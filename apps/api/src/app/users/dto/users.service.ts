import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../../auth/user.entity';
import { CreateUserDto } from './create-user.dto';
import { UpdateUserDto } from './update-user.dto';
import { MailService } from '../../mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async findAll() {
    return this.userRepo.find({
      where: { isActive: true },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roleId: true, departmentId: true, createdAt: true, status: true,
      },
    });
  }

  // ── Pending users for admin approval ──
  async findPending() {
    return this.userRepo.find({
      where: { status: UserStatus.PENDING },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        createdAt: true, status: true,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const user = await this.userRepo.findOne({
      where: { id, isActive: true },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roleId: true, departmentId: true, createdAt: true, status: true,
      },
    });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    return user;
  }

  // ── Approve pending user ──
  async approve(id: string, roleId: string, departmentId?: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (user.status !== UserStatus.PENDING)
      throw new BadRequestException(`User is not in PENDING status`);

    user.status       = UserStatus.ACTIVE;
    user.isActive     = true;
    user.roleId       = roleId;
    if (departmentId) user.departmentId = departmentId;

    await this.userRepo.save(user);

    // Get role name for email
    const roleResult = await this.userRepo.query(
      `SELECT name FROM roles WHERE id = $1`, [roleId]
    );
    const roleName = roleResult[0]?.name || 'User';

    // Send approval email
    await this.mailService.sendAccountApproved(user.email, user.firstName, roleName);

    return {
      message: `User ${user.email} approved successfully`,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, status: user.status, roleId: user.roleId },
    };
  }

  // ── Reject pending user ──
  async reject(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (user.status !== UserStatus.PENDING)
      throw new BadRequestException(`User is not in PENDING status`);

    user.status   = UserStatus.REJECTED;
    user.isActive = false;
    await this.userRepo.save(user);

    // Send rejection email
    await this.mailService.sendAccountRejected(user.email, user.firstName);

    return { message: `User ${user.email} rejected` };
  }

  async create(dto: CreateUserDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('User with this email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      email: dto.email, passwordHash,
      firstName: dto.firstName, lastName: dto.lastName,
      roleId: dto.roleId, departmentId: dto.departmentId,
      status: UserStatus.ACTIVE,  // Admin-created users are immediately active
      isActive: true,
    });
    await this.userRepo.save(user);

    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roleId: user.roleId, departmentId: user.departmentId };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    await this.userRepo.save(user);
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roleId: user.roleId, departmentId: user.departmentId, isActive: user.isActive };
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    user.isActive = false;
    user.deletedAt = new Date();
    await this.userRepo.save(user);
    return { message: `User ${user.email} deactivated successfully` };
  }

  async getProfile(userId: string) { return this.findOne(userId); }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.findOne(userId);
    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName)  user.lastName  = dto.lastName;
    await this.userRepo.save(user);
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }
}