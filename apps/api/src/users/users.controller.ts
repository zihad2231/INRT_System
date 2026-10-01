import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CreateUserDto } from './dto/create-user.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ListUsersDto } from './dto/list-users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('admins')
  async listAdmins(@Req() request: AuthenticatedRequest) {
    const data = await this.usersService.listAdmins(request.user);
    return { success: true, data };
  }

  @Post(':id/promote-admin')
  async promoteToAdmin(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('roleCode') roleCode?: 'ADMIN' | 'SUPER_ADMIN',
  ) {
    const result = await this.usersService.promoteToAdmin(request.user, id, roleCode ?? 'ADMIN');
    return { success: true, data: result };
  }

  @Post(':id/demote-admin')
  async demoteAdmin(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const result = await this.usersService.demoteAdmin(request.user, id);
    return { success: true, data: result };
  }

  @Get()
  async list(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListUsersDto,
  ) {
    const result = await this.usersService.list(request.user, query);
    return { success: true, data: { data: result.data, meta: result.meta } };
  }

  @Post()
  @RequirePermissions('USER_CREATE')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateUserDto,
  ) {
    const user = await this.usersService.create(request.user, dto);
    return { success: true, data: user };
  }

  @Patch(':id/reset-password')
  @RequirePermissions('USER_UPDATE')
  async resetPassword(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    await this.usersService.resetPassword(request.user, id, dto.password);
    return { success: true };
  }

  @Patch(':id/remove')
  @RequirePermissions('USER_UPDATE')
  async deleteUser(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.usersService.deleteUser(request.user, id, adminPassword);
    return { success: true };
  }

  @Delete(':id')
  @RequirePermissions('USER_UPDATE')
  async deleteUserDirect(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.usersService.deleteUser(request.user, id, adminPassword);
    return { success: true };
  }

  @Post(':id/remove')
  @RequirePermissions('USER_UPDATE')
  async deleteUserPost(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('adminPassword') adminPassword?: string,
  ) {
    await this.usersService.deleteUser(request.user, id, adminPassword);
    return { success: true };
  }

  @Patch('me/profile')
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Body() dto: {
      firstName?: string;
      lastName?: string;
      email?: string;
      bio?: string;
      phone?: string;
      profileImageUrl?: string;
      skills?: string[];
      researchAreas?: string[];
    },
  ) {
    await this.usersService.updateProfile(request.user, dto);
    return { success: true };
  }

  @Patch('me/details')
  async updateProfileDetails(
    @Req() request: AuthenticatedRequest,
    @Body() dto: {
      firstName?: string;
      lastName?: string;
      email?: string;
      bio?: string;
      phone?: string;
      profileImageUrl?: string;
      skills?: string[];
      researchAreas?: string[];
    },
  ) {
    await this.usersService.updateProfileDetails(request.user, dto);
    return { success: true };
  }

  @Patch('me/change-password')
  async changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() dto: { currentPassword: string; newPassword: string },
  ) {
    await this.usersService.changePassword(request.user, dto.currentPassword, dto.newPassword);
    return { success: true };
  }

  @Patch(':id')
  @RequirePermissions('USER_UPDATE')
  async updateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      bio?: string;
      profileImageUrl?: string;
      status?: any;
      password?: string;
    },
  ) {
    const updated = await this.usersService.updateUserByAdmin(request.user, id, dto);
    return { success: true, data: updated };
  }
}
