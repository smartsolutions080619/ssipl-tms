import {
  Controller, Get, Post, Delete, Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Public task config — no auth needed, used by create modals ──
  @Get('task-config')
  @ApiOperation({ summary: 'Get task priorities and types (public)' })
  getTaskConfig() {
    return this.adminService.getTaskConfig();
  }

  // ── Everything below requires admin auth ──
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)

  @Get('config')
  @ApiOperation({ summary: 'Get all config keys' })
  getAll() { return this.adminService.getAll(); }

  @Post('config/seed')
  @ApiOperation({ summary: 'Seed default config values' })
  seed() { return this.adminService.seedDefaults(); }

  @Post('config/:key')
  @ApiOperation({ summary: 'Set a config value' })
  set(@Param('key') key: string, @Body() body: { value: object; description?: string }) {
    return this.adminService.set(key, body.value, body.description);
  }

  @Delete('config/:key')
  @ApiOperation({ summary: 'Delete a config key' })
  remove(@Param('key') key: string) { return this.adminService.remove(key); }

  // ── API Keys ──
  @Get('api-keys')
  @ApiOperation({ summary: 'Get all API keys' })
  getApiKeys() { return this.adminService.getAll(); }

  @Post('api-keys')
  @ApiOperation({ summary: 'Generate API key' })
  createApiKey(@Body('name') name: string) { return this.adminService.set(`apikey_${Date.now()}`, { name }, name); }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke API key' })
  revokeApiKey(@Param('id') id: string) { return this.adminService.remove(id); }
}