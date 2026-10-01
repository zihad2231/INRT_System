import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request.js';
import { RequirePermissions } from '../auth/guards/require-permissions.decorator.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { CreateTodoDto } from './dto/create-todo.dto.js';
import { ListTasksDto } from './dto/list-tasks.dto.js';
import { ListTodosDto } from './dto/list-todos.dto.js';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto.js';
import { UpdateTodoStatusDto } from './dto/update-todo-status.dto.js';
import { TasksService } from './tasks.service.js';

@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('tasks')
  async listTasks(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTasksDto,
  ) {
    const result = await this.tasksService.listTasks(request.user, query);
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Post('tasks')
  @RequirePermissions('TASK_CREATE')
  async createTask(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTaskDto,
  ) {
    const task = await this.tasksService.createTask(request.user, dto);
    return { success: true, data: task };
  }

  @Patch('tasks/:id/status')
  async updateTaskStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    const task = await this.tasksService.updateTaskStatus(request.user, id, dto);
    return { success: true, data: task };
  }

  @Patch('tasks/:id')
  async updateTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    const task = await this.tasksService.updateTask(request.user, id, dto);
    return { success: true, data: task };
  }

  @Delete('tasks/:id')
  async deleteTask(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const task = await this.tasksService.deleteTask(request.user, id);
    return { success: true, data: task };
  }

  @Get('todos')
  async listTodos(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListTodosDto,
  ) {
    const result = await this.tasksService.listTodos(request.user, query.page, query.limit);
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Post('todos')
  async createTodo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTodoDto,
  ) {
    const todo = await this.tasksService.createTodo(request.user, dto);
    return { success: true, data: todo };
  }

  @Patch('todos/:id/status')
  async updateTodoStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTodoStatusDto,
  ) {
    const todo = await this.tasksService.updateTodoStatus(request.user, id, dto);
    return { success: true, data: todo };
  }
}
