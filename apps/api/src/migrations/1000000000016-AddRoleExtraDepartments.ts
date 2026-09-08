import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleExtraDepartments1000000000016
  implements MigrationInterface
{
  // Role-level counterpart to user_extra_departments — every user holding
  // a role gets that role's extra_department_ids automatically, instead
  // of an admin configuring each person individually. Stored as a jsonb
  // array directly on roles, matching the existing `permissions` column
  // rather than a new junction table, since roles.permissions already
  // established that pattern for this entity.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.roles
      ADD COLUMN IF NOT EXISTS extra_department_ids JSONB NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.roles DROP COLUMN IF EXISTS extra_department_ids`);
  }
}
