import { MailerService } from '@nestjs-modules/mailer';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private mailer: MailerService) {}

  async sendForgotPassword(to: string, name: string, resetUrl: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: 'Reset your SSIPL TMS password',
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
                <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px">Task Management System</div>
              </div>
              <div style="padding:32px">
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Reset your password</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${name},</p>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">We received a request to reset your password. Click below — link expires in <strong>1 hour</strong>.</p>
                <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-align:center;margin:24px 0">Reset Password</a>
                <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#dc2626">If you didn't request this, ignore this email. Your password won't change.</div>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
      this.logger.log(`Forgot password email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}`, err);
    }
  }

  async sendWelcome(to: string, name: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: 'Welcome to SSIPL TMS!',
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
                <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px">Task Management System</div>
              </div>
              <div style="padding:32px">
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Welcome, ${name}! 🎉</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">Your account has been created on <strong>SSIPL TMS</strong>.</p>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">You can now manage tasks, track progress, collaborate with your team, and view reports.</p>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
      this.logger.log(`Welcome email sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send welcome email to ${to}`, err);
    }
  }

  async sendTaskAssigned(to: string, name: string, taskTitle: string, taskNumber: string, assignedBy: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: `Task assigned to you: ${taskNumber}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
              </div>
              <div style="padding:32px">
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">New task assigned to you</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${name}, a task has been assigned to you:</p>
                <div style="background:rgba(34,139,152,0.06);border:1px solid rgba(34,139,152,0.15);border-radius:12px;padding:16px 20px;margin:20px 0">
                  <span style="font-family:monospace;font-size:11px;font-weight:700;color:#228b98;background:rgba(34,139,152,0.1);padding:2px 8px;border-radius:99px">${taskNumber}</span>
                  <div style="color:#1a2e2f;font-size:15px;font-weight:700;margin-top:8px">${taskTitle}</div>
                  <div style="color:#7aaa8a;font-size:12px;margin-top:6px">Assigned by ${assignedBy}</div>
                </div>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send task assigned email to ${to}`, err);
    }
  }

  async sendTaskStatusChanged(to: string, name: string, taskTitle: string, taskNumber: string, oldStatus: string, newStatus: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: `Task ${taskNumber} status updated`,
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
              </div>
              <div style="padding:32px">
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Task status updated</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${name}, task <strong>${taskNumber}</strong> — <em>${taskTitle}</em> status changed:</p>
                <div style="display:flex;align-items:center;gap:12px;background:#f8fafa;border-radius:10px;padding:14px 16px;margin:16px 0">
                  <span style="color:#94a3b8;font-weight:600;font-size:13px">${oldStatus}</span>
                  <span style="color:#228b98;font-size:18px">→</span>
                  <span style="color:#228b98;font-weight:700;font-size:13px">${newStatus}</span>
                </div>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send status email to ${to}`, err);
    }
  }

  async sendNewUserRequest(adminEmail: string, adminName: string, userName: string, userEmail: string) {
    try {
      await this.mailer.sendMail({
        to: adminEmail,
        subject: 'New User Registration Request — SSIPL TMS',
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
                <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:4px">Task Management System</div>
              </div>
              <div style="padding:32px">
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">New Registration Request</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${adminName},</p>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">A new user has registered and is awaiting your approval:</p>
                <div style="background:rgba(34,139,152,0.06);border:1px solid rgba(34,139,152,0.15);border-radius:12px;padding:16px 20px;margin:20px 0">
                  <div style="color:#1a2e2f;font-size:15px;font-weight:700">${userName}</div>
                  <div style="color:#7aaa8a;font-size:13px;margin-top:4px">${userEmail}</div>
                </div>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/users" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-align:center;margin:24px 0">Review Request</a>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send new user request email`, err);
    }
  }

  async sendAccountApproved(to: string, name: string, role: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: 'Account Approved — Welcome to SSIPL TMS!',
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
              </div>
              <div style="padding:32px;text-align:center">
                <div style="width:56px;height:56px;border-radius:50%;background:rgba(52,211,153,0.12);border:1px solid rgba(52,211,153,0.25);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
                  <svg width="24" height="24" fill="none" stroke="#34d399" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:800;margin:0 0 12px">Account Approved!</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6;text-align:left">Hi ${name}, your account has been approved with role <strong>${role}</strong>. You can now log in.</p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:700;font-size:14px;text-align:center;margin:24px 0">Login Now</a>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send approval email`, err);
    }
  }

  async sendAccountRejected(to: string, name: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: 'Account Registration Update — SSIPL TMS',
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:32px;text-align:center">
                <div style="color:white;font-size:22px;font-weight:800">SSIPL TMS</div>
              </div>
              <div style="padding:32px">
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:700;margin:0 0 12px">Registration Update</h2>
                <p style="color:#3d6b70;font-size:14px;line-height:1.6">Hi ${name}, we regret to inform you that your registration could not be approved. Please contact your administrator.</p>
              </div>
              <div style="padding:20px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:12px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send rejection email`, err);
    }
  }

  // ── Leave Management Emails ──

  async sendLeaveRequest(
    adminEmail: string, adminName: string,
    employeeName: string, employeeEmail: string,
    leaveType: string, fromDate: string, toDate: string,
    totalDays: number, reason: string,
  ) {
    try {
      await this.mailer.sendMail({
        to: adminEmail,
        subject: `Leave Request — ${employeeName} (${leaveType})`,
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:28px 32px">
                <div style="color:white;font-size:20px;font-weight:800">SSIPL TMS</div>
                <div style="color:rgba(255,255,255,0.6);font-size:12px;margin-top:2px">Leave Management</div>
              </div>
              <div style="padding:28px 32px">
                <h2 style="color:#1a2e2f;font-size:18px;font-weight:700;margin:0 0 16px">New Leave Request</h2>
                <p style="color:#3d6b70;font-size:14px">Hi ${adminName},</p>
                <p style="color:#3d6b70;font-size:14px;margin-bottom:20px"><strong>${employeeName}</strong> has submitted a leave request requiring your approval.</p>
                <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
                  ${[
                    ['Employee', employeeName],
                    ['Email', employeeEmail],
                    ['Leave Type', leaveType],
                    ['From', fromDate],
                    ['To', toDate],
                    ['Total Days', String(totalDays)],
                    ['Reason', reason],
                  ].map(([k, v], i) => `
                    <tr style="background:${i % 2 === 0 ? '#f8fafa' : 'white'}">
                      <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#7aaa8a;text-transform:uppercase;letter-spacing:0.05em;width:120px">${k}</td>
                      <td style="padding:10px 14px;font-size:13px;color:#1a2e2f">${v}</td>
                    </tr>
                  `).join('')}
                </table>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/leaves" style="display:block;background:linear-gradient(135deg,#228b98,#1a7a85);color:white;text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:700;font-size:14px;text-align:center">Review Request</a>
              </div>
              <div style="padding:16px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:11px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) { this.logger.error('Failed to send leave request email', err); }
  }

  async sendLeaveApproved(to: string, name: string, leaveType: string, fromDate: string, toDate: string, totalDays: number) {
    try {
      await this.mailer.sendMail({
        to,
        subject: `Leave Approved ✅ — ${leaveType} (${totalDays} day${totalDays > 1 ? 's' : ''})`,
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:28px 32px">
                <div style="color:white;font-size:20px;font-weight:800">SSIPL TMS</div>
              </div>
              <div style="padding:28px 32px;text-align:center">
                <div style="width:56px;height:56px;border-radius:50%;background:rgba(52,211,153,0.12);border:2px solid rgba(52,211,153,0.3);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
                  <svg width="26" height="26" fill="none" stroke="#34d399" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <h2 style="color:#1a2e2f;font-size:20px;font-weight:800;margin:0 0 8px">Leave Approved!</h2>
                <p style="color:#3d6b70;font-size:14px;margin-bottom:20px">Hi ${name}, your leave request has been approved.</p>
                <div style="background:#f0faf6;border:1px solid rgba(52,211,153,0.2);border-radius:12px;padding:16px;margin-bottom:20px;text-align:left">
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                    <div><div style="font-size:10px;font-weight:700;color:#7aaa8a;text-transform:uppercase;letter-spacing:0.06em">Leave Type</div><div style="font-size:14px;font-weight:700;color:#1a2e2f;margin-top:4px">${leaveType}</div></div>
                    <div><div style="font-size:10px;font-weight:700;color:#7aaa8a;text-transform:uppercase;letter-spacing:0.06em">Total Days</div><div style="font-size:14px;font-weight:700;color:#34d399;margin-top:4px">${totalDays} day${totalDays > 1 ? 's' : ''}</div></div>
                    <div><div style="font-size:10px;font-weight:700;color:#7aaa8a;text-transform:uppercase;letter-spacing:0.06em">From</div><div style="font-size:14px;font-weight:600;color:#1a2e2f;margin-top:4px">${fromDate}</div></div>
                    <div><div style="font-size:10px;font-weight:700;color:#7aaa8a;text-transform:uppercase;letter-spacing:0.06em">To</div><div style="font-size:14px;font-weight:600;color:#1a2e2f;margin-top:4px">${toDate}</div></div>
                  </div>
                </div>
              </div>
              <div style="padding:16px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:11px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) { this.logger.error('Failed to send leave approved email', err); }
  }

  async sendLeaveRejected(to: string, name: string, leaveType: string, fromDate: string, toDate: string, reason: string) {
    try {
      await this.mailer.sendMail({
        to,
        subject: `Leave Request Update — ${leaveType}`,
        html: `
          <div style="font-family:-apple-system,sans-serif;background:#f0f4f4;padding:32px 16px">
            <div style="background:white;border-radius:16px;max-width:480px;margin:0 auto;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
              <div style="background:linear-gradient(135deg,#1a3a3f,#228b98);padding:28px 32px">
                <div style="color:white;font-size:20px;font-weight:800">SSIPL TMS</div>
              </div>
              <div style="padding:28px 32px">
                <h2 style="color:#1a2e2f;font-size:18px;font-weight:700;margin:0 0 12px">Leave Request Update</h2>
                <p style="color:#3d6b70;font-size:14px">Hi ${name},</p>
                <p style="color:#3d6b70;font-size:14px;margin-bottom:16px">Your ${leaveType} leave request for <strong>${fromDate}</strong> to <strong>${toDate}</strong> could not be approved.</p>
                <div style="background:#fff5f5;border:1px solid rgba(248,113,113,0.25);border-radius:12px;padding:14px 16px;margin-bottom:20px">
                  <div style="font-size:11px;font-weight:700;color:#f87171;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Reason for Rejection</div>
                  <div style="font-size:13px;color:#1a2e2f">${reason}</div>
                </div>
                <p style="color:#7aaa8a;font-size:13px">If you have questions, please contact your manager or HR.</p>
              </div>
              <div style="padding:16px 32px;background:#f8fafa;border-top:1px solid #e8f1f2;color:#7aaa8a;font-size:11px;text-align:center">© 2026 SSIPL TMS · The Smart Solutions</div>
            </div>
          </div>
        `,
      });
    } catch (err) { this.logger.error('Failed to send leave rejected email', err); }
  }
}