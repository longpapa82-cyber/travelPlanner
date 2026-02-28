import { IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateConversionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  conversionValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  commission?: number;
}
