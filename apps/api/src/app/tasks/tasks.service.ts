import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
    currentUser?: any,
  ) {
    const query = this.taskRepo.createQueryBuilder('task')
      .leftJoin('users', 'assignee', 'assignee.id::text = task.assignee_id::text')
      .leftJoin('users', 'reporter', 'reporter.id::text = task.reporter_id::text')
      .addSelect([
        'task.id', 'task.task_number', 'task.title', 'task.description',
        'task.status', 'task.priority', 'task.type',
        'task.assignee_id', 'task.reporter_id', 'task.parent_task_id',
        'task.due_date', 'task.created_at', 'task.updated_at',
      ])
      .addSelect('assignee.first_name', 'assignee_first_name')
      .addSelect('assignee.last_name',  'assignee_last_name')
      .addSelect('assignee.email',      'assignee_email')
      .addSelect('reporter.first_name', 'reporter_first_name')
      .addSelect('reporter.last_name',  'reporter_last_name')
      .where('task.deleted_at IS NULL');

    // ── Role-based visibility ──
    const role = currentUser?.role?.toLowerCase();

    if (role === 'admin') {
      // Admin sees ALL tasks — no filter
    } else if (role === 'manager' || role === 'team lead') {
      // Manager sees: tasks assigned to them + tasks of users in their department
      const deptUsers = await this.taskRepo.query(
        `SELECT id FROM users
         WHERE department_id = (
           SELECT department_id FROM users WHERE id = $1
         ) AND deleted_at IS NULL`,
        [currentUser.userId]
      );
      const deptUserIds = deptUsers.map((u: any) => u.id);

      if (deptUserIds.length > 0) {
        query.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId OR task.assignee_id IN (:...deptUserIds))`,
          { userId: currentUser.userId, deptUserIds }
        );
      } else {
        query.andWhere(
          `(task.assignee_id = :userId OR task.reporter_id = :userId)`,
          { userId: currentUser.userId }
        );
      }
    } else {
      // Employee sees ONLY their own assigned/reported tasks
      query.andWhere(
        `(task.assignee_id = :userId OR task.reporter_id = :userId)`,
        { userId: currentUser.userId }
      );
    }

    // Apply filters
    if (filters?.status)     query.andWhere('task.status = :status',             { status: filters.status });
    if (filters?.priority)   query.andWhere('task.priority = :priority',         { priority: filters.priority });
    if (filters?.type)       query.andWhere('task.type = :type',                 { type: filters.type });
    if (filters?.assigneeId) query.andWhere('task.assignee_id = :assigneeId',    { assigneeId: filters.assigneeId });
    if (filters?.search) {
      query.andWhere(
        '(LOWER(task.title) LIKE :search OR LOWER(task.description) LIKE :search OR task.task_number LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }

    const raw = await query.orderBy('task.created_at', 'DESC').getRawMany();

    return raw.map(r => ({
      id:           r.task_id,
      taskNumber:   r.task_task_number,
      title:        r.task_title,
      description:  r.task_description,
      status:       r.task_status,
      priority:     r.task_priority,
      type:         r.task_type,
      assigneeId:   r.task_assignee_id,
      reporterId:   r.task_reporter_id,
      parentTaskId: r.task_parent_task_id,
      dueDate:      r.task_due_date,
      createdAt:    r.task_created_at,
      updatedAt:    r.task_updated_at,
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

  async create(dto: CreateTaskDto, reporterId: string) {
    if (dto.parentTaskId) {
      await this.checkSubTaskDepth(dto.parentTaskId, 1);
    }

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
      dueDate:      dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    const saved = await this.taskRepo.save(task);

    // Activity log
    await this.activityLogService.log(
      reporterId,
      ActivityAction.TASK_CREATED,
      saved.id,
      undefined,
      { title: saved.title, taskNumber: saved.taskNumber },
    );

    // ── Notify assignee if task created with assignee ──
    if (dto.assigneeId && dto.assigneeId !== reporterId) {
      await this.notificationsService.notifyTaskAssigned(
        dto.assigneeId,
        saved.taskNumber,
        saved.title,
      );
    }

    return saved;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const task     = await this.findOne(id);
    const oldValue = { status: task.status };
    const oldAssigneeId = task.assigneeId;

    const action = dto.status && dto.status !== task.status
      ? ActivityAction.STATUS_CHANGED
      : ActivityAction.TASK_UPDATED;

    Object.assign(task, dto);
    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(userId, action, id, oldValue, { status: saved.status });

    // ── Notify if assignee changed ──
    if (dto.assigneeId && dto.assigneeId !== oldAssigneeId && dto.assigneeId !== userId) {
      await this.notificationsService.notifyTaskAssigned(
        dto.assigneeId,
        saved.taskNumber,
        saved.title,
      );
    }

    return saved;
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    task.deletedAt = new Date();
    await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId, ActivityAction.TASK_DELETED, id,
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

    // Notify new assignee
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
    task.assigneeId = null;
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

    // ── Notify assignee about status change ──
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

    // Notify new assignee if reassigned
    if (reassignTo && reassignTo !== oldAssignee) {
      await this.notificationsService.notifyTaskAssigned(reassignTo, task.taskNumber, task.title);
    }

    // Notify original assignee that task was sent back
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
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.task_id = $1
       ORDER BY c.created_at ASC`,
      [taskId],
    );
  }

  async addComment(taskId: string, content: string, userId: string) {
    await this.findOne(taskId);

    const result = await this.taskRepo.query(
      `INSERT INTO comments (id, task_id, user_id, content, created_at, updated_at)
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
       FROM activity_logs a
       LEFT JOIN users u ON a.user_id = u.id
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

  private async checkSubTaskDepth(parentId: string, currentDepth: number): Promise<void> {
    if (currentDepth >= 3) {
      throw new BadRequestException('Maximum sub-task depth of 3 levels exceeded');
    }
    const parent = await this.taskRepo.findOne({ where: { id: parentId } });
    if (parent?.parentTaskId) {
      await this.checkSubTaskDepth(parent.parentTaskId, currentDepth + 1);
    }
  }
}