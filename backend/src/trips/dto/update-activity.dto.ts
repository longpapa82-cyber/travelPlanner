import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { stripHtml } from '../../common/utils/sanitize';

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be in HH:MM format (00:00-23:59)',
  })
  time?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(stripHtml)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Transform(stripHtml)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @Transform(stripHtml)
  location?: string;

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
  @MaxLength(50)
  @Transform(stripHtml)
  type?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
