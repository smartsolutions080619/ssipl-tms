import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetPasswordFields1000000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION add_reset_fields_to_tenant(tenant_slug VARCHAR)
      RETURNS void AS $$
      DECLARE
        schema_name TEXT := 'tenant_' || tenant_slug;
      BEGIN
        EXECUTE format('ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS reset_password_token VARCHAR(255)', schema_name);
        EXECUTE format('ALTER TABLE %I.users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMPTZ', schema_name);
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`SELECT add_reset_fields_to_tenant('ssipl')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS add_reset_fields_to_tenant`);
  }
}