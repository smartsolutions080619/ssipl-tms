import {
  WebSocketGateway, WebSocketServer,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;

  // userId → set of socket ids (a user can have multiple tabs/devices open)
  private onlineUsers = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
      if (!token) { client.disconnect(); return; }
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;

      const sockets = this.onlineUsers.get(payload.sub) || new Set<string>();
      sockets.add(client.id);
      this.onlineUsers.set(payload.sub, sockets);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;
    if (!userId) return;
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return;
    sockets.delete(client.id);
    if (sockets.size === 0) this.onlineUsers.delete(userId);
  }

  // Push an event to every open tab/device a user currently has connected.
  // No-op (silently) if the user isn't online — the notification still
  // exists in the DB and will show up next time they open the bell/login.
  sendToUser(userId: string, event: string, payload: unknown) {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return;
    for (const socketId of sockets) {
      this.server.to(socketId).emit(event, payload);
    }
  }
}