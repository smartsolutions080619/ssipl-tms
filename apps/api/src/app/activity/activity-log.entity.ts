import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
  } from 'typeorm';
  
  export enum ActivityAction {
    TASK_CREATED = 'TASK_CREATED',
    TASK_UPDATED = 'TASK_UPDATED',
    TASK_DELETED = 'TASK_DELETED',
    TASK_ASSIGNED = 'TASK_ASSIGNED',
    TASK_UNASSIGNED = 'TASK_UNASSIGNED',
    STATUS_CHANGED = 'STATUS_CHANGED',
    COMMENT_ADDED = 'COMMENT_ADDED',
    COMMENT_DELETED = 'COMMENT_DELETED',
    LEAVE_BALANCE_ADJUSTED = 'LEAVE_BALANCE_ADJUSTED',
    DEPARTMENT_ACCESS_CHANGED = 'DEPARTMENT_ACCESS_CHANGED',
    DESIGNATION_ACCESS_CHANGED = 'DESIGNATION_ACCESS_CHANGED',
    TASK_VISIBILITY_RESTRICTION_CHANGED = 'TASK_VISIBILITY_RESTRICTION_CHANGED',
    TASK_VIEW_VISIBILITY_CHANGED = 'TASK_VIEW_VISIBILITY_CHANGED',
  }
  
  @Entity({ name: 'activity_logs' })
  export class ActivityLog {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
  
    @Column({ name: 'task_id', nullable: true })
    taskId!: string;
  
    @Column({ name: 'user_id' })
    userId!: string;
  
    @Column()
    action!: string;
  
    @Column({ name: 'old_value', type: 'jsonb', nullable: true })
    oldValue!: object;
  
    @Column({ name: 'new_value', type: 'jsonb', nullable: true })
    newValue!: object;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
  }