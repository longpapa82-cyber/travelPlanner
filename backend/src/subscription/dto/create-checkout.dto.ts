import { IsIn } from 'class-validator';

export class CreateCheckoutDto {
  @IsIn(['monthly', 'yearly'])
  plan: 'monthly' | 'yearly';
}
