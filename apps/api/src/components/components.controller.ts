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
import { SessionAuthGuard } from '../auth/guards/session-auth.guard.js';
import { ComponentsService } from './components.service.js';
import { CreateComponentRequestDto } from './dto/create-component-request.dto.js';
import { CreateComponentDto } from './dto/create-component.dto.js';
import { ListComponentAllocationsDto } from './dto/list-component-allocations.dto.js';
import { ListComponentRequestsDto } from './dto/list-component-requests.dto.js';
import { ListComponentsDto } from './dto/list-components.dto.js';
import { ReturnComponentAllocationDto } from './dto/return-component-allocation.dto.js';
import { ReviewComponentRequestDto } from './dto/review-component-request.dto.js';
import { UpdateComponentDto } from './dto/update-component.dto.js';

@Controller('components')
@UseGuards(SessionAuthGuard)
export class ComponentsController {
  constructor(private readonly components: ComponentsService) {}

  @Get('generate-code')
  async generateCode(
    @Req() request: AuthenticatedRequest,
    @Query('name') name?: string,
    @Query('category') category?: string,
  ) {
    return { success: true, data: await this.components.generateCodeForClient(request.user, name || '', category) };
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest, @Query() query: ListComponentsDto) {
    return { success: true, data: await this.components.listComponents(request.user, query) };
  }

  @Post()
  async create(@Req() request: AuthenticatedRequest, @Body() dto: CreateComponentDto) {
    return { success: true, data: await this.components.createComponent(request.user, dto) };
  }

  @Get('requests')
  async listRequests(@Req() request: AuthenticatedRequest, @Query() query: ListComponentRequestsDto) {
    return { success: true, data: await this.components.listRequests(request.user, query) };
  }

  @Post('requests')
  async createRequest(@Req() request: AuthenticatedRequest, @Body() dto: CreateComponentRequestDto) {
    return { success: true, data: await this.components.createRequest(request.user, dto) };
  }

  @Patch('requests/:id/approve')
  async approveRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewComponentRequestDto,
  ) {
    return { success: true, data: await this.components.approveRequest(request.user, id, dto) };
  }

  @Patch('requests/:id/reject')
  async rejectRequest(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewComponentRequestDto,
  ) {
    return { success: true, data: await this.components.rejectRequest(request.user, id, dto) };
  }

  @Patch('requests/:id/cancel')
  async cancelRequest(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.components.cancelRequest(request.user, id) };
  }

  @Get('allocations')
  async listAllocations(@Req() request: AuthenticatedRequest, @Query() query: ListComponentAllocationsDto) {
    return { success: true, data: await this.components.listAllocations(request.user, query) };
  }

  @Patch('allocations/:id/return')
  async returnAllocation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnComponentAllocationDto,
  ) {
    return { success: true, data: await this.components.returnAllocation(request.user, id, dto) };
  }

  @Get(':id')
  async getOne(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.components.getComponent(request.user, id) };
  }

  @Patch(':id')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateComponentDto,
  ) {
    return { success: true, data: await this.components.updateComponent(request.user, id, dto) };
  }

  @Delete(':id')
  async remove(@Req() request: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { success: true, data: await this.components.deleteComponent(request.user, id) };
  }
}
