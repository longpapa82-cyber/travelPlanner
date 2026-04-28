import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';
import { RevenueCatClient } from './revenuecat.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ProcessedWebhookEvent]),
    ConfigModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, RevenueCatClient],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
