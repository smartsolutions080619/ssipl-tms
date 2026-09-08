import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from './designation.entity';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityAction } from '../activity/activity-log.entity';

@Injectable()
export class DesignationsService {
  constructor(
    @InjectRepository(Designation)
    private readonly repo: Repository<Designation>,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async findAll() {
    // Includes how many users currently hold each designation — handy for
    // the frontend to show a count and to warn before deleting one in use.
    // Also includes which role(s), if any, are linked to this designation
    // for Department Task Access (see role.entity.ts linkedDesignationId)
    // — this designation's own extra_department_ids is always what's
    // actually used; the linked role(s) just borrow it.
    return this.repo.query(`
      SELECT d.*, d.extra_department_ids AS "extraDepartmentIds",
             COALESCE(
               (SELECT jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name))
                FROM tenant_ssipl.roles r WHERE r.linked_designation_id = d.id),
               '[]'::jsonb
             ) AS "linkedRoles",
             COUNT(u.id)::int AS user_count
      FROM tenant_ssipl.designations d
      LEFT JOIN tenant_ssipl.users u ON u.designation_id = d.id AND u.deleted_at IS NULL
      GROUP BY d.id
      ORDER BY d.name ASC
    `);
  }

  async findOne(id: string) {
    const designation = await this.repo.findOne({ where: { id } });
    if (!designation) throw new NotFoundException('Designation not found');
    return designation;
  }

  async create(dto: { name: string; description?: string; extraDepartmentIds?: string[] }, actorId?: string) {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A designation with this name already exists');

    const designation = this.repo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      extraDepartmentIds: dto.extraDepartmentIds || [],
    });
    const saved = await this.repo.save(designation);

    if (actorId && dto.extraDepartmentIds?.length) {
      await this.activityLogService.log(
        actorId,
        ActivityAction.DEPARTMENT_ACCESS_CHANGED,
        undefined,
        { scope: 'designation', targetDesignationId: saved.id, targetDesignationName: saved.name, departmentIds: [] },
        { scope: 'designation', targetDesignationId: saved.id, targetDesignationName: saved.name, departmentIds: dto.extraDepartmentIds },
      );
    }

    return saved;
  }

  async update(id: string, dto: { name?: string; description?: string; extraDepartmentIds?: string[] }, actorId?: string) {
    const designation = await this.findOne(id);
    const before = designation.extraDepartmentIds || [];
    if (dto.name !== undefined) designation.name = dto.name.trim();
    if (dto.description !== undefined) designation.description = dto.description?.trim() || null;
    if (dto.extraDepartmentIds !== undefined) designation.extraDepartmentIds = dto.extraDepartmentIds;
    const saved = await this.repo.save(designation);

    if (actorId && dto.extraDepartmentIds !== undefined) {
      const before_ = [...before].sort();
      const after_ = [...dto.extraDepartmentIds].sort();
      if (JSON.stringify(before_) !== JSON.stringify(after_)) {
        await this.activityLogService.log(
          actorId,
          ActivityAction.DEPARTMENT_ACCESS_CHANGED,
          undefined,
          { scope: 'designation', targetDesignationId: id, targetDesignationName: saved.name, departmentIds: before },
          { scope: 'designation', targetDesignationId: id, targetDesignationName: saved.name, departmentIds: dto.extraDepartmentIds },
        );
      }
    }

    return saved;
  }

  async remove(id: string) {
    const designation = await this.findOne(id); // 404 if missing

    // A role can borrow this designation's Department Task Access list
    // (role.entity.ts linkedDesignationId) — deleting the designation out
    // from under a linked role would silently zero out that role's access
    // with no explanation anywhere, so block it the same way role deletion
    // is blocked while users are still assigned to it.
    const linkedRoles = await this.repo.query(
      `SELECT name FROM tenant_ssipl.roles WHERE linked_designation_id = $1`,
      [id],
    );
    if (linkedRoles.length > 0) {
      const names = linkedRoles.map((r: { name: string }) => r.name).join(', ');
      throw new ConflictException(
        `Cannot delete designation "${designation.name}" — it's linked from role${linkedRoles.length > 1 ? 's' : ''} "${names}" for Department Task Access. Unlink ${linkedRoles.length > 1 ? 'them' : 'it'} first.`,
      );
    }

    // Clear the designation off any users holding it first, so deleting
    // never leaves a dangling reference on someone's profile.
    await this.repo.query(
      `UPDATE tenant_ssipl.users SET designation_id = NULL WHERE designation_id = $1`,
      [id]
    );
    await this.repo.delete(id);
    return { message: 'Designation deleted' };
  }
}
