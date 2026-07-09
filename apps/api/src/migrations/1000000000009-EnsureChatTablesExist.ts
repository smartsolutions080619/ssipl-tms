/* eslint-disable @typescript-eslint/no-unused-vars */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureChatTablesExist1000000000009
  implements MigrationInterface
{
  // chat_rooms, chat_room_members, and chat_messages have been used
  // extensively by chat.gateway.ts but were never actually created by any
  // tracked migration (same class of issue as the missing task recurrence
  // columns). Using IF NOT EXISTS everywhere so this is safe whether these
  // were already created manually or not.
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.chat_rooms (
        id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name         VARCHAR(255),
        type         VARCHAR(20) NOT NULL DEFAULT 'direct', -- 'direct' | 'group' | 'channel'
        description  TEXT,
        created_by   UUID,
        is_active    BOOLEAN NOT NULL DEFAULT true,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.chat_room_members (
        room_id        UUID NOT NULL,
        user_id        UUID NOT NULL,
        role           VARCHAR(20) NOT NULL DEFAULT 'member', -- 'admin' | 'member'
        unread_count   INT NOT NULL DEFAULT 0,
        last_read_at   TIMESTAMPTZ,
        PRIMARY KEY (room_id, user_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenant_ssipl.chat_messages (
        id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        room_id     UUID NOT NULL,
        user_id     UUID NOT NULL,
        content     TEXT NOT NULL,
        type        VARCHAR(20) NOT NULL DEFAULT 'text',
        file_url    TEXT,
        file_name   TEXT,
        is_edited   BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON tenant_ssipl.chat_messages (room_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON tenant_ssipl.chat_room_members (user_id)
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Not dropping these — they may hold real chat history already.
    // If you truly need to reverse this, drop them manually.
  }
}