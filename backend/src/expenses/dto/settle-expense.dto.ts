import { IsOptional, IsUUID } from 'class-validator';

export class SettleExpenseDto {
  @IsOptional()
  @IsUUID()
  targetUserId?: string;
}
