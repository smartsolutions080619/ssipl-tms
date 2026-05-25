import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitPublicSchema1000000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tenants table — public schema mein
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT true,
        plan VARCHAR(50) DEFAULT 'free',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `);

    // API Keys table — public schema mein
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES public.tenants(id),
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_prefix VARCHAR(10) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_used_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Index
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id 
      ON public.api_keys(tenant_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash 
      ON public.api_keys(key_hash)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.api_keys`);
    await queryRunner.query(`DROP TABLE IF EXISTS public.tenants`);
  }
}