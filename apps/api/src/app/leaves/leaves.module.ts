import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequest } from './leave-request.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeavesService } from './leaves.service';
import { LeavesController } from './leaves.controller';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, LeaveBalance]),
    MailModule,
    NotificationsModule,
  ],
  providers: [LeavesService],
  controllers: [LeavesController],
  exports: [LeavesService],
})
export class LeavesModule {}