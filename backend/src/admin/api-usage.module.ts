import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiUsage } from './entities/api-usage.entity';
import { ApiUsageService } from './api-usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([ApiUsage])],
  providers: [ApiUsageService],
  exports: [ApiUsageService],
})
export class ApiUsageModule {}
