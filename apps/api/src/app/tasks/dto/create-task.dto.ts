import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TaskPriority, TaskType } from '../task.entity';

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskPriority, required: false })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiProperty({ enum: TaskType, required: false })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ required: false, description: 'ISO date string' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}