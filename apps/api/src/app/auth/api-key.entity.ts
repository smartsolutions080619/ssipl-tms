import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity({ name: 'api_keys', schema: 'public' })
  export class ApiKey {
    @PrimaryGeneratedColumn('uuid')
    id!: string;
  
    @Column({ name: 'tenant_id' })
    tenantId!: string;
  
    @Column()
    name!: string;
  
    @Column({ name: 'key_hash' })
    keyHash!: string;
  
    @Column({ name: 'key_prefix' })
    keyPrefix!: string;
  
    @Column({ name: 'is_active', default: true })
    isActive!: boolean;
  
    @Column({ name: 'last_used_at', nullable: true })
    lastUsedAt!: Date;
  
    @Column({ name: 'expires_at', nullable: true })
    expiresAt!: Date;
  
    @CreateDateColumn({ name: 'created_at' })
    createdAt!: Date;
  
    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt!: Date;
  }