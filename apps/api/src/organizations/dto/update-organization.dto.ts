import { IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  dateFormat?: string;

  @IsOptional()
  @IsString()
  bgImageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  accentColor?: string;

  @IsOptional()
  @IsString()
  loginBgImageUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  loginBgOpacity?: number;
}
