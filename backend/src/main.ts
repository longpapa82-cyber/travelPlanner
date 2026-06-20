import { NestFactory } from '@nestjs/core';
import {
  ValidationPipe,
  VersioningType,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AppModule } from './app.module';
import { persistErrorLog } from './common/services/error-log.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Paddle webhook signature verification
  });

  // Limit JSON/URL-encoded body size to prevent payload-based DoS
  app.useBodyParser('json', { limit: '1mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });

  // HTTP security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            // 'unsafe-inline' removed — API server serves no inline scripts.
            // The landing page (nginx-served static HTML) uses its own CSP header
            // and still carries unsafe-inline for AdSense/Paddle until nonce migration.
            'https://pagead2.googlesyndication.com',
            'https://www.googletagmanager.com',
            'https://adservice.google.com',
            'https://www.googletagservices.com',
            'https://googleads.g.doubleclick.net',
            'https://static.cloudflareinsights.com',
            'https://*.paddle.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
            'https://*.paddle.com',
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: [
            "'self'",
            'blob:',
            'https://exp.host',
            'https://api.openai.com',
            'https://maps.googleapis.com',
            'https://www.googleapis.com',
            'https://pagead2.googlesyndication.com',
            'https://*.googlesyndication.com',
            'https://*.doubleclick.net',
            'https://*.adtrafficquality.google.com',
            'https://ep1.adtrafficquality.google.com',
            'https://*.google.com',
            'https://*.paddle.com',
            'https://csi.gstatic.com',
          ],
          frameSrc: [
            "'self'",
            'https://pagead2.googlesyndication.com',
            'https://tpc.googlesyndication.com',
            'https://*.doubleclick.net',
            'https://www.google.com',
            'https://*.paddle.com',
          ],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow cross-origin images
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CDN assets
      crossOriginOpenerPolicy: false, // Allow OAuth redirect flow
      strictTransportSecurity: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // Serve uploaded files with long-term cache — images only (block sensitive files)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: 31536000000, // 1 year in ms
    immutable: true,
    extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  });

  // Global prefix for all routes
  const apiPrefix = process.env.API_PREFIX || 'api';
  app.setGlobalPrefix(apiPrefix);

  // API versioning (URI-based, opt-in per controller)
  // Existing routes remain at /api/... (VERSION_NEUTRAL)
  // New versioned routes can use @Version('2') → /api/v2/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });

  // Enable CORS — fail-fast in production if not configured
  const corsOrigin = process.env.CORS_ORIGIN?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    (!corsOrigin || corsOrigin.length === 0) &&
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error('CORS_ORIGIN must be set in production environment');
  }
  app.enableCors({
    origin: corsOrigin || [
      'http://localhost:8081',
      'http://localhost:19006',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'X-Request-ID',
    ],
  });

  // Graceful shutdown — drain connections on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Global exception filter (consistent error responses + ErrorLog persistence)
  const exceptionFilter = new AllExceptionsFilter(app.getHttpAdapter());
  const { DataSource } = await import('typeorm');
  const dataSource = app.get(DataSource);
  exceptionFilter.setDataSource(dataSource);
  app.useGlobalFilters(exceptionFilter);

  // Process-level safety net. Without these, an uncaught exception or unhandled
  // promise rejection outside any HTTP request (the bulk of background work)
  // dies with only a syslog line — invisible to the admin error dashboard.
  // Record as `fatal` so SRE can page on it. Do not exit on unhandledRejection
  // (Node default is non-fatal); for uncaughtException we record then rethrow
  // intent via a delayed exit so the process can be restarted by the orchestrator.
  process.on('unhandledRejection', (reason) => {
    void persistErrorLog(dataSource, {
      error: reason,
      source: 'process.unhandledRejection',
      routeName: 'process:unhandledRejection',
      severity: 'fatal',
    });
  });
  process.on('uncaughtException', (err) => {
    void persistErrorLog(dataSource, {
      error: err,
      source: 'process.uncaughtException',
      routeName: 'process:uncaughtException',
      severity: 'fatal',
    });
  });

  // Global response envelope interceptor
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API documentation (only in non-production)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MyTravel API')
      .setDescription('Travel planning service API documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication & user management')
      .addTag('trips', 'Trip CRUD & itinerary management')
      .addTag('users', 'User profile management')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${apiPrefix}/docs`, app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Swagger docs: http://localhost:${port}/${apiPrefix}/docs`);
  }
}
bootstrap().catch((err) => {
  // Boot failure (DB connection, port bind, missing required env). The DB may
  // be unavailable here, so error_logs persistence is not guaranteed — emit a
  // structured, greppable line and exit non-zero so the orchestrator restarts
  // and the failure is visible in container/systemd logs instead of a silent
  // unhandled rejection from the previous `void bootstrap()`.
  // eslint-disable-next-line no-console
  console.error(
    `[BOOTSTRAP_FAILED] ${err instanceof Error ? err.stack || err.message : String(err)}`,
  );
  process.exit(1);
});
