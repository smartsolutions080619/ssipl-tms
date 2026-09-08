import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'manager' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Can manage tasks and users', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['task:create', 'task:read', 'user:read'], required: false })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiProperty({ description: "Department IDs whose tasks every user with this role can additionally see", required: false })
  @IsOptional()
  @IsArray()
  extraDepartmentIds?: string[];
}