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
  let service: AvailabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.availability.deleteMany.mockResolvedValue({ count: 0 });
    prisma.availability.createMany.mockResolvedValue({ count: 1 });
    service = new AvailabilityService(prisma);
  });

  it('refuses a slot whose end is before its start', async () => {
    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '12:00', endTime: '08:00' },
      ]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.availability.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses overlapping slots on the same day', async () => {
    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '10:00', endTime: '14:00' },
      ]),
    ).rejects.toThrow('chevauchent');
    expect(prisma.availability.deleteMany).not.toHaveBeenCalled();
  });

  it('allows adjacent slots on the same day', async () => {
    await expect(
      service.setAvailability('provider-1', [
        { dayOfWeek: 0, startTime: '08:00', endTime: '12:00' },
        { dayOfWeek: 0, startTime: '14:00', endTime: '18:00' },
      ]),
    ).resolves.toEqual({ count: 1 });
    expect(prisma.availability.createMany).toHaveBeenCalled();
  });
});
