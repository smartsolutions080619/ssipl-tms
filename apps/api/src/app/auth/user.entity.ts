import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserStatus {
  PENDING  = 'PENDING',
  ACTIVE   = 'ACTIVE',
  REJECTED = 'REJECTED',
}

@Entity({ name: 'users', schema: 'tenant_ssipl' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'password_hash', nullable: true })
  passwordHash!: string;

  @Column({ name: 'first_name' })
  firstName!: string;

  @Column({ name: 'last_name', nullable: true })
  lastName!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'status', type: 'varchar', default: UserStatus.PENDING })
  status!: UserStatus;

  @Column({ name: 'role_id', nullable: true })
  roleId!: string;

  @Column({ name: 'department_id', nullable: true })
  departmentId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt!: Date;

  @Column({ name: 'reset_password_token', nullable: true })
  resetPasswordToken!: string | null;

  @Column({ name: 'reset_password_expires', nullable: true })
  resetPasswordExpires!: Date | null;
}