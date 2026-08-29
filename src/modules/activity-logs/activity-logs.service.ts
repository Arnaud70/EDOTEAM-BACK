import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogsService {
  private readonly logger = new Logger(ActivityLogsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Journalisation d'audit "best effort" : ne doit jamais faire échouer la requête appelante
   * (ex. si la base est momentanément indisponible).
   */
  async log(data: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    try {
      return await this.prisma.activityLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          metadata: data.metadata,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Journalisation ignorée (${data.action}) : ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async getAll(limit = 100, skip = 0) {
    return this.prisma.activityLog.findMany({
      take: limit,
      skip: skip,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nom: true, email: true } },
      },
    });
  }
}
