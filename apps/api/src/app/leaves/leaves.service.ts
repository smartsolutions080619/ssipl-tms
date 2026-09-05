/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable, NotFoundException,
  BadRequestException, 
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { LeaveRequest, LeaveType, LeaveStatus } from './leave-request.entity';
import { LeaveBalance } from './leave-balance.entity';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';

// Annual entitlements
const ANNUAL = { CL: 12, SL: 12, PL: 15, LWP: 999 };
const PL_MAX_CARRY = 30;

@Injectable()
export class LeavesService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveBalance)
    private readonly balanceRepo: Repository<LeaveBalance>,
    private readonly mailService: MailService,
    private readonly notifService: NotificationsService,
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

  // ── Get or create balance for user+year ──
  async getOrCreateBalance(userId: string, year: number, joiningDate?: Date): Promise<LeaveBalance> {
    let balance = await this.balanceRepo.findOne({ where: { userId, year } });
    if (balance) return balance;

    const joining = joiningDate || new Date();
    balance = this.balanceRepo.create({
      userId, year,
      clTotal:   this.proRata(ANNUAL.CL, joining, year),
      slTotal:   this.proRata(ANNUAL.SL, joining, year),
      plTotal:   this.proRata(ANNUAL.PL, joining, year),
      clUsed: 0, slUsed: 0, plUsed: 0, plCarried: 0,
    });
    return this.balanceRepo.save(balance);
  }

  // ── Get user's leave balance ──
  async getBalance(userId: string) {
    const year    = new Date().getFullYear();
    const balance = await this.getOrCreateBalance(userId, year);

    return {
      year,
      CL: { total: Number(balance.clTotal), used: Number(balance.clUsed), remaining: Number(balance.clTotal) - Number(balance.clUsed), carryForward: 0 },
      SL: { total: Number(balance.slTotal), used: Number(balance.slUsed), remaining: Number(balance.slTotal) - Number(balance.slUsed), carryForward: 0 },
      PL: { total: Number(balance.plTotal) + Number(balance.plCarried), used: Number(balance.plUsed), remaining: Number(balance.plTotal) + Number(balance.plCarried) - Number(balance.plUsed), carryForward: Number(balance.plCarried) },
      LWP: { total: 999, used: 0, remaining: 999, carryForward: 0 },
    };
  }

  // ── Fire-and-forget helper: runs notifications/emails in the
  //    background without making the caller wait. Any failure here
  //    is logged but never blocks or fails the main request. ──
  private notifyInBackground(fn: () => Promise<void>) {
    fn().catch(err => {
      console.error('[LeavesService] Background notification failed:', err?.message || err);
    });
  }

  // ── Submit leave request ──
  async create(userId: string, dto: {
    leaveType: LeaveType; fromDate: string; toDate: string; reason: string;
  }) {
    const from      = new Date(dto.fromDate);
    const to        = new Date(dto.toDate);
    const totalDays = this.calcDays(from, to);

    if (totalDays <= 0) throw new BadRequestException('Invalid date range — no working days selected');
    if (from < new Date(new Date().setHours(0,0,0,0))) throw new BadRequestException('Cannot apply leave for past dates');

    // Check balance (not for LWP)
    if (dto.leaveType !== LeaveType.LWP) {
      const balance = await this.getOrCreateBalance(userId, from.getFullYear());
      const key     = dto.leaveType.toLowerCase() as 'cl' | 'sl' | 'pl';
      const total   = key === 'pl' ? Number(balance.plTotal) + Number(balance.plCarried) : Number((balance as any)[`${key}Total`]);
      const used    = Number((balance as any)[`${key}Used`]);
      const avail   = total - used;

      if (totalDays > avail) {
        throw new BadRequestException(`Insufficient ${dto.leaveType} balance. Available: ${avail} days, Requested: ${totalDays} days`);
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
      userId, leaveType: dto.leaveType,
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
          `${user.first_name} ${user.last_name} has requested ${totalDays} day(s) of ${dto.leaveType} leave (${dto.fromDate} to ${dto.toDate})`,
          { type: 'LEAVE_REQUEST', leaveId: saved.id },
        );
        await this.mailService.sendLeaveRequest(
          admin.email, admin.first_name,
          `${user.first_name} ${user.last_name}`, user.email,
          dto.leaveType, dto.fromDate, dto.toDate, totalDays, dto.reason,
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

    // Deduct balance (not for LWP)
    if (leave.leaveType !== LeaveType.LWP) {
      const year    = new Date(leave.fromDate).getFullYear();
      const balance = await this.getOrCreateBalance(leave.userId, year);
      const key     = leave.leaveType.toLowerCase() as 'cl' | 'sl' | 'pl';

      if (key === 'pl') {
        // Deduct from carried first, then from main balance
        let remaining = leave.totalDays;
        const carried = Number(balance.plCarried);
        if (carried > 0) {
          const deductFromCarried = Math.min(carried, remaining);
          balance.plCarried = carried - deductFromCarried;
          remaining -= deductFromCarried;
        }
        if (remaining > 0) balance.plUsed = Number(balance.plUsed) + remaining;
      } else {
        (balance as any)[`${key}Used`] = Number((balance as any)[`${key}Used`]) + leave.totalDays;
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

  // ── Cancel leave (by employee) ──
  async cancel(leaveId: string, userId: string) {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveId, userId } });
    if (!leave) throw new NotFoundException('Leave request not found');
    if (!['PENDING','APPROVED'].includes(leave.status)) throw new BadRequestException('Cannot cancel this leave');

    // If already approved — restore balance
    if (leave.status === LeaveStatus.APPROVED && leave.leaveType !== LeaveType.LWP) {
      const year    = new Date(leave.fromDate).getFullYear();
      const balance = await this.getOrCreateBalance(leave.userId, year);
      const key     = leave.leaveType.toLowerCase() as 'cl' | 'sl' | 'pl';
      (balance as any)[`${key}Used`] = Math.max(0, Number((balance as any)[`${key}Used`]) - leave.totalDays);
      await this.balanceRepo.save(balance);
    }

    leave.status = LeaveStatus.CANCELLED;
    await this.leaveRepo.save(leave);
    return { message: 'Leave cancelled successfully' };
  }

  // ── Year-end carry forward (run on Jan 1) ──
  async processCarryForward(year: number) {
    const balances = await this.balanceRepo.find({ where: { year } });
    for (const bal of balances) {
      const plRemaining = Number(bal.plTotal) - Number(bal.plUsed) + Number(bal.plCarried);
      const nextYearBal = await this.getOrCreateBalance(bal.userId, year + 1);
      nextYearBal.plCarried = Math.min(plRemaining, PL_MAX_CARRY); // max 30 days carry
      await this.balanceRepo.save(nextYearBal);
    }
    return { message: `Carry forward processed for ${balances.length} employees` };
  }

  // ── Delete leave request (admin) ──
  //    Any status can be deleted, including APPROVED. An approved
  //    request has already deducted from the balance ledger (see
  //    approve() above), so deleting one restores that balance first —
  //    the same restore cancel() does — to keep the ledger correct.
  async delete(leaveId: string) {
    const leave = await this.leaveRepo.findOne({ where: { id: leaveId } });
    if (!leave || leave.deletedAt) throw new NotFoundException('Leave request not found');

    if (leave.status === LeaveStatus.APPROVED && leave.leaveType !== LeaveType.LWP) {
      const year    = new Date(leave.fromDate).getFullYear();
      const balance = await this.getOrCreateBalance(leave.userId, year);
      const key     = leave.leaveType.toLowerCase() as 'cl' | 'sl' | 'pl';
      (balance as any)[`${key}Used`] = Math.max(0, Number((balance as any)[`${key}Used`]) - leave.totalDays);
      await this.balanceRepo.save(balance);
    }

    leave.deletedAt = new Date();
    await this.leaveRepo.save(leave);
    return { message: 'Leave request deleted' };
  }

  // ── Get all employees' balance (admin) ──
  async getAllBalances() {
    const year = new Date().getFullYear();
    return this.balanceRepo.query(
      `SELECT lb.*, u.first_name, u.last_name, u.email
       FROM leave_balances lb
       LEFT JOIN users u ON u.id::text = lb.user_id::text
       WHERE lb.year = $1
       ORDER BY u.first_name`,
      [year]
    );
  }
}