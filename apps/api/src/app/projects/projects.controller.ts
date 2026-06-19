/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards, Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ProjectMemberRole } from './project-member.entity';
import { ProjectStatus, ProjectPriority } from './project.entity';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all projects (role-based visibility)' })
  async findAll(@CurrentUser() user: any) {
    return this.projectsService.findAll(user.userId, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details with members and stats' })
  async findOne(@Param('id') id: string) {
    return this.projectsService.findOne(id);
  }

  @Get(':id/tasks')
  @ApiOperation({ summary: 'Get all tasks in a project' })
  async getProjectTasks(@Param('id') id: string) {
    return this.projectsService.getProjectTasks(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create a new project (admin/manager)' })
  async create(@Body() body: any, @CurrentUser() user: any) {
    return this.projectsService.create(body, user.userId);
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update project' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.projectsService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete project (admin only)' })
  async remove(@Param('id') id: string) {
    return this.projectsService.remove(id);
  }

  // ── Members ──

  @Post(':id/members')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add member to project' })
  async addMember(
    @Param('id') id: string,
    @Body() body: { userId: string; role?: ProjectMemberRole },
    @CurrentUser() user: any,
  ) {
    return this.projectsService.addMember(id, body.userId, body.role || ProjectMemberRole.DEVELOPER, user.userId);
  }

  @Post(':id/departments')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add entire department to project' })
  async addDepartment(
    @Param('id') id: string,
    @Body('departmentId') departmentId: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.addDepartment(id, departmentId, user.userId);
  }

  @Patch(':id/members/:userId/role')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update member role in project' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body('role') role: ProjectMemberRole,
  ) {
    return this.projectsService.updateMemberRole(id, userId, role);
  }

  @Delete(':id/members/:userId')
  @Roles(Role.ADMIN, Role.MANAGER)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Remove member from project' })
  async removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.projectsService.removeMember(id, userId);
  }

  @Patch(':id/progress/recalc')
  @ApiOperation({ summary: 'Recalculate project progress from tasks' })
  async recalcProgress(@Param('id') id: string) {
    return this.projectsService.recalcProgress(id);
  }

  // ── Comments ──

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get project comments' })
  async getComments(@Param('id') id: string) {
    return this.projectsService.getComments(id);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add comment to project' })
  async addComment(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.projectsService.addComment(id, content, user.userId);
  }
}