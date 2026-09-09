import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropDesignationDepartmentAccess1000000000022
  implements MigrationInterface
{
  // Retires designation-level "Department Task Access" entirely (after
  // 1000000000021 already retired the same thing at the role level).
  // Extra task visibility is now handled exclusively from the Users page —
  // "Additional Task Visibility" (by department) and "Designation Task
  // Access" (by designation-holder), both per-user grants. This column is
  // permanently unreachable going forward, so drop it rather than leave it.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.designations DROP COLUMN IF EXISTS extra_department_ids`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.designations ADD COLUMN IF NOT EXISTS extra_department_ids JSONB NOT NULL DEFAULT '[]'`);
  }
}
