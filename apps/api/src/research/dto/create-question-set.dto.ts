import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ResearchAnswerType } from '@prisma/client';

export class ResearchQuestionInputDto {
  @IsString()
  @Length(1, 50)
  questionCode!: string;

  @IsString()
  @Length(1, 5000)
  questionText!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsEnum(ResearchAnswerType)
  answerType!: ResearchAnswerType;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  displayOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  excelColumn?: string;

  @IsOptional()
  @IsObject()
  validationRules?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  options?: unknown[];
}

export class CreateQuestionSetDto {
  @IsString()
  @Length(1, 150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ResearchQuestionInputDto)
  questions!: ResearchQuestionInputDto[];
}
