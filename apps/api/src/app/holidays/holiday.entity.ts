import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum HolidayType {
  NATIONAL = 'NATIONAL',
  FESTIVAL = 'FESTIVAL',
  OPTIONAL = 'OPTIONAL',
  COMPANY  = 'COMPANY',
}

@Entity({ name: 'holidays', schema: 'tenant_ssipl' })
export class Holiday {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ type: 'date' })
  date!: Date;

  @Column({ name: 'holiday_type', type: 'varchar', default: HolidayType.NATIONAL })
  holidayType!: HolidayType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by', nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}