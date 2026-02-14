import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { ShareController } from './share.controller';
import { AnalyticsController } from './analytics.controller';
import { Trip } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { Collaborator } from './entities/collaborator.entity';
import { AIService } from './services/ai.service';
import { TimezoneService } from './services/timezone.service';
import { WeatherService } from './services/weather.service';
import { AnalyticsService } from './services/analytics.service';
import { TripStatusScheduler } from './trip-status.scheduler';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ImageService } from '../common/image.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Itinerary, Collaborator, User]),
    ConfigModule,
    NotificationsModule,
  ],
  providers: [
    TripsService,
    AIService,
    TimezoneService,
    WeatherService,
    AnalyticsService,
    TripStatusScheduler,
    ImageService,
  ],
  controllers: [TripsController, ShareController, AnalyticsController],
  exports: [TripsService, AnalyticsService],
})
export class TripsModule {}
