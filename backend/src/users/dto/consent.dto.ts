import { IsEnum, IsBoolean, IsString, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ConsentType } from '../entities/user-consent.entity';

export class ConsentItemDto {
  @IsEnum(ConsentType)
  type: ConsentType;

  @IsString()
  version: string;

  @IsBoolean()
  isConsented: boolean;
}

export class UpdateConsentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConsentItemDto)
  consents: ConsentItemDto[];
}

export class ConsentResponseDto {
  type: ConsentType;
  version: string;
  isConsented: boolean;
  consentedAt?: Date;
  isRequired: boolean;
  requiresUpdate: boolean;
  description?: string;
  benefits?: string[];
}

export class ConsentsStatusDto {
  consents: ConsentResponseDto[];
  needsConsent: boolean;
  needsUpdate: boolean;
}
