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
    const seen = new Set<string>();
    const normalizedSlots = slots.map((slot) => {
      if (!Number.isInteger(slot.dayOfWeek) || slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new BadRequestException('Le jour de la semaine est invalide.');
      }

      const start = this.minutesFromTime(slot.startTime);
      const end = this.minutesFromTime(slot.endTime);
      if (start === null || end === null || end <= start) {
        throw new BadRequestException('L’heure de fin doit être après l’heure de début.');
      }

      const key = `${slot.dayOfWeek}:${start}:${end}`;
      if (seen.has(key)) {
        throw new BadRequestException('Ce créneau de disponibilité existe déjà.');
      }
      seen.add(key);

      return { ...slot, start, end };
    });

    for (let index = 0; index < normalizedSlots.length; index += 1) {
      for (let otherIndex = index + 1; otherIndex < normalizedSlots.length; otherIndex += 1) {
        const current = normalizedSlots[index];
        const other = normalizedSlots[otherIndex];
        if (
          current.dayOfWeek === other.dayOfWeek &&
          current.start < other.end &&
          current.end > other.start
        ) {
          throw new BadRequestException('Deux créneaux du même jour se chevauchent.');
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

  private minutesFromTime(value: string): number | null {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
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
