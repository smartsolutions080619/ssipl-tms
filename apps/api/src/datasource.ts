import { DataSource } from 'typeorm';
import { join } from 'path';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: +(process.env.DATABASE_PORT || 5432),
  username: process.env.DATABASE_USER || 'ssipl_user',
  password: process.env.DATABASE_PASSWORD || 'ssipl_pass',
  database: process.env.DATABASE_NAME || 'ssipl_tms_db',
  entities: [join(process.cwd(), 'apps/api/src/**/*.entity{.ts,.js}')],
  migrations: [join(process.cwd(), 'apps/api/src/migrations/**/*{.ts,.js}')],
  migrationsTableName: 'migrations_history',
  logging: true,
});
