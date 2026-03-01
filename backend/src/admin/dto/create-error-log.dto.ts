import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';

export class CreateErrorLogDto {
  @IsString()
  @MaxLength(1000)
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
}
