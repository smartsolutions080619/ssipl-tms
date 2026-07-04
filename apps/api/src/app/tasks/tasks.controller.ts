/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller, Get, Post, Put, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'Get all tasks' })
  async findAll(
    @Query('status')   status?: string,
    @Query('priority') priority?: string,
    @Query('type')     type?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('search')   search?: string,
    @CurrentUser()     user?: any,
  ) {
    return this.tasksService.findAll({ status, priority, type, assigneeId, search }, user ? { userId: user.userId, role: user.role } : undefined);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my assigned tasks' })
  async getMyTasks(@CurrentUser() user: any) {
    return this.tasksService.getMyTasks(user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by ID' })
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Get(':id/subtasks')
  @ApiOperation({ summary: 'Get subtasks of a task' })
  async getSubTasks(@Param('id') id: string) {
    return this.tasksService.findSubTasks(id);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for a task' })
  async getComments(@Param('id') id: string) {
    return this.tasksService.getTaskComments(id);
  }

  @Get(':id/activity')
  @ApiOperation({ summary: 'Get activity log for a task' })
  async getActivity(@Param('id') id: string) {
    return this.tasksService.getTaskActivity(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(dto, user.userId);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a task' })
  async addComment(
    @Param('id') id: string,
    @Body('content') content: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.addComment(id, content, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a task' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.update(id, dto, user.userId);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign task to a user' })
  async assign(
    @Param('id') id: string,
    @Body('assigneeId') assigneeId: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.assignTask(id, assigneeId, user.userId);
  }

  @Patch(':id/unassign')
  @ApiOperation({ summary: 'Unassign task' })
  async unassign(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.unassignTask(id, user.userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change task status' })
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.changeStatus(id, status, user.userId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Send task back (reject)' })
  async reject(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @Body('reassignTo') reassignTo: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.rejectTask(id, reason, reassignTo, user.userId);
  }

  @Patch(':id/undo')
  @ApiOperation({ summary: 'Undo last status change' })
  async undo(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.undoTask(id, user.userId);
  }

  @Patch(':id/due-date')
  @ApiOperation({ summary: 'Update due date' })
  async updateDueDate(
    @Param('id') id: string,
    @Body('dueDate') dueDate: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.updateDueDate(id, dueDate, user.userId);
  }

  @Patch(':id/priority')
  @ApiOperation({ summary: 'Update priority' })
  async updatePriority(
    @Param('id') id: string,
    @Body('priority') priority: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.updatePriority(id, priority, user.userId);
  }

  // ── Extend task deadline ──
  @Patch(':id/extend')
  @ApiOperation({ summary: 'Extend task deadline' })
  async extendDeadline(
    @Param('id') id: string,
    @Body('dueDate') dueDate: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.extendDeadline(id, dueDate, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.remove(id, user.userId);
  }
}