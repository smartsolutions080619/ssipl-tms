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

  async getAuditLog(filters: {
    userId?: string;
    action?: string;
    taskId?: string;
    limit?: number;
  }) {
    const query = this.activityRepo.createQueryBuilder('log')
      .orderBy('log.created_at', 'DESC')
      .take(filters.limit || 100);

    if (filters.userId) {
      query.andWhere('log.user_id = :userId', { userId: filters.userId });
    }

    if (filters.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }

    if (filters.taskId) {
      query.andWhere('log.task_id = :taskId', { taskId: filters.taskId });
    }

    return query.getMany();
  }
}