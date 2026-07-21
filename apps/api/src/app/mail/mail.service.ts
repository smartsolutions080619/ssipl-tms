/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey  = process.env.RESEND_API_KEY || '';
  private readonly from    = process.env.MAIL_FROM || 'onboarding@resend.dev';
  private readonly appUrl  = process.env.FRONTEND_URL || 'http://localhost:5173';

  private async send(to: string, subject: string, html: string) {
    if (!this.apiKey) {
      this.logger.warn('RESEND_API_KEY not set — skipping email');
      return;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Resend API error: ${err}`);
    }
    return res.json();
  }

  private wrapper(content: string) {
    return `
      <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
        <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
            <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
            <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px">Task Management System</div>
          </div>
          ${content}
          <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
        </div>
      </div>
    `;
  }

  async sendForgotPassword(to: string, name: string, resetUrl: string) {
    try {
      await this.send(to, 'Reset your SSIPL TMS password', this.wrapper(`
        <div style="padding:32px">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Reset your password</h2>
          <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${name},</p>
          <p style="color:#3d6b70;font-size:14px;line-height:1.6">We received a request to reset your password. Click below — link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-align:center;margin:24px 0">Reset Password</a>
          <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#dc2626">If you didn't request this, ignore this email.</div>
        </div>
      `));
      this.logger.log(`Forgot password email sent to ${to}`);
    } catch (err: any) {
      this.logger.error(`Failed to send forgot password email: ${err?.message}`);
    }
  }

  async sendWelcome(to: string, name: string) {
    try {
      await this.send(to, 'Welcome to SSIPL TMS!', this.wrapper(`
        <div style="padding:32px">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Welcome, ${name}! 🎉</h2>
          <p style="color:#3d6b70;font-size:14px;line-height:1.6">Your account has been created on <strong>SSIPL TMS</strong>.</p>
          <p style="color:#3d6b70;font-size:14px;line-height:1.6">You can now manage tasks, track progress, and collaborate with your team.</p>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send welcome email: ${err?.message}`);
    }
  }

  async sendTaskAssigned(to: string, name: string, taskTitle: string, taskNumber: string, assignedBy: string) {
    try {
      await this.send(to, `Task assigned: ${taskNumber}`, this.wrapper(`
        <div style="padding:32px">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">New task assigned</h2>
          <p style="color:#3d6b70;font-size:14px">Hi ${name}, a task has been assigned to you:</p>
          <div style="background:rgba(34,139,152,0.06);border:1px solid rgba(34,139,152,0.15);border-radius:12px;padding:16px 20px;margin:20px 0">
            <span style="font-family:monospace;font-size:11px;font-weight:700;color:#228b98;background:rgba(34,139,152,0.1);padding:2px 8px;border-radius:99px">${taskNumber}</span>
            <div style="color:#1a2e2f;font-size:15px;font-weight:700;margin-top:8px">${taskTitle}</div>
            <div style="color:#7aaa8a;font-size:12px;margin-top:6px">Assigned by ${assignedBy}</div>
          </div>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send task assigned email: ${err?.message}`);
    }
  }

  async sendTaskStatusChanged(to: string, name: string, taskTitle: string, taskNumber: string, oldStatus: string, newStatus: string) {
    try {
      await this.send(to, `Task ${taskNumber} status updated`, this.wrapper(`
        <div style="padding:32px">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Task status updated</h2>
          <p style="color:#3d6b70;font-size:14px">Hi ${name}, task <strong>${taskNumber}</strong> — <em>${taskTitle}</em> status changed:</p>
          <div style="background:#f8fafa;border-radius:10px;padding:14px 16px;margin:16px 0;font-size:13px">
            <span style="color:#94a3b8;font-weight:600">${oldStatus}</span>
            <span style="color:#228b98;font-size:18px;margin:0 12px">→</span>
            <span style="color:#228b98;font-weight:700">${newStatus}</span>
          </div>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send status email: ${err?.message}`);
    }
  }

  async sendNewUserRequest(adminEmail: string, adminName: string, userName: string, userEmail: string) {
    try {
      await this.send(adminEmail, 'New User Registration Request — SSIPL TMS', this.wrapper(`
        <div style="padding:32px">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">New Registration Request</h2>
          <p style="color:#3d6b70;font-size:14px">Hi ${adminName}, a new user has registered and is awaiting your approval:</p>
          <div style="background:rgba(34,139,152,0.06);border:1px solid rgba(34,139,152,0.15);border-radius:12px;padding:16px 20px;margin:20px 0">
            <div style="color:#1a2e2f;font-size:15px;font-weight:700">${userName}</div>
            <div style="color:#7aaa8a;font-size:13px;margin-top:4px">${userEmail}</div>
          </div>
          <a href="${this.appUrl}/users" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-align:center;margin:24px 0">Review Request</a>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send new user request email: ${err?.message}`);
    }
  }

  async sendAccountApproved(to: string, name: string, role: string) {
    try {
      await this.send(to, 'Account Approved — Welcome to SSIPL TMS!', this.wrapper(`
        <div style="padding:32px;text-align:center">
          <div style="width:56px;height:56px;border-radius:50%;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">✓</div>
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:800;margin:0 0 12px">Account Approved!</h2>
          <p style="color:#3d6b70;font-size:14px;line-height:1.6;text-align:left">Hi ${name}, your account has been approved with role <strong>${role}</strong>.</p>
          <a href="${this.appUrl}/login" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-align:center;margin:24px 0">Login Now</a>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send approval email: ${err?.message}`);
    }
  }

  async sendAccountRejected(to: string, name: string) {
    try {
      await this.send(to, 'Account Registration Update — SSIPL TMS', this.wrapper(`
        <div style="padding:32px">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Registration Update</h2>
          <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${name}, we regret to inform you that your registration could not be approved. Please contact your administrator.</p>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send rejection email: ${err?.message}`);
    }
  }

  async sendLeaveRequest(adminEmail: string, adminName: string, employeeName: string, employeeEmail: string, leaveType: string, fromDate: string, toDate: string, totalDays: number, reason: string) {
    try {
      await this.send(adminEmail, `Leave Request — ${employeeName} (${leaveType})`, this.wrapper(`
        <div style="padding:28px 32px">
          <h2 style="color:#1a2e2f;font-size:18px;font-weight:700;margin:0 0 16px">New Leave Request</h2>
          <p style="color:#3d6b70;font-size:14px">Hi ${adminName}, <strong>${employeeName}</strong> has submitted a leave request:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            ${[['Employee',employeeName],['Email',employeeEmail],['Type',leaveType],['From',fromDate],['To',toDate],['Days',String(totalDays)],['Reason',reason]].map(([k,v],i)=>`<tr style="background:${i%2===0?'#f8fafa':'white'}"><td style="padding:9px 14px;font-size:11px;font-weight:700;color:#7aaa8a;text-transform:uppercase;width:100px">${k}</td><td style="padding:9px 14px;font-size:13px;color:#1a2e2f">${v}</td></tr>`).join('')}
          </table>
          <a href="${this.appUrl}/leaves" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:700;font-size:14px;text-align:center">Review Request</a>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send leave request email: ${err?.message}`);
    }
  }

  async sendLeaveApproved(to: string, name: string, leaveType: string, fromDate: string, toDate: string, totalDays: number) {
    try {
      await this.send(to, `Leave Approved ✅ — ${leaveType} (${totalDays} day${totalDays>1?'s':''})`, this.wrapper(`
        <div style="padding:28px 32px;text-align:center">
          <h2 style="color:#1a2e2f;font-size:20px;font-weight:800;margin:0 0 8px">Leave Approved! ✅</h2>
          <p style="color:#3d6b70;font-size:14px;margin-bottom:20px">Hi ${name}, your leave request has been approved.</p>
          <div style="background:#f0faf6;border:1px solid rgba(52,211,153,0.2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left">
            <p style="margin:6px 0;font-size:13px;color:#1a2e2f"><strong>Type:</strong> ${leaveType}</p>
            <p style="margin:6px 0;font-size:13px;color:#1a2e2f"><strong>From:</strong> ${fromDate} &nbsp;→&nbsp; <strong>To:</strong> ${toDate}</p>
            <p style="margin:6px 0;font-size:13px;color:#34d399"><strong>${totalDays} day${totalDays>1?'s':''}</strong></p>
          </div>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send leave approved email: ${err?.message}`);
    }
  }

  async sendLeaveRejected(to: string, name: string, leaveType: string, fromDate: string, toDate: string, reason: string) {
    try {
      await this.send(to, `Leave Request Update — ${leaveType}`, this.wrapper(`
        <div style="padding:28px 32px">
          <h2 style="color:#1a2e2f;font-size:18px;font-weight:700;margin:0 0 12px">Leave Request Update</h2>
          <p style="color:#3d6b70;font-size:14px">Hi ${name}, your ${leaveType} leave for <strong>${fromDate}</strong> to <strong>${toDate}</strong> could not be approved.</p>
          <div style="background:#fff5f5;border:1px solid rgba(248,113,113,0.25);border-radius:12px;padding:14px 16px;margin:16px 0">
            <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;margin-bottom:6px">Reason</div>
            <div style="font-size:13px;color:#1a2e2f">${reason}</div>
          </div>
        </div>
      `));
    } catch (err: any) {
      this.logger.error(`Failed to send leave rejected email: ${err?.message}`);
    }
  }
}