/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  getSummary(@Req() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getSummary(req.user, query);
  }

  @Get('status-breakdown')
  getStatusBreakdown(@Req() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getStatusBreakdown(req.user, query);
  }

  @Get('priority-overdue')
  getPriorityAndOverdue(@Req() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getPriorityAndOverdue(req.user, query);
  }

  @Get('by-department')
  getByDepartment(@Req() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getTasksByDepartmentAndUser(req.user, query);
  }

  @Get('completion-trend')
  getCompletionTrend(@Req() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getCompletionTrend(req.user, query);
  }

  // ── NEW: Individual user report ──
  @Get('individual/:userId')
  getIndividualReport(@Param('userId') userId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.getIndividualReport(userId, query);
  }

  // ── NEW: Department detail report ──
  @Get('department/:deptId')
  getDepartmentReport(@Param('deptId') deptId: string, @Query() query: ReportQueryDto) {
    return this.reportsService.getDepartmentReport(deptId, query);
  }
}