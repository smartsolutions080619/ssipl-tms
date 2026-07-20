/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  private onlineUsers = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.user   = payload;
      this.onlineUsers.set(payload.sub, client.id);
      this.server.emit('online_users', Array.from(this.onlineUsers.keys()));
      console.log(`Chat connected: ${payload.email}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    if (client.data.userId) {
      this.onlineUsers.delete(client.data.userId);
      this.server.emit('online_users', Array.from(this.onlineUsers.keys()));
    }
  }

  // ── Get rooms ──
  // FIX 1: added DISTINCT ON (r.id) and scoped the chat_room_members join
  // to type='direct' only. Previously every group's row was duplicated
  // once per member because the join had no type guard, so a 4-member
  // group showed up 4 times in the sidebar.
  // FIX 2: DISTINCT ON (r.id) requires r.id to lead the ORDER BY, which
  // means the *visible* result order was actually just sorted by room
  // UUID — last_message_at DESC never got a chance to matter, since
  // there's only ever one row per room id at that point. Wrapped the
  // whole thing in a subquery so the outer ORDER BY can sort by recency
  // like a normal chat app (WhatsApp/Slack-style: newest activity first).
  @SubscribeMessage('get_rooms')
  async getRooms(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const rooms = await this.dataSource.query(`
      SELECT * FROM (
        SELECT DISTINCT ON (r.id) r.*,
          (SELECT content FROM tenant_ssipl.chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message,
          (SELECT created_at FROM tenant_ssipl.chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
          (SELECT COUNT(*)::int FROM tenant_ssipl.chat_messages WHERE room_id = r.id) AS message_count,
          ou.id AS other_user_id,
          ou.first_name AS other_first_name,
          ou.last_name AS other_last_name,
          ou.email AS other_email,
          ou.avatar AS other_avatar,
          COALESCE(crm_me.unread_count, 0) AS unread_count
        FROM tenant_ssipl.chat_rooms r
        LEFT JOIN tenant_ssipl.chat_room_members crm
          ON crm.room_id = r.id AND crm.user_id::text != $1 AND r.type = 'direct'
        LEFT JOIN tenant_ssipl.users ou ON ou.id::text = crm.user_id::text AND r.type = 'direct'
        LEFT JOIN tenant_ssipl.chat_room_members crm_me ON crm_me.room_id = r.id AND crm_me.user_id::text = $1
        WHERE r.is_active = true
          AND (r.type = 'channel' OR r.id IN (
            SELECT room_id FROM tenant_ssipl.chat_room_members WHERE user_id::text = $1
          ))
        ORDER BY r.id, last_message_at DESC NULLS LAST, r.created_at ASC
      ) rooms_deduped
      ORDER BY last_message_at DESC NULLS LAST, created_at DESC
    `, [userId]);
    client.emit('rooms', rooms);
  }

  // ── Join room ──
  @SubscribeMessage('join_room')
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.join(roomId);
    await this.dataSource.query(`
      UPDATE tenant_ssipl.chat_room_members
      SET unread_count = 0, last_read_at = NOW()
      WHERE room_id = $1 AND user_id::text = $2
    `, [roomId, client.data.userId]);

    client.emit('unread_update', { roomId, unreadCount: 0 });

    const messages = await this.dataSource.query(`
      SELECT m.*, u.first_name, u.last_name, u.email,
             (SELECT avatar FROM tenant_ssipl.users WHERE id = m.user_id) AS avatar
      FROM tenant_ssipl.chat_messages m
      LEFT JOIN tenant_ssipl.users u ON u.id::text = m.user_id::text
      WHERE m.room_id = $1
      ORDER BY m.created_at ASC
      LIMIT 50
    `, [roomId]);
    client.emit('room_messages', { roomId, messages });
  }

  // ── Leave room ──
  @SubscribeMessage('leave_room')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.leave(roomId);
  }

  // ── Send message ──
  @SubscribeMessage('send_message')
  async sendMessage(@ConnectedSocket() client: Socket, @MessageBody() data: {
    roomId: string; content: string; type?: string; fileUrl?: string; fileName?: string;
  }) {
    const userId = client.data.userId;
    if (!userId || !data.content?.trim()) return;

    // ── Broadcast channels: read-only for everyone except Admins ──
    const [room] = await this.dataSource.query(
      `SELECT type FROM tenant_ssipl.chat_rooms WHERE id = $1`,
      [data.roomId]
    );
    if (room?.type === 'channel') {
      const role = (client.data.user?.role || '').toLowerCase();
      if (role !== 'admin') {
        client.emit('error', { message: 'This is a broadcast channel — only Admins can post here' });
        return;
      }
    }

    const [msg] = await this.dataSource.query(`
      INSERT INTO tenant_ssipl.chat_messages (room_id, user_id, content, type, file_url, file_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [data.roomId, userId, data.content.trim(), data.type || 'text', data.fileUrl || null, data.fileName || null]);

    await this.dataSource.query(`
      UPDATE tenant_ssipl.chat_room_members
      SET unread_count = unread_count + 1
      WHERE room_id = $1 AND user_id::text != $2
    `, [data.roomId, userId]);

    await this.dataSource.query(`
      INSERT INTO tenant_ssipl.chat_room_members (room_id, user_id, unread_count)
      SELECT $1, u.id, 1
      FROM tenant_ssipl.users u
      WHERE u.is_active = true AND u.deleted_at IS NULL
        AND u.id::text != $2
        AND NOT EXISTS (
          SELECT 1 FROM tenant_ssipl.chat_room_members
          WHERE room_id = $1 AND user_id = u.id
        )
        AND EXISTS (SELECT 1 FROM tenant_ssipl.chat_rooms WHERE id = $1 AND type = 'channel')
      ON CONFLICT (room_id, user_id) DO NOTHING
    `, [data.roomId, userId]);

    const [user] = await this.dataSource.query(
      `SELECT first_name, last_name, email, avatar FROM tenant_ssipl.users WHERE id = $1`,
      [userId]
    );

    const fullMsg = { ...msg, first_name: user.first_name, last_name: user.last_name, email: user.email, avatar: user.avatar };
    this.server.to(data.roomId).emit('new_message', fullMsg);

    const members = await this.dataSource.query(`
      SELECT user_id, unread_count FROM tenant_ssipl.chat_room_members
      WHERE room_id = $1 AND user_id::text != $2
    `, [data.roomId, userId]);

    members.forEach((m: any) => {
      const socketId = this.onlineUsers.get(m.user_id);
      if (socketId) {
        this.server.to(socketId).emit('unread_update', {
          roomId: data.roomId,
          unreadCount: m.unread_count,
        });
      }
    });
  }

  // ── Typing indicator ──
  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; isTyping: boolean }) {
    const user = client.data.user;
    client.to(data.roomId).emit('user_typing', {
      userId: client.data.userId,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
      isTyping: data.isTyping,
    });
  }

  // ── Edit message ──
  @SubscribeMessage('edit_message')
  async editMessage(@ConnectedSocket() client: Socket, @MessageBody() data: { messageId: string; content: string }) {
    const userId = client.data.userId;
    const result = await this.dataSource.query(
      `UPDATE tenant_ssipl.chat_messages 
       SET content = $1, is_edited = true, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 
       RETURNING *`,
      [data.content, data.messageId, userId]
    );
    if (result.length > 0) {
      const msg = result[0];
      this.server.to(msg.room_id).emit('message_edited', msg);
    }
  }

  // ── Delete message ──
  @SubscribeMessage('delete_message')
  async deleteMessage(@ConnectedSocket() client: Socket, @MessageBody() data: { messageId: string; roomId: string }) {
    const userId = client.data.userId;
    await this.dataSource.query(
      `DELETE FROM tenant_ssipl.chat_messages WHERE id = $1 AND user_id = $2`,
      [data.messageId, userId]
    );
    this.server.to(data.roomId).emit('message_deleted', { messageId: data.messageId, roomId: data.roomId });
  }

  // ── Create DM room ──
  @SubscribeMessage('create_dm')
  async createDm(@ConnectedSocket() client: Socket, @MessageBody() targetUserId: string) {
    const userId = client.data.userId;
    const existing = await this.dataSource.query(`
      SELECT r.* FROM tenant_ssipl.chat_rooms r
      WHERE r.type = 'direct'
        AND EXISTS (SELECT 1 FROM tenant_ssipl.chat_room_members WHERE room_id = r.id AND user_id = $1)
        AND EXISTS (SELECT 1 FROM tenant_ssipl.chat_room_members WHERE room_id = r.id AND user_id = $2)
    `, [userId, targetUserId]);

    let room;
    if (existing.length > 0) {
      room = existing[0];
    } else {
      const [newRoom] = await this.dataSource.query(
        `INSERT INTO tenant_ssipl.chat_rooms (type, created_by) VALUES ('direct', $1) RETURNING *`,
        [userId]
      );
      await this.dataSource.query(
        `INSERT INTO tenant_ssipl.chat_room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)`,
        [newRoom.id, userId, targetUserId]
      );
      room = newRoom;
    }

    const [otherUser] = await this.dataSource.query(
      `SELECT id, first_name, last_name, email, avatar FROM tenant_ssipl.users WHERE id = $1`,
      [targetUserId]
    );

    const roomWithUser = {
      ...room,
      other_user_id: otherUser.id,
      other_first_name: otherUser.first_name,
      other_last_name: otherUser.last_name,
      other_email: otherUser.email,
      other_avatar: otherUser.avatar,
    };

    client.emit('dm_created', roomWithUser);
    await this.getRooms(client);
  }

  // ── Create Broadcast Channel (Admin only) ──
  @SubscribeMessage('create_channel')
  async createChannel(@ConnectedSocket() client: Socket, @MessageBody() data: {
    name: string; description?: string;
  }) {
    const userId = client.data.userId;
    const role   = (client.data.user?.role || '').toLowerCase();

    if (role !== 'admin') {
      client.emit('error', { message: 'Only Admins can create broadcast channels' });
      return;
    }
    if (!data.name?.trim()) return;

    const [room] = await this.dataSource.query(
      `INSERT INTO tenant_ssipl.chat_rooms (name, type, description, created_by, is_active)
       VALUES ($1, 'channel', $2, $3, true) RETURNING *`,
      [data.name.trim(), data.description || null, userId]
    );

    // Creator joins as room-level admin too (consistent with group pattern)
    await this.dataSource.query(
      `INSERT INTO tenant_ssipl.chat_room_members (room_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [room.id, userId]
    );

    // Broadcast channels are visible to everyone — nudge all online users
    // to refresh their room list so the new channel shows up immediately
    this.server.emit('refresh_rooms');

    client.emit('channel_created', room);
    await this.getRooms(client);
  }

  // ── Create Group ──
  @SubscribeMessage('create_group')
  async createGroup(@ConnectedSocket() client: Socket, @MessageBody() data: {
    name: string; description?: string; memberIds: string[];
  }) {
    const userId = client.data.userId;
    if (!data.name?.trim() || !data.memberIds?.length) return;

    const [room] = await this.dataSource.query(
      `INSERT INTO tenant_ssipl.chat_rooms (name, type, description, created_by, is_active)
       VALUES ($1, 'group', $2, $3, true) RETURNING *`,
      [data.name.trim(), data.description || null, userId]
    );

    await this.dataSource.query(
      `INSERT INTO tenant_ssipl.chat_room_members (room_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [room.id, userId]
    );

    for (const memberId of data.memberIds) {
      if (memberId !== userId) {
        await this.dataSource.query(
          `INSERT INTO tenant_ssipl.chat_room_members (room_id, user_id, role)
           VALUES ($1, $2, 'member') ON CONFLICT (room_id, user_id) DO NOTHING`,
          [room.id, memberId]
        );
      }
    }

    for (const memberId of [...data.memberIds, userId]) {
      const socketId = this.onlineUsers.get(memberId);
      if (socketId) {
        this.server.to(socketId).emit('refresh_rooms');
      }
    }

    client.emit('group_created', room);
    await this.getRooms(client);
  }

  // ── Get group members ──
  @SubscribeMessage('get_group_members')
  async getGroupMembers(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    const members = await this.dataSource.query(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.avatar,
             crm.role, crm.unread_count
      FROM tenant_ssipl.chat_room_members crm
      JOIN tenant_ssipl.users u ON u.id::text = crm.user_id::text
      WHERE crm.room_id = $1 AND u.deleted_at IS NULL
      ORDER BY crm.role DESC, u.first_name ASC
    `, [roomId]);
    client.emit('group_members', { roomId, members });
  }

  // ── Add member to group ──
  @SubscribeMessage('add_group_member')
  async addGroupMember(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string }) {
    const requesterId = client.data.userId;
    const [requester] = await this.dataSource.query(
      `SELECT role FROM tenant_ssipl.chat_room_members WHERE room_id = $1 AND user_id::text = $2`,
      [data.roomId, requesterId]
    );
    if (!requester || requester.role !== 'admin') {
      client.emit('error', { message: 'Only admins can add members' });
      return;
    }
    await this.dataSource.query(
      `INSERT INTO tenant_ssipl.chat_room_members (room_id, user_id, role)
       VALUES ($1, $2, 'member') ON CONFLICT (room_id, user_id) DO NOTHING`,
      [data.roomId, data.userId]
    );
    const socketId = this.onlineUsers.get(data.userId);
    if (socketId) {
      this.server.to(socketId).emit('refresh_rooms');
    }
    await this.getGroupMembers(client, data.roomId);
    this.server.to(data.roomId).emit('member_added', { roomId: data.roomId, userId: data.userId });
  }

  // ── Remove member from group ──
  @SubscribeMessage('remove_group_member')
  async removeGroupMember(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; userId: string }) {
    const requesterId = client.data.userId;
    const [requester] = await this.dataSource.query(
      `SELECT role FROM tenant_ssipl.chat_room_members WHERE room_id = $1 AND user_id::text = $2`,
      [data.roomId, requesterId]
    );
    if (!requester || requester.role !== 'admin') {
      client.emit('error', { message: 'Only admins can remove members' });
      return;
    }
    await this.dataSource.query(
      `DELETE FROM tenant_ssipl.chat_room_members WHERE room_id = $1 AND user_id::text = $2`,
      [data.roomId, data.userId]
    );
    this.server.to(data.roomId).emit('member_removed', { roomId: data.roomId, userId: data.userId });
    await this.getGroupMembers(client, data.roomId);
  }

  // ── Leave group ──
  @SubscribeMessage('leave_group')
  async leaveGroup(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    const userId = client.data.userId;
    await this.dataSource.query(
      `DELETE FROM tenant_ssipl.chat_room_members WHERE room_id = $1 AND user_id::text = $2`,
      [roomId, userId]
    );
    client.leave(roomId);
    this.server.to(roomId).emit('member_removed', { roomId, userId });
    await this.getRooms(client);
  }

  // ── Update group info ──
  @SubscribeMessage('update_group')
  async updateGroup(@ConnectedSocket() client: Socket, @MessageBody() data: { roomId: string; name?: string; description?: string }) {
    const userId = client.data.userId;
    const [requester] = await this.dataSource.query(
      `SELECT role FROM tenant_ssipl.chat_room_members WHERE room_id = $1 AND user_id::text = $2`,
      [data.roomId, userId]
    );
    if (!requester || requester.role !== 'admin') {
      client.emit('error', { message: 'Only admins can update group' });
      return;
    }
    const sets: string[] = [];
    const vals: any[]   = [];
    let idx = 1;
    if (data.name)        { sets.push(`name = $${idx++}`);        vals.push(data.name); }
    if (data.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(data.description); }
    if (!sets.length) return;
    vals.push(data.roomId);
    await this.dataSource.query(
      `UPDATE tenant_ssipl.chat_rooms SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    );
    this.server.to(data.roomId).emit('group_updated', { roomId: data.roomId, name: data.name, description: data.description });
    await this.getRooms(client);
  }

  // ── Delete Group ──
  @SubscribeMessage('delete_group')
  async deleteGroup(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    const userId = client.data.userId;
    const [requester] = await this.dataSource.query(
      `SELECT role FROM tenant_ssipl.chat_room_members WHERE room_id = $1 AND user_id::text = $2`,
      [roomId, userId]
    );
    if (!requester || requester.role !== 'admin') {
      client.emit('error', { message: 'Only admins can delete group' });
      return;
    }
    this.server.to(roomId).emit('group_deleted', { roomId });
    await this.dataSource.query(`DELETE FROM tenant_ssipl.chat_messages WHERE room_id = $1`, [roomId]);
    await this.dataSource.query(`DELETE FROM tenant_ssipl.chat_room_members WHERE room_id = $1`, [roomId]);
    await this.dataSource.query(`DELETE FROM tenant_ssipl.chat_rooms WHERE id = $1`, [roomId]);
    await this.getRooms(client);
  }
}