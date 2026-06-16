import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserStatus1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add status column with PENDING as default
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    `);

    // Existing active users should be ACTIVE not PENDING
    await queryRunner.query(`
      UPDATE users SET status = 'ACTIVE' WHERE is_active = true AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE users DROP COLUMN IF EXISTS status`);
  }
}