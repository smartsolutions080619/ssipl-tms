/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { LeaveRequest, LeaveStatus } from './leave-request.entity';
import { LeaveBalance } from './leave-balance.entity';
import { LeaveType } from './leave-type.entity';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityLogService } from '../activity/activity-log.service';
import { ActivityAction } from '../activity/activity-log.entity';

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    @InjectRepository(LeaveType)
    private readonly typeRepo: Repository<LeaveType>,
    private readonly mailService: MailService,
    private readonly notifService: NotificationsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  // ── Calculate business days between two dates ──
  private calcDays(from: Date, to: Date): number {
    let count = 0;
    const cur = new Date(from);
    while (cur <= to) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++; // exclude weekends
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  // ── Pro-rata calculation for new joiners ──
  private proRata(annual: number, joiningDate: Date, year: number): number {
    const yearStart  = new Date(year, 0, 1);
    const effectiveStart = joiningDate > yearStart ? joiningDate : yearStart;
    const monthsRemaining = 12 - effectiveStart.getMonth(); // getMonth() is 0-indexed
    const proRated = (annual * monthsRemaining) / 12;
    return Math.round(proRated * 2) / 2; // round to 0.5
  }

  // ── Fire-and-forget helper: runs notifications/emails in the
  //    background without making the caller wait. Any failure here
  //    is logged but never blocks or fails the main request. ──
  private notifyInBackground(fn: () => Promise<void>) {
    fn().catch(err => {
      console.error('[LeavesService] Background notification failed:', err?.message || err);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Leave Types (admin-managed)
  // ═══════════════════════════════════════════════════════════════

  // ── Active types only — the apply-leave form, balance cards, and
  //    everything an ordinary employee sees. ──
  async getActiveLeaveTypes() {
    return this.typeRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC' } });
  }

  // ── Every type, including deactivated ones — the Admin → Leave
  //    Management screen. ──
  async getAllLeaveTypesAdmin() {
    return this.typeRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createLeaveType(dto: {
    code: string; label: string; emoji?: string; color?: string; description?: string;
    annualDays?: number; proRata?: boolean; carryForwardEnabled?: boolean;
    maxCarryForward?: number; isUnlimited?: boolean;
  }) {
    if (!dto.code?.trim()) throw new BadRequestException('Code is required');
    if (!dto.label?.trim()) throw new BadRequestException('Label is required');

    const code = dto.code.toUpperCase().trim().replace(/\s+/g, '_');
    const existing = await this.typeRepo.findOne({ where: { code } });
    if (existing) throw new BadRequestException(`A leave type with code "${code}" already exists`);

    const annualDays      = dto.annualDays ?? 0;
    const maxCarryForward = dto.maxCarryForward ?? 0;
    if ((dto.carryForwardEnabled ?? false) && maxCarryForward > annualDays) {
      throw new BadRequestException('Max carry forward cannot exceed annual days');
    }

    const { max } = await this.typeRepo
      .createQueryBuilder('t')
      .select('MAX(t.sortOrder)', 'max')
      .getRawOne();

    const type = this.typeRepo.create({
      code,
      label: dto.label.trim(),
      emoji: dto.emoji || null,
      color: dto.color || 'var(--brand-primary)',
      description: dto.description || null,
      annualDays,
      proRata: dto.proRata ?? true,
      carryForwardEnabled: dto.carryForwardEnabled ?? false,
      maxCarryForward,
      isUnlimited: dto.isUnlimited ?? false,
      sortOrder: (Number(max) || 0) + 1,
      isActive: true,
    });
    return this.typeRepo.save(type);
  }

  async updateLeaveType(id: string, dto: {
    label?: string; emoji?: string; color?: string; description?: string;
    annualDays?: number; proRata?: boolean; carryForwardEnabled?: boolean;
    maxCarryForward?: number; isUnlimited?: boolean; sortOrder?: number;
  }) {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Leave type not found');

    // code is intentionally not editable here — past leave_requests
    // reference it by code, and silently renaming it would orphan them.
    if (dto.label !== undefined)                type.label = dto.label.trim();
    if (dto.emoji !== undefined)                 type.emoji = dto.emoji;
    if (dto.color !== undefined)                 type.color = dto.color;
    if (dto.description !== undefined)           type.description = dto.description;
    if (dto.annualDays !== undefined)            type.annualDays = dto.annualDays;
    if (dto.proRata !== undefined)               type.proRata = dto.proRata;
    if (dto.carryForwardEnabled !== undefined)   type.carryForwardEnabled = dto.carryForwardEnabled;
    if (dto.maxCarryForward !== undefined)       type.maxCarryForward = dto.maxCarryForward;
    if (dto.isUnlimited !== undefined)           type.isUnlimited = dto.isUnlimited;
    if (dto.sortOrder !== undefined)             type.sortOrder = dto.sortOrder;

    if (type.carryForwardEnabled && Number(type.maxCarryForward) > Number(type.annualDays)) {
      throw new BadRequestException('Max carry forward cannot exceed annual days');
    }

    return this.typeRepo.save(type);
  }

  async setLeaveTypeActive(id: string, isActive: boolean) {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Leave type not found');
    type.isActive = isActive;
    await this.typeRepo.save(type);
    return { message: `${type.label} ${isActive ? 'activated' : 'deactivated'}` };
  }

  // ═══════════════════════════════════════════════════════════════
  // Balances
  // ═══════════════════════════════════════════════════════════════

  // ── Get or create a user's balance row for one leave type + year.
  //    Defaults the total to the type's org-wide annualDays, pro-rated
  //    for the joining date when the type has proRata enabled. ──
  async getOrCreateBalance(userId: string, leaveTypeId: string, year: number, joiningDate?: Date): Promise<LeaveBalance> {
    let balance = await this.balanceRepo.findOne({ where: { userId, leaveTypeId, year } });
    if (balance) return balance;

    const type = await this.typeRepo.findOne({ where: { id: leaveTypeId } });
    const annual = type ? Number(type.annualDays) : 0;
    const total  = type?.proRata ? this.proRata(annual, joiningDate || new Date(), year) : annual;

    balance = this.balanceRepo.create({ userId, leaveTypeId, year, total, used: 0, carried: 0 });
    return this.balanceRepo.save(balance);
  }

  // ── Compute every active type's balance for one user+year, in the
  //    { CODE: { total, used, remaining, carryForward } } shape both the
  //    employee's own balance card and the admin override panel use. ──
  private async computeBalances(userId: string, year: number) {
    const types = await this.getActiveLeaveTypes();
    const result: Record<string, { total: number; used: number; remaining: number; carryForward: number }> = {};

    for (const type of types) {
      if (type.isUnlimited) {
        result[type.code] = { total: 999, used: 0, remaining: 999, carryForward: 0 };
        continue;
      }
      const balance = await this.getOrCreateBalance(userId, type.id, year);
      const total = Number(balance.total) + Number(balance.carried);
      result[type.code] = {
        total,
        used: Number(balance.used),
        remaining: total - Number(balance.used),
        carryForward: Number(balance.carried),
      };
    }
    return result;
  }

  // ── Get user's own leave balance (current year) ──
  async getBalance(userId: string) {
    const year = new Date().getFullYear();
    return { year, ...(await this.computeBalances(userId, year)) };
  }

  // ── Admin — any user's balance, any year (defaults to current) ──
  async getUserBalance(userId: string, year?: number) {
    const y = year || new Date().getFullYear();
    return { userId, year: y, ...(await this.computeBalances(userId, y)) };
  }

  // ── Admin — directly override a user's total entitlement for one
  //    type + year (e.g. a senior employee gets 20 CL instead of the
  //    org default 12). Logged to the activity trail so there's a
  //    record of who changed it and why. ──
  async overrideBalance(adminId: string, userId: string, leaveTypeId: string, year: number, newTotal: number, reason?: string) {
    if (newTotal < 0) throw new BadRequestException('Balance cannot be negative');

    const type = await this.typeRepo.findOne({ where: { id: leaveTypeId } });
    if (!type) throw new NotFoundException('Leave type not found');
    if (type.isUnlimited) throw new BadRequestException(`${type.label} is unlimited and doesn't track a balance`);

    const balance = await this.getOrCreateBalance(userId, leaveTypeId, year);
    const previousTotal = Number(balance.total);
    balance.total = newTotal;
    await this.balanceRepo.save(balance);

    await this.activityLogService.log(
      adminId,
      ActivityAction.LEAVE_BALANCE_ADJUSTED,
      undefined,
      { leaveTypeCode: type.code, leaveTypeLabel: type.label, previousTotal, year },
      { leaveTypeCode: type.code, leaveTypeLabel: type.label, newTotal, year, reason: reason?.trim() || null, targetUserId: userId },
    );

    return { message: `${type.label} balance for ${year} updated to ${newTotal} days`, balance };
  }

  // ═══════════════════════════════════════════════════════════════
  // Leave Requests
  // ═══════════════════════════════════════════════════════════════

  // ── Submit leave request ──
  async create(userId: string, dto: {
    leaveType: string; fromDate: string; toDate: string; reason: string;
  }) {
    const type = await this.typeRepo.findOne({ where: { code: dto.leaveType, isActive: true } });
    if (!type) throw new BadRequestException(`Unknown or inactive leave type: ${dto.leaveType}`);

    const from      = new Date(dto.fromDate);
    const to        = new Date(dto.toDate);
    const totalDays = this.calcDays(from, to);

    if (totalDays <= 0) throw new BadRequestException('Invalid date range — no working days selected');
    if (from < new Date(new Date().setHours(0,0,0,0))) throw new BadRequestException('Cannot apply leave for past dates');

    // Check balance (not for unlimited types)
    if (!type.isUnlimited) {
      const balance = await this.getOrCreateBalance(userId, type.id, from.getFullYear());
      const avail   = Number(balance.total) + Number(balance.carried) - Number(balance.used);

      if (totalDays > avail) {
        throw new BadRequestException(`Insufficient ${type.label} balance. Available: ${avail} days, Requested: ${totalDays} days`);
      }
    }

    // Check for overlapping requests
    const overlap = await this.leaveRepo.query(
      `SELECT id FROM leave_requests
       WHERE user_id = $1 AND status IN ('PENDING','APPROVED')
       AND deleted_at IS NULL
       AND (from_date, to_date) OVERLAPS ($2::date, $3::date)`,
      [userId, dto.fromDate, dto.toDate]
    );
    if (overlap.length > 0) throw new BadRequestException('You already have a leave request overlapping these dates');

    const leave = this.leaveRepo.create({
      userId, leaveType: type.code,
      fromDate: from, toDate: to,
      totalDays, reason: dto.reason,
      status: LeaveStatus.PENDING,
    });
    const saved = await this.leaveRepo.save(leave);

    // ── Notifications + emails run in the background — the request
    //    returns immediately after the leave row is saved, instead of
    //    waiting on N admin emails to send over SMTP one by one. ──
    this.notifyInBackground(async () => {
      const admins = await this.leaveRepo.query(
        `SELECT u.id, u.email, u.first_name FROM users u
         INNER JOIN roles r ON r.id::text = u.role_id::text
         WHERE LOWER(r.name) = 'admin' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL`
      );

      const [user] = await this.leaveRepo.query(`SELECT first_name, last_name, email FROM users WHERE id = $1`, [userId]);

      // In-app notifications and emails fire concurrently instead of
      // one-by-one in a sequential loop.
      await Promise.all(admins.map(async (admin: any) => {
        await this.notifService.create(
          admin.id,
          'New Leave Request',
          `${user.first_name} ${user.last_name} has requested ${totalDays} day(s) of ${type.code} leave (${dto.fromDate} to ${dto.toDate})`,
          { type: 'LEAVE_REQUEST', leaveId: saved.id },
        );
        await this.mailService.sendLeaveRequest(
          admin.email, admin.first_name,
          `${user.first_name} ${user.last_name}`, user.email,
          type.code, dto.fromDate, dto.toDate, totalDays, dto.reason,
        );
      }));
    });

    return saved;
  }

  // ── Get all APPROVED leaves for a calendar month/year — org-wide,
  //    open to every authenticated user (no @Roles restriction), the
  //    same way holidays are visible to everyone. Pass `month` to scope
  //    to a single month (used by the header calendar dropdown), or omit
  //    it to get the whole year (used by the Holidays page).
  async findApprovedForCalendar(year: number, month?: number) {
    const rangeStart = month
      ? `${year}-${String(month).padStart(2, '0')}-01`
      : `${year}-01-01`;
    const interval = month ? '1 month' : '1 year';

    return this.leaveRepo.query(
      `SELECT lr.id, lr.user_id AS "userId", lr.leave_type AS "leaveType",
              lr.from_date AS "fromDate", lr.to_date AS "toDate", lr.total_days AS "totalDays",
              u.first_name AS "firstName", u.last_name AS "lastName", u.avatar
       FROM leave_requests lr
       LEFT JOIN users u ON u.id::text = lr.user_id::text
       WHERE lr.status = 'APPROVED'
         AND lr.deleted_at IS NULL
         AND (lr.from_date, lr.to_date) OVERLAPS ($1::date, $1::date + $2::interval)
       ORDER BY lr.from_date ASC`,
      [rangeStart, interval]
    );
  }

  // ── Get all leave requests (admin) ──
  async findAll(filters?: { status?: string; userId?: string; year?: number }) {
    let query = `
      SELECT lr.*, u.first_name, u.last_name, u.email,
             ab.first_name as approver_first_name, ab.last_name as approver_last_name
      FROM leave_requests lr
      LEFT JOIN users u  ON u.id::text  = lr.user_id::text
      LEFT JOIN users ab ON ab.id::text = lr.approved_by::text
      WHERE lr.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (filters?.status) { params.push(filters.status); query += ` AND lr.status = $${params.length}`; }
    if (filters?.userId) { params.push(filters.userId); query += ` AND lr.user_id = $${params.length}`; }
    if (filters?.year)   { params.push(filters.year);   query += ` AND EXTRACT(YEAR FROM lr.from_date) = $${params.length}`; }

    query += ' ORDER BY lr.created_at DESC';
    return this.leaveRepo.query(query, params);
  }

  // ── Get my leave requests ──
  async findMine(userId: string) {
    return this.leaveRepo.find({
      where: { userId, deletedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  // ── Approve leave ──
  async approve(leaveId: string, adminId: string) {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Only pending requests can be approved');

    leave.status     = LeaveStatus.APPROVED;
    leave.approvedBy = adminId;
    leave.approvedAt = new Date();
    await this.leaveRepo.save(leave);

    const type = await this.typeRepo.findOne({ where: { code: leave.leaveType } });
    if (type && !type.isUnlimited) {
      const year    = new Date(leave.fromDate).getFullYear();
      const balance = await this.getOrCreateBalance(leave.userId, type.id, year);

      if (type.carryForwardEnabled) {
        // Deduct from carried-forward days first, then from this year's total.
        let remaining = leave.totalDays;
        const carried = Number(balance.carried);
        if (carried > 0) {
          const deductFromCarried = Math.min(carried, remaining);
          balance.carried = carried - deductFromCarried;
          remaining -= deductFromCarried;
        }
        if (remaining > 0) balance.used = Number(balance.used) + remaining;
      } else {
        balance.used = Number(balance.used) + leave.totalDays;
      }
      await this.balanceRepo.save(balance);
    }

    // ── Notification + email run in the background ──
    this.notifyInBackground(async () => {
      const [user] = await this.leaveRepo.query(`SELECT first_name, email FROM users WHERE id = $1`, [leave.userId]);
      await this.notifService.create(
        leave.userId, 'Leave Approved ✅',
        `Your ${leave.leaveType} leave request for ${leave.totalDays} day(s) has been approved.`,
        { type: 'LEAVE_APPROVED', leaveId },
      );
      await this.mailService.sendLeaveApproved(user.email, user.first_name, leave.leaveType, String(leave.fromDate), String(leave.toDate), leave.totalDays);
    });

    return { message: 'Leave approved successfully', leave };
  }

  // ── Reject leave ──
  async reject(leaveId: string, adminId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Rejection reason is required');

    const leave = await this.leaveRepo.findOne({ where: { id: leaveId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (leave.status !== LeaveStatus.PENDING) throw new BadRequestException('Only pending requests can be rejected');

    leave.status          = LeaveStatus.REJECTED;
    leave.approvedBy      = adminId;
    leave.approvedAt      = new Date();
    leave.rejectionReason = reason;
    await this.leaveRepo.save(leave);

    // ── Notification + email run in the background ──
    this.notifyInBackground(async () => {
      const [user] = await this.leaveRepo.query(`SELECT first_name, email FROM users WHERE id = $1`, [leave.userId]);
      await this.notifService.create(
        leave.userId, 'Leave Rejected ❌',
        `Your ${leave.leaveType} leave request was rejected. Reason: ${reason}`,
        { type: 'LEAVE_REJECTED', leaveId },
      );
      await this.mailService.sendLeaveRejected(user.email, user.first_name, leave.leaveType, String(leave.fromDate), String(leave.toDate), reason);
    });

    return { message: 'Leave rejected', leave };
  }

  // ── Restore the used-balance deduction for a leave that's being
  //    cancelled or deleted after having been approved. Shared by
  //    cancel() and delete() below. ──
  private async restoreBalance(leave: LeaveRequest) {
    const type = await this.typeRepo.findOne({ where: { code: leave.leaveType } });
    if (!type || type.isUnlimited) return;

    const year    = new Date(leave.fromDate).getFullYear();
    const balance = await this.getOrCreateBalance(leave.userId, type.id, year);
    balance.used  = Math.max(0, Number(balance.used) - leave.totalDays);
    await this.balanceRepo.save(balance);
  }

  // ── Cancel leave (by employee) ──
  async cancel(leaveId: string, userId: string) {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveId, userId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (!['PENDING','APPROVED'].includes(leave.status)) throw new BadRequestException('Cannot cancel this leave');

    if (leave.status === LeaveStatus.APPROVED) await this.restoreBalance(leave);

    leave.status = LeaveStatus.CANCELLED;
    await this.leaveRepo.save(leave);
    return { message: 'Leave cancelled successfully' };
  }

  // ── Year-end carry forward (run on Jan 1) — now type-driven: every
  //    active leave type with carryForwardEnabled gets processed,
  //    capped at that type's own maxCarryForward, instead of a single
  //    PL-only hardcoded rule. ──
  async processCarryForward(year: number) {
    const carryTypes = await this.typeRepo.find({ where: { carryForwardEnabled: true, isActive: true } });
    let processed = 0;

    for (const type of carryTypes) {
      const balances = await this.balanceRepo.find({ where: { leaveTypeId: type.id, year } });
      for (const bal of balances) {
        const remaining   = Number(bal.total) - Number(bal.used) + Number(bal.carried);
        const nextYearBal = await this.getOrCreateBalance(bal.userId, type.id, year + 1);
        nextYearBal.carried = Math.min(remaining, Number(type.maxCarryForward));
        await this.balanceRepo.save(nextYearBal);
        processed++;
      }
    }
    return { message: `Carry forward processed for ${processed} balance record(s) across ${carryTypes.length} leave type(s)` };
  }

  // ── Delete leave request (admin) ──
  //    Any status can be deleted, including APPROVED. An approved
  //    request has already deducted from the balance ledger (see
  //    approve() above), so deleting one restores that balance first —
  //    the same restore cancel() does — to keep the ledger correct.
  async delete(leaveId: string) {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveId } });
    if (!leave || leave.deletedAt) throw new NotFoundException('Leave request not found');

    if (leave.status === LeaveStatus.APPROVED) await this.restoreBalance(leave);

    leave.deletedAt = new Date();
    await this.leaveRepo.save(leave);
    return { message: 'Leave request deleted' };
  }

  // ── Get all employees' balances for the current year (admin overview) ──
  async getAllBalances() {
    const year  = new Date().getFullYear();
    const users = await this.balanceRepo.query(
      `SELECT DISTINCT u.id, u.first_name, u.last_name, u.email
       FROM users u
       INNER JOIN leave_balances lb ON lb.user_id::text = u.id::text AND lb.year = $1
       WHERE u.deleted_at IS NULL
       ORDER BY u.first_name`,
      [year]
    );

    return Promise.all(users.map(async (u: any) => ({
      ...u,
      balances: await this.computeBalances(u.id, year),
    })));
  }
}
