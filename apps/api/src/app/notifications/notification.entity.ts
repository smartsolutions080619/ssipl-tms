import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum NotificationType {
  TASK_ASSIGNED   = 'TASK_ASSIGNED',
  TASK_UPDATED    = 'TASK_UPDATED',
  COMMENT_ADDED   = 'COMMENT_ADDED',
  MENTION         = 'MENTION',
  STATUS_CHANGED  = 'STATUS_CHANGED',
  LEAVE_REQUEST   = 'LEAVE_REQUEST',
  LEAVE_APPROVED  = 'LEAVE_APPROVED',
  LEAVE_REJECTED  = 'LEAVE_REJECTED',
  TASK_REJECTED   = 'TASK_REJECTED',
  ANNOUNCEMENT    = 'ANNOUNCEMENT',
  USER_REGISTERED = 'USER_REGISTERED',
}

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  // link = frontend route to navigate on click e.g. /tasks?id=xxx or /leaves
  @Column({ name: 'link', nullable: true })
  link!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}