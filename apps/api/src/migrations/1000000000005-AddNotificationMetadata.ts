import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationMetadata1000000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION add_notification_metadata(tenant_slug VARCHAR)
      RETURNS void AS $$
      DECLARE
        schema_name TEXT := 'tenant_' || tenant_slug;
      BEGIN
        EXECUTE format('ALTER TABLE %I.notifications ADD COLUMN IF NOT EXISTS metadata JSONB', schema_name);
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`SELECT add_notification_metadata('ssipl')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS add_notification_metadata`);
  }
}