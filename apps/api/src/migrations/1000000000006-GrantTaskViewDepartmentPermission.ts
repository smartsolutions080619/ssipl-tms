import { MigrationInterface, QueryRunner } from 'typeorm';

export class GrantTaskViewDepartmentPermission1000000000006
  implements MigrationInterface
{
  // Roles that should get department-wide task visibility out of the box.
  // Admins can add/remove this permission for any role (including new ones)
  // from the Roles page going forward — this migration just seeds sensible
  // defaults for roles that already exist today.
  private readonly targetRoleNames = [
    'manager',
    'md',
    'ceo',
    'senior executive',
    'team lead',
    'team_lead',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenant_ssipl.roles
      SET permissions = permissions || '["task:view_department"]'::jsonb
      WHERE LOWER(name) = ANY($1)
        AND NOT (permissions @> '["task:view_department"]'::jsonb)
    `, [this.targetRoleNames]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenant_ssipl.roles
      SET permissions = (
        SELECT COALESCE(jsonb_agg(p), '[]'::jsonb)
        FROM jsonb_array_elements(permissions) p
        WHERE p <> '"task:view_department"'::jsonb
      )
      WHERE LOWER(name) = ANY($1)
    `, [this.targetRoleNames]);
  }
}