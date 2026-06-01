import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDepartmentDto {
  @ApiProperty({ example: 'Engineering' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'parent-dept-uuid', required: false })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}