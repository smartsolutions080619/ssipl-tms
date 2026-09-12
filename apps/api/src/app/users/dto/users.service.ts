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
import { ActivityLogService } from '../../activity/activity-log.service';
import { ActivityAction } from '../../activity/activity-log.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  private bgMail(fn: () => Promise<any>) {
    fn().catch(err => console.error('[UsersService] Mail failed:', err?.message));
  }

  async findAll() {
    const users = await this.userRepo.find({
      where: { isActive: true },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        roleId: true, departmentId: true, managerId: true, designationId: true, createdAt: true, status: true,
        restrictTaskVisibility: true,
      },
    });

    const rows = await this.userRepo.query(
      `SELECT user_id, department_id FROM tenant_ssipl.user_departments`
    );
    const deptMap = new Map<string, string[]>();
    for (const r of rows) {
      const list = deptMap.get(r.user_id) || [];
      list.push(r.department_id);
      deptMap.set(r.user_id, list);
    }

    const extraRows = await this.userRepo.query(
      `SELECT viewer_user_id, department_id FROM tenant_ssipl.user_extra_departments`
    );
    const extraDeptMap = new Map<string, string[]>();
    for (const r of extraRows) {
      const list = extraDeptMap.get(r.viewer_user_id) || [];
      list.push(r.department_id);
      extraDeptMap.set(r.viewer_user_id, list);
    }

    const extraDesigRows = await this.userRepo.query(
      `SELECT viewer_user_id, designation_id FROM tenant_ssipl.user_extra_designations`
    );
    const extraDesigMap = new Map<string, string[]>();
    for (const r of extraDesigRows) {
      const list = extraDesigMap.get(r.viewer_user_id) || [];
      list.push(r.designation_id);
      extraDesigMap.set(r.viewer_user_id, list);
    }

    const visibilityRows = await this.userRepo.query(
      `SELECT viewer_id, target_user_id FROM tenant_ssipl.user_task_visibility`
    );
    const visibilityMap = new Map<string, string[]>();
    for (const r of visibilityRows) {
      const list = visibilityMap.get(r.viewer_id) || [];
      list.push(r.target_user_id);
      visibilityMap.set(r.viewer_id, list);
    }

    return users.map(u => ({
      ...u,
      departmentIds: deptMap.get(u.id) || (u.departmentId ? [u.departmentId] : []),
      extraDepartmentIds: extraDeptMap.get(u.id) || [],
      extraDesignationIds: extraDesigMap.get(u.id) || [],
      visibleUserIds: visibilityMap.get(u.id) || [],
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
        restrictTaskVisibility: true,
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
    const extraDesignationIds = await this.getExtraDesignations(id);
    const visibleUserIds = await this.getTaskVisibility(id);

    return { ...user, departmentIds, extraDepartmentIds, extraDesignationIds, visibleUserIds };
  }

  async getUserDepartments(userId: string): Promise<string[]> {
    const rows = await this.userRepo.query(
      `SELECT department_id FROM tenant_ssipl.user_departments WHERE user_id = $1`,
      [userId]
    );
    return rows.map((r: any) => r.department_id);
  }

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

    await this.userRepo.query(
      `UPDATE tenant_ssipl.users SET department_id = $1 WHERE id = $2`,
      [departmentIds[0] || null, userId]
    );

    return { userId, departmentIds };
  }

  async getExtraDepartments(userId: string): Promise<string[]> {
    const rows = await this.userRepo.query(
      `SELECT department_id FROM tenant_ssipl.user_extra_departments WHERE viewer_user_id = $1`,
      [userId]
    );
    return rows.map((r: any) => r.department_id);
  }

  async setExtraDepartments(userId: string, departmentIds: string[], actorId?: string) {
    const target = await this.findOne(userId); // throws 404 if user doesn't exist
    const before = target.extraDepartmentIds || [];

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

    if (actorId) {
      const before_ = [...before].sort();
      const after_ = [...departmentIds].sort();
      if (JSON.stringify(before_) !== JSON.stringify(after_)) {
        await this.activityLogService.log(
          actorId,
          ActivityAction.DEPARTMENT_ACCESS_CHANGED,
          undefined,
          { scope: 'user', targetUserId: userId, departmentIds: before },
          { scope: 'user', targetUserId: userId, departmentIds },
        );
      }
    }

    return { userId, extraDepartmentIds: departmentIds };
  }

  async getExtraDesignations(userId: string): Promise<string[]> {
    const rows = await this.userRepo.query(
      `SELECT designation_id FROM tenant_ssipl.user_extra_designations WHERE viewer_user_id = $1`,
      [userId]
    );
    return rows.map((r: any) => r.designation_id);
  }

  async setExtraDesignations(userId: string, designationIds: string[], actorId?: string) {
    const target = await this.findOne(userId); // throws 404 if user doesn't exist
    const before = target.extraDesignationIds || [];

    await this.userRepo.query(
      `DELETE FROM tenant_ssipl.user_extra_designations WHERE viewer_user_id = $1`,
      [userId]
    );

    if (designationIds.length > 0) {
      const values = designationIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_extra_designations (viewer_user_id, designation_id) VALUES ${values}`,
        [userId, ...designationIds]
      );
    }

    if (actorId) {
      const before_ = [...before].sort();
      const after_ = [...designationIds].sort();
      if (JSON.stringify(before_) !== JSON.stringify(after_)) {
        await this.activityLogService.log(
          actorId,
          ActivityAction.DESIGNATION_ACCESS_CHANGED,
          undefined,
          { scope: 'user', targetUserId: userId, designationIds: before },
          { scope: 'user', targetUserId: userId, designationIds },
        );
      }
    }

    return { userId, extraDesignationIds: designationIds };
  }

  async setRestrictTaskVisibility(userId: string, restrict: boolean, actorId: string) {
    const target = await this.findOne(userId); // throws 404 if user doesn't exist
    const before = !!(target as any).restrictTaskVisibility;

    await this.userRepo.update(userId, { restrictTaskVisibility: restrict });

    if (before !== restrict) {
      await this.activityLogService.log(
        actorId,
        ActivityAction.TASK_VISIBILITY_RESTRICTION_CHANGED,
        undefined,
        { scope: 'user', targetUserId: userId, restrictTaskVisibility: before },
        { scope: 'user', targetUserId: userId, restrictTaskVisibility: restrict },
      );
    }

    return { userId, restrictTaskVisibility: restrict };
  }

  async getTaskVisibility(userId: string): Promise<string[]> {
    const rows = await this.userRepo.query(
      `SELECT target_user_id FROM tenant_ssipl.user_task_visibility WHERE viewer_id = $1`,
      [userId]
    );
    return rows.map((r: any) => r.target_user_id);
  }

  async setTaskVisibility(userId: string, targetUserIds: string[], actorId: string) {
    await this.findOne(userId); // throws 404 if user doesn't exist
    const before = await this.getTaskVisibility(userId);

    await this.userRepo.query(
      `DELETE FROM tenant_ssipl.user_task_visibility WHERE viewer_id = $1`,
      [userId]
    );

    if (targetUserIds.length > 0) {
      const values = targetUserIds.map((_, i) => `($1, $${i + 2})`).join(', ');
      await this.userRepo.query(
        `INSERT INTO tenant_ssipl.user_task_visibility (viewer_id, target_user_id) VALUES ${values}`,
        [userId, ...targetUserIds]
      );
    }

    const before_ = [...before].sort();
    const after_ = [...targetUserIds].sort();
    if (JSON.stringify(before_) !== JSON.stringify(after_)) {
      await this.activityLogService.log(
        actorId,
        ActivityAction.TASK_VIEW_VISIBILITY_CHANGED,
        undefined,
        { scope: 'user', targetUserId: userId, visibleUserIds: before },
        { scope: 'user', targetUserId: userId, visibleUserIds: targetUserIds },
      );
    }

    return { userId, visibleUserIds: targetUserIds };
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