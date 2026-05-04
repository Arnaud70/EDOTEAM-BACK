import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogsService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }) {
    return this.prisma.activityLog.create({
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
