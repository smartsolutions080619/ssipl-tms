import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Designation } from './designation.entity';

@Injectable()
export class DesignationsService {
  constructor(
    @InjectRepository(Designation)
    private readonly repo: Repository<Designation>,
  ) {}

  async findAll() {
    // Includes how many users currently hold each designation — handy for
    // the frontend to show a count and to warn before deleting one in use.
    return this.repo.query(`
      SELECT d.*, COUNT(u.id)::int AS user_count
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

  async create(dto: { name: string; description?: string }) {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A designation with this name already exists');

    const designation = this.repo.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
    });
    return this.repo.save(designation);
  }

  async update(id: string, dto: { name?: string; description?: string }) {
    const designation = await this.findOne(id);
    if (dto.name !== undefined) designation.name = dto.name.trim();
    if (dto.description !== undefined) designation.description = dto.description?.trim() || null;
    return this.repo.save(designation);
  }

  async remove(id: string) {
    await this.findOne(id); // 404 if missing
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