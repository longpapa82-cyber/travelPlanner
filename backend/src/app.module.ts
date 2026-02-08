import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { AnalyticsModule } from './analytics/analytics.module';

import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import oauthConfig from './config/oauth.config';

@Module({
  imports: [
    // Config Module - Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, oauthConfig],
      envFilePath: ['.env'],
    }),

    // Schedule Module - Cron jobs
    ScheduleModule.forRoot(),

    // TypeORM Module - Database connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions =>
        configService.get<TypeOrmModuleOptions>('database')!,
    }),

    // Feature Modules
    UsersModule,
    AuthModule,
    TripsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
