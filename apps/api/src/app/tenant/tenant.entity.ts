import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity({ name: 'tenants', schema: 'public' })
  export class Tenant {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
  
    @Column()
    name!: string;
  
    @Column({ unique: true })
    slug!: string;
  
    @Column({ name: 'is_active', default: true })
    isActive!: boolean;
  
    @Column({ default: 'free' })
    plan!: string;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
  
    @Column({ name: 'deleted_at', nullable: true })
    deletedAt!: Date;
  }