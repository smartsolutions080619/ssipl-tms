/* eslint-disable @typescript-eslint/no-explicit-any */
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

  // ── Return holidays that should show in announcement widget:
  //    - from 2 days before the holiday date
  //    - up to and including the holiday date itself
  //    - hidden the day after (already passed)
  async getUpcomingAnnouncements() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Show window: today → today + 2 days
    const from = today.toISOString().split('T')[0];

    const until = new Date(today);
    until.setDate(until.getDate() + 2);
    const to = until.toISOString().split('T')[0];

    const holidays = await this.holidayRepo
      .createQueryBuilder('h')
      .where('h.isActive = :active', { active: true })
      .andWhere('h.date BETWEEN :from AND :to', { from, to })
      .orderBy('h.date', 'ASC')
      .getMany();

    // Add how many days until each holiday
    return holidays.map(h => {
      const hDate = new Date(h.date);
      hDate.setHours(0, 0, 0, 0);
      const diffMs   = hDate.getTime() - today.getTime();
      const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return { ...h, daysUntil };
    });
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