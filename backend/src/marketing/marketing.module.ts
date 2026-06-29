import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { ViralPost } from './entities/viral-post.entity';
import { MarketingContentService } from './content.service';
import { NaverEmailPublisher } from './naver-email.publisher';
import { PexelsService } from './pexels.service';
import { ScenarioService } from './scenario.service';
import { SelfBlogPublisher } from './self-blog.publisher';
import { MarketingScheduler } from './marketing.scheduler';

/**
 * Daily viral-marketing automation.
 *
 * - TypeOrmModule.forFeature([ViralPost]) for dedup + audit persistence.
 * - EmailModule reuses EmailService for the Naver draft email.
 * - ConfigModule is global, imported here for explicitness.
 *
 * No controller: the only entry points are the @Cron and the scheduler's
 * generateNow() manual trigger (callable from tests / an admin endpoint).
 */
@Module({
  imports: [TypeOrmModule.forFeature([ViralPost]), EmailModule, ConfigModule],
  providers: [
    ScenarioService,
    MarketingContentService,
    SelfBlogPublisher,
    NaverEmailPublisher,
    PexelsService,
    MarketingScheduler,
  ],
  exports: [MarketingScheduler],
})
export class MarketingModule {}
