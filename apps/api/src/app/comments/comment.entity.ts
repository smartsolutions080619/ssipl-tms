import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'comments', schema: 'tenant_ssipl' })
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'task_id' })
  taskId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'jsonb', default: [], nullable: true })
  mentions!: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}