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

  // ── Add these methods to existing users.service.ts ──

  async getMyProfile(userId: string) {
    const [user] = await this.userRepo.query(
      `SELECT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName",
              u.role_id AS "roleId", u.department_id AS "departmentId",
              u.status, u.is_active AS "isActive", u.avatar, u.created_at AS "createdAt"
       FROM tenant_ssipl.users u
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    return user;
  }

  async updateMyProfile(userId: string, dto: { firstName?: string; lastName?: string; avatar?: string }) {
    const sets: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vals: any[]    = [];
    let idx = 1;
    if (dto.firstName !== undefined) { sets.push(`first_name = $${idx++}`); vals.push(dto.firstName); }
    if (dto.lastName  !== undefined) { sets.push(`last_name = $${idx++}`);  vals.push(dto.lastName); }
    if (dto.avatar    !== undefined) { sets.push(`avatar = $${idx++}`);     vals.push(dto.avatar); }
    if (!sets.length) return this.getMyProfile(userId);
    sets.push(`updated_at = NOW()`);
    vals.push(userId);
    await this.userRepo.query(
      `UPDATE tenant_ssipl.users SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    );
    return this.getMyProfile(userId);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const [user] = await this.userRepo.query(
      `SELECT id, password_hash FROM tenant_ssipl.users WHERE id = $1`,
      [userId]
    );
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.query(
      `UPDATE tenant_ssipl.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );
    return { message: 'Password changed successfully' };
  }
}