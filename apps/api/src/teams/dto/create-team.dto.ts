import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @Length(1, 50)
  teamCode!: string;

  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsUUID()
  teamLeaderId?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  startDate?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  targetDate?: string;

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
