import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private activityLogsService: ActivityLogsService,
  ) {}

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
        deletedAt: true 
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

  async suspendUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  async restoreUser(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null },
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
