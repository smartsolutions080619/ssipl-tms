import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTaskVisibility1000000000026
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.user_task_visibility (
        viewer_id      UUID NOT NULL,
        target_user_id UUID NOT NULL,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (viewer_id, target_user_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_task_visibility_viewer ON tenant_ssipl.user_task_visibility (viewer_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_user_task_visibility_target ON tenant_ssipl.user_task_visibility (target_user_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.user_task_visibility`);
  }
}
