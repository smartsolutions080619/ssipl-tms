import { IsString, IsNotEmpty, Matches, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({ example: 'Acme Corporation' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'acme-corp' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'slug can only contain lowercase letters, numbers and underscores',
  })
  slug!: string;

  @ApiProperty({ example: 'Main API Key' })
  @IsString()
  @IsNotEmpty()
  apiKeyName!: string;
}