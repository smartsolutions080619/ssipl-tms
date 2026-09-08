import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john@ssipl.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Doe', required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'uuid-of-role', required: false })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiProperty({ example: 'uuid-of-department', required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ example: 'uuid-of-manager', required: false, description: 'The user this person reports to (Reporting Manager).' })
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty({ example: 'uuid-of-designation', required: false, description: 'Job title — also drives designation-level Department Task Access.' })
  @IsOptional()
  @IsUUID()
  designationId?: string;
}