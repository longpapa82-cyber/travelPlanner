import api from './api';

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

export interface DestinationRecommendations {
  recommendedDuration: number;
  recommendedTravelers: number;
  bestMonths: number[];
  budget?: string;
  travelStyle?: string;
  topActivities: string[];
}

class AnalyticsService {
  /**
   * 최근 3개월 인기 여행지 조회
   */
  async getPopularDestinations(limit: number = 10): Promise<DestinationStats[]> {
    try {
      const response = await api.get<DestinationStats[]>('/analytics/popular-destinations', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch popular destinations:', error);
      return [];
    }
  }

  /**
   * 여행 트렌드 분석
   */
  async getTravelTrends(limit: number = 10): Promise<TravelTrend[]> {
    try {
      const response = await api.get<TravelTrend[]>('/analytics/travel-trends', {
        params: { limit },
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch travel trends:', error);
      return [];
    }
  }

  /**
   * 사용자 선호도 통계
   */
  async getUserPreferences(): Promise<UserPreferenceStats | null> {
    try {
      const response = await api.get<UserPreferenceStats>('/analytics/user-preferences');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch user preferences:', error);
      return null;
    }
  }

  /**
   * 특정 여행지에 대한 추천 정보
   */
  async getDestinationRecommendations(
    destination: string,
  ): Promise<DestinationRecommendations | null> {
    try {
      const response = await api.get<DestinationRecommendations>(
        '/analytics/destination-recommendations',
        {
          params: { destination },
        },
      );
      return response.data;
    } catch (error) {
      console.error('Failed to fetch destination recommendations:', error);
      return null;
    }
  }

  /**
   * 월 이름 가져오기 (1-12)
   */
  getMonthName(month: number): string {
    const months = [
      '1월', '2월', '3월', '4월', '5월', '6월',
      '7월', '8월', '9월', '10월', '11월', '12월',
    ];
    return months[month - 1] || '';
  }

  /**
   * 월 숫자를 영문 약어로 변환
   */
  getMonthAbbr(month: number): string {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return months[month - 1] || '';
  }
}

export default new AnalyticsService();
