import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';

@Module({
  imports: [
    ConfigModule,
    MulterModule.register({ dest: './uploads' }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}