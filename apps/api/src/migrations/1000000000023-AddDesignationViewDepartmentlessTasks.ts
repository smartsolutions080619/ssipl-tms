import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDesignationViewDepartmentlessTasks1000000000023
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.designations
      ADD COLUMN IF NOT EXISTS view_departmentless_tasks BOOLEAN NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.designations DROP COLUMN IF EXISTS view_departmentless_tasks`);
  }
}
