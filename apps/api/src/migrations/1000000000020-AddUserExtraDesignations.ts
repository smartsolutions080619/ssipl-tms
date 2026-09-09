import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserExtraDesignations1000000000020
  implements MigrationInterface
{
  // Designation-keyed counterpart to user_extra_departments — instead of
  // "let this viewer additionally see tasks from department X," this means
  // "let this viewer additionally see tasks touched by anyone holding
  // designation X," regardless of which department that person is in.
  // Set at user creation/approval or edit time (Users page). Purely
  // additive — see tasks.service.ts findAll().
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.user_extra_designations (
        viewer_user_id UUID NOT NULL,
        designation_id UUID NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (viewer_user_id, designation_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_extra_designations_viewer ON tenant_ssipl.user_extra_designations (viewer_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_extra_designations_desig ON tenant_ssipl.user_extra_designations (designation_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.user_extra_designations`);
  }
}
