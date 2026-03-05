import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RevenueCatEvent {
  @IsString()
  type: string;

  @IsString()
  @IsOptional()
  app_user_id?: string;

  @IsString()
  @IsOptional()
  product_id?: string;

  @IsString()
  @IsOptional()
  store?: string;

  @IsString()
  @IsOptional()
  expiration_at_ms?: string;

  @IsString()
  @IsOptional()
  environment?: string;
}

export class RevenueCatWebhookDto {
  @IsString()
  @IsOptional()
  api_version?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => RevenueCatEvent)
  event: RevenueCatEvent;
}
