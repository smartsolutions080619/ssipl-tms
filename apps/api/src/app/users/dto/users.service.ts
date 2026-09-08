/* eslint-disable @typescript-eslint/no-explicit-any */
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

  // ── Fire-and-forget helper ──
  private bgMail(fn: () => Promise<any>) {
    fn().catch(err => console.error('[UsersService] Mail failed:', err?.message));
  }

  async findAll() {
    const users = await this.userRepo.find({
      where: { isActive: true },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roleId: true, departmentId: true, managerId: true, designationId: true, createdAt: true, status: true,
      },
    });

    // Attach the full list of departments each user belongs to
    // (a user can now be in multiple departments, not just one).
    const rows = await this.userRepo.query(
      `SELECT user_id, department_id FROM tenant_ssipl.user_departments`
    );
    const deptMap = new Map<string, string[]>();
    for (const r of rows) {
      const list = deptMap.get(r.user_id) || [];
      list.push(r.department_id);
      deptMap.set(r.user_id, list);
    }

    // Same, for the optional extra task-visibility grant (which departments'
    // tasks this user can additionally see, on top of org membership).
    const extraRows = await this.userRepo.query(
      `SELECT viewer_user_id, department_id FROM tenant_ssipl.user_extra_departments`
    );
    const extraDeptMap = new Map<string, string[]>();
    for (const r of extraRows) {
      const list = extraDeptMap.get(r.viewer_user_id) || [];
      list.push(r.department_id);
      extraDeptMap.set(r.viewer_user_id, list);
    }

    return users.map(u => ({
      ...u,
      departmentIds: deptMap.get(u.id) || (u.departmentId ? [u.departmentId] : []),
      extraDepartmentIds: extraDeptMap.get(u.id) || [],
    }));
  }

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
        roleId: true, departmentId: true, managerId: true, designationId: true, createdAt: true, status: true,
      },
    });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    const rows = await this.userRepo.query(
      `SELECT department_id FROM tenant_ssipl.user_departments WHERE user_id = $1`,
      [id]
    );
    const departmentIds = rows.length
      ? rows.map((r: any) => r.department_id)
      : (user.departmentId ? [user.departmentId] : []);

    const extraDepartmentIds = await this.getExtraDepartments(id);

    return { ...user, departmentIds, extraDepartmentIds };
  }

  // ── Get just the department IDs a user belongs to ──
  async getUserDepartments(userId: string): Promise<string[]> {
    const rows = await this.userRepo.query(
      `SELECT department_id FROM tenant_ssipl.user_departments WHERE user_id = $1`,
      [userId]
    );
    return rows.map((r: any) => r.department_id);
  }

  // ── Replace a user's full set of department memberships ──
  async setUserDepartments(userId: string, departmentIds: string[]) {
    await this.findOne(userId); // throws 404 if user doesn't exist

    await this.userRepo.query(
      `DELETE FROM tenant_ssipl.user_departments WHERE user_id = $1`,
      [userId]
    );

    if (departmentIds.length > 0) {
      const values = departmentIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_departments (user_id, department_id) VALUES ${values}`,
        [userId, ...departmentIds]
      );
    }

    // Keep the legacy single department_id column pointing at the first
    // department, so any old code that still reads it doesn't break.
    await this.userRepo.query(
      `UPDATE tenant_ssipl.users SET department_id = $1 WHERE id = $2`,
      [departmentIds[0] || null, userId]
    );

    return { userId, departmentIds };
  }

  // ── Extra task-visibility grants (admin-configured, optional) ──
  //    Distinct from setUserDepartments above: this never touches org
  //    membership, only which OTHER departments' tasks this user may
  //    additionally see. See tasks.service.ts findAll() for how it's
  //    applied — purely additive to whatever hierarchy visibility the
  //    user's role already grants.
  async getExtraDepartments(userId: string): Promise<string[]> {
    const rows = await this.userRepo.query(
      `SELECT department_id FROM tenant_ssipl.user_extra_departments WHERE viewer_user_id = $1`,
      [userId]
    );
    return rows.map((r: any) => r.department_id);
  }

  async setExtraDepartments(userId: string, departmentIds: string[]) {
    await this.findOne(userId); // throws 404 if user doesn't exist

    await this.userRepo.query(
      `DELETE FROM tenant_ssipl.user_extra_departments WHERE viewer_user_id = $1`,
      [userId]
    );

    if (departmentIds.length > 0) {
      const values = departmentIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_extra_departments (viewer_user_id, department_id) VALUES ${values}`,
        [userId, ...departmentIds]
      );
    }

    return { userId, extraDepartmentIds: departmentIds };
  }

  // ── Approve pending user ──
  async approve(id: string, roleId: string, departmentId?: string, managerId?: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (user.status !== UserStatus.PENDING)
      throw new BadRequestException(`User is not in PENDING status`);

    user.status   = UserStatus.ACTIVE;
    user.isActive = true;
    user.roleId   = roleId;
    if (departmentId) user.departmentId = departmentId;
    if (managerId) user.managerId = managerId;
    await this.userRepo.save(user);

    if (departmentId) {
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_departments (user_id, department_id)
         VALUES ($1, $2) ON CONFLICT (user_id, department_id) DO NOTHING`,
        [user.id, departmentId]
      );
    }

    // ── Email in background — don't block the approve response ──
    this.bgMail(async () => {
      const roleResult = await this.userRepo.query(
        `SELECT name FROM roles WHERE id = $1`, [roleId]
      );
      const roleName = roleResult[0]?.name || 'User';
      await this.mailService.sendAccountApproved(user.email, user.firstName, roleName);
    });

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

    // ── Email in background ──
    this.bgMail(() => this.mailService.sendAccountRejected(user.email, user.firstName));

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
      managerId: dto.managerId || null,
      designationId: dto.designationId || null,
      status: UserStatus.ACTIVE,
      isActive: true,
    });
    await this.userRepo.save(user);

    if (dto.departmentId) {
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_departments (user_id, department_id)
         VALUES ($1, $2) ON CONFLICT (user_id, department_id) DO NOTHING`,
        [user.id, dto.departmentId]
      );
    }

    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roleId: user.roleId, departmentId: user.departmentId, managerId: user.managerId };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.findOne(id);
    Object.assign(user, dto);
    await this.userRepo.save(user);

    if (dto.departmentId !== undefined) {
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_departments (user_id, department_id)
         VALUES ($1, $2) ON CONFLICT (user_id, department_id) DO NOTHING`,
        [id, dto.departmentId]
      );
    }

    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, roleId: user.roleId, departmentId: user.departmentId, managerId: user.managerId, isActive: user.isActive };
  }

  // ── Permanently delete a user (admin "Delete" button) ──
  //    A true hard delete, not a soft one — the old isActive/deletedAt
  //    flip left the row (and its unique email) sitting in the table
  //    forever, so re-registering that same email as a new user always
  //    hit a "User with this email already exists" conflict. Nothing
  //    else in this schema has a real FK onto users (every user_id
  //    column elsewhere is a bare uuid), so removing the row is safe —
  //    historical tasks/leaves/comments/activity just keep the dangling
  //    id, which their existing LEFT JOINs already render as blank.
  async remove(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);

    await this.userRepo.query(
      `DELETE FROM tenant_ssipl.user_departments WHERE user_id = $1`,
      [id]
    );
    await this.userRepo.delete(id);

    return { message: `User ${user.email} permanently deleted` };
  }

  async getProfile(userId: string) { return this.findOne(userId); }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.findOne(userId);
    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName)  user.lastName  = dto.lastName;
    await this.userRepo.save(user);
    return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName };
  }

  async getMyProfile(userId: string) {
    const [user] = await this.userRepo.query(
      `SELECT u.id, u.email, u.first_name AS "firstName", u.last_name AS "lastName",
              u.role_id AS "roleId", u.department_id AS "departmentId",
              u.manager_id AS "managerId",
              m.first_name AS "managerFirstName", m.last_name AS "managerLastName",
              u.status, u.is_active AS "isActive", u.avatar, u.created_at AS "createdAt"
       FROM tenant_ssipl.users u
       LEFT JOIN tenant_ssipl.users m ON m.id::text = u.manager_id::text
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );
    if (!user) return user;

    // A user can belong to multiple departments — include the full list,
    // same as findOne(), so the profile page isn't stuck showing only one.
    const rows = await this.userRepo.query(
      `SELECT department_id FROM tenant_ssipl.user_departments WHERE user_id = $1`,
      [userId]
    );
    const departmentIds = rows.length
      ? rows.map((r: any) => r.department_id)
      : (user.departmentId ? [user.departmentId] : []);

    return { ...user, departmentIds };
  }

  async updateMyProfile(userId: string, dto: { firstName?: string; lastName?: string; avatar?: string }) {
    const sets: string[] = [];
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

  // ── Admin sets another user's password directly (no current password
  //    needed — that's the whole point of an admin reset). Passwords are
  //    bcrypt hashes, one-way by design: there is no plaintext to show or
  //    recover, for this user or anyone else. What we *can* do is bcrypt-
  //    compare the proposed new password against the stored hash, so the
  //    admin can't accidentally "reset" it to the same password it
  //    already is. ──
  async adminSetPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }

    const [user] = await this.userRepo.query(
      `SELECT id, password_hash FROM tenant_ssipl.users WHERE id = $1`,
      [userId]
    );
    if (!user) throw new NotFoundException('User not found');

    if (user.password_hash) {
      const same = await bcrypt.compare(newPassword, user.password_hash);
      if (same) throw new BadRequestException('New password must be different from the current password.');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.query(
      `UPDATE tenant_ssipl.users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );
    return { message: 'Password updated successfully' };
  }
}