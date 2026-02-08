import { IsOptional, IsEnum, IsString } from 'class-validator';
import { TripStatus } from '../entities/trip.entity';

export enum SortBy {
  START_DATE = 'startDate',
  CREATED_AT = 'createdAt',
  DESTINATION = 'destination',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryTripsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @IsEnum(SortBy)
  sortBy?: SortBy;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
