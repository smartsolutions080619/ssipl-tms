import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum LeaveType {
  CL  = 'CL',   // Casual Leave
  SL  = 'SL',   // Sick Leave
  PL  = 'PL',   // Privilege Leave
  LWP = 'LWP',  // Leave Without Pay
}

export enum LeaveStatus {
  PENDING  = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'leave_requests' })
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'leave_type', type: 'varchar' })
  leaveType!: LeaveType;

  @Column({ name: 'from_date', type: 'date' })
  fromDate!: Date;

  @Column({ name: 'to_date', type: 'date' })
  toDate!: Date;

  @Column({ name: 'total_days', type: 'int' })
  totalDays!: number;

  @Column({ name: 'reason', type: 'text' })
  reason!: string;

  @Column({ name: 'status', type: 'varchar', default: LeaveStatus.PENDING })
  status!: LeaveStatus;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason!: string | null;

  @Column({ name: 'approved_by', nullable: true })
  approvedBy!: string | null;

  @Column({ name: 'approved_at', nullable: true })
  approvedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}