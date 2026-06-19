import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum ProjectStatus {
  PLANNING   = 'PLANNING',
  ACTIVE     = 'ACTIVE',
  ON_HOLD    = 'ON_HOLD',
  COMPLETED  = 'COMPLETED',
  CANCELLED  = 'CANCELLED',
}

export enum ProjectPriority {
  LOW      = 'LOW',
  MEDIUM   = 'MEDIUM',
  HIGH     = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Entity({ name: 'projects', schema: 'tenant_ssipl' })
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'project_code', nullable: true })
  projectCode!: string | null;

  @Column({ name: 'status', type: 'varchar', default: ProjectStatus.PLANNING })
  status!: ProjectStatus;

  @Column({ name: 'priority', type: 'varchar', default: ProjectPriority.MEDIUM })
  priority!: ProjectPriority;

  // Color for project card (hex)
  @Column({ name: 'color', default: '#228b98' })
  color!: string;

  // Emoji icon for project
  @Column({ name: 'icon', default: '🚀' })
  icon!: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: Date | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

  // Progress 0-100
  @Column({ name: 'progress', type: 'int', default: 0 })
  progress!: number;

  @Column({ name: 'created_by' })
  createdBy!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}