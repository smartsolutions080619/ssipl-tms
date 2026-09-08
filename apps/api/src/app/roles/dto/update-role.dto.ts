import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiProperty({ description: "Department IDs whose tasks every user with this role can additionally see", required: false })
  @IsOptional()
  @IsArray()
  extraDepartmentIds?: string[];
}