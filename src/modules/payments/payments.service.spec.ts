import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import Stripe from 'stripe';

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

describe('PaymentsService', () => {
  it('creates a checkout session from a booking', async () => {
    const createSession = jest.fn().mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    });

    (Stripe as unknown as jest.Mock).mockImplementation(() => ({
      checkout: {
        sessions: {
          create: createSession,
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    }));

    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          clientId: 'client-1',
          totalAmount: 1500,
          service: { nom: 'Plomberie' },
          client: { email: 'client@example.com' },
        }),
      },
      booking: {
        update: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const notifications = {
      create: jest.fn(),
    } as unknown as NotificationsService;

    const config = {
      get: jest.fn((key: string) => ({
        STRIPE_SECRET_KEY: 'sk_test_123',
        STRIPE_CURRENCY: 'xof',
        FRONTEND_URL: 'http://localhost:5173',
      }[key])),
    } as unknown as ConfigService;

    const service = new PaymentsService(prisma, config, notifications);
    const result = await service.createCheckoutSession('booking-1', 'client-1');

    expect(createSession).toHaveBeenCalled();
    expect(result.url).toContain('checkout.stripe');
  });
});
