import { IsString, IsNotEmpty } from 'class-validator';

export class ExchangeOAuthCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
