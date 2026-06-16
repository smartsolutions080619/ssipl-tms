import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'leave_balances' })
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'year', type: 'int' })
  year!: number;

  // CL — Casual Leave (no carry forward)
  @Column({ name: 'cl_total',     type: 'numeric', precision: 5, scale: 1, default: 0 })
  clTotal!: number;
  @Column({ name: 'cl_used',      type: 'numeric', precision: 5, scale: 1, default: 0 })
  clUsed!: number;

  // SL — Sick Leave (no carry forward)
  @Column({ name: 'sl_total',     type: 'numeric', precision: 5, scale: 1, default: 0 })
  slTotal!: number;
  @Column({ name: 'sl_used',      type: 'numeric', precision: 5, scale: 1, default: 0 })
  slUsed!: number;

  // PL — Privilege Leave (carry forward max 30 days)
  @Column({ name: 'pl_total',     type: 'numeric', precision: 5, scale: 1, default: 0 })
  plTotal!: number;
  @Column({ name: 'pl_used',      type: 'numeric', precision: 5, scale: 1, default: 0 })
  plUsed!: number;
  @Column({ name: 'pl_carried',   type: 'numeric', precision: 5, scale: 1, default: 0 })
  plCarried!: number; // carried forward from last year

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}