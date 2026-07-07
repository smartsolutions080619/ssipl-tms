/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, LessThanOrEqual } from 'typeorm';
import { Task, RecurrenceFrequency, TaskStatus } from './task.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RecurringTaskService {
  private readonly logger = new Logger(RecurringTaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly notifService: NotificationsService,
  ) {}

  // ── Runs every day at midnight ──
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async spawnDueTasks() {
    this.logger.log('Checking for recurring tasks to spawn...');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all recurring template tasks whose nextRecurrenceDate is today or past
    const templates = await this.taskRepo.find({
      where: {
        isRecurring: true,
        deletedAt: IsNull(),
        nextRecurrenceDate: LessThanOrEqual(today),
        recurrenceParentId: IsNull(), // only original templates, not spawned copies
      },
    });

    this.logger.log(`Found ${templates.length} recurring tasks to process`);

    for (const template of templates) {
      // Stop if recurrence end date has passed
      if (template.recurrenceEndDate && template.recurrenceEndDate < today) {
        this.logger.log(`Recurrence ended for task ${template.taskNumber}`);
        continue;
      }

      try {
        await this.spawnTask(template);
        await this.updateNextRecurrenceDate(template);
      } catch (err: any) {
        this.logger.error(`Failed to spawn task ${template.taskNumber}: ${err?.message}`);
      }
    }
  }

  // ── Create a new task instance from a template ──
  private async spawnTask(template: Task) {
    const count = await this.taskRepo.count();
    const taskNumber = `TSK-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

    const dueDate = this.computeDueDate(template.recurrenceFrequency!);

    const spawned = this.taskRepo.create({
      taskNumber,
      title:             template.title,
      description:       template.description,
      priority:          template.priority,
      type:              template.type,
      assigneeId:        template.assigneeId,
      reporterId:        template.reporterId,
      projectId:         template.projectId,
      status:            TaskStatus.TODO,
      isRecurring:       false,        // spawned copies are NOT templates
      recurrenceParentId: template.id, // points back to original
      dueDate,
    });

    const saved = await this.taskRepo.save(spawned);

    // Notify the assignee
    if (template.assigneeId) {
      await this.notifService.create(
        template.assigneeId,
        `🔁 Recurring task assigned: ${saved.taskNumber}`,
        `A new instance of "${template.title}" has been created for you (${this.freqLabel(template.recurrenceFrequency!)})`,
        { type: 'RECURRING_TASK', taskId: saved.id, taskNumber: saved.taskNumber },
      );
    }

    this.logger.log(`Spawned ${saved.taskNumber} from template ${template.taskNumber}`);
    return saved;
  }

  // ── Calculate the due date of the new task based on frequency ──
  private computeDueDate(freq: RecurrenceFrequency): Date {
    const d = new Date();
    switch (freq) {
      case RecurrenceFrequency.DAILY:       d.setDate(d.getDate() + 1);      break;
      case RecurrenceFrequency.WEEKLY:      d.setDate(d.getDate() + 7);      break;
      case RecurrenceFrequency.MONTHLY:     d.setMonth(d.getMonth() + 1);    break;
      case RecurrenceFrequency.QUARTERLY:   d.setMonth(d.getMonth() + 3);    break;
      case RecurrenceFrequency.HALF_YEARLY: d.setMonth(d.getMonth() + 6);    break;
      case RecurrenceFrequency.YEARLY:      d.setFullYear(d.getFullYear()+1); break;
    }
    return d;
  }

  // ── Advance the template's nextRecurrenceDate ──
  private async updateNextRecurrenceDate(template: Task) {
    const next = new Date(template.nextRecurrenceDate!);
    next.setHours(0, 0, 0, 0); // keep it pinned to midnight every cycle
    switch (template.recurrenceFrequency) {
      case RecurrenceFrequency.DAILY:       next.setDate(next.getDate() + 1);      break;
      case RecurrenceFrequency.WEEKLY:      next.setDate(next.getDate() + 7);      break;
      case RecurrenceFrequency.MONTHLY:     next.setMonth(next.getMonth() + 1);    break;
      case RecurrenceFrequency.QUARTERLY:   next.setMonth(next.getMonth() + 3);    break;
      case RecurrenceFrequency.HALF_YEARLY: next.setMonth(next.getMonth() + 6);    break;
      case RecurrenceFrequency.YEARLY:      next.setFullYear(next.getFullYear()+1); break;
    }
    await this.taskRepo.update(template.id, { nextRecurrenceDate: next });
  }

  private freqLabel(freq: RecurrenceFrequency): string {
    const map: Record<RecurrenceFrequency, string> = {
      DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly',
      QUARTERLY: 'Quarterly', HALF_YEARLY: 'Half-yearly', YEARLY: 'Yearly',
    };
    return map[freq] || freq;
  }
}