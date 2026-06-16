import {
  Controller, Get, Post, Patch, Body,
  Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeaveType } from './leave-request.entity';

@ApiTags('Leaves')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  // ── Employee endpoints ──

  @Post()
  @ApiOperation({ summary: 'Submit a leave request' })
  async create(
    @CurrentUser() user: any,
    @Body() body: { leaveType: LeaveType; fromDate: string; toDate: string; reason: string },
  ) {
    return this.leavesService.create(user.userId, body);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my leave requests' })
  async findMine(@CurrentUser() user: any) {
    return this.leavesService.findMine(user.userId);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get my leave balance' })
  async getBalance(@CurrentUser() user: any) {
    return this.leavesService.getBalance(user.userId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel my leave request' })
  async cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leavesService.cancel(id, user.userId);
  }

  // ── Admin endpoints ──

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Get all leave requests (admin/manager)' })
  async findAll(
    @Query('status') status?: string,
    @Query('userId') userId?: string,
    @Query('year')   year?: string,
  ) {
    return this.leavesService.findAll({ status, userId, year: year ? parseInt(year) : undefined });
  }

  @Get('balances')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all employees leave balances (admin)' })
  async getAllBalances() {
    return this.leavesService.getAllBalances();
  }

  @Patch(':id/approve')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Approve a leave request' })
  async approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.leavesService.approve(id, user.userId);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Reject a leave request with reason' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body('reason') reason: string,
  ) {
    return this.leavesService.reject(id, user.userId, reason);
  }

  @Post('carry-forward/:year')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Process year-end carry forward (run on Jan 1)' })
  async carryForward(@Param('year') year: string) {
    return this.leavesService.processCarryForward(parseInt(year));
  }
}