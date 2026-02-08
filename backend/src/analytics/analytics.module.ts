import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AffiliateClick } from './entities/affiliate-click.entity';
import { AffiliateService } from './affiliate.service';
import { AffiliateController } from './affiliate.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AffiliateClick])],
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AnalyticsModule {}
