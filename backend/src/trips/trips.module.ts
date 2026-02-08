import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { ShareController } from './share.controller';
import { AnalyticsController } from './analytics.controller';
import { Trip } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { AIService } from './services/ai.service';
import { TimezoneService } from './services/timezone.service';
import { WeatherService } from './services/weather.service';
import { AnalyticsService } from './services/analytics.service';
import { TripStatusScheduler } from './trip-status.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, Itinerary]), ConfigModule],
  providers: [
    TripsService,
    AIService,
    TimezoneService,
    WeatherService,
    AnalyticsService,
    TripStatusScheduler,
  ],
  controllers: [TripsController, ShareController, AnalyticsController],
  exports: [TripsService, AnalyticsService],
})
export class TripsModule {}
