import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesignationExtraDepartments1000000000017
  implements MigrationInterface
{
  // Designation-level counterpart to roles.extra_department_ids — everyone
  // holding a designation gets its extra_department_ids automatically.
  // Note: users.designation_id already exists (migration
  // 1000000000012-AddDesignations) — nothing to add there, it was just
  // never wired up in code until now.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.designations
      ADD COLUMN IF NOT EXISTS extra_department_ids JSONB NOT NULL DEFAULT '[]'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.designations DROP COLUMN IF EXISTS extra_department_ids`);
  }
}
