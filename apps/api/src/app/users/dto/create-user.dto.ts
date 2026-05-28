import { IsEmail, IsString, IsNotEmpty, MinLength, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'john@ssipl.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'uuid-of-role', required: false })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiProperty({ example: 'uuid-of-department', required: false })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}