import {
    Injectable,
    NotFoundException,
    ConflictException,
  } from '@nestjs/common';
  import { InjectRepository } from '@nestjs/typeorm';
  import { Repository } from 'typeorm';
  import { User } from '../../auth/user.entity';
  import { CreateUserDto } from './create-user.dto';
  import { UpdateUserDto } from './update-user.dto';
  import * as bcrypt from 'bcrypt';
  
  @Injectable()
  export class UsersService {
    constructor(
      @InjectRepository(User)
      private readonly userRepo: Repository<User>,
    ) {}
  
    async findAll() {
      return this.userRepo.find({
        where: { isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roleId: true,
          departmentId: true,
          createdAt: true,
        },
      });
    }
  
    async findOne(id: string) {
      const user = await this.userRepo.findOne({
        where: { id, isActive: true },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          roleId: true,
          departmentId: true,
          createdAt: true,
        },
      });
  
      if (!user) {
        throw new NotFoundException(`User with id ${id} not found`);
      }
  
      return user;
    }
  
    async create(dto: CreateUserDto) {
      const existing = await this.userRepo.findOne({
        where: { email: dto.email },
      });
  
      if (existing) {
        throw new ConflictException('User with this email already exists');
      }
  
      const passwordHash = await bcrypt.hash(dto.password, 10);
  
      const user = this.userRepo.create({
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        roleId: dto.roleId,
        departmentId: dto.departmentId,
      });
  
      await this.userRepo.save(user);
  
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        departmentId: user.departmentId,
      };
    }
  
    async update(id: string, dto: UpdateUserDto) {
      const user = await this.findOne(id);
  
      Object.assign(user, dto);
      await this.userRepo.save(user);
  
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        departmentId: user.departmentId,
        isActive: user.isActive,
      };
    }
  
    async remove(id: string) {
      const user = await this.findOne(id);
  
      // Soft delete
      user.isActive = false;
      user.deletedAt = new Date();
      await this.userRepo.save(user);
  
      return { message: `User ${user.email} deactivated successfully` };
    }
  
    async getProfile(userId: string) {
      return this.findOne(userId);
    }
  
    async updateProfile(userId: string, dto: UpdateUserDto) {
      const user = await this.findOne(userId);
  
      if (dto.firstName) user.firstName = dto.firstName;
      if (dto.lastName) user.lastName = dto.lastName;
  
      await this.userRepo.save(user);
  
      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }
  }