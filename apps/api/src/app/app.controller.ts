import { Controller, Get, ForbiddenException, Request } from '@nestjs/common';
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
}