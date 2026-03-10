import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  IsIn,
  Min,
  Max,
  IsObject,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { IsAfterDate } from '../../common/validators/is-after-date.validator';
import { stripHtml } from '../../common/utils/sanitize';

class TripPreferencesDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(stripHtml)
  budget?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(stripHtml)
  travelStyle?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v: string) =>
          typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : v,
        )
      : value,
  )
  interests?: string[];
}

export class CreateTripDto {
  @IsString()
  @MaxLength(200)
  @Transform(stripHtml)
  destination: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(stripHtml)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Transform(stripHtml)
  city?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  @IsAfterDate('startDate', {
    message: 'endDate must be on or after startDate',
  })
  endDate: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  @Transform(stripHtml)
  description?: string;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  numberOfTravelers?: number;

  @IsObject()
  @ValidateNested()
  @Type(() => TripPreferencesDto)
  @IsOptional()
  preferences?: TripPreferencesDto;

  @IsNumber()
  @Min(1)
  @Max(100000000)
  @IsOptional()
  totalBudget?: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  budgetCurrency?: string;

  @IsString()
  @IsIn(['ai', 'manual'])
  @IsOptional()
  planningMode?: 'ai' | 'manual';
}
