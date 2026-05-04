import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ApiTags } from '@nestjs/swagger';

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService
  ) {}

  async sendMessage(senderId: string, receiverId: string, content: string) {
    if (senderId === receiverId) {
      throw new BadRequestException('Vous ne pouvez pas vous envoyer un message à vous-même');
    }

    if (content.length > 1000) {
      throw new BadRequestException('Message trop long (max 1000 caractères)');
    }

    const message = await this.prisma.message.create({
      data: { senderId, receiverId, content },
      include: {
        sender: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
        receiver: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
      },
    });

    // Notify the receiver
    await this.notifications.create({
      userId: receiverId,
      title: 'Nouveau message',
      message: `${message.sender.prenom} ${message.sender.nom} vous a envoyé un message : ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
      type: 'MESSAGE_RECEIVED',
    });

    return message;
  }

  async getConversations(userId: string) {
    // Get unique conversation partners
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
        receiver: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
      },
    });

    // Group by conversation partner
    const conversations = new Map<string, any>();
    for (const msg of messages) {
      const partnerId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      if (!conversations.has(partnerId)) {
        conversations.set(partnerId, {
          partner: msg.senderId === userId ? msg.receiver : msg.sender,
          lastMessage: msg,
          unreadCount: 0,
        });
      }
      if (!msg.isRead && msg.receiverId === userId) {
        const conv = conversations.get(partnerId);
        conv.unreadCount++;
      }
    }

    return Array.from(conversations.values());
  }

  async getMessages(userId: string, partnerId: string) {
    // Mark messages as read
    await this.prisma.message.updateMany({
      where: { senderId: partnerId, receiverId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });

    return this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: partnerId },
          { senderId: partnerId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: { select: { id: true, nom: true, prenom: true, photoUrl: true } },
      },
    });
  }

  async hasInteracted(userId1: string, userId2: string): Promise<boolean> {
    const count = await this.prisma.message.count({
      where: {
        OR: [
          { senderId: userId1, receiverId: userId2 },
          { senderId: userId2, receiverId: userId1 },
        ],
      },
    });
    return count > 0;
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.message.count({
      where: { receiverId: userId, isRead: false },
    });
  }
}
