import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AssetCondition } from '@prisma/client';

export class AssignAssetDto {
  @IsOptional() @IsUUID() userId?: string;
  @IsOptional() @IsUUID() teamId?: string;
  @IsEnum(AssetCondition) conditionOnAssignment!: AssetCondition;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
