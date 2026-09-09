import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropRoleDepartmentAccess1000000000021
  implements MigrationInterface
{
  // Retires role-level Department Task Access entirely. After discussion,
  // Roles no longer grant department access at all — Designations are now
  // the sole department-level source (alongside the two per-user grants).
  // A Role can no longer keep its own list or link to a Designation, so
  // both columns this adds/removes are pure dead weight going forward —
  // drop them rather than leave permanently-unreachable columns behind.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.roles DROP COLUMN IF EXISTS extra_department_ids`);
    await queryRunner.query(`ALTER TABLE tenant_ssipl.roles DROP COLUMN IF EXISTS linked_designation_id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.roles ADD COLUMN IF NOT EXISTS extra_department_ids JSONB NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE tenant_ssipl.roles ADD COLUMN IF NOT EXISTS linked_designation_id UUID NULL`);
  }
}
