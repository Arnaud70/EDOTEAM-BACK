import { Injectable } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService
  ) {}

  async create(data: {
    clientId: string;
    prestataireId: string;
    serviceId: string;
    date: Date;
    startTime: Date;
    endTime: Date;
    totalAmount: number;
    address: string;
  }) {
    const booking = await this.prisma.booking.create({
      data: {
        clientId: data.clientId,
        prestataireId: data.prestataireId,
        serviceId: data.serviceId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        totalAmount: data.totalAmount,
        address: data.address,
      },
      include: {
        service: true,
        client: { select: { id: true, nom: true, prenom: true, email: true } },
        prestataire: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    // Notify the provider
    await this.notifications.create({
      userId: data.prestataireId,
      title: 'Nouveau rendez-vous !',
      message: `Vous avez une nouvelle demande de réservation pour le service ${booking.service.nom}.`,
      type: 'BOOKING_CREATED',
    });

    return booking;
  }

  async findAll(userId: string, role: string) {
    const where = role === 'PRESTATAIRE' 
      ? { prestataireId: userId } 
      : { clientId: userId };

    return this.prisma.booking.findMany({
      where,
      include: {
        service: true,
        client: { select: { id: true, nom: true, prenom: true } },
        prestataire: { select: { id: true, nom: true, prenom: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async updateStatus(id: string, status: BookingStatus) {
    const booking = await this.prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        service: true,
        prestataire: { select: { nom: true, prenom: true } }
      }
    });

    // Notify the client
    const statusLabel = status === 'CONFIRMED' ? 'confirmé' : status === 'CANCELLED' ? 'annulé' : 'mis à jour';
    await this.notifications.create({
      userId: booking.clientId,
      title: `Rendez-vous ${statusLabel}`,
      message: `Votre rendez-vous pour ${booking.service.nom} avec ${booking.prestataire.prenom} ${booking.prestataire.nom} a été ${statusLabel}.`,
      type: `BOOKING_${status}`,
    });

    return booking;
  }
}
