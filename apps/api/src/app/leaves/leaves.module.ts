import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './leave-request.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveType } from './leave-type.entity';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogModule } from '../activity/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, LeaveBalance, LeaveType]),
    MailModule,
    NotificationsModule,
    ActivityLogModule,
  ],
  providers: [LeavesService],
  controllers: [LeavesController],
  exports: [LeavesService],
})
export class LeavesModule {}