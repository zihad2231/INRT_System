import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ComponentAllocationStatus } from '@prisma/client';

export class ListComponentAllocationsDto {
  @IsOptional()
  @IsEnum(ComponentAllocationStatus)
  status?: ComponentAllocationStatus;

  @IsOptional()
  @IsUUID()
  componentId?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

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
