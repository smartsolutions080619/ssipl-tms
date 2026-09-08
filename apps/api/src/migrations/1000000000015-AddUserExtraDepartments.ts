import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserExtraDepartments1000000000015
  implements MigrationInterface
{
  // Admin-granted "extra" task visibility, separate from user_departments
  // (which means actual org membership and already has other side effects
  // — the org-wide shortcut when someone belongs to every department, the
  // department-scoped assignee dropdown). This table means only one thing:
  // "this viewer may additionally see tasks touched by anyone in this
  // department," without making them a member of it. Purely additive —
  // see tasks.service.ts findAll().
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.user_extra_departments (
        viewer_user_id UUID NOT NULL,
        department_id  UUID NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (viewer_user_id, department_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_extra_departments_viewer ON tenant_ssipl.user_extra_departments (viewer_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_extra_departments_dept ON tenant_ssipl.user_extra_departments (department_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.user_extra_departments`);
  }
}
