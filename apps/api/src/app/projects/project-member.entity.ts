import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn,
} from 'typeorm';

export enum ProjectMemberRole {
  PROJECT_LEAD = 'PROJECT_LEAD',
  DEVELOPER    = 'DEVELOPER',
  DESIGNER     = 'DESIGNER',
  TESTER       = 'TESTER',
  VIEWER       = 'VIEWER',
}

@Entity({ name: 'project_members', schema: 'tenant_ssipl' })
export class ProjectMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'project_id' })
  projectId!: string;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'role', type: 'varchar', default: ProjectMemberRole.DEVELOPER })
  role!: ProjectMemberRole;

  @Column({ name: 'added_by' })
  addedBy!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}