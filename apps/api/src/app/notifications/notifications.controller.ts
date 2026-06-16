import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/roles.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AnnouncementPriority } from './announcement.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all notifications for current user' })
  async findAll(@CurrentUser() user: any) {
    return this.notificationsService.findAll(user.userId);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.userId);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.markRead(id, user.userId);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.delete(id, user.userId);
  }

  // ── Announcements ──

  @Get('announcements')
  @ApiOperation({ summary: 'Get active announcements (all users)' })
  async getAnnouncements() {
    return this.notificationsService.getActiveAnnouncements();
  }

  @Get('announcements/all')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Get all announcements (admin)' })
  async getAllAnnouncements() {
    return this.notificationsService.getAllAnnouncements();
  }

  @Post('announcements')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Create announcement (admin)' })
  async createAnnouncement(
    @Body() body: { title: string; message: string; priority?: AnnouncementPriority; expiresAt?: string },
    @CurrentUser() user: any,
  ) {
    return this.notificationsService.createAnnouncement({ ...body, createdBy: user.userId });
  }

  @Put('announcements/:id/deactivate')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Deactivate announcement (admin)' })
  async deactivate(@Param('id') id: string) {
    return this.notificationsService.deactivateAnnouncement(id);
  }

  @Delete('announcements/:id')
  @Roles(Role.ADMIN)
  @UseGuards(RolesGuard)
  @ApiOperation({ summary: 'Delete announcement (admin)' })
  async deleteAnnouncement(@Param('id') id: string) {
    return this.notificationsService.deleteAnnouncement(id);
  }
}