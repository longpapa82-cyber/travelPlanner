import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { DevThrottlerGuard } from './common/guards/dev-throttler.guard';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule as TypeOrmFeatureModule } from '@nestjs/typeorm';
import { Trip } from './trips/entities/trip.entity';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExpensesModule } from './expenses/expenses.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

import { AppCacheModule } from './common/cache.module';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import oauthConfig from './config/oauth.config';
import emailConfig from './config/email.config';

@Module({
  imports: [
    // Config Module - Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, oauthConfig, emailConfig],
      envFilePath: ['.env'],
    }),

    // Schedule Module - Cron jobs
    ScheduleModule.forRoot(),

    // Throttler Module - Rate limiting
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'short',
          ttl: 1000,
          limit: 10,
        },
        {
          name: 'medium',
          ttl: 60000,
          limit: 100,
        },
      ],
    }),

    // TypeORM Module - Database connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions =>
        configService.get<TypeOrmModuleOptions>('database')!,
    }),

    // Cache Module - Redis/Memory caching
    AppCacheModule,

    // Entity for AppController (sitemap, OG tags)
    TypeOrmFeatureModule.forFeature([Trip]),

    // Feature Modules
    UsersModule,
    AuthModule,
    TripsModule,
    AnalyticsModule,
    NotificationsModule,
    ExpensesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: DevThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
