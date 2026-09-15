import { BadRequestException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const prisma = {
    availability: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
  const service = new AvailabilityService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('rejects an end time before the start time', async () => {
    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '14:00', endTime: '12:00' },
      ]),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.availability.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects duplicate and overlapping slots on the same day', async () => {
    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '14:00' },
      ]),
    ).rejects.toThrow('chevauchent');

    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00' },
      ]),
    ).rejects.toThrow('existe déjà');
  });

  it('allows adjacent slots on the same day', async () => {
    prisma.availability.createMany.mockResolvedValue({ count: 2 });

    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '14:00', endTime: '18:00' },
      ]),
    ).resolves.toEqual({ count: 2 });
    expect(prisma.availability.deleteMany).toHaveBeenCalled();
  });
});
