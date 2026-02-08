import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { AffiliateService } from './affiliate.service';
import { TrackAffiliateClickDto } from './dto/track-affiliate-click.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Request } from 'express';

@Controller('analytics/affiliate')
export class AffiliateController {
  constructor(private readonly affiliateService: AffiliateService) {}

  /**
   * POST /api/analytics/affiliate/track
   * 제휴 링크 클릭 추적
   *
   * 인증 선택: 로그인 사용자는 userId 저장, 비로그인은 익명 추적
   */
  @Post('track')
  @UseGuards(OptionalJwtAuthGuard)
  async trackClick(
    @Body() dto: TrackAffiliateClickDto,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    const userId = req.user?.userId;
    const click = await this.affiliateService.trackClick(dto, userId, req);

    return {
      success: true,
      clickId: click.id,
      message: 'Affiliate click tracked successfully',
    };
  }

  /**
   * POST /api/analytics/affiliate/conversion/:clickId
   * 전환 업데이트 (제휴사 콜백용)
   *
   * 관리자 전용 또는 제휴사 webhook
   */
  @Post('conversion/:clickId')
  @UseGuards(JwtAuthGuard) // TODO: Admin guard or webhook authentication
  async updateConversion(
    @Param('clickId') clickId: string,
    @Body() body: { conversionValue?: number; commission?: number },
  ) {
    const click = await this.affiliateService.updateConversion(
      clickId,
      body.conversionValue,
      body.commission,
    );

    return {
      success: true,
      click,
      message: 'Conversion updated successfully',
    };
  }

  /**
   * GET /api/analytics/affiliate/stats
   * 제휴사별 통계 (관리자용)
   *
   * Query params:
   * - startDate: ISO format (optional)
   * - endDate: ISO format (optional)
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard) // TODO: Admin guard
  async getProviderStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    const stats = await this.affiliateService.getProviderStats(start, end);

    return {
      success: true,
      stats,
    };
  }

  /**
   * GET /api/analytics/affiliate/daily
   * 일별 통계 (관리자용)
   *
   * Query params:
   * - startDate: ISO format (required)
   * - endDate: ISO format (required)
   * - provider: 제휴사 필터 (optional)
   */
  @Get('daily')
  @UseGuards(JwtAuthGuard) // TODO: Admin guard
  async getDailyStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('provider') provider?: string,
  ) {
    if (!startDate || !endDate) {
      return {
        success: false,
        message: 'startDate and endDate are required',
      };
    }

    const stats = await this.affiliateService.getDailyStats(
      new Date(startDate),
      new Date(endDate),
      provider,
    );

    return {
      success: true,
      stats,
    };
  }

  /**
   * GET /api/analytics/affiliate/summary
   * 전체 요약 통계 (관리자용)
   *
   * Query params:
   * - days: 통계 기간 (기본: 30일)
   */
  @Get('summary')
  @UseGuards(JwtAuthGuard) // TODO: Admin guard
  async getSummaryStats(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const summary = await this.affiliateService.getSummaryStats(days);

    return {
      success: true,
      summary,
    };
  }

  /**
   * GET /api/analytics/affiliate/my-clicks
   * 내 클릭 이력 (사용자용)
   *
   * Query params:
   * - limit: 조회 개수 (기본: 20)
   */
  @Get('my-clicks')
  @UseGuards(JwtAuthGuard)
  async getMyClickHistory(
    @Req() req: Request & { user: { userId: string } },
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const clicks = await this.affiliateService.getUserClickHistory(
      req.user.userId,
      limit,
    );

    return {
      success: true,
      clicks,
    };
  }

  /**
   * GET /api/analytics/affiliate/trip/:tripId
   * 여행별 클릭 이력
   */
  @Get('trip/:tripId')
  @UseGuards(JwtAuthGuard)
  async getTripClickHistory(@Param('tripId') tripId: string) {
    const clicks = await this.affiliateService.getTripClickHistory(tripId);

    return {
      success: true,
      clicks,
    };
  }
}
