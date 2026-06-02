import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminConfig1000000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION add_admin_config_table(tenant_slug VARCHAR)
      RETURNS void AS $$
      DECLARE
        schema_name TEXT := 'tenant_' || tenant_slug;
      BEGIN
        EXECUTE format('
          CREATE TABLE IF NOT EXISTS %I.admin_config (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            key VARCHAR(255) NOT NULL UNIQUE,
            value JSONB NOT NULL,
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )', schema_name);
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`SELECT add_admin_config_table('ssipl')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS add_admin_config_table`);
  }
}