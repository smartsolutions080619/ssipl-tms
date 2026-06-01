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

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private async generateTaskNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.taskRepo.count();
    const number = String(count + 1).padStart(4, '0');
    return `TSK-${year}-${number}`;
  }

  async findAll() {
    return this.taskRepo.find({
      where: { deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const task = await this.taskRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  async findSubTasks(parentId: string) {
    return this.taskRepo.find({
      where: { parentTaskId: parentId, deletedAt: IsNull() },
    });
  }

  async create(dto: CreateTaskDto, reporterId: string) {
    if (dto.parentTaskId) {
      await this.checkSubTaskDepth(dto.parentTaskId, 1);
    }

    const taskNumber = await this.generateTaskNumber();

    const task = this.taskRepo.create({
      taskNumber,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      type: dto.type,
      assigneeId: dto.assigneeId,
      reporterId,
      parentTaskId: dto.parentTaskId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(
      reporterId,
      ActivityAction.TASK_CREATED,
      saved.id,
      undefined,
      { title: saved.title, taskNumber: saved.taskNumber },
    );

    return saved;
  }

  async update(id: string, dto: UpdateTaskDto, userId: string) {
    const task = await this.findOne(id);
    const oldValue = { status: task.status };

    const action = dto.status && dto.status !== task.status
      ? ActivityAction.STATUS_CHANGED
      : ActivityAction.TASK_UPDATED;

    Object.assign(task, dto);
    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId,
      action,
      id,
      oldValue,
      { status: saved.status },
    );

    return saved;
  }

  async remove(id: string, userId: string) {
    const task = await this.findOne(id);
    task.deletedAt = new Date();
    await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId,
      ActivityAction.TASK_DELETED,
      id,
      { title: task.title, taskNumber: task.taskNumber },
      undefined,
    );

    return { message: `Task ${task.taskNumber} deleted successfully` };
  }

  async assignTask(taskId: string, assigneeId: string, userId: string) {
    const task = await this.findOne(taskId);
    const oldAssignee = task.assigneeId;
    task.assigneeId = assigneeId;
    const saved = await this.taskRepo.save(task);

    await this.activityLogService.log(
      userId,
      ActivityAction.TASK_ASSIGNED,
      taskId,
      { assigneeId: oldAssignee },
      { assigneeId },
    );

    return {
      message: `Task ${task.taskNumber} assigned successfully`,
      task: {
        id: saved.id,
        taskNumber: saved.taskNumber,
        title: saved.title,
        assigneeId: saved.assigneeId,
      },
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

    await this.activityLogService.log(
      userId,
      ActivityAction.TASK_UNASSIGNED,
      taskId,
      undefined,
      undefined,
    );

    return { message: `Task ${task.taskNumber} unassigned successfully` };
  }

  async changeStatus(taskId: string, status: string, userId: string) {
    const task = await this.findOne(taskId);
    const oldStatus = task.status;
  
    // Valid transitions check
    const validTransitions: Record<string, string[]> = {
      TODO: ['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS: ['IN_REVIEW', 'TODO', 'CANCELLED'],
      IN_REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
      DONE: ['IN_PROGRESS'],
      CANCELLED: ['TODO'],
    };
  
    const allowed = validTransitions[oldStatus] || [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Cannot change status from ${oldStatus} to ${status}. Allowed: ${allowed.join(', ')}`,
      );
    }
  
    task.status = status;
    const saved = await this.taskRepo.save(task);
  
    await this.activityLogService.log(
      userId,
      ActivityAction.STATUS_CHANGED,
      taskId,
      { status: oldStatus },
      { status },
    );
  
    return {
      message: `Status changed from ${oldStatus} to ${status}`,
      task: {
        id: saved.id,
        taskNumber: saved.taskNumber,
        status: saved.status,
      },
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