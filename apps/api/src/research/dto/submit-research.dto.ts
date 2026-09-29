import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ResearchAnswerInputDto {
  @IsUUID()
  questionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50000)
  text?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  number?: number;

  @IsOptional()
  @IsBoolean()
  boolean?: boolean;

  @IsOptional()
  @IsDateString({ strict: true })
  date?: string;

  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  multiSelect?: string[];
}

export class SubmitResearchDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ResearchAnswerInputDto)
  answers!: ResearchAnswerInputDto[];

  @IsOptional()
  @IsBoolean()
  submit = false;
}

export class ReviewResearchDto {
  @IsString()
  @MaxLength(5000)
  comment!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
