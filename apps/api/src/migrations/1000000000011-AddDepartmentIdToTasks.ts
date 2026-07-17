import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepartmentIdToTasks1000000000011
  implements MigrationInterface
{
  // Tasks can now be tagged with a specific department — needed because a
  // user can belong to multiple departments, so "which department is this
  // task under" is no longer automatically obvious from the assignee alone.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.tasks
        ADD COLUMN IF NOT EXISTS department_id UUID
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tasks_department_id ON tenant_ssipl.tasks (department_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.tasks DROP COLUMN IF EXISTS department_id
    `);
  }
}