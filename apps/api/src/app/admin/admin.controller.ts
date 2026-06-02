import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { ApiKeyService } from '../auth/api-key.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class CreateApiKeyDto {
  @ApiProperty({ example: 'Mobile App Key' })
  @IsString()
  @IsNotEmpty()
  name: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  // ── Config ──
  @Get('config')
  @ApiOperation({ summary: 'Get all system configs' })
  async getAll() {
    return this.adminService.getAll();
  }

  @Post('config/seed')
  @ApiOperation({ summary: 'Seed default configs' })
  async seed() {
    return this.adminService.seedDefaults();
  }

  @Get('config/:key')
  @ApiOperation({ summary: 'Get config by key' })
  async getByKey(@Param('key') key: string) {
    return this.adminService.getByKey(key);
  }

  @Post('config/:key')
  @ApiOperation({ summary: 'Set config value' })
  async set(
    @Param('key') key: string,
    @Body('value') value: object,
    @Body('description') description: string,
  ) {
    return this.adminService.set(key, value, description);
  }

  @Delete('config/:key')
  @ApiOperation({ summary: 'Delete config' })
  async removeConfig(@Param('key') key: string) {
    return this.adminService.remove(key);
  }

  // ── API Keys ──
  @Get('api-keys')
  @ApiOperation({ summary: 'Get all API keys for current tenant' })
  async getApiKeys(@CurrentUser() user: any) {
    return this.apiKeyService.getApiKeysByTenant(user.tenantId);
  }

  @Post('api-keys')
  @ApiOperation({ summary: 'Create a new API key' })
  async createApiKey(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser() user: any,
  ) {
    return this.apiKeyService.createApiKey(user.tenantId, dto.name);
  }

  @Delete('api-keys/:id')
  @ApiOperation({ summary: 'Revoke API key' })
  async revokeApiKey(@Param('id') id: string) {
    return this.apiKeyService.revokeApiKey(id);
  }
}