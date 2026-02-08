import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { AffiliateClick } from './entities/affiliate-click.entity';
import { TrackAffiliateClickDto } from './dto/track-affiliate-click.dto';
import { Request } from 'express';

export interface AffiliateStats {
  provider: string;
  totalClicks: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommission: number;
  averageCommission: number;
}

export interface AffiliateDailyStats {
  date: string;
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
}

@Injectable()
export class AffiliateService {
  private readonly logger = new Logger(AffiliateService.name);

  constructor(
    @InjectRepository(AffiliateClick)
    private affiliateClickRepository: Repository<AffiliateClick>,
  ) {}

  /**
   * 제휴 링크 클릭 추적
   */
  async trackClick(
    dto: TrackAffiliateClickDto,
    userId?: string,
    request?: Request,
  ): Promise<AffiliateClick> {
    try {
      const click = this.affiliateClickRepository.create({
        provider: dto.provider,
        destination: dto.destination,
        checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
        checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
        travelers: dto.travelers,
        trackingId: dto.trackingId,
        affiliateUrl: dto.affiliateUrl,
        referrer: dto.referrer,
        tripId: dto.tripId,
        userId: userId,
        metadata: dto.metadata,

        // Request 정보 추출
        ipAddress: request ? this.extractIpAddress(request) : undefined,
        userAgent: request ? request.headers['user-agent'] : undefined,
      });

      const saved = await this.affiliateClickRepository.save(click);

      this.logger.log(
        `Tracked affiliate click: ${dto.provider} - ${dto.destination || 'N/A'}`,
      );

      return saved;
    } catch (error) {
      this.logger.error(`Failed to track affiliate click: ${error.message}`);
      throw error;
    }
  }

  /**
   * 전환 업데이트 (제휴사 콜백용)
   */
  async updateConversion(
    clickId: string,
    conversionValue?: number,
    commission?: number,
  ): Promise<AffiliateClick> {
    const click = await this.affiliateClickRepository.findOne({
      where: { id: clickId },
    });

    if (!click) {
      throw new Error('Affiliate click not found');
    }

    click.converted = true;
    click.convertedAt = new Date();
    click.conversionValue = conversionValue;
    click.commission = commission;

    return await this.affiliateClickRepository.save(click);
  }

  /**
   * 제휴사별 통계 (기간별)
   */
  async getProviderStats(
    startDate?: Date,
    endDate?: Date,
  ): Promise<AffiliateStats[]> {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.createdAt = Between(startDate, endDate);
    } else if (startDate) {
      whereClause.createdAt = MoreThan(startDate);
    }

    const clicks = await this.affiliateClickRepository.find({
      where: whereClause,
    });

    // 제휴사별 그룹화
    const providerMap = new Map<string, AffiliateClick[]>();
    clicks.forEach((click) => {
      if (!providerMap.has(click.provider)) {
        providerMap.set(click.provider, []);
      }
      providerMap.get(click.provider)!.push(click);
    });

    // 통계 계산
    const stats: AffiliateStats[] = [];
    for (const [provider, providerClicks] of providerMap.entries()) {
      const totalClicks = providerClicks.length;
      const conversions = providerClicks.filter((c) => c.converted).length;
      const conversionRate =
        totalClicks > 0 ? (conversions / totalClicks) * 100 : 0;

      const totalRevenue = providerClicks
        .filter((c) => c.converted && c.conversionValue)
        .reduce((sum, c) => sum + Number(c.conversionValue), 0);

      const totalCommission = providerClicks
        .filter((c) => c.converted && c.commission)
        .reduce((sum, c) => sum + Number(c.commission), 0);

      const averageCommission =
        conversions > 0 ? totalCommission / conversions : 0;

      stats.push({
        provider,
        totalClicks,
        conversions,
        conversionRate,
        totalRevenue,
        totalCommission,
        averageCommission,
      });
    }

    // 클릭 수 기준 정렬
    return stats.sort((a, b) => b.totalClicks - a.totalClicks);
  }

  /**
   * 일별 통계
   */
  async getDailyStats(
    startDate: Date,
    endDate: Date,
    provider?: string,
  ): Promise<AffiliateDailyStats[]> {
    const whereClause: any = {
      createdAt: Between(startDate, endDate),
    };

    if (provider) {
      whereClause.provider = provider;
    }

    const clicks = await this.affiliateClickRepository.find({
      where: whereClause,
      order: { createdAt: 'ASC' },
    });

    // 날짜별 그룹화
    const dateMap = new Map<string, AffiliateClick[]>();
    clicks.forEach((click) => {
      const dateKey = click.createdAt.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(click);
    });

    // 일별 통계 생성
    const dailyStats: AffiliateDailyStats[] = [];
    for (const [date, dayClicks] of dateMap.entries()) {
      const conversions = dayClicks.filter((c) => c.converted).length;
      const revenue = dayClicks
        .filter((c) => c.converted && c.conversionValue)
        .reduce((sum, c) => sum + Number(c.conversionValue), 0);
      const commission = dayClicks
        .filter((c) => c.converted && c.commission)
        .reduce((sum, c) => sum + Number(c.commission), 0);

      dailyStats.push({
        date,
        clicks: dayClicks.length,
        conversions,
        revenue,
        commission,
      });
    }

    return dailyStats.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 사용자별 클릭 이력
   */
  async getUserClickHistory(
    userId: string,
    limit: number = 20,
  ): Promise<AffiliateClick[]> {
    return await this.affiliateClickRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * 여행별 클릭 이력
   */
  async getTripClickHistory(tripId: string): Promise<AffiliateClick[]> {
    return await this.affiliateClickRepository.find({
      where: { tripId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 전체 요약 통계
   */
  async getSummaryStats(days: number = 30): Promise<{
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    totalCommission: number;
    topProvider: string;
    topDestination: string;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const clicks = await this.affiliateClickRepository.find({
      where: {
        createdAt: MoreThan(startDate),
      },
    });

    const totalClicks = clicks.length;
    const conversions = clicks.filter((c) => c.converted);
    const totalConversions = conversions.length;
    const conversionRate =
      totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

    const totalRevenue = conversions
      .filter((c) => c.conversionValue)
      .reduce((sum, c) => sum + Number(c.conversionValue), 0);

    const totalCommission = conversions
      .filter((c) => c.commission)
      .reduce((sum, c) => sum + Number(c.commission), 0);

    // Top Provider
    const providerCounts = new Map<string, number>();
    clicks.forEach((c) => {
      providerCounts.set(c.provider, (providerCounts.get(c.provider) || 0) + 1);
    });
    const topProvider =
      Array.from(providerCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] || 'N/A';

    // Top Destination
    const destinationCounts = new Map<string, number>();
    clicks
      .filter((c) => c.destination)
      .forEach((c) => {
        destinationCounts.set(
          c.destination!,
          (destinationCounts.get(c.destination!) || 0) + 1,
        );
      });
    const topDestination =
      Array.from(destinationCounts.entries()).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0] || 'N/A';

    return {
      totalClicks,
      totalConversions,
      conversionRate,
      totalRevenue,
      totalCommission,
      topProvider,
      topDestination,
    };
  }

  /**
   * IP 주소 추출 (프록시 고려)
   */
  private extractIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }
}
