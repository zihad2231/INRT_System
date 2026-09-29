import { IsEnum } from 'class-validator';
import { TodoStatus } from '@prisma/client';

export class UpdateTodoStatusDto {
  @IsEnum(TodoStatus)
  status!: TodoStatus;
}
