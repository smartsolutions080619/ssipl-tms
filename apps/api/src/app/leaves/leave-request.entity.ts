import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

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

  // References leave_types.code — an admin-defined, unbounded set rather
  // than a fixed enum. Kept as a plain string (not a FK) so a leave type
  // can be renamed/deactivated later without breaking past requests that
  // used its code.
  @Column({ name: 'leave_type', type: 'varchar' })
  leaveType!: string;

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