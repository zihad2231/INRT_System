import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AssetCondition } from '@prisma/client';

export class ReturnAssetDto {
  @IsEnum(AssetCondition) conditionOnReturn!: AssetCondition;
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
