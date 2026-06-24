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

  // userId → socketId map
  private onlineUsers = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // ── Auth on connect ──
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.data.user   = payload;
      this.onlineUsers.set(payload.sub, client.id);
      // Broadcast online users
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
  @SubscribeMessage('get_rooms')
  async getRooms(@ConnectedSocket() client: Socket) {
    const userId = client.data.userId;
    const rooms = await this.dataSource.query(`
      SELECT r.*,
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
      LEFT JOIN tenant_ssipl.chat_room_members crm ON crm.room_id = r.id AND crm.user_id::text != $1
      LEFT JOIN tenant_ssipl.users ou ON ou.id::text = crm.user_id::text AND r.type = 'direct'
      LEFT JOIN tenant_ssipl.chat_room_members crm_me ON crm_me.room_id = r.id AND crm_me.user_id::text = $1
      WHERE r.is_active = true
        AND (r.type = 'channel' OR r.id IN (
          SELECT room_id FROM tenant_ssipl.chat_room_members WHERE user_id::text = $1
        ))
      ORDER BY last_message_at DESC NULLS LAST, r.created_at ASC
    `, [userId]);
    client.emit('rooms', rooms);
  }

  // ── Join room ──
  @SubscribeMessage('join_room')
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() roomId: string) {
    client.join(roomId);
    // Reset unread count
    await this.dataSource.query(`
      UPDATE tenant_ssipl.chat_room_members
      SET unread_count = 0, last_read_at = NOW()
      WHERE room_id = $1 AND user_id::text = $2
    `, [roomId, client.data.userId]);

    // Emit reset to client
    client.emit('unread_update', { roomId, unreadCount: 0 });

    // Load last 50 messages
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

    const [msg] = await this.dataSource.query(`
      INSERT INTO tenant_ssipl.chat_messages (room_id, user_id, content, type, file_url, file_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [data.roomId, userId, data.content.trim(), data.type || 'text', data.fileUrl || null, data.fileName || null]);

    // Increment unread for all other members
    await this.dataSource.query(`
      UPDATE tenant_ssipl.chat_room_members
      SET unread_count = unread_count + 1
      WHERE room_id = $1 AND user_id::text != $2
    `, [data.roomId, userId]);

    // For channels — ensure all users have a member record
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

    // Emit updated unread counts to each user
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
      // Broadcast to entire room
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

    // Get other user info
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
    // Refresh rooms list
    await this.getRooms(client);
  }
}