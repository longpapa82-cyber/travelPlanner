import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { TripsService } from './trips.service';
import { TripsController } from './trips.controller';
import { ShareController } from './share.controller';
import { AnalyticsController } from './analytics.controller';
import { TemplateController } from './template.controller';
import { SeedTemplatesCommand } from './commands/seed-templates.command';
import { Trip } from './entities/trip.entity';
import { Itinerary } from './entities/itinerary.entity';
import { ItineraryTemplate } from './entities/itinerary-template.entity';
import { Collaborator } from './entities/collaborator.entity';
import { AIService } from './services/ai.service';
import { TemplateService } from './services/template.service';
import { EmbeddingService } from './services/embedding.service';
import { TimezoneService } from './services/timezone.service';
import { WeatherService } from './services/weather.service';
import { AnalyticsService } from './services/analytics.service';
import { TemplateWarmupService } from './services/template-warmup.service';
import { TripStatusScheduler } from './trip-status.scheduler';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ImageService } from '../common/image.service';
import { GeocodingService } from '../common/services/geocoding.service';
import { GeocodingCache } from '../common/entities/geocoding-cache.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, Itinerary, ItineraryTemplate, Collaborator, User, GeocodingCache]),
    ConfigModule,
    NotificationsModule,
    SubscriptionModule,
  ],
  providers: [
    TripsService,
    AIService,
    TemplateService,
    EmbeddingService,
    SeedTemplatesCommand,
    TemplateWarmupService,
    TimezoneService,
    WeatherService,
    AnalyticsService,
    TripStatusScheduler,
    ImageService,
    GeocodingService,
  ],
  controllers: [TripsController, ShareController, AnalyticsController, TemplateController],
  exports: [TripsService, AnalyticsService, TemplateService],
})
export class TripsModule {}
