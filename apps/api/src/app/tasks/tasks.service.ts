/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityAction } from '../activity/activity-log.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async generateTaskNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.taskRepo.count();
    const number = String(count + 1).padStart(4, '0');
    return `TSK-${year}-${number}`;
  }

  async findAll(
    filters?: {
      status?: string;
      priority?: string;
      type?: string;
      assigneeId?: string;
      search?: string;
    },
    currentUser?: { userId: string; role: string },
  ) {
    const query = this.taskRepo.createQueryBuilder('task')
      .leftJoin('users', 'assignee', 'assignee.id::text = task.assignee_id::text')
      .leftJoin('users', 'reporter', 'reporter.id::text = task.reporter_id::text')
      .leftJoin('departments', 'dept', 'dept.id::text = task.department_id::text')
      .addSelect([
        'task.id', 'task.task_number', 'task.title', 'task.description',
        'task.status', 'task.priority', 'task.type',
        'task.assignee_id', 'task.reporter_id', 'task.parent_task_id',
        'task.due_date', 'task.created_at', 'task.updated_at',
        'task.extension_count', 'task.original_due_date', 'task.last_extended_at',
        'task.is_recurring', 'task.recurrence_frequency', 'task.recurrence_end_date',
        'task.next_recurrence_date', 'task.department_id',
      ])
      .addSelect('assignee.first_name', 'assignee_first_name')
      .addSelect('assignee.last_name',  'assignee_last_name')
      .addSelect('assignee.email',      'assignee_email')
      .addSelect('reporter.first_name', 'reporter_first_name')
      .addSelect('reporter.last_name',  'reporter_last_name')
      .addSelect('dept.name',           'department_name')
      .where('task.deleted_at IS NULL');

    if (!currentUser) return [];

    const roleResult = await this.taskRepo.query(
      `SELECT r.permissions, des.view_departmentless_tasks AS "viewDepartmentlessTasks"
       FROM tenant_ssipl.users u
       LEFT JOIN tenant_ssipl.roles r          ON u.role_id = r.id
       LEFT JOIN tenant_ssipl.designations des ON u.designation_id = des.id
       WHERE u.id = $1 LIMIT 1`,
      [currentUser.userId]
    );

    const permissions: string[] = roleResult?.[0]?.permissions || [];
    const canViewAll  = permissions.includes('task:view_all');
    const canViewDept = permissions.includes('task:view_department');
    const roleLower   = currentUser.role?.toLowerCase() || '';
    const viewerIsSenior = roleLower === 'admin' || roleResult?.[0]?.viewDepartmentlessTasks === true;

    let isInEveryDepartment = false;
    if (!canViewAll && roleLower !== 'admin') {
      const [{ total, mine }] = await this.taskRepo.query(
        `SELECT
           (SELECT COUNT(*)::int FROM departments) AS total,
           (SELECT COUNT(*)::int FROM user_departments WHERE user_id = $1) AS mine`,
        [currentUser.userId]
      );
      isInEveryDepartment = total > 0 && mine >= total;
    }

    const departmentlessRows = await this.taskRepo.query(
      `SELECT u.id FROM tenant_ssipl.users u
       WHERE u.deleted_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM tenant_ssipl.user_departments ud WHERE ud.user_id = u.id)`
    );
    const departmentlessUserIds: string[] = departmentlessRows.map((r: { id: string }) => r.id);

    let extraVisibilityUserIds: string[] = [];
    if (!(canViewAll || roleLower === 'admin' || isInEveryDepartment)) {
      const personalExtraDeptRows = await this.taskRepo.query(
        `SELECT department_id FROM tenant_ssipl.user_extra_departments WHERE viewer_user_id = $1`,
        [currentUser.userId]
      );
      const grantedDeptIds = personalExtraDeptRows.map((r: { department_id: string }) => r.department_id);

      let deptBasedUserIds: string[] = [];
      if (grantedDeptIds.length > 0) {
        const extraDeptUsers = await this.taskRepo.query(
          `SELECT DISTINCT u.id FROM tenant_ssipl.users u
           INNER JOIN tenant_ssipl.user_departments ud ON ud.user_id = u.id
           WHERE u.deleted_at IS NULL AND ud.department_id = ANY($1::uuid[])`,
          [grantedDeptIds]
        );
        deptBasedUserIds = extraDeptUsers.map((u: { id: string }) => u.id);
      }

      const personalExtraDesigRows = await this.taskRepo.query(
        `SELECT designation_id FROM tenant_ssipl.user_extra_designations WHERE viewer_user_id = $1`,
        [currentUser.userId]
      );
      const grantedDesigIds = personalExtraDesigRows.map((r: { designation_id: string }) => r.designation_id);

      let desigBasedUserIds: string[] = [];
      if (grantedDesigIds.length > 0) {
        const extraDesigUsers = await this.taskRepo.query(
          `SELECT id FROM tenant_ssipl.users WHERE deleted_at IS NULL AND designation_id = ANY($1::uuid[])`,
          [grantedDesigIds]
        );
        desigBasedUserIds = extraDesigUsers.map((u: { id: string }) => u.id);
      }

      extraVisibilityUserIds = [...new Set([
        ...deptBasedUserIds,
        ...desigBasedUserIds,
        ...(viewerIsSenior ? departmentlessUserIds : []),
      ])];
    }
    const extraVisibilityClause = extraVisibilityUserIds.length > 0
      ? ' OR task.assignee_id IN (:...extraVisibilityUserIds) OR task.reporter_id IN (:...extraVisibilityUserIds)'
      : '';
    const extraVisibilityParams = extraVisibilityUserIds.length > 0 ? { extraVisibilityUserIds } : {};

    if (roleLower === 'admin') {
      // Admin bypasses all visibility rules.
    } else {
      const hasDepartmentless = departmentlessUserIds.length > 0;
      const departmentlessGuard = (!viewerIsSenior && hasDepartmentless)
        ? 'NOT (task.assignee_id IN (:...departmentlessUserIds) OR task.reporter_id IN (:...departmentlessUserIds))'
        : '1=1';
      const departmentlessParams = (!viewerIsSenior && hasDepartmentless) ? { departmentlessUserIds } : {};

      if (canViewAll || isInEveryDepartment) {
        query.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId OR (${departmentlessGuard}))`,
          { userId: currentUser.userId, ...departmentlessParams }
        );
      } else if (canViewDept) {
        const deptUsers = await this.taskRepo.query(
          `SELECT DISTINCT u.id FROM tenant_ssipl.users u
           WHERE u.deleted_at IS NULL
             AND EXISTS (
               SELECT 1 FROM tenant_ssipl.user_departments ud_self
               JOIN tenant_ssipl.user_departments ud_other
                 ON ud_other.department_id = ud_self.department_id
               WHERE ud_self.user_id = $1 AND ud_other.user_id = u.id
             )`,
          [currentUser.userId]
        );
        const deptUserIds = deptUsers.map((u: { id: string }) => u.id);

        if (deptUserIds.length > 0) {
          const rootOwnedRows = await this.taskRepo.query(
            `
            WITH RECURSIVE task_lineage AS (
              SELECT id, parent_task_id, assignee_id AS root_assignee_id
              FROM tenant_ssipl.tasks
              WHERE parent_task_id IS NULL

              UNION ALL

              SELECT t.id, t.parent_task_id, tl.root_assignee_id
              FROM tenant_ssipl.tasks t
              JOIN task_lineage tl ON t.parent_task_id = tl.id
            )
            SELECT id FROM task_lineage WHERE root_assignee_id = ANY($1)
            `,
            [deptUserIds]
          );
          const rootOwnedTaskIds: string[] = rootOwnedRows.map((r: { id: string }) => r.id);

          query.andWhere(
            `(task.assignee_id = :userId OR task.reporter_id = :userId OR (
                (task.assignee_id IN (:...deptUserIds)
                  OR task.reporter_id IN (:...deptUserIds)
                  OR task.id IN (:...rootOwnedTaskIds)${extraVisibilityClause})
                AND ${departmentlessGuard}
              ))`,
            {
              userId: currentUser.userId,
              deptUserIds,
              // avoid an empty IN () which some drivers choke on
              rootOwnedTaskIds: rootOwnedTaskIds.length > 0 ? rootOwnedTaskIds : ['00000000-0000-0000-0000-000000000000'],
              ...extraVisibilityParams,
              ...departmentlessParams,
            }
          );
        } else {
          query.andWhere(
            `(task.assignee_id = :userId OR task.reporter_id = :userId OR ((1=0${extraVisibilityClause}) AND ${departmentlessGuard}))`,
            { userId: currentUser.userId, ...extraVisibilityParams, ...departmentlessParams }
          );
        }
      } else {
        query.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId OR ((1=0${extraVisibilityClause}) AND ${departmentlessGuard}))`,
          { userId: currentUser.userId, ...extraVisibilityParams, ...departmentlessParams }
        );
      }
    }

    // Apply filters
    if (filters?.status)     query.andWhere('task.status = :status',           { status: filters.status });
    if (filters?.priority)   query.andWhere('task.priority = :priority',       { priority: filters.priority });
    if (filters?.type)       query.andWhere('task.type = :type',               { type: filters.type });
    if (filters?.assigneeId) query.andWhere('task.assignee_id = :assigneeId',  { assigneeId: filters.assigneeId });
    if (filters?.search) {
      query.andWhere(
        '(LOWER(task.title) LIKE :search OR LOWER(task.description) LIKE :search OR task.task_number LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }

    const raw = await query.orderBy('task.created_at', 'DESC').getRawMany();

    return raw.map(r => ({
      id:              r.task_id,
      taskNumber:      r.task_task_number,
      title:           r.task_title,
      description:     r.task_description,
      status:          r.task_status,
      priority:        r.task_priority,
      type:            r.task_type,
      assigneeId:      r.task_assignee_id,
      reporterId:      r.task_reporter_id,
      parentTaskId:    r.task_parent_task_id,
      dueDate:         r.task_due_date,
      createdAt:       r.task_created_at,
      updatedAt:       r.task_updated_at,
      extensionCount:  r.task_extension_count  ?? 0,
      originalDueDate: r.task_original_due_date ?? null,
      lastExtendedAt:  r.task_last_extended_at  ?? null,
      isRecurring:          r.task_is_recurring ?? false,
      recurrenceFrequency:  r.task_recurrence_frequency ?? null,
      recurrenceEndDate:    r.task_recurrence_end_date  ?? null,
      nextRecurrenceDate:   r.task_next_recurrence_date ?? null,
      departmentId:   r.task_department_id ?? null,
      departmentName: r.department_name    ?? null,
      assignee: r.task_assignee_id ? {
        id:        r.task_assignee_id,
        firstName: r.assignee_first_name,
        lastName:  r.assignee_last_name,
        email:     r.assignee_email,
      } : null,
      reporter: r.task_reporter_id ? {
        id:        r.task_reporter_id,
        firstName: r.reporter_first_name,
        lastName:  r.reporter_last_name,
      } : null,
    }));
  }

  async findOne(id: string) {
    const task = await this.taskRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findSubTasks(parentId: string) {
    return this.taskRepo.find({ where: { parentTaskId: parentId, deletedAt: IsNull() } });
  }

  async create(dto: CreateTaskDto, creatorId: string, creatorRole?: string) {
    // Admins must hand a task off to someone — only regular employees may
    // leave a task unassigned (e.g. a self-tracked to-do for themselves).
    if ((creatorRole || '').toLowerCase() === 'admin' && !dto.assigneeId) {
      throw new BadRequestException('Please assign this task to someone — Admins cannot leave a task unassigned.');
    }

    // The date picker already blocks past dates client-side, but that's just
    // UI — re-check here since dueDate can be sent directly via the API.
    if (dto.dueDate) {
      const todayUtcMidnight = new Date();
      todayUtcMidnight.setUTCHours(0, 0, 0, 0);
      if (new Date(dto.dueDate) < todayUtcMidnight) {
        throw new BadRequestException('Due date cannot be in the past.');
      }
    }

    if (dto.parentTaskId) {
      await this.checkSubTaskDepth(dto.parentTaskId, 1);
    }

    // The task's "reporter" — defaults to whoever is creating it, but can
    // be explicitly set to someone else (e.g. "log this on behalf of X").
    // Every existing visibility/notification rule already keys off
    // reporterId, so setting it here is enough for those rules to apply
    // correctly to whoever ends up as the reporter — no other change needed.
    const reporterId = dto.reporterId || creatorId;

    const taskNumber = await this.generateTaskNumber();

    const task = this.taskRepo.create({
      taskNumber,
      title:        dto.title,
      description:  dto.description,
      priority:     dto.priority,
      type:         dto.type,
      assigneeId:   dto.assigneeId,
      reporterId,
      parentTaskId: dto.parentTaskId,
      projectId:    dto.projectId,
      departmentId: dto.departmentId ?? null,
      dueDate:      dto.dueDate ? new Date(dto.dueDate) : undefined,
      // ── Recurrence ──
      isRecurring:          dto.isRecurring ?? false,
      recurrenceFrequency:  dto.recurrenceFrequency ?? null,
      recurrenceEndDate:    dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null,
      nextRecurrenceDate:   dto.isRecurring ? this.computeNextDate(dto.recurrenceFrequency!) : null,
    });

    const saved = await this.taskRepo.save(task);

    // Activity log always credits whoever actually clicked "Create" —
    // that's the real audit trail, separate from the chosen reporter.
    await this.activityLogService.log(
      creatorId, ActivityAction.TASK_CREATED, saved.id,
      undefined,
      { title: saved.title, taskNumber: saved.taskNumber },
    );

    if (dto.assigneeId && dto.assigneeId !== reporterId) {
      await this.notificationsService.notifyTaskAssigned(
        dto.assigneeId, saved.taskNumber, saved.title,
      );
    }

    // If someone else was set as the reporter (not the creator, and not
    // already notified as the assignee), let them know a task now exists
    // under their name.
    if (dto.reporterId && dto.reporterId !== creatorId && dto.reporterId !== dto.assigneeId) {
      await this.notificationsService.create(
        dto.reporterId,
        'Task reported under your name',
        `${saved.taskNumber}: "${saved.title}" was created with you as the reporter`,
        undefined,
        `/tasks/${saved.id}`,
      );
    }

    return saved;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const task     = await this.findOne(id);
    const oldValue = { status: task.status };
    const oldAssigneeId = task.assigneeId;
    const oldReporterId = task.reporterId;

    const action = dto.status && dto.status !== task.status
      ? ActivityAction.STATUS_CHANGED
      : ActivityAction.TASK_UPDATED;

    Object.assign(task, dto);
    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(userId, action, id, oldValue, { status: saved.status });

    if (dto.assigneeId && dto.assigneeId !== oldAssigneeId && dto.assigneeId !== userId) {
      await this.notificationsService.notifyTaskAssigned(
        dto.assigneeId, saved.taskNumber, saved.title,
      );
    }

    if (dto.reporterId && dto.reporterId !== oldReporterId && dto.reporterId !== userId) {
      await this.notificationsService.create(
        dto.reporterId,
        'Task reported under your name',
        `${saved.taskNumber}: "${saved.title}" now has you as the reporter`,
        undefined,
        `/tasks/${saved.id}`,
      );
    }

    return saved;
  }

  async remove(id: string, requester: { userId: string; role?: string; permissions?: string[] }) {
    const task = await this.findOne(id);

    // Admins and anyone with task:delete can remove any task. Otherwise, an
    // employee may only delete a task that's genuinely their own — one they
    // created for themselves (unassigned or self-assigned) — not one someone
    // else assigned to them, and not one they merely reported on someone
    // else's behalf.
    const roleLower  = (requester.role || '').toLowerCase();
    const isOwnTask   = task.reporterId === requester.userId
      && (!task.assigneeId || task.assigneeId === requester.userId);
    const canDelete   = roleLower === 'admin'
      || (requester.permissions || []).includes('task:delete')
      || isOwnTask;

    if (!canDelete) {
      throw new ForbiddenException('You do not have permission to delete this task');
    }

    task.deletedAt = new Date();
    await this.taskRepo.save(task);

    await this.activityLogService.log(
      requester.userId, ActivityAction.TASK_DELETED, id,
      { title: task.title, taskNumber: task.taskNumber },
      undefined,
    );

    return { message: `Task ${task.taskNumber} deleted successfully` };
  }

  async assignTask(taskId: string, assigneeId: string, userId: string) {
    const task        = await this.findOne(taskId);
    const oldAssignee = task.assigneeId;
    task.assigneeId   = assigneeId;
    const saved       = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId, ActivityAction.TASK_ASSIGNED, taskId,
      { assigneeId: oldAssignee },
      { assigneeId },
    );

    if (assigneeId !== userId) {
      await this.notificationsService.notifyTaskAssigned(assigneeId, task.taskNumber, task.title);
    }

    return {
      message: `Task ${task.taskNumber} assigned successfully`,
      task: { id: saved.id, taskNumber: saved.taskNumber, title: saved.title, assigneeId: saved.assigneeId },
    };
  }

  async getMyTasks(userId: string) {
    return this.taskRepo.find({
      where: { assigneeId: userId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async unassignTask(taskId: string, userId: string) {
    const task = await this.findOne(taskId);
    task.assigneeId = null as unknown as string;
    await this.taskRepo.save(task);

    await this.activityLogService.log(userId, ActivityAction.TASK_UNASSIGNED, taskId, undefined, undefined);

    return { message: `Task ${task.taskNumber} unassigned successfully` };
  }

  async changeStatus(taskId: string, status: string, userId: string) {
    const task      = await this.findOne(taskId);
    const oldStatus = task.status;

    const validTransitions: Record<string, string[]> = {
      TODO:        ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['IN_REVIEW', 'TODO', 'CANCELLED'],
      IN_REVIEW:   ['DONE', 'IN_PROGRESS', 'CANCELLED'],
      DONE:        ['IN_PROGRESS'],
      CANCELLED:   ['TODO'],
    };

    const allowed = validTransitions[oldStatus] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot change status from ${oldStatus} to ${status}. Allowed: ${allowed.join(', ')}`,
      );
    }

    task.status = status;
    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(userId, ActivityAction.STATUS_CHANGED, taskId, { status: oldStatus }, { status });

    if (task.assigneeId && task.assigneeId !== userId) {
      await this.notificationsService.create(
        task.assigneeId,
        `Task ${task.taskNumber} status updated`,
        `Status changed: ${oldStatus.replace('_', ' ')} → ${status.replace('_', ' ')}`,
        { taskNumber: task.taskNumber, type: 'STATUS_CHANGED' },
      );
    }

    return {
      message: `Status changed from ${oldStatus} to ${status}`,
      task: { id: saved.id, taskNumber: saved.taskNumber, status: saved.status },
    };
  }

  async rejectTask(taskId: string, reason: string, reassignTo: string, userId: string) {
    const task = await this.findOne(taskId);

    if (!['IN_REVIEW', 'DONE', 'CANCELLED'].includes(task.status)) {
      throw new BadRequestException(
        `Cannot reject task with status "${task.status}". Only IN_REVIEW, DONE or CANCELLED tasks can be sent back.`,
      );
    }

    const oldStatus   = task.status;
    const oldAssignee = task.assigneeId;

    task.status = oldStatus === 'CANCELLED' ? 'TODO' : 'IN_PROGRESS';
    if (reassignTo) task.assigneeId = reassignTo;

    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId, ActivityAction.STATUS_CHANGED, taskId,
      { status: oldStatus, assigneeId: oldAssignee },
      { status: task.status, assigneeId: task.assigneeId, reason },
    );

    if (reassignTo && reassignTo !== oldAssignee) {
      await this.notificationsService.notifyTaskAssigned(reassignTo, task.taskNumber, task.title);
    }

    if (oldAssignee) {
      await this.notificationsService.create(
        oldAssignee,
        'Task Sent Back',
        `Task ${task.taskNumber} was sent back: ${reason || 'Needs revision'}`,
        { taskNumber: task.taskNumber, type: 'TASK_REJECTED' },
      );
    }

    return {
      message: `Task ${task.taskNumber} sent back to ${task.status.replace('_', ' ')}`,
      task: { id: saved.id, taskNumber: saved.taskNumber, status: saved.status, assigneeId: saved.assigneeId },
    };
  }

  async undoTask(taskId: string, userId: string) {
    const task = await this.findOne(taskId);

    const undoMap: Record<string, string> = {
      DONE:        'IN_PROGRESS',
      CANCELLED:   'TODO',
      IN_REVIEW:   'IN_PROGRESS',
      IN_PROGRESS: 'TODO',
    };

    const newStatus = undoMap[task.status];
    if (!newStatus) {
      throw new BadRequestException(`Cannot undo task with status "${task.status}"`);
    }

    const oldStatus = task.status;
    task.status     = newStatus;
    const saved     = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId, ActivityAction.STATUS_CHANGED, taskId,
      { status: oldStatus },
      { status: newStatus, action: 'UNDO' },
    );

    return {
      message: `Task ${task.taskNumber} reverted from ${oldStatus} to ${newStatus}`,
      task: { id: saved.id, taskNumber: saved.taskNumber, status: saved.status },
    };
  }

  async getTaskComments(taskId: string) {
    await this.findOne(taskId);
    return this.taskRepo.query(
      `SELECT c.*, u.first_name, u.last_name, u.email
       FROM tenant_ssipl.comments c
       LEFT JOIN tenant_ssipl.users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId],
    );
  }

  async addComment(taskId: string, content: string, userId: string) {
    await this.findOne(taskId);

    const result = await this.taskRepo.query(
      `INSERT INTO tenant_ssipl.comments (id, task_id, user_id, content, created_at, updated_at)
       VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [taskId, userId, content],
    );

    await this.activityLogService.log(
      userId, ActivityAction.TASK_UPDATED, taskId,
      undefined,
      { action: 'COMMENT_ADDED', preview: content.slice(0, 80) },
    );

    return result[0];
  }

  async getTaskActivity(taskId: string) {
    await this.findOne(taskId);
    return this.taskRepo.query(
      `SELECT a.*, u.first_name, u.last_name
       FROM tenant_ssipl.activity_logs a
       LEFT JOIN tenant_ssipl.users u ON a.user_id = u.id
       WHERE a.task_id = $1
       ORDER BY a.created_at DESC`,
      [taskId],
    );
  }

  async updateDueDate(taskId: string, dueDate: string, userId: string) {
    const task   = await this.findOne(taskId);
    const old    = task.dueDate;
    task.dueDate = dueDate ? new Date(dueDate) : null;
    const saved  = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId, ActivityAction.TASK_UPDATED, taskId,
      { dueDate: old },
      { dueDate: task.dueDate },
    );

    return {
      message: 'Due date updated',
      task: { id: saved.id, taskNumber: saved.taskNumber, dueDate: saved.dueDate },
    };
  }

  async updatePriority(taskId: string, priority: string, userId: string) {
    const task    = await this.findOne(taskId);
    const old     = task.priority;
    task.priority = priority;
    const saved   = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId, ActivityAction.TASK_UPDATED, taskId,
      { priority: old },
      { priority },
    );

    return {
      message: 'Priority updated',
      task: { id: saved.id, taskNumber: saved.taskNumber, priority: saved.priority },
    };
  }

  // ── Compute first nextRecurrenceDate from today ──
  private computeNextDate(freq: string): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0); // normalize to midnight so it matches the cron's
                            // midnight comparison — otherwise a task created
                            // at, say, 3:47 PM would need "tomorrow 3:47 PM"
                            // to be <= "tomorrow midnight", which never happens
    switch (freq) {
      case 'DAILY':       d.setDate(d.getDate() + 1);       break;
      case 'WEEKLY':      d.setDate(d.getDate() + 7);       break;
      case 'FORTNIGHTLY': d.setDate(d.getDate() + 14);      break;
      case 'MONTHLY':     d.setMonth(d.getMonth() + 1);     break;
      case 'QUARTERLY':   d.setMonth(d.getMonth() + 3);     break;
      case 'HALF_YEARLY': d.setMonth(d.getMonth() + 6);     break;
      case 'YEARLY':      d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
  }

  private async checkSubTaskDepth(parentId: string, currentDepth: number): Promise<void> {
    if (currentDepth >= 3) {
      throw new BadRequestException('Maximum sub-task depth of 3 levels exceeded');
    }
    const parent = await this.taskRepo.findOne({ where: { id: parentId } });
    if (parent?.parentTaskId) {
      await this.checkSubTaskDepth(parent.parentTaskId, currentDepth + 1);
    }
  }

  // ── Extend task deadline ──
  async extendDeadline(taskId: string, newDueDate: string, userId: string) {
    const task = await this.findOne(taskId);

    if (!task.dueDate) throw new BadRequestException('Task has no due date to extend');

    const originalDueDate = (task as any).originalDueDate || task.dueDate;

    await this.taskRepo.query(
      `UPDATE tenant_ssipl.tasks
       SET due_date          = $1,
           extension_count   = COALESCE(extension_count, 0) + 1,
           last_extended_at  = NOW(),
           original_due_date = COALESCE(original_due_date, $2),
           updated_at        = NOW()
       WHERE id = $3`,
      [newDueDate, originalDueDate, taskId]
    );

    await this.activityLogService.log(
      userId, ActivityAction.TASK_UPDATED, taskId,
      { dueDate: task.dueDate },
      { dueDate: newDueDate, action: 'DEADLINE_EXTENDED', extensionCount: ((task as any).extensionCount || 0) + 1 },
    );

    if (task.assigneeId && task.assigneeId !== userId) {
      await this.notificationsService.create(
        task.assigneeId,
        `⏰ Task deadline extended: ${task.taskNumber}`,
        `Deadline for "${task.title}" extended to ${new Date(newDueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        { type: 'DEADLINE_EXTENDED', taskId },
      );
    }

    return {
      message: 'Deadline extended successfully',
      task: { id: taskId, newDueDate, extensionCount: ((task as any).extensionCount || 0) + 1 },
    };
  }
}