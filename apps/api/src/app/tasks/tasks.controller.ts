import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards,
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
  async findAll() {
    return this.tasksService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  async create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.create(dto, user.userId);
  }

  @Get('my-tasks')
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
  @ApiOperation({ summary: 'Get sub-tasks of a task' })
  async findSubTasks(@Param('id') id: string) {
    return this.tasksService.findSubTasks(id);
  }

  @Put(':id/assign')
  @ApiOperation({ summary: 'Assign task to any user' })
  async assignTask(
    @Param('id') id: string,
    @Body('assigneeId') assigneeId: string,
  ) {
    return this.tasksService.assignTask(id, assigneeId);
  }

  @Put(':id/unassign')
  @ApiOperation({ summary: 'Unassign task' })
  async unassignTask(@Param('id') id: string) {
    return this.tasksService.unassignTask(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update task' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete task (soft delete)' })
  async remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
  }
}