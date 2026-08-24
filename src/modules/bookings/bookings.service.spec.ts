import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let prisma: any;
  let notifications: any;
  let service: BookingsService;

  beforeEach(() => {
    prisma = {
      booking: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    notifications = {
      create: jest.fn(),
    };

    service = new BookingsService(prisma, notifications);
  });

  it('should reject self-booking for the same provider', async () => {
    await expect(
      service.create({
        clientId: 'user-1',
        prestataireId: 'user-1',
        serviceId: 'service-1',
        date: new Date('2026-08-13T00:00:00.000Z'),
        startTime: new Date('2026-08-13T10:00:00.000Z'),
        endTime: new Date('2026-08-13T11:00:00.000Z'),
        totalAmount: 100,
        address: 'Paris',
      }),
    ).rejects.toThrow('Un prestataire ne peut pas réserver son propre service.');

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('should reject overlapping appointments for the same provider', async () => {
    prisma.booking.findFirst.mockResolvedValue({ id: 'existing-booking' });

    await expect(
      service.create({
        clientId: 'client-1',
        prestataireId: 'provider-1',
        serviceId: 'service-1',
        date: new Date('2026-08-13T00:00:00.000Z'),
        startTime: new Date('2026-08-13T10:00:00.000Z'),
        endTime: new Date('2026-08-13T11:00:00.000Z'),
        totalAmount: 100,
        address: 'Paris',
      }),
    ).rejects.toThrow('Ce créneau est déjà réservé pour ce prestataire.');

    expect(prisma.booking.create).not.toHaveBeenCalled();
  });

  it('should allow confirming a booking only if no overlapping active slot exists', async () => {
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-1',
      clientId: 'client-1',
      prestataireId: 'provider-1',
      status: 'PENDING',
      service: { nom: 'Massage' },
      prestataire: { nom: 'Dupont', prenom: 'Alice' },
      client: { id: 'client-1' },
      startTime: new Date('2026-08-13T10:00:00.000Z'),
      endTime: new Date('2026-08-13T11:00:00.000Z'),
    });
    prisma.booking.findFirst.mockResolvedValue(null);
    prisma.booking.update.mockResolvedValue({
      id: 'booking-1',
      status: BookingStatus.CONFIRMED,
      service: { nom: 'Massage' },
      prestataire: { nom: 'Dupont', prenom: 'Alice' },
    });

    await expect(service.updateStatus('booking-1', BookingStatus.CONFIRMED, 'provider-1')).resolves.toMatchObject({
      id: 'booking-1',
      status: BookingStatus.CONFIRMED,
    });
  });
});
