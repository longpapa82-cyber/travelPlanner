import { IsString, IsOptional, IsObject } from 'class-validator';

/**
 * RevenueCat webhook DTO.
 * The event object is kept loosely typed because RevenueCat sends many
 * additional properties that evolve over time.  Strict whitelist validation
 * would reject unknown fields and break the webhook.
 */
export class RevenueCatWebhookDto {
  @IsString()
  @IsOptional()
  api_version?: string;

  @IsObject()
  event: Record<string, any>;
}
