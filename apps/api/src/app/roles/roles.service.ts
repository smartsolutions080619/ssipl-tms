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
  
  @Injectable()
  export class RolesService {
    constructor(
      @InjectRepository(Role)
      private readonly roleRepo: Repository<Role>,
    ) {}
  
    async findAll() {
      return this.roleRepo.find();
    }
  
    async findOne(id: string) {
      const role = await this.roleRepo.findOne({ where: { id } });
      if (!role) throw new NotFoundException(`Role ${id} not found`);
      return role;
    }
  
    async create(dto: CreateRoleDto) {
      const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
      if (existing) throw new ConflictException(`Role "${dto.name}" already exists`);
  
      const role = this.roleRepo.create({
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions || [],
      });
  
      return this.roleRepo.save(role);
    }
  
    async update(id: string, dto: UpdateRoleDto) {
      const role = await this.findOne(id);
      Object.assign(role, dto);
      return this.roleRepo.save(role);
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