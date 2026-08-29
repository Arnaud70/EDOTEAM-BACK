import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private activityLogsService: ActivityLogsService,
    private mailerService: MailerService,
    private notificationsService: NotificationsService,
  ) {}

  private isSmtpConfigured(): boolean {
    return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  }

  private async sendVerificationStatusEmail(
    user: { email: string; prenom: string | null; nom: string },
    status: 'VERIFIED' | 'REJECTED',
    reason?: string | null,
  ) {
    if (!this.isSmtpConfigured()) return;

    const isVerified = status === 'VERIFIED';
    const subject = isVerified
      ? 'EDOTEAM • Votre compte prestataire est validé !'
      : 'EDOTEAM • Votre document justificatif n\'a pas été validé';

    const html = `
      <div style="font-family: 'Segoe UI', Tahoma, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; color: #1e293b;">
        <div style="background-color: ${isVerified ? '#064e3b' : '#0f172a'}; padding: 32px 20px; text-align: center;">
          <h1 style="color: ${isVerified ? '#fbbf24' : '#f87171'}; margin: 0; font-size: 22px;">EDOTEAM</h1>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #0f172a; margin-top: 0;">${isVerified ? 'Compte validé ✅' : 'Document non validé'}</h2>
          <p style="line-height: 1.6;">Bonjour ${user.prenom || user.nom},</p>
          ${isVerified ? `
            <p style="line-height: 1.6;">Bonne nouvelle : notre équipe a vérifié votre document justificatif et validé votre profil prestataire. Vos services sont désormais visibles publiquement sur EDOTEAM.</p>
          ` : `
            <p style="line-height: 1.6;">Notre équipe a examiné votre document justificatif et n'a pas pu valider votre profil prestataire pour le moment.</p>
            <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <strong style="color: #b91c1c;">Motif :</strong> <span style="color: #7f1d1d;">${reason || 'Non spécifié.'}</span>
            </div>
            <p style="line-height: 1.6;">Vous pouvez importer un nouveau document depuis vos Paramètres. Tant qu'il n'est pas validé, votre profil n'apparaît pas dans les recherches publiques.</p>
          `}
          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.FRONTEND_URL}/${isVerified ? 'dashboard' : 'settings'}" style="background-color: #059669; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">${isVerified ? 'Accéder à mon Tableau de Bord' : 'Importer un nouveau document'}</a>
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 18px; text-align: center; font-size: 12px; color: #64748b;">
          © ${new Date().getFullYear()} EDOTEAM
        </div>
      </div>`;

    try {
      await this.mailerService.sendMail({ to: user.email, subject, html });
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email de vérification:', error);
    }
  }

  async getStats() {
    const [
      totalUsers,
      totalClients,
      totalPrestataires,
      totalServices,
      totalMessages,
      totalAvis,
      pendingReports,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'CLIENT', deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'PRESTATAIRE', deletedAt: null } }),
      this.prisma.service.count(),
      this.prisma.message.count(),
      this.prisma.avis.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
    ]);

    const [totalRevenueResult, missionsRealisees, serviceDistributionGroups] = await Promise.all([
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { status: 'CONFIRMED' },
      }),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.prestataireService.groupBy({
        by: ['serviceId'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    const serviceIds = serviceDistributionGroups.map((group) => group.serviceId);
    const services = serviceIds.length
      ? await this.prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, nom: true },
        })
      : [];

    const serviceDistribution = serviceDistributionGroups.map((group) => ({
      name: services.find((service) => service.id === group.serviceId)?.nom ?? 'Autre',
      value: group._count.id,
    }));

    const monthlyRevenue = await this.prisma.$queryRaw<Array<{ month: string; revenue: number }>>`
      SELECT to_char(date_trunc('month', "date"), 'Mon') AS month,
             sum(total_amount)::float AS revenue
      FROM bookings
      WHERE status = 'CONFIRMED'
      GROUP BY date_trunc('month', "date")
      ORDER BY date_trunc('month', "date")
    `;

    return {
      utilisateurs: { total: totalUsers, clients: totalClients, prestataires: totalPrestataires },
      services: totalServices,
      messages: totalMessages,
      avis: totalAvis,
      signalements: { enAttente: pendingReports },
      chiffreAffaires: Number(totalRevenueResult._sum.totalAmount ?? 0),
      missionsRealisees,
      totalBookings: await this.prisma.booking.count(),
      monthlyRevenue,
      serviceDistribution,
    };
  }

  async getAllUsers(role?: string, status?: 'ACTIVE' | 'SUSPENDED') {
    const where: any = {};
    if (role) where.role = role as any;
    
    if (status === 'ACTIVE') where.deletedAt = null;
    else if (status === 'SUSPENDED') where.deletedAt = { not: null };

    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        role: true,
        createdAt: true,
        emailVerified: true,
        verificationStatus: true,
        rejectionReason: true,
        deletedAt: true,
        media: {
          where: { type: 'DOCUMENT' },
          select: { id: true, url: true, mimeType: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async activityLogs(limit?: number) {
    return this.activityLogsService.getAll(limit);
  }

  async getAllReports(status?: string) {
    return this.reportsService.getAll(status);
  }

  async resolveReport(reportId: string, adminId: string, status: 'RESOLVED' | 'REJECTED') {
    return this.reportsService.resolve(reportId, adminId, status);
  }

  async verifyUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (user.role === 'PRESTATAIRE') {
      const documentCount = await this.prisma.media.count({ where: { userId, type: 'DOCUMENT' } });
      if (documentCount === 0) {
        throw new BadRequestException(
          "Impossible de valider ce prestataire : aucun document justificatif n'a été fourni.",
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: 'VERIFIED',
        rejectionReason: null,
        emailVerified: true,
      },
    });

    await this.sendVerificationStatusEmail(updated, 'VERIFIED');
    await this.notificationsService.create({
      userId,
      title: 'Compte validé ✅',
      message: 'Votre document justificatif a été vérifié. Votre profil prestataire est maintenant visible publiquement.',
      type: 'VERIFICATION_APPROVED',
    }).catch(() => undefined);

    return updated;
  }

  async rejectUser(userId: string, reason: string) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        verificationStatus: 'REJECTED',
        rejectionReason: reason,
      },
    });

    await this.sendVerificationStatusEmail(updated, 'REJECTED', reason);
    await this.notificationsService.create({
      userId,
      title: 'Document non validé',
      message: `Votre document justificatif n'a pas été validé : ${reason}`,
      type: 'VERIFICATION_REJECTED',
    }).catch(() => undefined);

    return updated;
  }

  async suspendUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), verificationStatus: 'REJECTED' },
    });
  }

  async restoreUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, verificationStatus: 'PENDING' },
    });
  }

  async deleteUser(userId: string) {
    return this.prisma.$transaction([
      this.prisma.notification.deleteMany({ where: { userId } }),
      this.prisma.activityLog.deleteMany({ where: { userId } }),
      this.prisma.booking.deleteMany({ where: { OR: [{ clientId: userId }, { prestataireId: userId }] } }),
      this.prisma.transaction.deleteMany({ where: { wallet: { userId } } }),
      this.prisma.wallet.deleteMany({ where: { userId } }),
      this.prisma.report.deleteMany({ where: { OR: [{ reporterId: userId }, { resolvedById: userId }] } }),
      this.prisma.message.deleteMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] } }),
      this.prisma.avis.deleteMany({ where: { OR: [{ clientId: userId }, { prestataireId: userId }] } }),
      this.prisma.prestataireService.deleteMany({ where: { prestataireId: userId } }),
      this.prisma.availability.deleteMany({ where: { prestataireId: userId } }),
      this.prisma.media.deleteMany({ where: { userId } }),
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      this.prisma.user.delete({ where: { id: userId } })
    ]);
  }

  // Service Category Management
  async createService(data: { nom: string; description?: string; icon?: string }) {
    return this.prisma.service.create({ data });
  }

  async updateService(id: string, data: { nom?: string; description?: string; icon?: string }) {
    return this.prisma.service.update({ where: { id }, data });
  }

  async deleteService(id: string) {
    return this.prisma.service.delete({ where: { id } });
  }

  async getProviderStats(userId: string) {
    const [
      totalServices,
      totalAvailabilities,
      totalReviews,
      totalBookings,
      totalRevenueResult,
    ] = await Promise.all([
      this.prisma.prestataireService.count({ where: { prestataireId: userId } }),
      this.prisma.availability.count({ where: { prestataireId: userId } }),
      this.prisma.avis.count({ where: { prestataireId: userId } }),
      this.prisma.booking.count({ where: { prestataireId: userId } }),
      this.prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { prestataireId: userId, status: 'CONFIRMED' },
      }),
    ]);

    const monthlyRevenue = await this.prisma.$queryRaw<Array<{ month: string; revenue: number }>>`
      SELECT to_char(date_trunc('month', "date"), 'Mon') AS month,
             sum(total_amount)::float AS revenue
      FROM bookings
      WHERE prestataire_id = ${userId}
        AND status = 'CONFIRMED'
      GROUP BY date_trunc('month', "date")
      ORDER BY date_trunc('month', "date")
    `;

    return {
      totalServices,
      totalAvailabilities,
      totalReviews,
      totalRevenue: Number(totalRevenueResult._sum.totalAmount ?? 0),
      totalBookings,
      monthlyRevenue,
    };
  }
}
