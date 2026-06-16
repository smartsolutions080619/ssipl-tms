import {
  Entity, Column, PrimaryGeneratedColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum AnnouncementPriority {
  LOW    = 'LOW',
  NORMAL = 'NORMAL',
  HIGH   = 'HIGH',
  URGENT = 'URGENT',
}

@Entity({ name: 'announcements' })
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'priority', type: 'varchar', default: AnnouncementPriority.NORMAL })
  priority!: AnnouncementPriority;

  @Column({ name: 'created_by' })
  createdBy!: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'expires_at', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}