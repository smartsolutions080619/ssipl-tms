import {
    Injectable,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { Department } from './department.entity';
  import { CreateDepartmentDto } from './dto/create-department.dto';
  import { UpdateDepartmentDto } from './dto/update-department.dto';
  
  @Injectable()
  export class DepartmentsService {
    constructor(
      @InjectRepository(Department)
      private readonly deptRepo: Repository<Department>,
    ) {}
  
    async findAll() {
      return this.deptRepo.find({ order: { name: 'ASC' } });
    }
  
    async findOne(id: string) {
      const dept = await this.deptRepo.findOne({ where: { id } });
      if (!dept) throw new NotFoundException(`Department ${id} not found`);
      return dept;
    }
  
    async findChildren(parentId: string) {
      return this.deptRepo.find({ where: { parentId } });
    }
  
    async getHierarchy() {
      const all = await this.deptRepo.find({ order: { name: 'ASC' } });
  
      const map = new Map<string, any>();
      all.forEach(d => map.set(d.id, { ...d, children: [] }));
  
      const roots: any[] = [];
      map.forEach(dept => {
        if (dept.parentId) {
          const parent = map.get(dept.parentId);
          if (parent) parent.children.push(dept);
        } else {
          roots.push(dept);
        }
      });
  
      return roots;
    }
  
    async create(dto: CreateDepartmentDto) {
      if (dto.parentId) {
        await this.findOne(dto.parentId);
      }
  
      const dept = this.deptRepo.create({
        name: dto.name,
        parentId: dto.parentId || null,
      });
  
      return this.deptRepo.save(dept);
    }
  
    async update(id: string, dto: UpdateDepartmentDto) {
      const dept = await this.findOne(id);
  
      if (dto.parentId) {
        if (dto.parentId === id) {
          throw new BadRequestException('Department cannot be its own parent');
        }
        await this.findOne(dto.parentId);
      }
  
      Object.assign(dept, dto);
      return this.deptRepo.save(dept);
    }
  
    async remove(id: string) {
      const dept = await this.findOne(id);
      const children = await this.findChildren(id);

      if (children.length > 0) {
        throw new BadRequestException('Cannot delete department with sub-departments');
      }

      // Scrub the one remaining place that can reference this department
      // by ID before dropping the row (roles.extra_department_ids and
      // designations.extra_department_ids were retired and dropped
      // entirely — see migrations 1000000000021/1000000000022 — so
      // per-user grants are now the only thing left to clean up here).
      // Not a real DB foreign key, so nothing would ever error on its
      // own — the risk is a stale ID silently sitting in a grant forever.
      await this.deptRepo.query(
        `DELETE FROM tenant_ssipl.user_extra_departments WHERE department_id = $1`,
        [id],
      );

      await this.deptRepo.remove(dept);
      return { message: `Department "${dept.name}" deleted successfully` };
    }
  }