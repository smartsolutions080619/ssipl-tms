import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesignations1000000000012 implements MigrationInterface {
  // Designations are pure job-title labels ("Senior Developer", "Team Lead")
  // — they carry NO permissions of their own. Access/permissions continue
  // to come entirely from the user's Role, exactly as before. Designation
  // is purely informational/display, assignable to any user.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.designations (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(150) NOT NULL,
        description VARCHAR(255),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.users
        ADD COLUMN IF NOT EXISTS designation_id UUID
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_designation_id ON tenant_ssipl.users (designation_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.users DROP COLUMN IF EXISTS designation_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.designations`);
  }
}