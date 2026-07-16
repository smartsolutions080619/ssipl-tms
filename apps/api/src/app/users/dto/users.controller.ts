/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ── PROFILE ROUTES FIRST (before :id) ──

  @Get('profile/me')
  @ApiOperation({ summary: 'Get my profile' })
  async getMyProfile(@CurrentUser() user: any) {
    return this.usersService.getMyProfile(user.userId);
  }

  @Put('profile/me')
  @ApiOperation({ summary: 'Update my profile' })
  async updateMyProfile(@CurrentUser() user: any, @Body() body: any) {
    return this.usersService.updateMyProfile(user.userId, body);
  }

  @Put('profile/me/password')
  @ApiOperation({ summary: 'Change my password' })
  async changePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.usersService.changePassword(user.userId, body.currentPassword, body.newPassword);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile (legacy)' })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getMyProfile(user.userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update current user profile (legacy)' })
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMyProfile(user.userId, dto);
  }

  // ── OTHER ROUTES ──

  @Get()
  @ApiOperation({ summary: 'Get all active users' })
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('pending')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get pending user registrations' })
  async findPending() {
    return this.usersService.findPending();
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a pending user' })
  async approve(@Param('id') id: string, @Body() body: { roleId: string; departmentId?: string }) {
    return this.usersService.approve(id, body.roleId, body.departmentId);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a pending user' })
  async reject(@Param('id') id: string) {
    return this.usersService.reject(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new user (admin)' })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user by ID' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Put(':id/departments')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Set the full list of departments a user belongs to' })
  async setDepartments(@Param('id') id: string, @Body() body: { departmentIds: string[] }) {
    return this.usersService.setUserDepartments(id, body.departmentIds || []);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Deactivate user' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}