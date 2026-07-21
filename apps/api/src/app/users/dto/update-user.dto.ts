import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  @IsOptional()
  roleId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string | null;

  @ApiProperty({ required: false, description: 'The user this person reports to (Reporting Manager). Null clears it.' })
  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}