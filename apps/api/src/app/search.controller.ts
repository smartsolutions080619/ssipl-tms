/* eslint-disable @typescript-eslint/no-explicit-any */
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './auth/guards/jwt.guard';
import { CurrentUser } from './common/decorators/current-user.decorator';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Global search across tasks, projects, users' })
  async search(@Query('q') q: string, @CurrentUser() user: any) {
    if (!q || q.trim().length < 2) return { tasks: [], projects: [], users: [] };

    const search = `%${q.toLowerCase()}%`;
    const role   = user?.role?.toLowerCase();
    const userId = user?.userId;

    // Tasks
    let taskQuery = `
      SELECT t.id, t.task_number, t.title, t.status, t.priority, t.type,
             u.first_name AS assignee_first_name, u.last_name AS assignee_last_name
      FROM tenant_ssipl.tasks t
      LEFT JOIN tenant_ssipl.users u ON u.id::text = t.assignee_id::text
      WHERE t.deleted_at IS NULL
        AND (LOWER(t.title) LIKE $1 OR LOWER(t.task_number) LIKE $1 OR LOWER(t.description) LIKE $1)
    `;
    if (role !== 'admin') {
      taskQuery += ` AND (t.assignee_id = '${userId}' OR t.reporter_id = '${userId}')`;
    }
    taskQuery += ` ORDER BY t.created_at DESC LIMIT 5`;

    // Projects
    let projectQuery = `
      SELECT p.id, p.name, p.status, p.priority, p.color, p.project_code, p.progress
      FROM tenant_ssipl.projects p
      WHERE p.deleted_at IS NULL AND p.is_active = true
        AND (LOWER(p.name) LIKE $1 OR LOWER(p.description) LIKE $1 OR LOWER(p.project_code) LIKE $1)
    `;
    if (role !== 'admin') {
      projectQuery += ` AND (p.created_by = '${userId}' OR EXISTS (SELECT 1 FROM tenant_ssipl.project_members pm WHERE pm.project_id = p.id AND pm.user_id = '${userId}'))`;
    }
    projectQuery += ` LIMIT 5`;

    // Users (admin only)
    let users: any[] = [];
    if (role === 'admin') {
      users = await this.dataSource.query(
        `SELECT u.id, u.first_name, u.last_name, u.email, r.name AS role_name
         FROM tenant_ssipl.users u
         LEFT JOIN tenant_ssipl.roles r ON r.id::text = u.role_id::text
         WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE'
           AND (LOWER(u.first_name) LIKE $1 OR LOWER(u.last_name) LIKE $1 OR LOWER(u.email) LIKE $1)
         LIMIT 5`,
        [search]
      );
    }

    const [tasks, projects] = await Promise.all([
      this.dataSource.query(taskQuery, [search]),
      this.dataSource.query(projectQuery, [search]),
    ]);

    return { tasks, projects, users };
  }
}