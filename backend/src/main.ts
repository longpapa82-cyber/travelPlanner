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
import { initSentry } from './common/sentry';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AppModule } from './app.module';

// Initialize Sentry before app creation
initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
            "'unsafe-inline'",
            'https://pagead2.googlesyndication.com',
            'https://www.googletagmanager.com',
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://fonts.googleapis.com',
          ],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 'https://exp.host', 'https://api.openai.com'],
          frameSrc: ["'self'", 'https://pagead2.googlesyndication.com'],
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

  // Serve uploaded files with long-term cache (filenames contain unique timestamps)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: 31536000000, // 1 year in ms
    immutable: true,
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

  // Enable CORS — no wildcard fallback in production
  const corsOrigin = process.env.CORS_ORIGIN?.split(',');
  app.enableCors({
    origin: corsOrigin || [
      'http://localhost:8081',
      'http://localhost:19006',
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language', 'X-Request-ID'],
  });

  // Graceful shutdown — drain connections on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Global exception filter (consistent error responses + Sentry reporting)
  app.useGlobalFilters(new AllExceptionsFilter(app.getHttpAdapter()));

  // Global response envelope interceptor
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API documentation (only in non-production)
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('TravelPlanner API')
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
void bootstrap();
