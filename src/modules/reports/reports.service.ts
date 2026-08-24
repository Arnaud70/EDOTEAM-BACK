import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async create(reporterId: string, data: {
    motif: string;
    description?: string;
    avisId?: string;
    messageId?: string;
    targetUserId?: string;
  }) {
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        motif: data.motif,
        description: data.description,
        reviewId: data.avisId,
        messageId: data.messageId,
        targetUserId: data.targetUserId,
      },
    });

    // Notify admins
    try {
      const admins = await this.prisma.user.findMany({ where: { role: 'ADMIN' } });
      for (const admin of admins) {
        await this.notificationsService.create({
          userId: admin.id,
          title: '🚨 Nouveau signalement',
          message: `Un nouveau signalement a été soumis pour le motif : ${data.motif}. Veuillez consulter le Centre de Sécurité.`,
          type: 'REPORT_CREATED',
        });
      }
    } catch (e) {
      this.logger.error('Erreur lors de la notification des admins pour le signalement', e);
    }

    return report;
  }

  async getAll(status?: string) {
    const reports = await this.prisma.report.findMany({
      where: status ? { status: status as any } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, nom: true, prenom: true, email: true } },
        review: true,
        message: true,
        resolver: { select: { id: true, nom: true, prenom: true } },
      },
    });

    return reports.map(r => ({
      id: r.id,
      type: r.reviewId ? 'AVIS' : (r.messageId ? 'MESSAGE' : 'USER'),
      reason: r.motif,
      description: r.description || '',
      status: r.status,
      createdAt: r.createdAt,
      reporter: {
        nom: r.reporter.nom,
        prenom: r.reporter.prenom || '',
      },
      targetId: r.targetUserId || r.reviewId || r.messageId || 'N/A',
      resolvedBy: r.resolver ? `${r.resolver.prenom || ''} ${r.resolver.nom || ''}`.trim() : null,
    }));
  }

  async resolve(reportId: string, adminId: string, status: 'RESOLVED' | 'REJECTED') {
    return this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolvedById: adminId, resolvedAt: new Date() },
    });
  }
}
