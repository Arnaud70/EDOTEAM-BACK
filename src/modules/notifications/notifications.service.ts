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
    const notification = await this.prisma.notification.create({
      data,
    });

    // Envoyer l'email
    try {
      const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
      if (user && user.email) {
        await this.mailerService.sendMail({
          to: user.email,
          subject: `[Togo Connect] ${data.title}`,
          text: `${data.message}\n\nConnectez-vous sur Togo Connect pour en savoir plus.`,
        });
        this.logger.log(`Email envoyé à ${user.email} pour la notification: ${data.title}`);
      }
    } catch (error) {
      this.logger.error(`Erreur lors de l'envoi de l'email de notification: ${error.message}`);
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
