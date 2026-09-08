import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity({ schema: 'tenant_ssipl', name: 'designations' })
export class Designation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string | null;

  // Designation-level "Department Task Access" — everyone holding this
  // designation automatically sees these departments' tasks, the same
  // additive mechanism as the role-level grant (roles.extraDepartmentIds)
  // and the per-user grant (user_extra_departments). See
  // tasks.service.ts findAll() for how all three combine. This is always
  // the source of truth for this designation — a Role can optionally link
  // to a designation (role.entity.ts linkedDesignationId) to borrow this
  // list instead of keeping its own, but never the other way around.
  @Column({ name: 'extra_department_ids', type: 'jsonb', default: [] })
  extraDepartmentIds!: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}