import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class AppleIdentityTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  identityToken: string;

  @IsString()
  @IsOptional()
  @MaxLength(256)
  fullName?: string;
}
