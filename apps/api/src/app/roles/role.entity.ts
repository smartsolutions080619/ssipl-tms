import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity({ name: 'roles' })
  export class Role {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
  
    @Column({ unique: true })
    name!: string;
  
    @Column({ nullable: true })
    description!: string;
  
    @Column({ type: 'jsonb', default: [] })
    permissions!: string[];

    // Role-level "Department Task Access" — every user holding this role
    // automatically sees these departments' tasks, on top of whatever
    // their normal hierarchy visibility already grants. Same additive
    // mechanism as the per-user grant (user_extra_departments); this is
    // just its role-wide counterpart so an admin doesn't have to
    // configure every individual person by hand. See tasks.service.ts
    // findAll() for how the two combine.
    @Column({ name: 'extra_department_ids', type: 'jsonb', default: [] })
    extraDepartmentIds!: string[];

    // Optional link to a Designation, so a Role and a Designation that
    // represent the same real-world title (e.g. Role "CEO" + Designation
    // "CEO") can share one Department Task Access list instead of drifting
    // apart as two independently-edited ones. When set, extraDepartmentIds
    // above is ignored in favor of the linked designation's own list
    // everywhere it's read (tasks.service.ts, effective-access) — it stays
    // stored, untouched, so unlinking later restores whatever this role
    // had on its own. The designation is always the source of truth here.
    @Column({ name: 'linked_designation_id', type: 'uuid', nullable: true })
    linkedDesignationId!: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
  }