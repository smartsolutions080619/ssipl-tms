import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';
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

  @ApiProperty({ description: "Optional Designation ID to borrow its Department Task Access list from, instead of keeping this role's own", required: false })
  @IsOptional()
  @IsUUID()
  linkedDesignationId?: string | null;
}