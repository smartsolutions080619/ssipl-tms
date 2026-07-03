/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { HolidayType } from './holiday.entity';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Holidays')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @ApiOperation({ summary: 'Get all holidays (optionally by year)' })
  async findAll(@Query('year') year?: string) {
    return this.holidaysService.findAll(year ? parseInt(year) : undefined);
  }

  // ── New endpoint: holidays to show in announcement widget ──
  @Get('announcements')
  @ApiOperation({ summary: 'Get upcoming holidays for announcement widget (2 days before + day of)' })
  async getAnnouncements() {
    return this.holidaysService.getUpcomingAnnouncements();
  }

  @Get('range')
  @ApiOperation({ summary: 'Get holidays by date range' })
  async findByRange(@Query('from') from: string, @Query('to') to: string) {
    return this.holidaysService.findByRange(from, to);
  }

  @Get('month')
  @ApiOperation({ summary: 'Get holidays for a specific month' })
  async findByMonth(@Query('year') year: string, @Query('month') month: string) {
    return this.holidaysService.findByMonth(parseInt(year), parseInt(month));
  }

  @Post()
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Add a holiday (admin only)' })
  async create(
    @Body() body: { name: string; date: string; holidayType?: HolidayType; description?: string },
    @CurrentUser() user: any,
  ) {
    return this.holidaysService.create({ ...body, createdBy: user.userId });
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Update a holiday (admin only)' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.holidaysService.update(id, body);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete a holiday (admin only)' })
  async remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}