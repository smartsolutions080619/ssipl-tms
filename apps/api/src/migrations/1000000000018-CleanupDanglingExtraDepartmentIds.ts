import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupDanglingExtraDepartmentIds1000000000018
  implements MigrationInterface
{
  // Defensive one-time sweep: departments.service.ts remove() now scrubs
  // department IDs out of user_extra_departments / roles.extra_department_ids
  // / designations.extra_department_ids whenever a department is deleted —
  // but that cleanup didn't exist before this migration, so any department
  // deleted earlier could have left a dangling ID behind in one of these
  // three places. A dangling ID never breaks anything (no real FK, and it
  // just fails to match any real department at query time), but it does
  // silently inflate "X/Y departments" badges and Effective Access counts
  // with an entry that resolves to nothing. This clears that out once.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM tenant_ssipl.user_extra_departments ued
      WHERE NOT EXISTS (
        SELECT 1 FROM tenant_ssipl.departments d WHERE d.id = ued.department_id
      )
    `);

    await queryRunner.query(`
      UPDATE tenant_ssipl.roles
      SET extra_department_ids = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements_text(extra_department_ids) elem
        WHERE EXISTS (SELECT 1 FROM tenant_ssipl.departments d WHERE d.id::text = elem)
      )
    `);

    await queryRunner.query(`
      UPDATE tenant_ssipl.designations
      SET extra_department_ids = (
        SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
        FROM jsonb_array_elements_text(extra_department_ids) elem
        WHERE EXISTS (SELECT 1 FROM tenant_ssipl.departments d WHERE d.id::text = elem)
      )
    `);
  }

  // Nothing meaningful to restore — the rows removed were already
  // references to departments that don't exist.
  public async down(): Promise<void> {
    // no-op
  }
}
