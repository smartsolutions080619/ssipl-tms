import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /**
   * Builds the base query with role-based visibility applied.
   * Mirrors TasksService.findAll() role logic so reports respect
   * the same data-access boundaries as the task list.
   */
  private async buildBaseQuery(currentUser: any, query: ReportQueryDto) {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .where('task.deleted_at IS NULL');

    const role = currentUser?.role?.toLowerCase();

    if (role === 'admin') {
      // Admin sees everything
    } else if (role === 'manager' || role === 'team lead') {
      const deptUsers = await this.taskRepo.query(
        `SELECT id FROM users
         WHERE department_id = (
           SELECT department_id FROM users WHERE id = $1
         ) AND deleted_at IS NULL`,
        [currentUser.userId],
      );
      const deptUserIds = deptUsers.map((u: any) => u.id);

      if (deptUserIds.length > 0) {
        qb.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId OR task.assignee_id IN (:...deptUserIds))`,
          { userId: currentUser.userId, deptUserIds },
        );
      } else {
        qb.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId)`,
          { userId: currentUser.userId },
        );
      }
    } else {
      // Employee sees only their own tasks
      qb.andWhere(
        `(task.assignee_id = :userId OR task.reporter_id = :userId)`,
        { userId: currentUser.userId },
      );
    }

    if (query?.startDate) {
      qb.andWhere('task.created_at >= :startDate', { startDate: query.startDate });
    }
    if (query?.endDate) {
      qb.andWhere('task.created_at <= :endDate', { endDate: query.endDate });
    }

    return qb;
  }

  // ── 1. Status breakdown (pie/bar) ──
  async getStatusBreakdown(currentUser: any, query: ReportQueryDto) {
    const qb = await this.buildBaseQuery(currentUser, query);

    const rows = await qb
      .select('task.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('task.status')
      .getRawMany();

    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  }

  // ── 2. Priority / overdue distribution ──
  async getPriorityAndOverdue(currentUser: any, query: ReportQueryDto) {
    const qb = await this.buildBaseQuery(currentUser, query);

    const priorityRows = await qb
      .clone()
      .select('task.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .groupBy('task.priority')
      .getRawMany();

    const overdueQb = await this.buildBaseQuery(currentUser, query);
    const overdueCount = await overdueQb
      .andWhere('task.due_date IS NOT NULL')
      .andWhere('task.due_date < NOW()')
      .andWhere(`task.status NOT IN ('DONE', 'CANCELLED')`)
      .getCount();

    return {
      byPriority: priorityRows.map((r) => ({
        priority: r.priority,
        count: Number(r.count),
      })),
      overdueCount,
    };
  }

  // ── 3. Tasks by department / by user ──
  async getTasksByDepartmentAndUser(currentUser: any, query: ReportQueryDto) {
    const qb = await this.buildBaseQuery(currentUser, query);

    const rows = await qb
      .leftJoin('users', 'assignee', 'assignee.id::text = task.assignee_id::text')
      .leftJoin('departments', 'dept', 'dept.id::text = assignee.department_id::text')
      .select('dept.id', 'department_id')
      .addSelect('dept.name', 'department_name')
      .addSelect('assignee.id', 'user_id')
      .addSelect('assignee.first_name', 'user_first_name')
      .addSelect('assignee.last_name', 'user_last_name')
      .addSelect('COUNT(*)', 'count')
      .groupBy('dept.id')
      .addGroupBy('dept.name')
      .addGroupBy('assignee.id')
      .addGroupBy('assignee.first_name')
      .addGroupBy('assignee.last_name')
      .getRawMany();

    // Aggregate by department
    const deptMap = new Map<string, { departmentId: string | null; departmentName: string; count: number }>();
    const userList = rows.map((r) => {
      const deptKey = r.department_id || 'unassigned';
      const deptName = r.department_name || 'Unassigned';

      if (!deptMap.has(deptKey)) {
        deptMap.set(deptKey, { departmentId: r.department_id, departmentName: deptName, count: 0 });
      }
      deptMap.get(deptKey)!.count += Number(r.count);

      return {
        userId: r.user_id,
        userName: r.user_id
          ? `${r.user_first_name || ''} ${r.user_last_name || ''}`.trim()
          : 'Unassigned',
        departmentName: deptName,
        count: Number(r.count),
      };
    });

    return {
      byDepartment: Array.from(deptMap.values()),
      byUser: userList,
    };
  }

  // ── 4. Completion trend over time ──
  async getCompletionTrend(currentUser: any, query: ReportQueryDto) {
    const granularity = query?.granularity || 'week';
    const bucket =
      granularity === 'day' ? 'day' : granularity === 'month' ? 'month' : 'week';

    // Created trend
    const createdQb = await this.buildBaseQuery(currentUser, query);
    const createdRows = await createdQb
      .select(`DATE_TRUNC('${bucket}', task.created_at)`, 'period')
      .addSelect('COUNT(*)', 'count')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Completed trend (status = DONE, using updated_at as proxy for completedAt)
    const completedQb = await this.buildBaseQuery(currentUser, query);
    const completedRows = await completedQb
      .andWhere('task.status = :doneStatus', { doneStatus: 'DONE' })
      .select(`DATE_TRUNC('${bucket}', task.updated_at)`, 'period')
      .addSelect('COUNT(*)', 'count')
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Merge into a single timeline keyed by period
    const map = new Map<string, { period: string; created: number; completed: number }>();

    for (const r of createdRows) {
      const key = new Date(r.period).toISOString();
      map.set(key, { period: key, created: Number(r.count), completed: 0 });
    }
    for (const r of completedRows) {
      const key = new Date(r.period).toISOString();
      if (map.has(key)) {
        map.get(key)!.completed = Number(r.count);
      } else {
        map.set(key, { period: key, created: 0, completed: Number(r.count) });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime(),
    );
  }

  // ── Combined summary endpoint (all charts in one call) ──
  async getSummary(currentUser: any, query: ReportQueryDto) {
    const [statusBreakdown, priorityAndOverdue, byDeptAndUser, completionTrend] =
      await Promise.all([
        this.getStatusBreakdown(currentUser, query),
        this.getPriorityAndOverdue(currentUser, query),
        this.getTasksByDepartmentAndUser(currentUser, query),
        this.getCompletionTrend(currentUser, query),
      ]);

    return {
      statusBreakdown,
      priority: priorityAndOverdue.byPriority,
      overdueCount: priorityAndOverdue.overdueCount,
      byDepartment: byDeptAndUser.byDepartment,
      byUser: byDeptAndUser.byUser,
      completionTrend,
    };
  }
}