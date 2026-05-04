import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.service.findMany({
      include: {
        _count: {
          select: { providers: true }
        }
      }
    });
  }

  async getOne(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: {
        providers: {
          include: { prestataire: true }
        }
      }
    });
  }

  async create(data: { nom: string; description?: string; icon?: string }) {
    return this.prisma.service.create({
      data,
    });
  }

  async getProviderServices(userId: string) {
    return this.prisma.prestataireService.findMany({
      where: { prestataireId: userId },
      include: {
        service: true,
      },
    });
  }

  async addServiceToProvider(userId: string, serviceId: string, prixIndicatif?: number, experience?: number) {
    return this.prisma.prestataireService.create({
      data: {
        prestataireId: userId,
        serviceId: serviceId,
        prixIndicatif: prixIndicatif,
        experience: experience,
      },
      include: {
        service: true,
      },
    });
  }

  async removeServiceFromProvider(userId: string, serviceId: string) {
    return this.prisma.prestataireService.delete({
      where: {
        prestataireId_serviceId: {
          prestataireId: userId,
          serviceId: serviceId,
        },
      },
    });
  }
}
