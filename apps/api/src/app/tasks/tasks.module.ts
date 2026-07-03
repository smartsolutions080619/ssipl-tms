import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { ActivityLogModule } from '../activity/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RecurringTaskService } from './recurring-task.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task]),
    ScheduleModule.forRoot(),
    ActivityLogModule,
    NotificationsModule,
  ],
  providers: [TasksService, RecurringTaskService],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}