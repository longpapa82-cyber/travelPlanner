import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  MaxLength,
  IsArray,
  IsObject,
  ArrayMaxSize,
} from 'class-validator';

// V176: breadcrumbs are stored as JSONB and consumed by the admin UI as
// freeform objects. The previous `ValidateNested + Type` shape combined with
// the global `forbidNonWhitelisted: true` ValidationPipe rejected the entire
// payload whenever the client added a Sentry-style key (event_id, type, etc.)
// that wasn't on the DTO. Result: 4/25 logged 0 rows because the client had
// already migrated to the V174 shape but the DTO rejected unknown keys.
//
// Fix: accept any object array, cap size to bound DB writes, and rely on the
// admin UI to render whatever keys are present. We sanitize for size, not
// shape — error logs are diagnostic data, not user input.
const MAX_BREADCRUMBS = 50;

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
  @ArrayMaxSize(MAX_BREADCRUMBS)
  @IsObject({ each: true })
  breadcrumbs?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsInt()
  httpStatus?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceModel?: string;
}
