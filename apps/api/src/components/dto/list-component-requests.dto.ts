import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ComponentRequestStatus } from '@prisma/client';

export class ListComponentRequestsDto {
  @IsOptional()
  @IsEnum(ComponentRequestStatus)
  status?: ComponentRequestStatus;

  @IsOptional()
  @IsUUID()
  componentId?: string;

  @IsOptional()
  @IsUUID()
  requestedBy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
