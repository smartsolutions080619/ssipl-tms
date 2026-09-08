import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../auth/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailModule } from '../../mail/mail.module';
import { ActivityLogModule } from '../../activity/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MailModule,
    ActivityLogModule,
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}