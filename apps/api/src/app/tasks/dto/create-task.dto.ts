import {
  IsString, IsOptional, IsEnum, IsUUID, IsDateString, IsBoolean,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum RecurrenceFrequency {
  DAILY       = 'DAILY',
  WEEKLY      = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY     = 'MONTHLY',
  QUARTERLY   = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY      = 'YEARLY',
}

export class CreateTaskDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiProperty({ required: false, description: 'Who this task is reported under. Defaults to whoever creates the task.' })
  @IsOptional()
  @IsUUID()
  reporterId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiProperty({ required: false, description: 'Which department this task is tagged under.' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  // ── Recurrence fields ──
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({ enum: RecurrenceFrequency, required: false })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @ApiProperty({ required: false, description: 'When recurrence ends (ISO date). Null = forever.' })
  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;
}