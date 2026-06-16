import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { Announcement, AnnouncementPriority } from './announcement.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,
  ) {}

  // ── Create notification with optional link ──
  async create(
    userId: string,
    title: string,
    message: string,
    metadata?: object,
    link?: string,
  ) {
    const notif = this.notifRepo.create({ userId, title, message, metadata, link: link || null });
    return this.notifRepo.save(notif);
  }

  // ── Task assigned notification ──
  async notifyTaskAssigned(userId: string, taskNumber: string, taskTitle: string) {
    return this.create(
      userId,
      'Task Assigned',
      `You have been assigned task ${taskNumber}: ${taskTitle}`,
      { type: 'TASK_ASSIGNED', taskNumber },
      `/tasks`,  // frontend route — Tasks page, user can search by taskNumber
    );
  }

  // ── Task status changed ──
  async notifyStatusChanged(userId: string, taskNumber: string, taskTitle: string, oldStatus: string, newStatus: string) {
    return this.create(
      userId,
      `Task ${taskNumber} status updated`,
      `Status changed: ${oldStatus.replace('_',' ')} → ${newStatus.replace('_',' ')}`,
      { type: 'STATUS_CHANGED', taskNumber },
      `/tasks`,
    );
  }

  async findAll(userId: string) {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.notifRepo.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markRead(id: string, userId: string) {
    await this.notifRepo.update({ id, userId }, { isRead: true });
    return { message: 'Marked as read' };
  }

  async markAllRead(userId: string) {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
    return { message: 'All marked as read' };
  }

  async delete(id: string, userId: string) {
    await this.notifRepo.delete({ id, userId });
    return { message: 'Notification deleted' };
  }

  // ════════════════════════════════════════
  // ANNOUNCEMENTS
  // ════════════════════════════════════════

  async createAnnouncement(dto: {
    title: string;
    message: string;
    priority?: AnnouncementPriority;
    expiresAt?: string;
    createdBy: string;
  }) {
    const ann = this.announcementRepo.create({
      title:     dto.title,
      message:   dto.message,
      priority:  dto.priority || AnnouncementPriority.NORMAL,
      createdBy: dto.createdBy,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive:  true,
    });
    const saved = await this.announcementRepo.save(ann);

    // Also push as notification to ALL active users
    const users = await this.notifRepo.query(
      `SELECT id FROM users WHERE status = 'ACTIVE' AND deleted_at IS NULL AND id != $1`,
      [dto.createdBy]
    );
    await Promise.all(users.map((u: any) =>
      this.create(u.id, `📢 ${dto.title}`, dto.message, { type: 'ANNOUNCEMENT', announcementId: saved.id }, '/dashboard')
    ));

    return saved;
  }

  async getActiveAnnouncements() {
    return this.announcementRepo.query(`
      SELECT a.*, u.first_name, u.last_name
      FROM announcements a
      LEFT JOIN users u ON u.id::text = a.created_by::text
      WHERE a.is_active = true
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
      ORDER BY
        CASE a.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'NORMAL' THEN 3 ELSE 4 END,
        a.created_at DESC
    `);
  }

  async getAllAnnouncements() {
    return this.announcementRepo.query(`
      SELECT a.*, u.first_name, u.last_name
      FROM announcements a
      LEFT JOIN users u ON u.id::text = a.created_by::text
      ORDER BY a.created_at DESC
    `);
  }

  async deactivateAnnouncement(id: string) {
    await this.announcementRepo.update(id, { isActive: false });
    return { message: 'Announcement deactivated' };
  }

  async deleteAnnouncement(id: string) {
    await this.announcementRepo.delete(id);
    return { message: 'Announcement deleted' };
  }
}