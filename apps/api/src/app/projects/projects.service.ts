import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Project, ProjectStatus, ProjectPriority } from './project.entity';
import { ProjectMember, ProjectMemberRole } from './project-member.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly memberRepo: Repository<ProjectMember>,
    private readonly notifService: NotificationsService,
  ) {}

  // ── Get all projects (with member count + task stats) ──
  async findAll(userId: string, role: string) {
    const isAdmin = role?.toLowerCase() === 'admin';

    let query = `
      SELECT
        p.*,
        u.first_name AS creator_first_name,
        u.last_name  AS creator_last_name,
        COUNT(DISTINCT pm.user_id)::int  AS member_count,
        COUNT(DISTINCT t.id)::int        AS total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'DONE' THEN t.id END)::int AS completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'IN_PROGRESS' THEN t.id END)::int AS active_tasks,
        COUNT(DISTINCT CASE WHEN t.deleted_at IS NULL AND t.due_date < NOW() AND t.status NOT IN ('DONE','CANCELLED') THEN t.id END)::int AS overdue_tasks
      FROM tenant_ssipl.projects p
      LEFT JOIN tenant_ssipl.users u  ON u.id::text = p.created_by::text
      LEFT JOIN tenant_ssipl.project_members pm ON pm.project_id = p.id
      LEFT JOIN tenant_ssipl.tasks t  ON t.project_id::text = p.id::text AND t.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.is_active = true
    `;

    // Non-admins see only projects they are member of
    if (!isAdmin) {
      query += ` AND (p.created_by = '${userId}' OR pm.user_id = '${userId}')`;
    }

    query += ` GROUP BY p.id, u.first_name, u.last_name ORDER BY p.created_at DESC`;

    return this.projectRepo.query(query);
  }

  // ── Get single project with full details ──
  async findOne(id: string) {
    const [project] = await this.projectRepo.query(`
      SELECT p.*,
        u.first_name AS creator_first_name, u.last_name AS creator_last_name,
        COUNT(DISTINCT t.id)::int AS total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'DONE' THEN t.id END)::int AS completed_tasks,
        COUNT(DISTINCT CASE WHEN t.status IN ('TODO') THEN t.id END)::int AS todo_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'IN_PROGRESS' THEN t.id END)::int AS active_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'IN_REVIEW' THEN t.id END)::int AS review_tasks,
        COUNT(DISTINCT CASE WHEN t.deleted_at IS NULL AND t.due_date < NOW() AND t.status NOT IN ('DONE','CANCELLED') THEN t.id END)::int AS overdue_tasks
      FROM tenant_ssipl.projects p
      LEFT JOIN tenant_ssipl.users u ON u.id::text = p.created_by::text
      LEFT JOIN tenant_ssipl.tasks t ON t.project_id::text = p.id::text AND t.deleted_at IS NULL
      WHERE p.id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id, u.first_name, u.last_name
    `, [id]);

    if (!project) throw new NotFoundException('Project not found');

    // Get members
    const members = await this.memberRepo.query(`
      SELECT pm.*, u.first_name, u.last_name, u.email,
             r.name AS role_name, d.name AS dept_name
      FROM tenant_ssipl.project_members pm
      LEFT JOIN tenant_ssipl.users u ON u.id::text = pm.user_id::text
      LEFT JOIN tenant_ssipl.roles r ON r.id::text = u.role_id::text
      LEFT JOIN tenant_ssipl.departments d ON d.id::text = u.department_id::text
      WHERE pm.project_id = $1
      ORDER BY pm.created_at ASC
    `, [id]);

    return { ...project, members };
  }

  // ── Create project ──
  async create(dto: {
    name: string; description?: string; projectCode?: string;
    status?: ProjectStatus; priority?: ProjectPriority;
    color?: string; icon?: string;
    startDate?: string; endDate?: string;
    memberIds?: string[]; departmentIds?: string[];
  }, createdBy: string) {

    const project = this.projectRepo.create({
      name:        dto.name,
      description: dto.description || null,
      projectCode: dto.projectCode || null,
      status:      dto.status    || ProjectStatus.PLANNING,
      priority:    dto.priority  || ProjectPriority.MEDIUM,
      color:       dto.color     || '#228b98',
      icon:        dto.icon      || '🚀',
      startDate:   dto.startDate ? new Date(dto.startDate) : null,
      endDate:     dto.endDate   ? new Date(dto.endDate)   : null,
      createdBy,
      isActive: true,
    });

    const saved = await this.projectRepo.save(project);

    // Add creator as PROJECT_LEAD automatically
    await this.memberRepo.save(this.memberRepo.create({
      projectId: saved.id, userId: createdBy,
      role: ProjectMemberRole.PROJECT_LEAD, addedBy: createdBy,
    }));

    // Add individual members
    const allUserIds = new Set<string>([createdBy]);
    if (dto.memberIds?.length) {
      for (const uid of dto.memberIds) {
        if (!allUserIds.has(uid)) {
          allUserIds.add(uid);
          await this.memberRepo.save(this.memberRepo.create({
            projectId: saved.id, userId: uid,
            role: ProjectMemberRole.DEVELOPER, addedBy: createdBy,
          }));
        }
      }
    }

    // Add department members
    if (dto.departmentIds?.length) {
      const deptUsers = await this.projectRepo.query(
        `SELECT id FROM tenant_ssipl.users WHERE department_id = ANY($1::uuid[]) AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [dto.departmentIds]
      );
      for (const u of deptUsers) {
        if (!allUserIds.has(u.id)) {
          allUserIds.add(u.id);
          await this.memberRepo.save(this.memberRepo.create({
            projectId: saved.id, userId: u.id,
            role: ProjectMemberRole.DEVELOPER, addedBy: createdBy,
          }));
        }
      }
    }

    // Notify all added members (except creator)
    const [creator] = await this.projectRepo.query(`SELECT first_name, last_name FROM tenant_ssipl.users WHERE id = $1`, [createdBy]);
    for (const uid of allUserIds) {
      if (uid !== createdBy) {
        await this.notifService.create(
          uid,
          `Added to project: ${saved.name}`,
          `${creator.first_name} ${creator.last_name} added you to project "${saved.name}"`,
          { type: 'PROJECT_ADDED', projectId: saved.id },
          '/projects',
        );
      }
    }

    return this.findOne(saved.id);
  }

  // ── Update project ──
  async update(id: string, dto: Partial<{ name: string; description: string; status: ProjectStatus; priority: ProjectPriority; color: string; icon: string; startDate: string; endDate: string; progress: number; projectCode: string; }>) {
    const project = await this.projectRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!project) throw new NotFoundException('Project not found');

    if (dto.name)        project.name        = dto.name;
    if (dto.description !== undefined) project.description = dto.description;
    if (dto.status)      project.status      = dto.status;
    if (dto.priority)    project.priority    = dto.priority;
    if (dto.color)       project.color       = dto.color;
    if (dto.icon)        project.icon        = dto.icon;
    if (dto.startDate)   project.startDate   = new Date(dto.startDate);
    if (dto.endDate)     project.endDate     = new Date(dto.endDate);
    if (dto.progress !== undefined) project.progress = dto.progress;
    if (dto.projectCode) project.projectCode = dto.projectCode;

    return this.projectRepo.save(project);
  }

  // ── Delete project (soft) ──
  async remove(id: string) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    project.deletedAt = new Date();
    project.isActive  = false;
    await this.projectRepo.save(project);
    return { message: `Project "${project.name}" deleted` };
  }

  // ── Add member ──
  async addMember(projectId: string, userId: string, role: ProjectMemberRole, addedBy: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const existing = await this.memberRepo.findOne({ where: { projectId, userId } });
    if (existing) throw new BadRequestException('User is already a member');

    const member = await this.memberRepo.save(this.memberRepo.create({ projectId, userId, role, addedBy }));

    // Notify
    const [adder] = await this.projectRepo.query(`SELECT first_name, last_name FROM tenant_ssipl.users WHERE id = $1`, [addedBy]);
    await this.notifService.create(
      userId,
      `Added to project: ${project.name}`,
      `${adder.first_name} ${adder.last_name} added you to project "${project.name}" as ${role.replace('_', ' ')}`,
      { type: 'PROJECT_ADDED', projectId },
      '/projects',
    );

    return member;
  }

  // ── Add entire department ──
  async addDepartment(projectId: string, departmentId: string, addedBy: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const users = await this.projectRepo.query(
      `SELECT id FROM tenant_ssipl.users WHERE department_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [departmentId]
    );

    let added = 0;
    for (const u of users) {
      const existing = await this.memberRepo.findOne({ where: { projectId, userId: u.id } });
      if (!existing) {
        await this.memberRepo.save(this.memberRepo.create({
          projectId, userId: u.id, role: ProjectMemberRole.DEVELOPER, addedBy,
        }));
        await this.notifService.create(
          u.id,
          `Added to project: ${project.name}`,
          `Your department was added to project "${project.name}"`,
          { type: 'PROJECT_ADDED', projectId },
          '/projects',
        );
        added++;
      }
    }

    return { message: `${added} members added from department` };
  }

  // ── Update member role ──
  async updateMemberRole(projectId: string, userId: string, role: ProjectMemberRole) {
    await this.memberRepo.update({ projectId, userId }, { role });
    return { message: 'Role updated' };
  }

  // ── Remove member ──
  async removeMember(projectId: string, userId: string) {
    await this.memberRepo.delete({ projectId, userId });
    return { message: 'Member removed' };
  }

  // ── Get project tasks ──
  async getProjectTasks(projectId: string) {
    return this.projectRepo.query(`
      SELECT t.*,
        a.first_name AS assignee_first_name, a.last_name AS assignee_last_name, a.email AS assignee_email,
        r.first_name AS reporter_first_name, r.last_name AS reporter_last_name
      FROM tenant_ssipl.tasks t
      LEFT JOIN tenant_ssipl.users a ON a.id::text = t.assignee_id::text
      LEFT JOIN tenant_ssipl.users r ON r.id::text = t.reporter_id::text
      WHERE t.project_id = $1 AND t.deleted_at IS NULL
      ORDER BY t.created_at DESC
    `, [projectId]);
  }

  // ── Auto-calculate progress from tasks ──
  async recalcProgress(projectId: string) {
    const [stats] = await this.projectRepo.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'DONE' THEN 1 END)::int AS done
      FROM tenant_ssipl.tasks
      WHERE project_id = $1 AND deleted_at IS NULL
    `, [projectId]);

    const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    await this.projectRepo.update(projectId, { progress });
    return { progress };
  }
}