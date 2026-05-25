import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ApiKey } from './api-key.entity';
import { User } from './user.entity';
import { ApiKeyService } from './api-key.service';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt.guard';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TokenBlacklistService } from './token-blacklist.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    ApiKeyService,
    ApiKeyGuard,
    JwtStrategy,
    JwtAuthGuard,
    AuthService,
    TokenBlacklistService,
  ],
  controllers: [AuthController],
  exports: [ApiKeyService, ApiKeyGuard, JwtAuthGuard, AuthService, JwtModule],
})
export class AuthModule {}