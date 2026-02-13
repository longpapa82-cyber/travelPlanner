import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  IsObject,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { TripStatus } from '../entities/trip.entity';

export class UpdateTripDto {
  @IsString()
  @MaxLength(200)
  @IsOptional()
  destination?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
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
  @IsOptional()
  totalBudget?: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  budgetCurrency?: string;
}
