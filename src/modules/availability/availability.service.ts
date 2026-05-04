import { Injectable } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const dayMap: DayOfWeek[] = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

@Injectable()
export class AvailabilityService {
  constructor(private prisma: PrismaService) {}

  async setAvailability(prestataireId: string, slots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isRecurring?: boolean;
  }>) {

    // Remove old recurring slots and replace
    await this.prisma.availability.deleteMany({
      where: { prestataireId, isRecurring: true },
    });

    return this.prisma.availability.createMany({
      data: slots.map(s => {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        return {
          prestataireId,
          dayOfWeek: dayMap[s.dayOfWeek % 7],
          startTime: new Date(`${dateStr}T${s.startTime}:00`),
          endTime: new Date(`${dateStr}T${s.endTime}:00`),
          isRecurring: s.isRecurring ?? true,
        };
      }),
    });
  }

  async getAvailability(prestataireId: string) {
    return this.prisma.availability.findMany({
      where: { prestataireId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }
}
