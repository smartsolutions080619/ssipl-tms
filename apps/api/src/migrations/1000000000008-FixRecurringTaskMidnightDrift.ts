import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRecurringTaskMidnightDrift1000000000008
  implements MigrationInterface
{
  // Existing recurring template tasks may have a next_recurrence_date with
  // a non-midnight time component (e.g. "tomorrow 3:47 PM" instead of
  // "tomorrow 00:00:00"), because it was computed from `new Date()` at
  // creation time without zeroing the clock. The cron that spawns new
  // instances runs at exactly midnight and only matches dates <= midnight,
  // so any drifted time-of-day meant the task would never actually
  // re-spawn. This snaps existing values back to midnight of the same
  // calendar day so they start firing correctly without recreation.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE tenant_ssipl.tasks
      SET next_recurrence_date = date_trunc('day', next_recurrence_date)
      WHERE is_recurring = true
        AND next_recurrence_date IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // Not reversible — the original drifted time-of-day wasn't meaningful
    // and isn't worth restoring.
  }
}