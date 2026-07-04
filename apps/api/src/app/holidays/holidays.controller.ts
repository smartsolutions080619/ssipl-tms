/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HolidaysService } from './holidays.service';
import { HolidayType } from './holiday.entity';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
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

  @Get('announcements')
  @ApiOperation({ summary: 'Get upcoming holidays for announcement widget' })
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
  @ApiOperation({ summary: 'Add a holiday (admin only)' })
  async create(
    @Body() body: { name: string; date: string; holidayType?: HolidayType; description?: string },
    @CurrentUser() user: any,
  ) {
    return this.holidaysService.create({ ...body, createdBy: user.userId });
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a holiday' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.holidaysService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a holiday' })
  async remove(@Param('id') id: string) {
    return this.holidaysService.remove(id);
  }
}