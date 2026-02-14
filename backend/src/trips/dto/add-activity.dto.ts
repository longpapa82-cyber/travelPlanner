import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

const stripHtml = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;

export class AddActivityDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be in HH:MM format (00:00-23:59)',
  })
  time: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(stripHtml)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @Transform(stripHtml)
  description: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  @Transform(stripHtml)
  location: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDuration?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000000)
  estimatedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10000000)
  actualCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(stripHtml)
  type?: string;
}
