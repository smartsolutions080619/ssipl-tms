import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMissingTaskColumns1000000000007
  implements MigrationInterface
{
  // The Task entity (task.entity.ts) declares several columns that were
  // never actually added to the real tenant_ssipl.tasks table — the
  // original InitTenantSchema migration only created the base columns.
  // This silently broke: Projects linkage (project_id), due-date extension
  // tracking (extension_count, last_extended_at, original_due_date), and
  // the entire recurring-task feature (is_recurring, recurrence_frequency,
  // recurrence_end_date, next_recurrence_date, recurrence_parent_id).
  // Using IF NOT EXISTS everywhere so this is safe to run even if some of
  // these were already added manually at some point.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.tasks
        ADD COLUMN IF NOT EXISTS project_id            UUID,
        ADD COLUMN IF NOT EXISTS extension_count        INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_extended_at        TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS original_due_date       TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_recurring            BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS recurrence_frequency    VARCHAR(20),
        ADD COLUMN IF NOT EXISTS recurrence_end_date     TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS next_recurrence_date    TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS recurrence_parent_id    UUID
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.tasks
        DROP COLUMN IF EXISTS project_id,
        DROP COLUMN IF EXISTS extension_count,
        DROP COLUMN IF EXISTS last_extended_at,
        DROP COLUMN IF EXISTS original_due_date,
        DROP COLUMN IF EXISTS is_recurring,
        DROP COLUMN IF EXISTS recurrence_frequency,
        DROP COLUMN IF EXISTS recurrence_end_date,
        DROP COLUMN IF EXISTS next_recurrence_date,
        DROP COLUMN IF EXISTS recurrence_parent_id
    `);
  }
}