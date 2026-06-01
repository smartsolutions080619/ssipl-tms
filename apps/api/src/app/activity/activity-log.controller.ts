import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activity')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get('task/:taskId')
  @ApiOperation({ summary: 'Get activity log for a task' })
  async getTaskActivity(@Param('taskId') taskId: string) {
    return this.activityLogService.getTaskActivity(taskId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my activity log' })
  async getMyActivity(@CurrentUser() user: any) {
    return this.activityLogService.getUserActivity(user.userId);
  }
}