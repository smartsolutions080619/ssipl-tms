import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async create(
    userId: string,
    title: string,
    message: string,
    metadata?: object,
  ) {
    const notif = this.notifRepo.create({
      userId,
      title,
      message,
      metadata,
    });
    return this.notifRepo.save(notif);
  }

  async getMyNotifications(userId: string) {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async getUnreadCount(userId: string) {
    const count = await this.notifRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markAsRead(id: string, userId: string) {
    await this.notifRepo.update({ id, userId }, { isRead: true });
    return { message: 'Notification marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
    return { message: 'All notifications marked as read' };
  }

  async deleteNotification(id: string, userId: string) {
    await this.notifRepo.delete({ id, userId });
    return { message: 'Notification deleted' };
  }

  // Task assign hone pe notification
  async notifyTaskAssigned(assigneeId: string, taskNumber: string, taskTitle: string) {
    return this.create(
      assigneeId,
      'Task Assigned',
      `You have been assigned task ${taskNumber}: ${taskTitle}`,
      { taskNumber, type: NotificationType.TASK_ASSIGNED },
    );
  }

  // Comment mention pe notification
  async notifyMention(userId: string, mentionedBy: string, taskNumber: string) {
    return this.create(
      userId,
      'You were mentioned',
      `${mentionedBy} mentioned you in task ${taskNumber}`,
      { taskNumber, type: NotificationType.MENTION },
    );
  }
}