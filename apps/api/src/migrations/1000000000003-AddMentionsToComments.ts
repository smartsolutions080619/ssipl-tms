import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMentionsToComments1000000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION add_mentions_to_comments(tenant_slug VARCHAR)
      RETURNS void AS $$
      DECLARE
        schema_name TEXT := 'tenant_' || tenant_slug;
      BEGIN
        EXECUTE format('ALTER TABLE %I.comments ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT ''[]''', schema_name);
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`SELECT add_mentions_to_comments('ssipl')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS add_mentions_to_comments`);
  }
}