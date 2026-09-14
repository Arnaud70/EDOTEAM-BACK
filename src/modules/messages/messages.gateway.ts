import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { MessagesService } from './messages.service';

interface SendMessagePayload {
  receiverId?: string;
  content?: string;
}

@WebSocketGateway({
  namespace: '/messages',
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
    credentials: true,
  },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.getToken(socket);
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt) {
        throw new UnauthorizedException();
      }

      socket.data.userId = user.id;
      await socket.join(this.userRoom(user.id));
      this.server.emit('user_online', { userId: user.id });
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const userId = socket.data.userId as string | undefined;
    if (userId) {
      this.server.emit('user_offline', { userId });
    }
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    const senderId = socket.data.userId as string | undefined;
    const receiverId = payload?.receiverId?.trim();
    const content = payload?.content?.trim();

    if (!senderId || !receiverId || !content) {
      return { ok: false, error: 'Destinataire et contenu requis' };
    }

    try {
      const message = await this.messagesService.sendMessage(
        senderId,
        receiverId,
        content,
      );
      this.server.to(this.userRoom(receiverId)).emit('new_message', message);
      socket.emit('message_sent', message);
      return { ok: true, message };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : 'Impossible d’envoyer le message',
      };
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { receiverId?: string; isTyping?: boolean },
  ) {
    const senderId = socket.data.userId as string | undefined;
    const receiverId = payload?.receiverId?.trim();
    if (senderId && receiverId) {
      this.server.to(this.userRoom(receiverId)).emit('typing', {
        senderId,
        isTyping: Boolean(payload.isTyping),
      });
    }
  }

  private getToken(socket: Socket): string {
    const authToken = socket.handshake.auth?.token;
    const header = socket.handshake.headers.authorization;
    const token =
      authToken ||
      (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) {
      throw new UnauthorizedException();
    }
    return token;
  }

  private userRoom(userId: string): string {
    return `user:${userId}`;
  }
}
