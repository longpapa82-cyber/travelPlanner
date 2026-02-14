import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsObject,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TripStatus } from '../entities/trip.entity';
import { IsAfterDate } from '../../common/validators/is-after-date.validator';

const stripHtml = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;

export class UpdateTripDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  @Transform(stripHtml)
  destination?: string;

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
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  @IsAfterDate('startDate', { message: 'endDate must be on or after startDate' })
  endDate?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  @Transform(stripHtml)
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfTravelers?: number;

  @IsObject()
  @IsOptional()
  preferences?: {
    budget?: string;
    travelStyle?: string;
    interests?: string[];
  };

  @IsEnum(TripStatus)
  @IsOptional()
  status?: TripStatus;

  @IsString()
  @IsOptional()
  coverImage?: string;

  @IsNumber()
  @Min(0)
  @Max(100000000)
  @IsOptional()
  totalBudget?: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  budgetCurrency?: string;
}
