import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLogModule } from '../activity/activity-log.module';
import { Designation } from './designation.entity';
import { DesignationsService } from './designations.service';
import { DesignationsController } from './designations.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Designation]), ActivityLogModule],
  providers: [DesignationsService],
  controllers: [DesignationsController],
  exports: [DesignationsService],
})
export class DesignationsModule {}