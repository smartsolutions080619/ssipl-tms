import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLeaveTypesAndNormalizeBalances1000000000014
  implements MigrationInterface
{
  // Leave types used to be a hardcoded CL/SL/PL/LWP enum, and leave_balances
  // had one fixed column pair per type (cl_total/cl_used, sl_total/sl_used,
  // ...) — no way to add a 5th type without a schema change. This migration:
  //   1. Creates leave_types (admin-managed, unbounded) and seeds it with
  //      the 4 existing types, preserving their current rules exactly.
  //   2. Creates a normalized leave_balances (one row per user per type per
  //      year) and backfills it from the old wide-column table, so nobody's
  //      current balance or history is lost.
  //   3. Drops the old wide-column leave_balances and renames the new one
  //      into its place.
  //   4. Drops a leave_requests_leave_type_check CHECK constraint that was
  //      never captured by any migration (added directly on the DB at some
  //      point) — it hardcoded leave_type to CL/SL/PL/LWP, which would
  //      reject every custom leave type an admin creates.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.leave_types (
        id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code                   VARCHAR(20) NOT NULL UNIQUE,
        label                  VARCHAR(100) NOT NULL,
        emoji                  VARCHAR(10),
        color                  VARCHAR(20),
        description            VARCHAR(255),
        annual_days            NUMERIC(5,1) NOT NULL DEFAULT 0,
        pro_rata               BOOLEAN NOT NULL DEFAULT true,
        carry_forward_enabled  BOOLEAN NOT NULL DEFAULT false,
        max_carry_forward      NUMERIC(5,1) NOT NULL DEFAULT 0,
        is_unlimited           BOOLEAN NOT NULL DEFAULT false,
        sort_order             INT NOT NULL DEFAULT 0,
        is_active              BOOLEAN NOT NULL DEFAULT true,
        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Seed the 4 pre-existing types with their exact current behaviour.
    await queryRunner.query(`
      INSERT INTO tenant_ssipl.leave_types
        (code, label, emoji, color, description, annual_days, pro_rata, carry_forward_enabled, max_carry_forward, is_unlimited, sort_order)
      VALUES
        ('CL',  'Casual Leave',      '🏖️', '#60a5fa', '12 days / year',                 12, true,  false, 0,  false, 1),
        ('SL',  'Sick Leave',        '🏥', '#34d399', '12 days / year',                 12, true,  false, 0,  false, 2),
        ('PL',  'Privilege Leave',   '⭐', '#a78bfa', '15 days / year + carry forward',  15, true,  true,  15, false, 3),
        ('LWP', 'Leave Without Pay', '📋', '#f87171', 'Deducted from salary',            0,  false, false, 0,  true,  4)
      ON CONFLICT (code) DO NOTHING
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.leave_balances_new (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id       UUID NOT NULL,
        leave_type_id UUID NOT NULL,
        year          INT NOT NULL,
        total         NUMERIC(5,1) NOT NULL DEFAULT 0,
        used          NUMERIC(5,1) NOT NULL DEFAULT 0,
        carried       NUMERIC(5,1) NOT NULL DEFAULT 0,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, leave_type_id, year)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_balances_new_user_year ON tenant_ssipl.leave_balances_new (user_id, year)
    `);

    // Backfill: each existing wide row becomes up to 3 normalized rows
    // (CL/SL/PL — LWP was never tracked in the old table since it's
    // unlimited). Skipped only if the old table doesn't exist (fresh DB).
    const oldTableExists = await queryRunner.hasTable('tenant_ssipl.leave_balances');
    if (oldTableExists) {
      await queryRunner.query(`
        INSERT INTO tenant_ssipl.leave_balances_new (user_id, leave_type_id, year, total, used, carried)
        SELECT lb.user_id, (SELECT id FROM tenant_ssipl.leave_types WHERE code = 'CL'), lb.year, lb.cl_total, lb.cl_used, 0
        FROM tenant_ssipl.leave_balances lb
        ON CONFLICT (user_id, leave_type_id, year) DO NOTHING
      `);
      await queryRunner.query(`
        INSERT INTO tenant_ssipl.leave_balances_new (user_id, leave_type_id, year, total, used, carried)
        SELECT lb.user_id, (SELECT id FROM tenant_ssipl.leave_types WHERE code = 'SL'), lb.year, lb.sl_total, lb.sl_used, 0
        FROM tenant_ssipl.leave_balances lb
        ON CONFLICT (user_id, leave_type_id, year) DO NOTHING
      `);
      await queryRunner.query(`
        INSERT INTO tenant_ssipl.leave_balances_new (user_id, leave_type_id, year, total, used, carried)
        SELECT lb.user_id, (SELECT id FROM tenant_ssipl.leave_types WHERE code = 'PL'), lb.year, lb.pl_total, lb.pl_used, lb.pl_carried
        FROM tenant_ssipl.leave_balances lb
        ON CONFLICT (user_id, leave_type_id, year) DO NOTHING
      `);

      await queryRunner.query(`DROP TABLE tenant_ssipl.leave_balances`);
    }

    await queryRunner.query(`ALTER TABLE tenant_ssipl.leave_balances_new RENAME TO leave_balances`);
    await queryRunner.query(`ALTER INDEX tenant_ssipl.idx_leave_balances_new_user_year RENAME TO idx_leave_balances_user_year`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.leave_balances`);
    await queryRunner.query(`DROP TABLE IF EXISTS tenant_ssipl.leave_types`);
  }
}
