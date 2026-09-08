import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoleLinkedDesignation1000000000019
  implements MigrationInterface
{
  // Optional link so a Role can share one Department Task Access list with
  // a Designation that represents the same title (e.g. Role "CEO" ->
  // Designation "CEO"), instead of the two being edited independently and
  // silently drifting apart. The Designation stays the source of truth —
  // its own extra_department_ids is always what's used; a linked Role just
  // borrows it instead of keeping a second copy. No real FK — matches
  // every other cross-entity reference in this schema (role_id on users,
  // department_id on the various extra-department tables) — validated at
  // the app layer.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant_ssipl.roles
      ADD COLUMN IF NOT EXISTS linked_designation_id UUID NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenant_ssipl.roles DROP COLUMN IF EXISTS linked_designation_id`);
  }
}
