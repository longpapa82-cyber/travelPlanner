import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  Max,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { IsAfterDate } from '../../common/validators/is-after-date.validator';

/** Strip HTML tags to prevent stored XSS */
const stripHtml = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;

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
  @IsOptional()
  numberOfTravelers?: number;

  @IsObject()
  @IsOptional()
  preferences?: {
    budget?: string;
    travelStyle?: string;
    interests?: string[];
  };

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
