import { Controller, Get, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getMyActivity(@CurrentUser() user: any) {
    const canViewAll = user.role?.toLowerCase() === 'admin' || (user.permissions || []).includes('task:view_all');
    return this.activityLogService.getUserActivity(user.userId, canViewAll);
  }

  @Delete()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — clear all activity log entries' })
  async clearAll() {
    return this.activityLogService.clearAll();
  }

  @Get('audit')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — Get all activity logs with filters' })
  async getAuditLog(
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('taskId') taskId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.activityLogService.getAuditLog({
      userId,
      action,
      taskId,
      limit: limit ? +limit : 100,
    });
  }
}