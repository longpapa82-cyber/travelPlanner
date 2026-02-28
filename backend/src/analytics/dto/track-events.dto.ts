import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

class EventPayloadDto {
  @IsString()
  name: string;

  @IsOptional()
  properties?: Record<string, any>;

  @IsNumber()
  timestamp: number;
}

export class TrackEventsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EventPayloadDto)
  events: EventPayloadDto[];
}
