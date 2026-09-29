import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { NoticePriority, NoticeScope } from '@prisma/client';

export class CreateNoticeDto {
  @IsString()
  @Length(1, 255)
  title!: string;

  @IsString()
  @Length(1, 20000)
  content!: string;

  @IsOptional()
  @IsEnum(NoticePriority)
  priority?: NoticePriority;

  @IsEnum(NoticeScope)
  scope!: NoticeScope;

  @IsOptional()
  @IsDateString({ strict: true })
  publishAt?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  requiresAcknowledgement?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  teamIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  userIds?: string[];
}
