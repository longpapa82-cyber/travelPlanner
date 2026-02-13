import {
  IsString,
  IsDateString,
  IsOptional,
  IsInt,
  IsNumber,
  Min,
  IsObject,
  IsArray,
  MaxLength,
} from 'class-validator';

export class CreateTripDto {
  @IsString()
  @MaxLength(200)
  destination: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  country?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalBudget?: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  budgetCurrency?: string;
}
