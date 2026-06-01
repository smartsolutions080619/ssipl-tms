import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Patch,
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
  async create(@Body() dto: CreateTaskDto, @CurrentUser() user: any) {
    return this.tasksService.create(dto, user.userId);
  }

  @Get('config')
@ApiOperation({ summary: 'Get task types, statuses and priorities' })
async getConfig() {
  return {
    statuses: [
      { value: 'TODO', label: 'To Do' },
      { value: 'IN_PROGRESS', label: 'In Progress' },
      { value: 'IN_REVIEW', label: 'In Review' },
      { value: 'DONE', label: 'Done' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
    priorities: [
      { value: 'LOW', label: 'Low' },
      { value: 'MEDIUM', label: 'Medium' },
      { value: 'HIGH', label: 'High' },
      { value: 'CRITICAL', label: 'Critical' },
    ],
    types: [
      { value: 'TASK', label: 'Task' },
      { value: 'BUG', label: 'Bug' },
      { value: 'FEATURE', label: 'Feature' },
      { value: 'IMPROVEMENT', label: 'Improvement' },
    ],
  };
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
    @CurrentUser() user: any,
  ) {
    return this.tasksService.assignTask(id, assigneeId, user.userId);
  }
  @Patch(':id/status')
  @ApiOperation({ summary: 'Change task status with workflow validation' })
  async changeStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.changeStatus(id, status, user.userId);
  }

  @Put(':id/unassign')
  @ApiOperation({ summary: 'Unassign task' })
  async unassignTask(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.unassignTask(id, user.userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update task' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: any,
  ) {
    return this.tasksService.update(id, dto, user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete task (soft delete)' })
  async remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.tasksService.remove(id, user.userId);
  }
}