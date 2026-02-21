import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUUID,
  IsArray,
  IsDateString,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { SplitMethod, ExpenseCategory } from '../entities/expense.entity';
import { stripHtml } from '../../common/utils/sanitize';

class SplitDto {
  @IsUUID()
  userId: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;
}

export class CreateExpenseDto {
  @IsString()
  @MaxLength(200)
  @Transform(stripHtml)
  description: string;

  @IsNumber()
  @Min(0)
  @Max(100000000)
  amount: number;

  @IsString()
  @MaxLength(3)
  @IsOptional()
  currency?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @IsEnum(SplitMethod)
  @IsOptional()
  splitMethod?: SplitMethod;

  @IsDateString()
  date: string;

  @IsUUID()
  paidByUserId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SplitDto)
  splits: SplitDto[];
}
