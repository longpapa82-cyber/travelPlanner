import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  MaxLength,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ErrorLogBreadcrumbDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  level?: string;

  @IsOptional()
  @IsInt()
  timestamp?: number;

  @IsOptional()
  data?: Record<string, unknown>;
}

export class CreateErrorLogDto {
  @IsString()
  @MaxLength(500)
  errorMessage: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  stackTrace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  screen?: string;

  @IsOptional()
  @IsIn(['error', 'warning', 'fatal'])
  severity?: 'error' | 'warning' | 'fatal';

  @IsOptional()
  @IsString()
  @MaxLength(50)
  deviceOS?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  appVersion?: string;

  // V174 (P1): expanded client-reported context for higher-signal triage.

  @IsOptional()
  @IsString()
  @MaxLength(100)
  errorName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  routeName?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ErrorLogBreadcrumbDto)
  breadcrumbs?: ErrorLogBreadcrumbDto[];

  @IsOptional()
  @IsInt()
  httpStatus?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceModel?: string;
}
