import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

/**
 * V187 P0-B: Strict DTO replacing the inline `{ sku?: string }` body.
 *
 * Inline TypeScript types are not seen by class-validator, so the global
 * `forbidNonWhitelisted: true` ValidationPipe never enforced shape on
 * preflight payloads. A patched client could submit arbitrary keys and
 * have them flow into logger.log (CRLF log injection) or future fields
 * (mass assignment). This DTO closes both holes.
 *
 * SKU shape rule: Google Play product IDs are lowercase alphanumeric +
 * underscore, max 40 chars per Play Console limits. The regex rejects
 * embedded newlines/control chars that would corrupt server logs.
 */
export class PreflightPurchaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9_.-]+$/, {
    message: 'sku must be lowercase alphanumeric, dot, dash, or underscore',
  })
  sku?: string;
}
