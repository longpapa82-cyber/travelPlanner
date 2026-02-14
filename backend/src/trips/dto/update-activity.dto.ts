import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

const stripHtml = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/<[^>]*>/g, '') : value;

export class UpdateActivityDto {
  @IsOptional()
  @IsString()
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
  estimatedCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
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
