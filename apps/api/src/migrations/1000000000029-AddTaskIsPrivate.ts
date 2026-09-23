import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskIsPrivate1000000000029
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.tasks
      ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.tasks DROP COLUMN IF EXISTS is_private`);
  }
}
