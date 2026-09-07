import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn, Unique,
} from 'typeorm';

// One row per user, per leave type, per year — replaces the old
// cl_total/sl_total/pl_total fixed-column design, which couldn't support
// an admin-defined, unbounded set of leave types. `total` is what the
// employee is entitled to for that type+year (org default, pro-rated for
// their joining date, or an admin override — see LeavesService.getOrCreateBalance
// and overrideBalance).
@Entity({ name: 'leave_balances' })
@Unique(['userId', 'leaveTypeId', 'year'])
export class LeaveBalance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'leave_type_id' })
  leaveTypeId!: string;

  @Column({ name: 'year', type: 'int' })
  year!: number;

  @Column({ name: 'total', type: 'numeric', precision: 5, scale: 1, default: 0 })
  total!: number;

  @Column({ name: 'used', type: 'numeric', precision: 5, scale: 1, default: 0 })
  used!: number;

  // Carried forward from the previous year (only meaningful when the
  // leave type has carryForwardEnabled).
  @Column({ name: 'carried', type: 'numeric', precision: 5, scale: 1, default: 0 })
  carried!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
