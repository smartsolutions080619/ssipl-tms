import { IsString, IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../task.entity';

export class UpdateTaskDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ required: false, description: 'Priority key — admin-configurable, not a fixed enum.' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({ required: false, description: 'Type key — admin-configurable, not a fixed enum.' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  reporterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}