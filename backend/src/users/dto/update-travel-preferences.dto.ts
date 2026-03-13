import { IsOptional, IsString, IsArray, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { stripHtml } from '../../common/utils/sanitize';

export class UpdateTravelPreferencesDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(stripHtml)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(stripHtml)
  travelStyle?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((v: string) => typeof v === 'string' ? v.replace(/<[^>]*>/g, '') : v)
      : value,
  )
  interests?: string[];
}
