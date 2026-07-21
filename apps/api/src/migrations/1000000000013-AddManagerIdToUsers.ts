import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagerIdToUsers1000000000013 implements MigrationInterface {
  // Reporting hierarchy — every user can have a manager (another user they
  // report to). Nullable since not everyone has one (e.g. the org's top of
  // the chain), and no FK constraint (consistent with role_id/department_id
  // on this table) so deleting/deactivating a manager never blocks on this.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.users
        ADD COLUMN IF NOT EXISTS manager_id UUID
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_users_manager_id ON tenant_ssipl.users (manager_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.users DROP COLUMN IF EXISTS manager_id
    `);
  }
}
