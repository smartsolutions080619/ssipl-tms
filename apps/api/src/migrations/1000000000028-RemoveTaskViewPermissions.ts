import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTaskViewPermissions1000000000028
  implements MigrationInterface
{
  // task:view_all / task:view_department were legacy — the task-list
  // visibility engine that read them was already disabled in favor of the
  // explicit per-user user_task_visibility table, and the one live spot
  // that still checked task:view_all (the activity log) has been switched
  // to a plain Admin check. Strip both off every role so nothing keeps
  // holding an unmanageable, invisible permission.
  private readonly staleKeys = ['task:view_all', 'task:view_department'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenant_ssipl.roles
      SET permissions = (
        SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
        FROM jsonb_array_elements(permissions) p
        WHERE p::text NOT IN ('"task:view_all"', '"task:view_department"')
      )
      WHERE permissions @> '["task:view_all"]'::jsonb
         OR permissions @> '["task:view_department"]'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Not reversible — which roles originally held these isn't recoverable.
    void queryRunner;
  }
}
