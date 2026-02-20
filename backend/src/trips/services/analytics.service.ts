import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Trip, TripStatus } from '../entities/trip.entity';
import { getErrorMessage } from '../../common/types/request.types';

export interface DestinationStats {
  destination: string;
  country?: string;
  city?: string;
  tripCount: number;
  averageDuration: number;
  averageTravelers: number;
  popularMonths: number[];
}

export interface TravelTrend {
  destination: string;
  popularity: number;
  recentCount: number;
  averageBudget?: string;
  commonTravelStyle?: string;
  topInterests: string[];
}

export interface UserPreferenceStats {
  budgetDistribution: Record<string, number>;
  travelStyleDistribution: Record<string, number>;
  interestDistribution: Record<string, number>;
  averageDuration: number;
  averageTravelers: number;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Trip)
    private tripRepository: Repository<Trip>,
  ) {}

  /**
   * 최근 3개월 여행 데이터를 기반으로 인기 여행지 분석
   */
  async getPopularDestinations(
    limit: number = 10,
  ): Promise<DestinationStats[]> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
      // 최근 3개월 완료된 여행만 분석 (실제 여행 데이터)
      const trips = await this.tripRepository.find({
        where: {
          createdAt: MoreThan(threeMonthsAgo),
          status: TripStatus.COMPLETED,
        },
        relations: ['itineraries'],
      });

      // 여행지별로 그룹화
      const destinationMap = new Map<
        string,
        {
          trips: Trip[];
          country?: string;
          city?: string;
        }
      >();

      for (const trip of trips) {
        const key = trip.destination.toLowerCase();
        if (!destinationMap.has(key)) {
          destinationMap.set(key, {
            trips: [],
            country: trip.country,
            city: trip.city,
          });
        }
        destinationMap.get(key)!.trips.push(trip);
      }

      // 통계 계산
      const stats: DestinationStats[] = [];
      for (const [_destination, data] of destinationMap.entries()) {
        const tripCount = data.trips.length;

        // 평균 여행 기간 (일 수)
        const totalDuration = data.trips.reduce((sum, trip) => {
          const days =
            Math.ceil(
              (new Date(trip.endDate).getTime() -
                new Date(trip.startDate).getTime()) /
                (1000 * 60 * 60 * 24),
            ) + 1;
          return sum + days;
        }, 0);
        const averageDuration = Math.round(totalDuration / tripCount);

        // 평균 여행 인원
        const totalTravelers = data.trips.reduce(
          (sum, trip) => sum + trip.numberOfTravelers,
          0,
        );
        const averageTravelers = Math.round(totalTravelers / tripCount);

        // 인기 월 (여행 시작 월)
        const monthCounts: number[] = new Array(12).fill(0) as number[];
        data.trips.forEach((trip) => {
          const month = new Date(trip.startDate).getMonth();
          monthCounts[month]++;
        });
        const popularMonths = monthCounts
          .map((count, index) => ({ month: index, count }))
          .filter((m) => m.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((m) => m.month + 1); // 1-12로 변환

        stats.push({
          destination: data.trips[0].destination, // 원본 대소문자 유지
          country: data.country,
          city: data.city,
          tripCount,
          averageDuration,
          averageTravelers,
          popularMonths,
        });
      }

      // 인기도 순으로 정렬
      return stats.sort((a, b) => b.tripCount - a.tripCount).slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Failed to get popular destinations: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * 여행 트렌드 분석 (목적지별 선호도, 예산, 스타일 등)
   */
  async getTravelTrends(limit: number = 10): Promise<TravelTrend[]> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
      const trips = await this.tripRepository.find({
        where: {
          createdAt: MoreThan(threeMonthsAgo),
        },
      });

      // 여행지별로 그룹화
      const trendMap = new Map<string, Trip[]>();
      for (const trip of trips) {
        const key = trip.destination.toLowerCase();
        if (!trendMap.has(key)) {
          trendMap.set(key, []);
        }
        trendMap.get(key)!.push(trip);
      }

      // 트렌드 계산
      const trends: TravelTrend[] = [];
      for (const [_destination, tripList] of trendMap.entries()) {
        // 예산 분포
        const budgets = tripList
          .filter((t) => t.preferences?.budget)
          .map((t) => t.preferences!.budget!);
        const budgetCounts = this.countOccurrences(budgets);
        const commonBudget = this.getMostCommon(budgetCounts);

        // 여행 스타일 분포
        const styles = tripList
          .filter((t) => t.preferences?.travelStyle)
          .map((t) => t.preferences!.travelStyle!);
        const styleCounts = this.countOccurrences(styles);
        const commonStyle = this.getMostCommon(styleCounts);

        // 관심사 통계
        const allInterests: string[] = [];
        tripList.forEach((trip) => {
          if (trip.preferences?.interests) {
            allInterests.push(...trip.preferences.interests);
          }
        });
        const interestCounts = this.countOccurrences(allInterests);
        const topInterests = Object.entries(interestCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([interest]) => interest);

        trends.push({
          destination: tripList[0].destination,
          popularity: tripList.length,
          recentCount: tripList.filter((t) => {
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            return new Date(t.createdAt) > oneMonthAgo;
          }).length,
          averageBudget: commonBudget,
          commonTravelStyle: commonStyle,
          topInterests,
        });
      }

      return trends.sort((a, b) => b.popularity - a.popularity).slice(0, limit);
    } catch (error) {
      this.logger.error(
        `Failed to get travel trends: ${getErrorMessage(error)}`,
      );
      return [];
    }
  }

  /**
   * 사용자 선호도 통계
   */
  async getUserPreferenceStats(): Promise<UserPreferenceStats> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
      const trips = await this.tripRepository.find({
        where: {
          createdAt: MoreThan(threeMonthsAgo),
        },
      });

      // 예산 분포
      const budgets = trips
        .filter((t) => t.preferences?.budget)
        .map((t) => t.preferences!.budget!);
      const budgetDistribution = this.countOccurrences(budgets);

      // 여행 스타일 분포
      const styles = trips
        .filter((t) => t.preferences?.travelStyle)
        .map((t) => t.preferences!.travelStyle!);
      const travelStyleDistribution = this.countOccurrences(styles);

      // 관심사 분포
      const allInterests: string[] = [];
      trips.forEach((trip) => {
        if (trip.preferences?.interests) {
          allInterests.push(...trip.preferences.interests);
        }
      });
      const interestDistribution = this.countOccurrences(allInterests);

      // 평균 여행 기간
      const totalDuration = trips.reduce((sum, trip) => {
        const days =
          Math.ceil(
            (new Date(trip.endDate).getTime() -
              new Date(trip.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        return sum + days;
      }, 0);
      const averageDuration =
        trips.length > 0 ? Math.round(totalDuration / trips.length) : 0;

      // 평균 여행 인원
      const totalTravelers = trips.reduce(
        (sum, trip) => sum + trip.numberOfTravelers,
        0,
      );
      const averageTravelers =
        trips.length > 0 ? Math.round(totalTravelers / trips.length) : 0;

      return {
        budgetDistribution,
        travelStyleDistribution,
        interestDistribution,
        averageDuration,
        averageTravelers,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get user preference stats: ${getErrorMessage(error)}`,
      );
      return {
        budgetDistribution: {},
        travelStyleDistribution: {},
        interestDistribution: {},
        averageDuration: 0,
        averageTravelers: 0,
      };
    }
  }

  /**
   * 특정 여행지에 대한 추천 정보
   */
  async getDestinationRecommendations(destination: string): Promise<{
    recommendedDuration: number;
    recommendedTravelers: number;
    bestMonths: number[];
    budget?: string;
    travelStyle?: string;
    topActivities: string[];
  }> {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    try {
      const trips = await this.tripRepository.find({
        where: {
          createdAt: MoreThan(threeMonthsAgo),
        },
        relations: ['itineraries'],
      });

      // 해당 여행지 필터링 (부분 매칭)
      const relevantTrips = trips.filter(
        (trip) =>
          trip.destination.toLowerCase().includes(destination.toLowerCase()) ||
          destination.toLowerCase().includes(trip.destination.toLowerCase()),
      );

      if (relevantTrips.length === 0) {
        return {
          recommendedDuration: 5,
          recommendedTravelers: 2,
          bestMonths: [],
          topActivities: [],
        };
      }

      // 평균 여행 기간
      const totalDuration = relevantTrips.reduce((sum, trip) => {
        const days =
          Math.ceil(
            (new Date(trip.endDate).getTime() -
              new Date(trip.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        return sum + days;
      }, 0);
      const recommendedDuration = Math.round(
        totalDuration / relevantTrips.length,
      );

      // 평균 여행 인원 (이상치 제외: 50명 초과 데이터 cap 적용)
      const totalTravelers = relevantTrips.reduce(
        (sum, trip) => sum + Math.min(trip.numberOfTravelers, 50),
        0,
      );
      const recommendedTravelers = Math.min(
        Math.round(totalTravelers / relevantTrips.length),
        50,
      );

      // 인기 월
      const monthCounts: number[] = new Array(12).fill(0) as number[];
      relevantTrips.forEach((trip) => {
        const month = new Date(trip.startDate).getMonth();
        monthCounts[month]++;
      });
      const bestMonths = monthCounts
        .map((count, index) => ({ month: index + 1, count }))
        .filter((m) => m.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((m) => m.month);

      // 예산 추천
      const budgets = relevantTrips
        .filter((t) => t.preferences?.budget)
        .map((t) => t.preferences!.budget!);
      const budgetCounts = this.countOccurrences(budgets);
      const budget = this.getMostCommon(budgetCounts);

      // 여행 스타일 추천
      const styles = relevantTrips
        .filter((t) => t.preferences?.travelStyle)
        .map((t) => t.preferences!.travelStyle!);
      const styleCounts = this.countOccurrences(styles);
      const travelStyle = this.getMostCommon(styleCounts);

      // 인기 활동 (itinerary의 activities에서 추출)
      const allActivities: string[] = [];
      relevantTrips.forEach((trip) => {
        trip.itineraries?.forEach((itinerary) => {
          itinerary.activities?.forEach((activity) => {
            if (activity.title) {
              allActivities.push(activity.title);
            }
          });
        });
      });
      const activityCounts = this.countOccurrences(allActivities);
      const topActivities = Object.entries(activityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([activity]) => activity);

      return {
        recommendedDuration,
        recommendedTravelers,
        bestMonths,
        budget,
        travelStyle,
        topActivities,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get destination recommendations: ${getErrorMessage(error)}`,
      );
      return {
        recommendedDuration: 5,
        recommendedTravelers: 2,
        bestMonths: [],
        topActivities: [],
      };
    }
  }

  // Helper methods
  private countOccurrences(items: string[]): Record<string, number> {
    return items.reduce(
      (acc, item) => {
        acc[item] = (acc[item] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private getMostCommon(counts: Record<string, number>): string | undefined {
    const entries = Object.entries(counts);
    if (entries.length === 0) return undefined;

    return entries.sort((a, b) => b[1] - a[1])[0][0];
  }
}
