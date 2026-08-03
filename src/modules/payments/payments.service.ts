import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly paymentProvider: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.paymentProvider = this.config.get<string>('PAYMENT_PROVIDER') || 'fedapay';
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY is not configured. Payment endpoints will be disabled.');
    }
    this.stripe = new Stripe(secretKey || 'sk_test_placeholder', {
      apiVersion: '2026-06-24.dahlia',
    });
  }

  async createCheckoutSession(bookingId: string, clientId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        client: { select: { id: true, email: true } },
      },
    });

    const paymentUrl = this.config.get<string>('KKIAPAY_PAYMENT_URL')
      || this.config.get<string>('LOCAL_PAYMENT_URL')
      || 'https://www.kkiapay.me/';

    const fallbackAmount = booking?.totalAmount ? Math.round(Number(booking.totalAmount)) : 1000;
    const fallbackReference = booking?.id ? `booking-${booking.id}` : `booking-${Date.now()}`;
    const fallbackDescription = booking?.service?.nom ? `Réservation - ${booking.service.nom}` : 'Réservation EDOTEAM';
    const callbackUrl = `${this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/bookings?payment=success`;
    const cancelUrl = `${this.config.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/bookings?payment=cancelled`;

    return {
      id: `kkiapay-${fallbackReference}`,
      url: `${paymentUrl}${paymentUrl.includes('?') ? '&' : '?'}amount=${fallbackAmount}&reference=${fallbackReference}&description=${encodeURIComponent(fallbackDescription)}&callback_url=${encodeURIComponent(callbackUrl)}&cancel_url=${encodeURIComponent(cancelUrl)}`,
      provider: 'kkiapay',
      reference: fallbackReference,
    };
  }

  async handleCheckoutSuccess(sessionId: string) {
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);
    const bookingId = session.metadata?.bookingId;
    if (!bookingId) {
      throw new Error('Aucune réservation associée à cette session Stripe.');
    }

    const booking = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
      include: {
        service: true,
        prestataire: { select: { id: true, nom: true, prenom: true } },
      },
    });

    await this.notifications.create({
      userId: booking.prestataire.id,
      title: 'Paiement confirmé',
      message: `Le paiement pour la réservation ${booking.service.nom} a été confirmé.`,
      type: 'PAYMENT_CONFIRMED',
    });

    return booking;
  }
}
