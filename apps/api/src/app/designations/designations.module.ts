import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from './designation.entity';
import { DesignationsService } from './designations.service';
import { DesignationsController } from './designations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Designation])],
  providers: [DesignationsService],
  controllers: [DesignationsController],
  exports: [DesignationsService],
})
export class DesignationsModule {}