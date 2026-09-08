import {
    Injectable,
    NotFoundException,
    ConflictException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { Role } from './role.entity';
  import { CreateRoleDto } from './dto/create-role.dto';
  import { UpdateRoleDto } from './dto/update-role.dto';
  import { ActivityLogService } from '../activity/activity-log.service';
  import { ActivityAction } from '../activity/activity-log.entity';

  @Injectable()
  export class RolesService {
    constructor(
      @InjectRepository(Role)
      private readonly roleRepo: Repository<Role>,
      private readonly activityLogService: ActivityLogService,
    ) {}
  
    async findAll() {
      // Resolve the EFFECTIVE Department Task Access list: when this role
      // is linked to a designation, its own extra_department_ids is
      // ignored in favor of the linked designation's — see role.entity.ts
      // linkedDesignationId. Also surfaces the linked designation's name
      // for display.
      // Raw query (not the repo's typed find()) so linkedDesignation* and
      // effectiveDepartmentIds can be joined in — r.* alone would return
      // snake_case columns, so extra_department_ids/created_at/updated_at
      // are re-aliased to match what the entity's find() would normally
      // hand back and what the frontend already reads.
      return this.roleRepo.query(`
        SELECT r.id, r.name, r.description, r.permissions,
               r.extra_department_ids   AS "extraDepartmentIds",
               r.created_at             AS "createdAt",
               r.updated_at             AS "updatedAt",
               ld.id   AS "linkedDesignationId",
               ld.name AS "linkedDesignationName",
               COALESCE(ld.extra_department_ids, r.extra_department_ids) AS "effectiveDepartmentIds"
        FROM tenant_ssipl.roles r
        LEFT JOIN tenant_ssipl.designations ld ON r.linked_designation_id = ld.id
      `);
    }
  
    async findOne(id: string) {
      const role = await this.roleRepo.findOne({ where: { id } });
      if (!role) throw new NotFoundException(`Role ${id} not found`);
      return role;
    }
  
    async create(dto: CreateRoleDto, actorId?: string) {
      const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);

      if (dto.linkedDesignationId) await this.assertDesignationExists(dto.linkedDesignationId);

      const role = this.roleRepo.create({
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions || [],
        extraDepartmentIds: dto.extraDepartmentIds || [],
        linkedDesignationId: dto.linkedDesignationId || null,
      });

      const saved = await this.roleRepo.save(role);

      if (actorId && (dto.extraDepartmentIds?.length || dto.linkedDesignationId)) {
        await this.activityLogService.log(
          actorId,
          ActivityAction.DEPARTMENT_ACCESS_CHANGED,
          undefined,
          { scope: 'role', targetRoleId: saved.id, targetRoleName: saved.name, departmentIds: [], linkedDesignationId: null },
          { scope: 'role', targetRoleId: saved.id, targetRoleName: saved.name, departmentIds: dto.extraDepartmentIds || [], linkedDesignationId: dto.linkedDesignationId || null },
        );
      }

      return saved;
    }

    async update(id: string, dto: UpdateRoleDto, actorId?: string) {
      const role = await this.findOne(id);
      const before = role.extraDepartmentIds || [];
      const beforeLinkedDesignationId = role.linkedDesignationId;

      if (dto.linkedDesignationId) await this.assertDesignationExists(dto.linkedDesignationId);

      Object.assign(role, dto);
      if (dto.linkedDesignationId !== undefined) role.linkedDesignationId = dto.linkedDesignationId || null;
      const saved = await this.roleRepo.save(role);

      if (actorId) {
        const deptsChanged = dto.extraDepartmentIds !== undefined &&
          JSON.stringify([...before].sort()) !== JSON.stringify([...(dto.extraDepartmentIds || [])].sort());
        const linkChanged = dto.linkedDesignationId !== undefined && (dto.linkedDesignationId || null) !== (beforeLinkedDesignationId || null);

        if (deptsChanged || linkChanged) {
          await this.activityLogService.log(
            actorId,
            ActivityAction.DEPARTMENT_ACCESS_CHANGED,
            undefined,
            { scope: 'role', targetRoleId: id, targetRoleName: role.name, departmentIds: before, linkedDesignationId: beforeLinkedDesignationId || null },
            { scope: 'role', targetRoleId: id, targetRoleName: role.name, departmentIds: saved.extraDepartmentIds, linkedDesignationId: saved.linkedDesignationId || null },
          );
        }
      }

      return saved;
    }

    private async assertDesignationExists(designationId: string) {
      const [row] = await this.roleRepo.query(`SELECT id FROM tenant_ssipl.designations WHERE id = $1`, [designationId]);
      if (!row) throw new NotFoundException('Linked designation not found');
    }

    async remove(id: string) {
      const role = await this.findOne(id);

      // There's no DB foreign key from users.role_id to roles.id, so deleting
      // an in-use role would silently orphan every user who holds it — their
      // role_id would point at nothing and their permissions would just stop
      // resolving, with no error anywhere to explain why.
      const [{ count }] = await this.roleRepo.query(
        `SELECT COUNT(*)::int AS count FROM tenant_ssipl.users WHERE role_id = $1 AND deleted_at IS NULL`,
        [id],
      );
      if (count > 0) {
        throw new ConflictException(
          `Cannot delete role "${role.name}" — ${count} user${count > 1 ? 's are' : ' is'} currently assigned to it. Reassign them to a different role first.`,
        );
      }

      await this.roleRepo.remove(role);
      return { message: `Role "${role.name}" deleted successfully` };
    }
  
    async seedDefaultRoles() {
      const defaults = [
        {
          name: 'admin',
          description: 'Full access to everything',
          permissions: [
            'user:create', 'user:read', 'user:update', 'user:delete',
            'task:create', 'task:read', 'task:update', 'task:delete', 'task:assign',
            'report:read', 'settings:manage',
          ],
        },
        {
          name: 'manager',
          description: 'Can manage tasks and view users',
          permissions: [
            'user:read', 'task:create', 'task:read', 'task:update', 'task:assign',
            'task:view_department', 'report:read',
          ],
        },
        {
          name: 'employee',
          description: 'Can view and update own tasks',
          permissions: ['task:read', 'task:update'],
        },
      ];
  
      for (const r of defaults) {
        const exists = await this.roleRepo.findOne({ where: { name: r.name } });
        if (!exists) {
          await this.roleRepo.save(this.roleRepo.create(r));
        }
      }
  
      return { message: 'Default roles seeded successfully' };
    }
  }