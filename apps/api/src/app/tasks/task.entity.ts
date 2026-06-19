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

  // ── Project link ──
  @Column({ name: 'project_id', nullable: true })
  projectId!: string | null;

  @Column({ name: 'due_date', nullable: true })
  dueDate!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt!: Date;
}