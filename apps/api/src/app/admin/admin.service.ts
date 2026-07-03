/* eslint-disable @typescript-eslint/no-explicit-any */
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

  // ── Get task config (priorities + types) — public endpoint ──
  async getTaskConfig() {
    const priorities = await this.configRepo.findOne({ where: { key: 'task_priorities' } });
    const types      = await this.configRepo.findOne({ where: { key: 'task_types' } });

    return {
      priorities: (priorities?.value as any)?.items ?? [
        { value: 'LOW',      label: 'Low',      color: '#34d399' },
        { value: 'MEDIUM',   label: 'Medium',   color: '#fbbf24' },
        { value: 'HIGH',     label: 'High',     color: '#fb923c' },
        { value: 'CRITICAL', label: 'Critical', color: '#f87171' },
      ],
      types: (types?.value as any)?.items ?? [
        { value: 'TASK',        label: 'Task',        emoji: '📋' },
        { value: 'BUG',         label: 'Bug',         emoji: '🐛' },
        { value: 'FEATURE',     label: 'Feature',     emoji: '⭐' },
        { value: 'IMPROVEMENT', label: 'Improvement', emoji: '📈' },
      ],
    };
  }

  async seedDefaults() {
    const defaults = [
      { key: 'max_subtask_depth',    value: { value: 3 },    description: 'Maximum depth for sub-tasks' },
      { key: 'task_number_prefix',   value: { value: 'TSK' }, description: 'Prefix for task numbers' },
      { key: 'allow_self_assign',    value: { value: true },  description: 'Allow users to assign tasks to themselves' },
      { key: 'notification_enabled', value: { value: true },  description: 'Enable in-app notifications' },
      {
        key: 'task_priorities',
        value: { items: [
          { value: 'LOW',      label: 'Low',      color: '#34d399' },
          { value: 'MEDIUM',   label: 'Medium',   color: '#fbbf24' },
          { value: 'HIGH',     label: 'High',     color: '#fb923c' },
          { value: 'CRITICAL', label: 'Critical', color: '#f87171' },
        ]},
        description: 'Custom task priority options',
      },
      {
        key: 'task_types',
        value: { items: [
          { value: 'TASK',        label: 'Task',        emoji: '📋' },
          { value: 'BUG',         label: 'Bug',         emoji: '🐛' },
          { value: 'FEATURE',     label: 'Feature',     emoji: '⭐' },
          { value: 'IMPROVEMENT', label: 'Improvement', emoji: '📈' },
        ]},
        description: 'Custom task type options',
      },
    ];

    for (const d of defaults) {
      const exists = await this.configRepo.findOne({ where: { key: d.key } });
      if (!exists) await this.configRepo.save(this.configRepo.create(d));
    }
    return { message: 'Default configs seeded successfully' };
  }
}