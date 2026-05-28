import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    UseGuards,
  } from '@nestjs/common';
  import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
  import { UsersService } from './users.service';
  import { CreateUserDto } from './create-user.dto';
  import { UpdateUserDto } from './update-user.dto';
  import { JwtAuthGuard } from '../../auth/guards/jwt.guard';
  import { RolesGuard } from '../../common/guards/roles.guard';
  import { Roles } from '../../common/decorators/roles.decorator';
  import { Role } from '../../common/enums/roles.enum';
  import { CurrentUser } from '../../common/decorators/current-user.decorator';
  
  @ApiTags('Users')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Controller('users')
  export class UsersController {
    constructor(private readonly usersService: UsersService) {}
  
    @Get()
@ApiOperation({ summary: 'Get all users' })
async findAll() {
  return this.usersService.findAll();
}
  
    @Post()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create a new user' })
    async create(@Body() dto: CreateUserDto) {
      return this.usersService.create(dto);
    }
  
    @Get('profile')
    @ApiOperation({ summary: 'Get current user profile' })
    async getProfile(@CurrentUser() user: any) {
      return this.usersService.getProfile(user.userId);
    }
  
    @Put('profile')
    @ApiOperation({ summary: 'Update current user profile' })
    async updateProfile(
      @CurrentUser() user: any,
      @Body() dto: UpdateUserDto,
    ) {
      return this.usersService.updateProfile(user.userId, dto);
    }
  
    @Get(':id')
    @Roles(Role.ADMIN, Role.MANAGER)
    @ApiOperation({ summary: 'Get user by ID' })
    async findOne(@Param('id') id: string) {
      return this.usersService.findOne(id);
    }
  
    @Put(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update user by ID' })
    async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
      return this.usersService.update(id, dto);
    }
  
    @Delete(':id')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Deactivate user' })
    async remove(@Param('id') id: string) {
      return this.usersService.remove(id);
    }
  }