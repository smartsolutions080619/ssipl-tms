import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { DesignationsService } from './designations.service';

@ApiTags('Designations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('designations')
export class DesignationsController {
  constructor(private readonly designationsService: DesignationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all designations (read-only for any authenticated user)' })
  async findAll() {
    return this.designationsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single designation' })
  async findOne(@Param('id') id: string) {
    return this.designationsService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new designation (Admin only)' })
  async create(@Body() dto: { name: string; description?: string; extraDepartmentIds?: string[] }) {
    return this.designationsService.create(dto);
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a designation (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: { name?: string; description?: string; extraDepartmentIds?: string[] }) {
    return this.designationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete a designation (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.designationsService.remove(id);
  }
}