import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateClick } from './entities/affiliate-click.entity';
import { AnalyticsEvent } from './entities/analytics-event.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';
import { EventsController } from './events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AffiliateClick, AnalyticsEvent])],
  controllers: [AffiliateController, EventsController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AnalyticsModule {}
