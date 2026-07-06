/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
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

  private async buildBaseQuery(currentUser: any, query: ReportQueryDto) {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .where('task.deleted_at IS NULL');

    const role = currentUser?.role?.toLowerCase();

    if (role === 'admin') {
      // sees everything
    } else if (role === 'manager' || role === 'team lead') {
      const deptUsers = await this.taskRepo.query(
        `SELECT id FROM tenant_ssipl.users
         WHERE department_id = (SELECT department_id FROM tenant_ssipl.users WHERE id = $1)
         AND deleted_at IS NULL`,
        [currentUser.userId],
      );
      const deptUserIds = deptUsers.map((u: any) => u.id);
      if (deptUserIds.length > 0) {
        qb.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId OR task.assignee_id IN (:...deptUserIds))`,
          { userId: currentUser.userId, deptUserIds },
        );
      } else {
        qb.andWhere(`(task.assignee_id = :userId OR task.reporter_id = :userId)`, { userId: currentUser.userId });
      }
    } else {
      qb.andWhere(`(task.assignee_id = :userId OR task.reporter_id = :userId)`, { userId: currentUser.userId });
    }

    if (query?.startDate) qb.andWhere('task.created_at >= :startDate', { startDate: query.startDate });
    if (query?.endDate)   qb.andWhere('task.created_at <= :endDate',   { endDate:   query.endDate });

    return qb;
  }

  async getStatusBreakdown(currentUser: any, query: ReportQueryDto) {
    const qb   = await this.buildBaseQuery(currentUser, query);
    const rows = await qb.select('task.status', 'status').addSelect('COUNT(*)', 'count').groupBy('task.status').getRawMany();
    return rows.map(r => ({ status: r.status, count: Number(r.count) }));
  }

  async getPriorityAndOverdue(currentUser: any, query: ReportQueryDto) {
    const qb          = await this.buildBaseQuery(currentUser, query);
    const priorityRows = await qb.clone().select('task.priority', 'priority').addSelect('COUNT(*)', 'count').groupBy('task.priority').getRawMany();
    const overdueQb   = await this.buildBaseQuery(currentUser, query);
    const overdueCount = await overdueQb.andWhere('task.due_date IS NOT NULL').andWhere('task.due_date < NOW()').andWhere(`task.status NOT IN ('DONE','CANCELLED')`).getCount();
    return { byPriority: priorityRows.map(r => ({ priority: r.priority, count: Number(r.count) })), overdueCount };
  }

  async getTasksByDepartmentAndUser(currentUser: any, query: ReportQueryDto) {
    const role = currentUser?.role?.toLowerCase();
    let whereClause = `t.deleted_at IS NULL`;
    const params: any[] = [];

    if (role !== 'admin') {
      if (role === 'manager' || role === 'team lead') {
        const deptUsers = await this.taskRepo.query(
          `SELECT id FROM tenant_ssipl.users WHERE department_id = (SELECT department_id FROM tenant_ssipl.users WHERE id = $1) AND deleted_at IS NULL`,
          [currentUser.userId]
        );
        const ids = deptUsers.map((u: any) => u.id);
        if (ids.length > 0) {
          params.push(currentUser.userId, ...ids);
          whereClause += ` AND (t.assignee_id = $1 OR t.reporter_id = $1 OR t.assignee_id IN (${ids.map((_: any, i: number) => `$${i + 2}`).join(',')}))`;
        } else {
          params.push(currentUser.userId);
          whereClause += ` AND (t.assignee_id = $1 OR t.reporter_id = $1)`;
        }
      } else {
        params.push(currentUser.userId);
        whereClause += ` AND (t.assignee_id = $1 OR t.reporter_id = $1)`;
      }
    }

    if (query?.startDate) { params.push(query.startDate); whereClause += ` AND t.created_at >= $${params.length}`; }
    if (query?.endDate)   { params.push(query.endDate);   whereClause += ` AND t.created_at <= $${params.length}`; }

    const rows = await this.taskRepo.query(`
      SELECT
        d.id   AS department_id,
        d.name AS department_name,
        u.id   AS user_id,
        u.first_name AS user_first_name,
        u.last_name  AS user_last_name,
        COUNT(t.id)  AS count
      FROM tenant_ssipl.tasks t
      LEFT JOIN tenant_ssipl.users u       ON u.id::text = t.assignee_id::text
      LEFT JOIN tenant_ssipl.departments d ON d.id::text = u.department_id::text
      WHERE ${whereClause}
      GROUP BY d.id, d.name, u.id, u.first_name, u.last_name
    `, params);

    const deptMap = new Map<string, any>();
    const userList = rows.map((r: any) => {
      const key  = r.department_id || 'unassigned';
      const name = r.department_name || 'Unassigned';
      if (!deptMap.has(key)) deptMap.set(key, { departmentId: r.department_id, departmentName: name, count: 0 });
      deptMap.get(key)!.count += Number(r.count);
      return {
        userId:         r.user_id,
        userName:       r.user_id ? `${r.user_first_name || ''} ${r.user_last_name || ''}`.trim() : 'Unassigned',
        departmentName: name,
        count:          Number(r.count),
      };
    });

    return { byDepartment: Array.from(deptMap.values()), byUser: userList };
  }

  async getCompletionTrend(currentUser: any, query: ReportQueryDto) {
    const bucket     = query?.granularity === 'day' ? 'day' : query?.granularity === 'month' ? 'month' : 'week';
    const createdQb  = await this.buildBaseQuery(currentUser, query);
    const createdRows = await createdQb.select(`DATE_TRUNC('${bucket}', task.created_at)`, 'period').addSelect('COUNT(*)', 'count').groupBy('period').orderBy('period', 'ASC').getRawMany();
    const completedQb = await this.buildBaseQuery(currentUser, query);
    const completedRows = await completedQb.andWhere('task.status = :doneStatus', { doneStatus: 'DONE' }).select(`DATE_TRUNC('${bucket}', task.updated_at)`, 'period').addSelect('COUNT(*)', 'count').groupBy('period').orderBy('period', 'ASC').getRawMany();

    const map = new Map<string, any>();
    for (const r of createdRows)   { const k = new Date(r.period).toISOString(); map.set(k, { period: k, created: Number(r.count), completed: 0 }); }
    for (const r of completedRows) {
      const k = new Date(r.period).toISOString();
      if (map.has(k)) {
        map.get(k)!.completed = Number(r.count);
      } else {
        map.set(k, { period: k, created: 0, completed: Number(r.count) });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(a.period).getTime() - new Date(b.period).getTime());
  }

  // ── NEW: Individual user report ──
  async getIndividualReport(userId: string, query: ReportQueryDto) {
    const [userInfo] = await this.taskRepo.query(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              r.name AS role_name, d.name AS dept_name
       FROM tenant_ssipl.users u
       LEFT JOIN tenant_ssipl.roles r ON r.id::text = u.role_id::text
       LEFT JOIN tenant_ssipl.departments d ON d.id::text = u.department_id::text
       WHERE u.id = $1`, [userId]
    );

    const tasks = await this.taskRepo.query(
      `SELECT status, priority, type,
              COUNT(*) AS count,
              COUNT(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('DONE','CANCELLED') THEN 1 END) AS overdue
       FROM tenant_ssipl.tasks
       WHERE assignee_id = $1 AND deleted_at IS NULL
       GROUP BY status, priority, type`, [userId]
    );

    const statusMap: Record<string, number> = {};
    const priorityMap: Record<string, number> = {};
    const typeMap: Record<string, number> = {};
    let total = 0, overdue = 0;

    for (const t of tasks) {
      statusMap[t.status]     = (statusMap[t.status]   || 0) + Number(t.count);
      priorityMap[t.priority] = (priorityMap[t.priority] || 0) + Number(t.count);
      typeMap[t.type]         = (typeMap[t.type]        || 0) + Number(t.count);
      total   += Number(t.count);
      overdue += Number(t.overdue);
    }

    const done       = statusMap['DONE']        || 0;
    const inProgress = statusMap['IN_PROGRESS'] || 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    // Recent tasks
    const recentTasks = await this.taskRepo.query(
      `SELECT t.id, t.task_number, t.title, t.status, t.priority, t.due_date, t.created_at, t.extension_count
       FROM tenant_ssipl.tasks t
       WHERE t.assignee_id = $1 AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC LIMIT 10`, [userId]
    );

    return {
      user: userInfo,
      summary: { total, done, inProgress, overdue, completionRate },
      byStatus:   Object.entries(statusMap).map(([status, count])     => ({ status,   count })),
      byPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
      byType:     Object.entries(typeMap).map(([type, count])         => ({ type,     count })),
      recentTasks,
    };
  }

  // ── NEW: Department detail report ──
  async getDepartmentReport(deptId: string, query: ReportQueryDto) {
    const [dept] = await this.taskRepo.query(
      `SELECT id, name FROM tenant_ssipl.departments WHERE id = $1`, [deptId]
    );

    const members = await this.taskRepo.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role_name,
              COUNT(t.id) AS total_tasks,
              COUNT(CASE WHEN t.status = 'DONE' THEN 1 END) AS done,
              COUNT(CASE WHEN t.status = 'IN_PROGRESS' THEN 1 END) AS in_progress,
              COUNT(CASE WHEN t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('DONE','CANCELLED') THEN 1 END) AS overdue
       FROM tenant_ssipl.users u
       LEFT JOIN tenant_ssipl.roles r ON r.id::text = u.role_id::text
       LEFT JOIN tenant_ssipl.tasks t ON t.assignee_id::text = u.id::text AND t.deleted_at IS NULL
       WHERE u.department_id = $1 AND u.deleted_at IS NULL
       GROUP BY u.id, u.first_name, u.last_name, u.email, r.name
       ORDER BY total_tasks DESC`, [deptId]
    );

    const statusBreakdown = await this.taskRepo.query(
      `SELECT t.status, COUNT(*) AS count
       FROM tenant_ssipl.tasks t
       LEFT JOIN tenant_ssipl.users u ON u.id::text = t.assignee_id::text
       WHERE u.department_id = $1 AND t.deleted_at IS NULL
       GROUP BY t.status`, [deptId]
    );

    const total = members.reduce((s: number, m: any) => s + Number(m.total_tasks), 0);
    const done  = members.reduce((s: number, m: any) => s + Number(m.done), 0);

    return {
      department: dept,
      summary: {
        totalMembers: members.length,
        totalTasks:   total,
        done,
        completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
      },
      members: members.map((m: any) => ({
        ...m,
        total_tasks: Number(m.total_tasks),
        done:        Number(m.done),
        in_progress: Number(m.in_progress),
        overdue:     Number(m.overdue),
        completionRate: Number(m.total_tasks) > 0 ? Math.round((Number(m.done) / Number(m.total_tasks)) * 100) : 0,
      })),
      statusBreakdown: statusBreakdown.map((r: any) => ({ status: r.status, count: Number(r.count) })),
    };
  }

  async getSummary(currentUser: any, query: ReportQueryDto) {
    const [statusBreakdown, priorityAndOverdue, byDeptAndUser, completionTrend] = await Promise.all([
      this.getStatusBreakdown(currentUser, query),
      this.getPriorityAndOverdue(currentUser, query),
      this.getTasksByDepartmentAndUser(currentUser, query),
      this.getCompletionTrend(currentUser, query),
    ]);

    return {
      statusBreakdown,
      priority:        priorityAndOverdue.byPriority,
      overdueCount:    priorityAndOverdue.overdueCount,
      byDepartment:    byDeptAndUser.byDepartment,
      byUser:          byDeptAndUser.byUser,
      completionTrend,
    };
  }
}