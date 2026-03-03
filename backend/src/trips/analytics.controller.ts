import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './services/analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * GET /api/analytics/popular-destinations
   * 최근 3개월 인기 여행지 조회
   */
  @Get('popular-destinations')
  async getPopularDestinations(@Query('limit') limit?: string) {
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '10', 10) || 10));
    return this.analyticsService.getPopularDestinations(limitNum);
  }

  /**
   * GET /api/analytics/travel-trends
   * 여행 트렌드 분석 (목적지별 선호도, 예산, 스타일 등)
   */
  @Get('travel-trends')
  async getTravelTrends(@Query('limit') limit?: string) {
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '10', 10) || 10));
    return this.analyticsService.getTravelTrends(limitNum);
  }

  /**
   * GET /api/analytics/user-preferences
   * 사용자 선호도 통계
   */
  @Get('user-preferences')
  async getUserPreferences() {
    return this.analyticsService.getUserPreferenceStats();
  }

  /**
   * GET /api/analytics/destination-recommendations?destination=도쿄
   * 특정 여행지에 대한 추천 정보
   */
  @Get('destination-recommendations')
  async getDestinationRecommendations(
    @Query('destination') destination: string,
  ) {
    if (!destination) {
      return {
        error: 'destination parameter is required',
      };
    }
    return this.analyticsService.getDestinationRecommendations(destination);
  }
}
