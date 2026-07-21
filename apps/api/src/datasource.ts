import { DataSource } from 'typeorm';
import { join } from 'path';

// ── This file is only used by `npm run migration:run` (the TypeORM CLI),
// which does NOT go through Nest's ConfigModule/`.env` loading — it only
// sees whatever is already in the shell's process.env when the command
// is invoked. The old version of this file silently fell back to
// 127.0.0.1/ssipl_user/ssipl_pass/ssipl_tms_db whenever those vars were
// missing, which means a migration can be run — and get recorded as
// "applied" — against a completely different (e.g. local) database
// without any error, while everyone assumes it hit production. That's a
// prime suspect for "the migration is marked applied and the column
// exists, but the live app can't see it": the CLI and the live app may
// not have been talking to the same database.
//
// Failing loudly here instead of guessing is intentional — better to stop
// the migration than to quietly run it somewhere unexpected. Make sure
// DATABASE_HOST/PORT/USER/PASSWORD/NAME are exported in the shell (or
// prefix the command with `railway run`, `dotenv -e .env --`, etc.)
// before running migrations against Railway.
const required = ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME'] as const;
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(
    `[datasource.ts] Missing required env var(s): ${missing.join(', ')}. ` +
    `Refusing to fall back to local defaults — set these explicitly (e.g. ` +
    `via 'railway run' or 'dotenv -e .env --') so migrations can't silently ` +
    `run against the wrong database.`
  );
}

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: +process.env.DATABASE_PORT!,
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [join(process.cwd(), 'apps/api/src/**/*.entity{.ts,.js}')],
  migrations: [join(process.cwd(), 'apps/api/src/migrations/**/*{.ts,.js}')],
  migrationsTableName: 'migrations_history',
  logging: true,
});