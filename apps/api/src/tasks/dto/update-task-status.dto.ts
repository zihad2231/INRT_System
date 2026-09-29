import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { TaskStatus } from '@prisma/client';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;
}
