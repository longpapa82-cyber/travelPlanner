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
import { Transform } from 'class-transformer';
import { maskPii } from '../../common/utils/sanitize';

/**
 * V187 P1-C (Security #2): per-breadcrumb size cap.
 *
 * @ArrayMaxSize(50) bounds the count, but each object's value can still be
 * an arbitrarily long string (1MB each = 50MB request body). NestJS body
 * parser default is 1MB but mass-write attempts via the queue replay path
 * could still flood error_logs.jsonb. We cap each breadcrumb's serialized
 * length and truncate noisy fields, preserving diagnostic value while
 * making storage exhaustion infeasible.
 */
const MAX_BREADCRUMB_VALUE_LEN = 500;
const MAX_BREADCRUMB_KEY_LEN = 100;

const sanitizeBreadcrumbs = (
  raw: unknown,
): Array<Record<string, unknown>> | undefined => {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .filter((b) => b && typeof b === 'object')
    .slice(0, 50)
    .map((b) => {
      const entries = Object.entries(b as Record<string, unknown>).slice(0, 20);
      const out: Record<string, unknown> = {};
      for (const [k, v] of entries) {
        const safeKey = String(k).slice(0, MAX_BREADCRUMB_KEY_LEN);
        if (typeof v === 'string') {
          out[safeKey] = v.slice(0, MAX_BREADCRUMB_VALUE_LEN);
        } else if (v == null || ['number', 'boolean'].includes(typeof v)) {
          out[safeKey] = v;
        } else {
          // Nested objects are stringified + truncated so the JSONB column
          // never receives an unbounded structure.
          try {
            out[safeKey] = JSON.stringify(v).slice(0, MAX_BREADCRUMB_VALUE_LEN);
          } catch {
            out[safeKey] = '[unserializable]';
          }
        }
      }
      return out;
    });
};

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
  // E13: mask PII (email/JWT/credential kv) on the client-report path too, so
  // all three write paths (filter, service, this DTO) redact consistently.
  @Transform(({ value }) => maskPii(value) ?? value)
  @IsString()
  @MaxLength(500)
  errorMessage: string;

  // E03: the global filter returns `message` as an array, and the frontend 5xx
  // auto-reporter forwards that value here as `stackTrace`. Accept both string
  // and string[] by normalizing an array into a newline-joined string BEFORE
  // @IsString validation, so array-shaped reports are no longer rejected with
  // 400 (which silently dropped the client-side device/app-version context of
  // every 5xx). String clients are unaffected (pass-through).
  // E13: mask PII after the array→string normalization.
  @IsOptional()
  @Transform(({ value }) => {
    const joined = Array.isArray(value)
      ? value.map((v) => String(v)).join('\n')
      : value;
    return maskPii(joined) ?? joined;
  })
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
  // V187 P1-C: serialized payload is bounded per-breadcrumb at the DTO
  // boundary so storage exhaustion via the JSONB column is infeasible.
  @Transform(({ value }) => sanitizeBreadcrumbs(value))
  breadcrumbs?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsInt()
  httpStatus?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceModel?: string;
}
