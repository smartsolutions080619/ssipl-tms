import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActivityAction } from './activity-log.entity';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityRepo: Repository<ActivityLog>,
  ) {}

  async log(
    userId: string,
    action: ActivityAction,
    taskId?: string,
    oldValue?: object,
    newValue?: object,
  ) {
    const log = this.activityRepo.create({
      userId,
      action,
      taskId,
      oldValue,
      newValue,
    });
    return this.activityRepo.save(log);
  }

  async getTaskActivity(taskId: string) {
    return this.activityRepo.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
  }

  async getUserActivity(userId: string) {
    return this.activityRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}