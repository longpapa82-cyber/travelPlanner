import { IsString, IsOptional, IsInt, IsUrl, IsDateString, Min, IsObject } from 'class-validator';

export class TrackAffiliateClickDto {
  /**
   * 제휴 파트너
   * @example 'booking'
   */
  @IsString()
  provider: string;

  /**
   * 여행 목적지
   * @example '도쿄'
   */
  @IsOptional()
  @IsString()
  destination?: string;

  /**
   * 체크인 날짜 (ISO format)
   * @example '2026-03-01'
   */
  @IsOptional()
  @IsDateString()
  checkIn?: string;

  /**
   * 체크아웃 날짜 (ISO format)
   * @example '2026-03-05'
   */
  @IsOptional()
  @IsDateString()
  checkOut?: string;

  /**
   * 여행 인원
   * @example 2
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  travelers?: number;

  /**
   * 추적 ID
   * @example 'trip_123'
   */
  @IsOptional()
  @IsString()
  trackingId?: string;

  /**
   * 생성된 제휴 URL
   */
  @IsOptional()
  @IsUrl()
  affiliateUrl?: string;

  /**
   * Referrer URL
   */
  @IsOptional()
  @IsString()
  referrer?: string;

  /**
   * 연관된 여행 ID
   */
  @IsOptional()
  @IsString()
  tripId?: string;

  /**
   * 추가 메타데이터
   */
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
