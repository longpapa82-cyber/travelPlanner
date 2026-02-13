import { IsString, Length } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class TwoFactorLoginDto {
  @IsString()
  @Length(6, 8) // 6 for TOTP, 8 for backup code
  code: string;
}
