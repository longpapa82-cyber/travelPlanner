import { IsArray, IsInt, ArrayMinSize } from 'class-validator';

export class ReorderActivitiesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  order: number[];
}
