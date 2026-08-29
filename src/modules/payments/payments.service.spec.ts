import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: { sessions: { create: jest.fn(), retrieve: jest.fn() } },
    webhooks: { constructEvent: jest.fn() },
  }));
});

const makeConfig = (overrides: Record<string, string> = {}) =>
  ({
    get: jest.fn((key: string) => ({
      STRIPE_SECRET_KEY: 'sk_test_123',
      STRIPE_CURRENCY: 'xof',
      FRONTEND_URL: 'http://localhost:5173',
      KKIAPAY_PAYMENT_URL: 'https://checkout.kkiapay.me/',
      ...overrides,
    }[key])),
  } as unknown as ConfigService);

describe('PaymentsService', () => {
  it('génère un lien de paiement à partir d’une réservation', async () => {
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          clientId: 'client-1',
          totalAmount: 1500,
          service: { nom: 'Plomberie' },
          client: { id: 'client-1', email: 'client@example.com' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const notifications = { create: jest.fn() } as unknown as NotificationsService;

    const service = new PaymentsService(prisma, makeConfig(), notifications);
    const result = await service.createCheckoutSession('booking-1', 'client-1');

    expect(prisma.booking.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'booking-1' } }),
    );
    expect(result.provider).toBe('kkiapay');
    expect(result.reference).toBe('booking-booking-1');
    expect(result.url).toContain('checkout.kkiapay.me');
    expect(result.url).toContain('amount=1500');
    expect(result.url).toContain('reference=booking-booking-1');
  });

  it('utilise un montant par défaut si la réservation est introuvable', async () => {
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
    } as unknown as PrismaService;

    const service = new PaymentsService(
      prisma,
      makeConfig(),
      { create: jest.fn() } as unknown as NotificationsService,
    );
    const result = await service.createCheckoutSession('missing', 'client-1');

    expect(result.url).toContain('amount=1000');
    expect(result.provider).toBe('kkiapay');
  });
});
