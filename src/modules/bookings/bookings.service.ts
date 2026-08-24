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
    interventionLatitude?: number;
    interventionLongitude?: number;
  }) {
    if (data.clientId === data.prestataireId) {
      throw new Error('Un prestataire ne peut pas réserver son propre service.');
    }

    if (data.startTime >= data.endTime) {
      throw new Error('La date de fin doit être après la date de début.');
    }

    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        prestataireId: data.prestataireId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        OR: [
          {
            AND: [
              { startTime: { lt: data.endTime } },
              { endTime: { gt: data.startTime } },
            ],
          },
        ],
      },
    });

    if (overlappingBooking) {
      throw new Error('Ce créneau est déjà réservé pour ce prestataire.');
    }

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
        interventionLatitude: data.interventionLatitude,
        interventionLongitude: data.interventionLongitude,
      },
      include: {
        service: true,
        client: { select: { id: true, nom: true, prenom: true, email: true } },
        prestataire: { select: { id: true, nom: true, prenom: true, email: true } },
      },
    });

    await this.notifications.create({
      userId: data.prestataireId,
      title: 'Nouveau rendez-vous !',
      message: `Vous avez une nouvelle demande de réservation pour le service ${booking.service.nom}.`,
      type: 'BOOKING_CREATED',
    });

    return booking;
  }

  async getBusySlots(prestataireId: string, date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    return this.prisma.booking.findMany({
      where: {
        prestataireId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startTime: { lt: dayEnd },
        endTime: { gt: dayStart },
      },
      select: {
        startTime: true,
        endTime: true,
        status: true,
      },
      orderBy: { startTime: 'asc' },
    });
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

  async updateStatus(id: string, status: BookingStatus, actingUserId?: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        service: true,
        prestataire: { select: { id: true, nom: true, prenom: true } },
        client: { select: { id: true, nom: true, prenom: true } },
      },
    });

    if (!booking) {
      throw new Error('Réservation introuvable.');
    }

    if (status === 'CONFIRMED') {
      const overlapping = await this.prisma.booking.findFirst({
        where: {
          prestataireId: booking.prestataireId,
          id: { not: id },
          status: { in: ['PENDING', 'CONFIRMED'] },
          AND: [
            { startTime: { lt: booking.endTime } },
            { endTime: { gt: booking.startTime } },
          ],
        },
      });

      if (overlapping) {
        throw new Error('Ce créneau est déjà pris par une autre réservation.');
      }
    }

    if (actingUserId && booking.prestataireId !== actingUserId && booking.clientId !== actingUserId) {
      throw new Error('Vous n’êtes pas autorisé à modifier cette réservation.');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: { status },
      include: {
        service: true,
        prestataire: { select: { nom: true, prenom: true } },
      },
    });

    const statusLabel = status === 'CONFIRMED' ? 'confirmé' : status === 'CANCELLED' ? 'annulé' : 'mis à jour';
    await this.notifications.create({
      userId: booking.clientId,
      title: `Rendez-vous ${statusLabel}`,
      message: `Votre rendez-vous pour ${updatedBooking.service.nom} avec ${updatedBooking.prestataire.prenom} ${updatedBooking.prestataire.nom} a été ${statusLabel}.`,
      type: `BOOKING_${status}`,
    });

    return updatedBooking;
  }
}
