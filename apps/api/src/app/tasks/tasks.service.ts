import {
    Injectable,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository, IsNull } from 'typeorm';
  import { Task } from './task.entity';
  import { CreateTaskDto } from './dto/create-task.dto';
  import { UpdateTaskDto } from './dto/update-task.dto';
  
  @Injectable()
  export class TasksService {
    constructor(
      @InjectRepository(Task)
      private readonly taskRepo: Repository<Task>,
    ) {}
  
    // Auto task number generate — TSK-2026-0001
    private async generateTaskNumber(): Promise<string> {
      const year = new Date().getFullYear();
      const count = await this.taskRepo.count();
      const number = String(count + 1).padStart(4, '0');
      return `TSK-${year}-${number}`;
    }
  
    async findAll() {
      return this.taskRepo.find({
        where: { deletedAt: IsNull() },
        order: { createdAt: 'DESC' },
      });
    }
  
    async findOne(id: string) {
      const task = await this.taskRepo.findOne({
        where: { id, deletedAt: IsNull() },
      });
      if (!task) throw new NotFoundException(`Task ${id} not found`);
      return task;
    }
  
    async findSubTasks(parentId: string) {
      return this.taskRepo.find({
        where: { parentTaskId: parentId, deletedAt: IsNull() },
      });
    }
  
    async create(dto: CreateTaskDto, reporterId: string) {
      // Sub-task level check — max 3 levels
      if (dto.parentTaskId) {
        await this.checkSubTaskDepth(dto.parentTaskId, 1);
      }
  
      const taskNumber = await this.generateTaskNumber();
  
      const task = this.taskRepo.create({
        taskNumber,
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        type: dto.type,
        assigneeId: dto.assigneeId,
        reporterId,
        parentTaskId: dto.parentTaskId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      });
  
      return this.taskRepo.save(task);
    }
  
    async update(id: string, dto: UpdateTaskDto) {
      const task = await this.findOne(id);
      Object.assign(task, dto);
      return this.taskRepo.save(task);
    }
  
    async remove(id: string) {
      const task = await this.findOne(id);
      task.deletedAt = new Date();
      await this.taskRepo.save(task);
      return { message: `Task ${task.taskNumber} deleted successfully` };
    }
  
    // Sub-task depth check — max 3 levels
    private async checkSubTaskDepth(parentId: string, currentDepth: number): Promise<void> {
      if (currentDepth >= 3) {
        throw new BadRequestException('Maximum sub-task depth of 3 levels exceeded');
      }
      const parent = await this.taskRepo.findOne({ where: { id: parentId } });
      if (parent?.parentTaskId) {
        await this.checkSubTaskDepth(parent.parentTaskId, currentDepth + 1);
      }
    }
  }