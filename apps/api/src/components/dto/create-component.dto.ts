import { IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

export class CreateComponentDto {
  @IsOptional()
  @IsString()
  componentCode?: string;

  @IsString()
  name!: string;

  @IsString()
  category!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt()
  @Min(0)
  totalQuantity!: number;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @ValidateIf((o) => o.purchaseDate !== '' && o.purchaseDate !== null && o.purchaseDate !== undefined)
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
