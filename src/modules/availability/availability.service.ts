import { BadRequestException, Injectable } from '@nestjs/common';
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

  async setAvailability(
    prestataireId: string,
    slots: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isRecurring?: boolean;
    }>,
  ) {
    const normalizedSlots = slots.map((slot) => ({
      ...slot,
      dayOfWeek: Number(slot.dayOfWeek),
      startTime: slot.startTime?.trim(),
      endTime: slot.endTime?.trim(),
    }));

    for (const slot of normalizedSlots) {
      if (
        !Number.isInteger(slot.dayOfWeek) ||
        slot.dayOfWeek < 0 ||
        slot.dayOfWeek > 6 ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startTime) ||
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endTime)
      ) {
        throw new BadRequestException(
          'Chaque disponibilité doit contenir un jour et des heures valides.',
        );
      }

      if (this.toMinutes(slot.endTime) <= this.toMinutes(slot.startTime)) {
        throw new BadRequestException(
          "L'heure de fin doit être après l'heure de début.",
        );
      }
    }

    for (let index = 0; index < normalizedSlots.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < normalizedSlots.length; otherIndex += 1) {
        const current = normalizedSlots[index];
        const other = normalizedSlots[otherIndex];
        if (
          current.dayOfWeek === other.dayOfWeek &&
          this.toMinutes(current.startTime) < this.toMinutes(other.endTime) &&
          this.toMinutes(current.endTime) > this.toMinutes(other.startTime)
        ) {
          throw new BadRequestException(
            'Deux disponibilités du même jour se chevauchent.',
          );
        }
      }
    }

    // Remove old recurring slots and replace
    await this.prisma.availability.deleteMany({
      where: { prestataireId, isRecurring: true },
    });

    return this.prisma.availability.createMany({
      data: normalizedSlots.map((s) => {
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

  private toMinutes(value: string): number {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async getAvailability(prestataireId: string) {
    return this.prisma.availability.findMany({
      where: { prestataireId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
  }
}
