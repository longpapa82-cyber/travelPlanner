import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';
import { initSentry } from './common/sentry';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppModule } from './app.module';

// Initialize Sentry before app creation
initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

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
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", 'https://exp.host', 'https://api.openai.com'],
          frameSrc: ["'self'", 'https://pagead2.googlesyndication.com'],
        },
      },
      crossOriginEmbedderPolicy: false, // Allow cross-origin images
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow CDN assets
      crossOriginOpenerPolicy: false, // Allow OAuth redirect flow
    }),
  );

  // Serve uploaded files with long-term cache (filenames contain unique timestamps)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    maxAge: 31536000000, // 1 year in ms
    immutable: true,
  });

  // Global prefix for all routes
  app.setGlobalPrefix(process.env.API_PREFIX || 'api');

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
  });

  // Global exception filter (consistent error responses + Sentry reporting)
  app.useGlobalFilters(new AllExceptionsFilter(app.getHttpAdapter()));

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

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(
    `Application is running on: http://localhost:${port}/${process.env.API_PREFIX || 'api'}`,
  );
}
bootstrap();
