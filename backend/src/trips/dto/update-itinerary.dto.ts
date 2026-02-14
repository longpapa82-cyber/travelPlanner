import {
  IsArray,
  IsOptional,
  IsString,
  IsBoolean,
  IsNumber,
  ValidateNested,
  MaxLength,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

const stripHtml = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;

export class ActivityDto {
  @IsString()
  @Matches(/^([01]?\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be in HH:MM format (00:00-23:59)',
  })
  time: string;

  @IsString()
  @MaxLength(200)
  @Transform(stripHtml)
  title: string;

  @IsString()
  @MaxLength(2000)
  @Transform(stripHtml)
  description: string;

  @IsString()
  @MaxLength(300)
  @Transform(stripHtml)
  location: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  estimatedDuration?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10000000)
  estimatedCost?: number;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  @Transform(stripHtml)
  type?: string;
}

export class UpdateItineraryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDto)
  @IsOptional()
  activities?: ActivityDto[];

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  @Transform(stripHtml)
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isCompleted?: boolean;
}
