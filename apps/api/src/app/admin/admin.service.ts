import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminConfig } from './admin-config.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AdminConfig)
    private readonly configRepo: Repository<AdminConfig>,
  ) {}

  async getAll() {
    return this.configRepo.find();
  }

  async getByKey(key: string) {
    const config = await this.configRepo.findOne({ where: { key } });
    if (!config) throw new NotFoundException(`Config key "${key}" not found`);
    return config;
  }

  async set(key: string, value: object, description?: string) {
    const existing = await this.configRepo.findOne({ where: { key } });

    if (existing) {
      existing.value = value;
      if (description) existing.description = description;
      return this.configRepo.save(existing);
    }

    const config = this.configRepo.create({ key, value, description });
    return this.configRepo.save(config);
  }

  async remove(key: string) {
    const config = await this.getByKey(key);
    await this.configRepo.remove(config);
    return { message: `Config "${key}" deleted` };
  }

  async seedDefaults() {
    const defaults = [
      {
        key: 'max_subtask_depth',
        value: { value: 3 },
        description: 'Maximum depth for sub-tasks',
      },
      {
        key: 'task_number_prefix',
        value: { value: 'TSK' },
        description: 'Prefix for task numbers',
      },
      {
        key: 'allow_self_assign',
        value: { value: true },
        description: 'Allow users to assign tasks to themselves',
      },
      {
        key: 'notification_enabled',
        value: { value: true },
        description: 'Enable in-app notifications',
      },
    ];

    for (const d of defaults) {
      const exists = await this.configRepo.findOne({ where: { key: d.key } });
      if (!exists) {
        await this.configRepo.save(this.configRepo.create(d));
      }
    }

    return { message: 'Default configs seeded successfully' };
  }
}