import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Holiday, HolidayType } from './holiday.entity';

@Injectable()
export class HolidaysService {
  constructor(
    @InjectRepository(Holiday)
    private readonly holidayRepo: Repository<Holiday>,
  ) {}

  async findAll(year?: number) {
    const y = year || new Date().getFullYear();
    return this.holidayRepo
      .createQueryBuilder('h')
      .where('h.isActive = :active', { active: true })
      .andWhere('EXTRACT(YEAR FROM h.date) = :year', { year: y })
      .orderBy('h.date', 'ASC')
      .getMany();
  }

  async findByMonth(year: number, month: number) {
    return this.holidayRepo
      .createQueryBuilder('h')
      .where('h.isActive = :active', { active: true })
      .andWhere('EXTRACT(YEAR FROM h.date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM h.date) = :month', { month })
      .orderBy('h.date', 'ASC')
      .getMany();
  }

  async findByRange(from: string, to: string) {
    return this.holidayRepo
      .createQueryBuilder('h')
      .where('h.isActive = :active', { active: true })
      .andWhere('h.date BETWEEN :from AND :to', { from, to })
      .orderBy('h.date', 'ASC')
      .getMany();
  }

  async create(dto: {
    name: string; date: string;
    holidayType?: HolidayType; description?: string; createdBy: string;
  }) {
    const holiday = this.holidayRepo.create({
      name:        dto.name,
      date:        new Date(dto.date),
      holidayType: dto.holidayType || HolidayType.NATIONAL,
      description: dto.description || null,
      createdBy:   dto.createdBy,
      isActive:    true,
    });
    return this.holidayRepo.save(holiday);
  }

  async update(id: string, dto: any) {
    const holiday = await this.holidayRepo.findOne({ where: { id } });
    if (!holiday) throw new NotFoundException('Holiday not found');
    if (dto.name)        holiday.name        = dto.name;
    if (dto.date)        holiday.date        = new Date(dto.date);
    if (dto.holidayType) holiday.holidayType = dto.holidayType;
    if (dto.description !== undefined) holiday.description = dto.description;
    if (dto.isActive    !== undefined) holiday.isActive    = dto.isActive;
    return this.holidayRepo.save(holiday);
  }

  async remove(id: string) {
    await this.holidayRepo.delete(id);
    return { message: 'Holiday deleted' };
  }
}