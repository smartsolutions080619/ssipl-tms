import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

// Admin-defined leave categories (Casual Leave, Sick Leave, ...). Replaces
// the old hardcoded CL/SL/PL/LWP enum — an admin can now create, edit, and
// deactivate as many of these as the organisation's policy needs, from the
// Admin → Leave Management tab. `code` is what leave_requests.leave_type
// and leave_balances.leave_type_id key off of; it's stable even if the
// label/icon/rules are edited later.
@Entity({ name: 'leave_types' })
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  emoji!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  color!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description!: string | null;

  // Org-wide default annual entitlement. Ignored when isUnlimited is true.
  @Column({ name: 'annual_days', type: 'numeric', precision: 5, scale: 1, default: 0 })
  annualDays!: number;

  // Pro-rate the annual entitlement for new joiners based on their joining
  // date (same math CL/SL/PL always used), vs. granting the full amount
  // regardless of when someone joined (e.g. a flat "3-day Compassionate
  // Leave" policy).
  @Column({ name: 'pro_rata', default: true })
  proRata!: boolean;

  @Column({ name: 'carry_forward_enabled', default: false })
  carryForwardEnabled!: boolean;

  @Column({ name: 'max_carry_forward', type: 'numeric', precision: 5, scale: 1, default: 0 })
  maxCarryForward!: number;

  // The LWP case — no balance tracking/cap, deducted from salary instead.
  @Column({ name: 'is_unlimited', default: false })
  isUnlimited!: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  // Deactivated types drop out of the apply-leave form and balance cards,
  // but existing requests/history that used them keep working — never
  // hard-deleted so the code a past request references stays resolvable.
  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
