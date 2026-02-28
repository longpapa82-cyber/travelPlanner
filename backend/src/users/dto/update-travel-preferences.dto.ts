import { IsOptional, IsString, IsArray, MaxLength } from 'class-validator';

export class UpdateTravelPreferencesDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  travelStyle?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];
}
