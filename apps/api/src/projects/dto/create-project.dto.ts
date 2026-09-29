import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @Length(1, 50)
  projectCode!: string;

  @IsString()
  @Length(1, 255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  targetDate?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  teamIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  memberIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  researchAreaIds?: string[];
}
