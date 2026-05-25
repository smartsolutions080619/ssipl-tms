import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitTenantSchema1000000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION create_tenant_schema(tenant_slug VARCHAR)
      RETURNS void AS $$
      DECLARE
        schema_name TEXT := 'tenant_' || tenant_slug;
      BEGIN
        EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255),
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            is_active BOOLEAN DEFAULT true,
            role_id UUID,
            department_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
          )', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.roles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(100) NOT NULL UNIQUE,
            description TEXT,
            permissions JSONB DEFAULT ''[]'',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.departments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            parent_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.tasks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_number VARCHAR(20) NOT NULL UNIQUE,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT ''TODO'',
            priority VARCHAR(20) DEFAULT ''MEDIUM'',
            type VARCHAR(50) DEFAULT ''TASK'',
            assignee_id UUID,
            reporter_id UUID,
            parent_task_id UUID,
            due_date TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            deleted_at TIMESTAMPTZ
          )', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.comments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID NOT NULL,
            user_id UUID NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.activity_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id UUID,
            user_id UUID NOT NULL,
            action VARCHAR(100) NOT NULL,
            old_value JSONB,
            new_value JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )', schema_name);

        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT NOW()
          )', schema_name);

      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS create_tenant_schema`);
  }
}