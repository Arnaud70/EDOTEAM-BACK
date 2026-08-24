import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private mailerService: MailerService,
  ) {}

  async create(data: { userId: string; title: string; message: string; type: string }) {
    if (!data?.userId || !data?.title || !data?.message || !data?.type) {
      this.logger.warn('Notification ignorée: données incomplètes.');
      return null;
    }

    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      this.logger.warn(`Notification ignorée pour userId inconnu: ${data.userId}`);
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
      const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST;
      const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASSWORD;

      if (user.email && smtpHost && smtpUser && smtpPass) {
        await this.mailerService.sendMail({
          to: user.email,
          subject: `[EDOTEAM] ${data.title}`,
          text: `${data.message}\n\nConnectez-vous sur EDOTEAM pour en savoir plus.`,
        });
        this.logger.log(`Email envoyé à ${user.email} pour la notification: ${data.title}`);
      }
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Erreur lors de l'envoi de l'email de notification: ${errMessage}`);
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
