import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AssetCondition } from '@prisma/client';

export class CreateAssetDto {
  @IsString() @Length(1, 50) assetCode!: string;
  @IsString() @Length(1, 255) name!: string;
  @IsString() @Length(1, 100) category!: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() @MaxLength(255) serialNumber?: string;
  @IsOptional() @IsDateString({ strict: true }) purchaseDate?: string;
  @IsOptional() @IsNumber() purchasePrice?: number;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @IsString() @MaxLength(255) location?: string;
}
