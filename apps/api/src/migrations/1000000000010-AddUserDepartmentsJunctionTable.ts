import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserDepartmentsJunctionTable1000000000010
  implements MigrationInterface
{
  // Users could previously only belong to ONE department (users.department_id).
  // This adds a proper many-to-many junction table so a user can belong to
  // multiple departments at once. Existing single-department assignments are
  // backfilled into the new table so nobody loses their current membership.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.user_departments (
        user_id       UUID NOT NULL,
        department_id UUID NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, department_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON tenant_ssipl.user_departments (user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_departments_dept_id ON tenant_ssipl.user_departments (department_id)
    `);

    // Backfill: every user's existing single department_id becomes their
    // first row in the new junction table. Their old department_id column
    // is left untouched (kept as their "primary" department for now).
    await queryRunner.query(`
      INSERT INTO tenant_ssipl.user_departments (user_id, department_id)
      SELECT id, department_id FROM tenant_ssipl.users
      WHERE department_id IS NOT NULL
      ON CONFLICT (user_id, department_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.user_departments`);
  }
}