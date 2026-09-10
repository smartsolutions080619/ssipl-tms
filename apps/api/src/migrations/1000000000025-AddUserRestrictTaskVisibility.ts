import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserRestrictTaskVisibility1000000000025
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.users
      ADD COLUMN IF NOT EXISTS restrict_task_visibility BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.users DROP COLUMN IF EXISTS restrict_task_visibility`);
  }
}
