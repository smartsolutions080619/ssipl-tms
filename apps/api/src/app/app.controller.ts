import { Controller, Get, Post, ForbiddenException, Request } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getData() {
    return this.appService.getData();
  }

  // ── TEMPORARY diagnostic endpoint ──
  // Admin-only (JwtAuthGuard + RolesGuard/PermissionsGuard are already
  // global, so this just needs a valid admin JWT — no new guard wiring).
  // Hit this on the LIVE Railway URL and compare `live.database` /
  // `live.server_ip` against whatever pgAdmin/Railway's Query tab shows,
  // and check `manager_id_column_found`. Remove once the manager_id issue
  // is confirmed fixed — it's not meant to stay long-term.
  @Get('debug/db-info')
  async dbInfo(@Request() req: { user?: { role?: string } }) {
    if (req.user?.role?.toLowerCase() !== 'admin') {
      throw new ForbiddenException('Admin only');
    }

    const [identity] = await this.dataSource.query(
      `SELECT current_database() AS database, inet_server_addr()::text AS server_ip, current_setting('search_path') AS search_path`
    );

    const columns: { column_name: string }[] = await this.dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'tenant_ssipl' AND table_name = 'users' AND column_name = 'manager_id'`
    );

    return {
      resolved_config: {
        // No password — just enough to compare against pgAdmin/Railway.
        host: this.configService.get('DATABASE_HOST'),
        port: this.configService.get('DATABASE_PORT'),
        name: this.configService.get('DATABASE_NAME'),
      },
      live: identity,
      manager_id_column_found: columns.length > 0,
    };
  }

  // ── TEMPORARY fix endpoint ──
  // Runs the ADD COLUMN directly through the app's own live connection
  // pool — the exact same connection every other request already uses
  // successfully. This sidesteps the whole "which database is pgAdmin
  // pointed at vs. which one the app is pointed at" question entirely,
  // because it doesn't touch any external tool's connection — it fixes
  // whatever database the app itself is actually talking to.
  // Safe to call more than once (IF NOT EXISTS). Admin-only. Remove once
  // confirmed working — GET /api/v1/users should stop 500ing right after.
  @Post('debug/fix-manager-id')
  async fixManagerId(@Request() req: { user?: { role?: string } }) {
    if (req.user?.role?.toLowerCase() !== 'admin') {
      throw new ForbiddenException('Admin only');
    }

    await this.dataSource.query(
      `ALTER TABLE tenant_ssipl.users ADD COLUMN IF NOT EXISTS manager_id UUID`
    );
    await this.dataSource.query(
      `CREATE INDEX IF NOT EXISTS idx_users_manager_id ON tenant_ssipl.users (manager_id)`
    );

    const columns: { column_name: string }[] = await this.dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'tenant_ssipl' AND table_name = 'users' AND column_name = 'manager_id'`
    );

    return {
      message: 'manager_id column ensured on the database this app is actually connected to.',
      manager_id_column_found: columns.length > 0,
    };
  }
}