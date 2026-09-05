/* eslint-disable @typescript-eslint/no-explicit-any */
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

  async getUserActivity(userId: string, canViewAll = false) {
    // Rich feed: joins the actor's name, the task's number/title, and (for
    // assignment events) the target assignee's name — so the frontend can
    // render sentences like "Vijay assigned TSK-0012 to Bhavin" instead of
    // a bare "TASK_ASSIGNED" + timestamp.
    const rows = await this.activityRepo.manager.query(
      `
      SELECT
        log.id, log.action, log.task_id, log.old_value, log.new_value, log.created_at,
        actor.first_name  AS actor_first_name,
        actor.last_name   AS actor_last_name,
        t.task_number     AS task_number,
        t.title           AS task_title,
        target.first_name AS target_first_name,
        target.last_name  AS target_last_name
      FROM tenant_ssipl.activity_logs log
      LEFT JOIN tenant_ssipl.users actor  ON actor.id  = log.user_id
      LEFT JOIN tenant_ssipl.tasks t      ON t.id      = log.task_id AND t.deleted_at IS NULL
      LEFT JOIN tenant_ssipl.users target ON target.id = NULLIF(log.new_value->>'assigneeId', '')::uuid
      -- Drop entries whose task was soft-deleted (t.id comes back null once
      -- the join's deleted_at check excludes it) — otherwise the feed keeps
      -- showing history for, and dead links to, tasks that no longer exist.
      -- General (non-task) log rows are untouched.
      WHERE (log.task_id IS NULL OR t.id IS NOT NULL)
      ${canViewAll ? '' : 'AND log.user_id = $1'}
      ORDER BY log.created_at DESC
      LIMIT 50
      `,
      canViewAll ? [] : [userId],
    );

    return rows.map((r: any) => ({
      id:              r.id,
      action:          r.action,
      taskId:          r.task_id,
      taskNumber:      r.task_number,
      taskTitle:       r.task_title,
      oldValue:        r.old_value,
      newValue:        r.new_value,
      createdAt:       r.created_at,
      actorFirstName:  r.actor_first_name,
      actorLastName:   r.actor_last_name,
      targetFirstName: r.target_first_name,
      targetLastName:  r.target_last_name,
    }));
  }

  // ── Clear every activity log entry (admin) ──
  //    Used by the Dashboard's "Clear All" control on Recent Activity.
  //    This is log data, not a business record, so it's a hard delete
  //    rather than the soft-delete pattern used for tasks/leaves/users.
  async clearAll() {
    await this.activityRepo.createQueryBuilder().delete().from(ActivityLog).execute();
    return { message: 'Activity log cleared' };
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