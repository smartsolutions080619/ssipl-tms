import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum TaskStatus {
  TODO        = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW   = 'IN_REVIEW',
  DONE        = 'DONE',
  CANCELLED   = 'CANCELLED',
}

export enum TaskPriority {
  LOW      = 'LOW',
  MEDIUM   = 'MEDIUM',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum TaskType {
  TASK        = 'TASK',
  BUG         = 'BUG',
  FEATURE     = 'FEATURE',
  IMPROVEMENT = 'IMPROVEMENT',
}

export enum RecurrenceFrequency {
  DAILY       = 'DAILY',
  WEEKLY      = 'WEEKLY',
  FORTNIGHTLY = 'FORTNIGHTLY',
  MONTHLY     = 'MONTHLY',
  QUARTERLY   = 'QUARTERLY',
  HALF_YEARLY = 'HALF_YEARLY',
  YEARLY      = 'YEARLY',
}

@Entity({ name: 'tasks' })
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_number', unique: true })
  taskNumber!: string;

  @Column()
  title!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ default: TaskStatus.TODO })
  status!: string;

  @Column({ default: TaskPriority.MEDIUM })
  priority!: string;

  @Column({ default: TaskType.TASK })
  type!: string;

  @Column({ name: 'assignee_id', nullable: true })
  assigneeId!: string;

  @Column({ name: 'reporter_id', nullable: true })
  reporterId!: string;

  @Column({ name: 'parent_task_id', nullable: true })
  parentTaskId!: string;

  @Column({ name: 'project_id', nullable: true })
  projectId!: string | null;

  @Column({ name: 'department_id', nullable: true })
  departmentId!: string | null;

  @Column({ name: 'due_date', nullable: true })
  dueDate!: Date | null;

  // ── Extension tracking ──
  @Column({ name: 'extension_count', type: 'int', default: 0 })
  extensionCount!: number;

  @Column({ name: 'last_extended_at', nullable: true })
  lastExtendedAt!: Date | null;

  @Column({ name: 'original_due_date', nullable: true })
  originalDueDate!: Date | null;

  // ── Recurrence ──
  @Column({ name: 'is_recurring', default: false })
  isRecurring!: boolean;

  @Column({ name: 'recurrence_frequency', type: 'varchar', nullable: true })
  recurrenceFrequency!: RecurrenceFrequency | null;

  @Column({ name: 'recurrence_end_date', nullable: true })
  recurrenceEndDate!: Date | null;

  @Column({ name: 'next_recurrence_date', nullable: true })
  nextRecurrenceDate!: Date | null;

  // Points back to the original template task
  @Column({ name: 'recurrence_parent_id', nullable: true })
  recurrenceParentId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt!: Date;
}