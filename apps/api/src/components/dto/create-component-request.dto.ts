import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateComponentRequestDto {
  @IsUUID()
  componentId!: string;

  @IsInt()
  @Min(1)
  requestedQuantity!: number;

  @IsString()
  purpose!: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  expectedStartDate?: string;

  @IsOptional()
  @IsDateString()
  expectedEndDate?: string;

  @IsOptional()
  @IsString()
  additionalNote?: string;
}
