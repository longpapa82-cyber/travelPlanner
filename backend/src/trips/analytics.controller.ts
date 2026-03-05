import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AnalyticsService } from './services/analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/analytics/popular-destinations
   * 최근 3개월 인기 여행지 조회 (인증된 사용자 모두 접근 가능)
   */
  @Get('popular-destinations')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 30 } })
  async getPopularDestinations(@Query('limit') limit?: string) {
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit || '10', 10) || 10),
    );
    return this.analyticsService.getPopularDestinations(limitNum);
  }

  /**
   * GET /api/analytics/travel-trends
   * 여행 트렌드 분석 (관리자 전용)
   */
  @Get('travel-trends')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getTravelTrends(@Query('limit') limit?: string) {
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit || '10', 10) || 10),
    );
    return this.analyticsService.getTravelTrends(limitNum);
  }

  /**
   * GET /api/analytics/user-preferences
   * 사용자 선호도 통계 (관리자 전용)
   */
  @Get('user-preferences')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserPreferences() {
    return this.analyticsService.getUserPreferenceStats();
  }

  /**
   * GET /api/analytics/destination-recommendations?destination=도쿄
   * 특정 여행지에 대한 추천 정보 (인증된 사용자 모두 접근 가능)
   */
  @Get('destination-recommendations')
  @UseGuards(JwtAuthGuard)
  @Throttle({ short: { ttl: 60000, limit: 20 } })
  async getDestinationRecommendations(
    @Query('destination') destination: string,
  ) {
    if (!destination?.trim()) {
      throw new BadRequestException('destination parameter is required');
    }
    return this.analyticsService.getDestinationRecommendations(destination);
  }
}
