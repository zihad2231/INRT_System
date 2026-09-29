import {
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { Prisma } from '@prisma/client';

export class PaperIdentifierDto {
  @IsString()
  @MaxLength(50)
  type!: string;

  @IsString()
  @MaxLength(2048)
  value!: string;
}

export class AddProjectPaperDto {
  @IsOptional()
  @IsUUID()
  paperId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  title?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaperIdentifierDto)
  identifiers?: PaperIdentifierDto[];

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  canonicalUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  authors?: string[];

  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(3000)
  publicationYear?: number;

  @IsOptional()
  @IsUUID()
  researchAreaId?: string;

  @IsOptional()
  @IsString()
  abstract?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  journalName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  publisher?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  pdfUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  imageUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: Prisma.InputJsonObject;
}
