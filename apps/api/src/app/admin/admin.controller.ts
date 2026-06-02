import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/config')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system configs' })
  async getAll() {
    return this.adminService.getAll();
  }

  @Post('seed')
  @ApiOperation({ summary: 'Seed default configs' })
  async seed() {
    return this.adminService.seedDefaults();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get config by key' })
  async getByKey(@Param('key') key: string) {
    return this.adminService.getByKey(key);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Set config value' })
  async set(
    @Param('key') key: string,
    @Body('value') value: object,
    @Body('description') description: string,
  ) {
    return this.adminService.set(key, value, description);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Delete config' })
  async remove(@Param('key') key: string) {
    return this.adminService.remove(key);
  }
}