import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
  } from 'typeorm';
  
  export enum NotificationType {
    TASK_ASSIGNED = 'TASK_ASSIGNED',
    TASK_UPDATED = 'TASK_UPDATED',
    COMMENT_ADDED = 'COMMENT_ADDED',
    MENTION = 'MENTION',
    STATUS_CHANGED = 'STATUS_CHANGED',
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
  
    @Column({ type: 'jsonb', nullable: true })
    metadata!: object;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
  }