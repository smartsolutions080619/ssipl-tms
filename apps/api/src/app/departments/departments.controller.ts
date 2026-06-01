import {
    Controller, Get, Post, Put, Delete,
    Body, Param, UseGuards,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
  import { DepartmentsService } from './departments.service';
  import { CreateDepartmentDto } from './dto/create-department.dto';
  import { UpdateDepartmentDto } from './dto/update-department.dto';
  import { JwtAuthGuard } from '../auth/guards/jwt.guard';
  import { RolesGuard } from '../common/guards/roles.guard';
  import { Roles } from '../common/decorators/roles.decorator';
  import { Role } from '../common/enums/roles.enum';
  
  @ApiTags('Departments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller('departments')
  export class DepartmentsController {
    constructor(private readonly departmentsService: DepartmentsService) {}
  
    @Get()
    @ApiOperation({ summary: 'Get all departments' })
    async findAll() {
      return this.departmentsService.findAll();
    }
  
    @Get('hierarchy')
    @ApiOperation({ summary: 'Get department hierarchy tree' })
    async getHierarchy() {
      return this.departmentsService.getHierarchy();
    }
  
    @Get(':id')
    @ApiOperation({ summary: 'Get department by ID' })
    async findOne(@Param('id') id: string) {
      return this.departmentsService.findOne(id);
    }
  
    @Get(':id/children')
    @ApiOperation({ summary: 'Get sub-departments' })
    async findChildren(@Param('id') id: string) {
      return this.departmentsService.findChildren(id);
    }
  
    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create department' })
    async create(@Body() dto: CreateDepartmentDto) {
      return this.departmentsService.create(dto);
    }
  
    @Put(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update department' })
    async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
      return this.departmentsService.update(id, dto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Delete department' })
    async remove(@Param('id') id: string) {
      return this.departmentsService.remove(id);
    }
  }