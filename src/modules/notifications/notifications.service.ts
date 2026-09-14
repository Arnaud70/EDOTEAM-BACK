import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../common/mail/mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  async create(data: {
    userId: string;
    title: string;
    message: string;
    type: string;
  }) {
    if (!data?.userId || !data?.title || !data?.message || !data?.type) {
      this.logger.warn('Notification ignorée: données incomplètes.');
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });
    if (!user) {
      this.logger.warn(
        `Notification ignorée pour userId inconnu: ${data.userId}`,
      );
      return null;
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        message: data.message,
        type: data.type,
      },
    });

    try {
      if (user.email && this.mailService.isConfigured()) {
        await this.mailService.sendMail({
          to: user.email,
          subject: `[EDOTEAM] ${data.title}`,
          text: `${data.message}\n\nConnectez-vous sur EDOTEAM pour en savoir plus.`,
        });
        this.logger.log(
          `Email envoyé à ${user.email} pour la notification: ${data.title}`,
        );
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Erreur lors de l'envoi de l'email de notification: ${errMessage}`,
      );
    }

    return notification;
  }

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}
