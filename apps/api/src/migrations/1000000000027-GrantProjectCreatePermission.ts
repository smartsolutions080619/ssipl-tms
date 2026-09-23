import { MigrationInterface, QueryRunner } from 'typeorm';

export class GrantProjectCreatePermission1000000000027
  implements MigrationInterface
{
  // Project creation used to be hardcoded to the literal 'admin'/'manager'
  // role names. It's now a toggleable permission from the Roles page, so
  // this just seeds it onto the roles that already relied on that hardcoded
  // check, to avoid regressing anyone's access on deploy.
  private readonly targetRoleNames = ['admin', 'manager'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenant_ssipl.roles
      SET permissions = permissions || '["project:create"]'::jsonb
      WHERE LOWER(name) = ANY($1)
        AND NOT (permissions @> '["project:create"]'::jsonb)
    `, [this.targetRoleNames]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenant_ssipl.roles
      SET permissions = (
        SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
        FROM jsonb_array_elements(permissions) p
        WHERE p <> '"project:create"'::jsonb
      )
      WHERE LOWER(name) = ANY($1)
    `, [this.targetRoleNames]);
  }
}
