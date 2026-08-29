import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomInt } from 'crypto';
import { AuthTokenType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// Durée de validité du code OTP, en secondes. Configurable via OTP_TTL_SECONDS.
// Défaut 120 s (2 min) : compromis entre sécurité et délai de livraison de l'email.
const CODE_TTL_SECONDS = Math.min(600, Math.max(30, Number(process.env.OTP_TTL_SECONDS ?? 120)));

// Nombre d'essais autorisés sur un même code avant de devoir en redemander un.
const MAX_ATTEMPTS_PER_CODE = 5;

// Verrouillage : au-delà de MAX_FAILED_ATTEMPTS échecs cumulés dans la fenêtre,
// on bloque l'utilisateur pendant LOCK_DURATION_MS.
const MAX_FAILED_ATTEMPTS = Math.max(3, Number(process.env.OTP_MAX_FAILED_ATTEMPTS ?? 8));
const LOCK_DURATION_MS = Math.max(60_000, Number(process.env.OTP_LOCK_MINUTES ?? 60) * 60_000);
const FAIL_WINDOW_MS = 30 * 60_000; // fenêtre glissante d'accumulation des échecs

@Injectable()
export class AuthTokensService {
  private readonly logger = new Logger(AuthTokensService.name);

  constructor(private prisma: PrismaService) {}

  private hash(code: string, userId: string): string {
    return createHash('sha256').update(`${userId}:${code}`).digest('hex');
  }

  private smtpConfigured(): boolean {
    return !!process.env.SMTP_HOST && !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
  }

  private lockError(lockedUntil: Date): HttpException {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    return new HttpException(
      {
        code: 'TOO_MANY_ATTEMPTS',
        lockedUntil: lockedUntil.toISOString(),
        message: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Vérifie qu'un utilisateur n'est pas verrouillé pour ce type de code.
   * À appeler avant d'émettre ou de consommer un code.
   */
  async assertNotLocked(userId: string, type: AuthTokenType): Promise<void> {
    const throttle = await this.prisma.authThrottle.findUnique({
      where: { userId_type: { userId, type } },
    });
    if (throttle?.lockedUntil && throttle.lockedUntil > new Date()) {
      throw this.lockError(throttle.lockedUntil);
    }
  }

  /** Enregistre un échec de saisie. Verrouille 1 h si le seuil est atteint. */
  private async registerFailure(userId: string, type: AuthTokenType): Promise<Date | null> {
    const now = new Date();
    const existing = await this.prisma.authThrottle.findUnique({
      where: { userId_type: { userId, type } },
    });

    // Fenêtre expirée -> on repart de zéro.
    const windowExpired = !existing || now.getTime() - existing.windowStart.getTime() > FAIL_WINDOW_MS;
    const failedCount = windowExpired ? 1 : existing.failedCount + 1;

    if (failedCount >= MAX_FAILED_ATTEMPTS) {
      const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MS);
      await this.prisma.authThrottle.upsert({
        where: { userId_type: { userId, type } },
        create: { userId, type, failedCount: 0, windowStart: now, lockedUntil },
        update: { failedCount: 0, windowStart: now, lockedUntil },
      });
      this.logger.warn(`Verrouillage ${type} pour ${userId} jusqu'à ${lockedUntil.toISOString()}`);
      return lockedUntil;
    }

    await this.prisma.authThrottle.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, failedCount, windowStart: now },
      update: windowExpired
        ? { failedCount: 1, windowStart: now, lockedUntil: null }
        : { failedCount },
    });
    return null;
  }

  private async clearThrottle(userId: string, type: AuthTokenType): Promise<void> {
    await this.prisma.authThrottle.deleteMany({ where: { userId, type } });
  }

  /**
   * Génère un code OTP à 6 chiffres, invalide les précédents du même type
   * et renvoie le code en clair (à envoyer par email uniquement).
   */
  async issueCode(userId: string, type: AuthTokenType): Promise<{ code: string; expiresAt: Date }> {
    await this.assertNotLocked(userId, type);
    await this.prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const expiresAt = new Date(Date.now() + CODE_TTL_SECONDS * 1000);

    await this.prisma.authToken.create({
      data: {
        userId,
        type,
        tokenHash: this.hash(code, userId),
        expiresAt,
      },
    });

    // Hors production : on affiche le code dans les logs pour pouvoir tester
    // même si l'email tarde. En production (NODE_ENV=production) : jamais.
    if (process.env.NODE_ENV !== 'production' || !this.smtpConfigured()) {
      this.logger.warn(`[DEV] Code ${type} pour ${userId} : ${code} (valide ${CODE_TTL_SECONDS}s)`);
    }

    return { code, expiresAt };
  }

  /**
   * Vérifie un code OTP.
   * - Consomme le code si valide (et réinitialise le compteur de verrouillage).
   * - Sinon incrémente les compteurs ; supprime le code après MAX_ATTEMPTS_PER_CODE,
   *   et verrouille l'utilisateur 1 h après MAX_FAILED_ATTEMPTS échecs cumulés.
   */
  async consumeCode(userId: string, type: AuthTokenType, code: string): Promise<void> {
    await this.assertNotLocked(userId, type);

    const cleaned = (code || '').trim();
    if (!/^\d{6}$/.test(cleaned)) {
      throw new BadRequestException('Code invalide.');
    }

    const record = await this.prisma.authToken.findFirst({
      where: { userId, type, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException('Aucun code en attente. Demandez un nouveau code.');
    }

    if (record.expiresAt < new Date()) {
      await this.prisma.authToken.delete({ where: { id: record.id } });
      throw new BadRequestException('Le code a expiré. Demandez un nouveau code.');
    }

    if (record.tokenHash !== this.hash(cleaned, userId)) {
      const attempts = record.attempts + 1;
      if (attempts >= MAX_ATTEMPTS_PER_CODE) {
        await this.prisma.authToken.delete({ where: { id: record.id } });
      } else {
        await this.prisma.authToken.update({ where: { id: record.id }, data: { attempts } });
      }

      const lockedUntil = await this.registerFailure(userId, type);
      if (lockedUntil) {
        throw this.lockError(lockedUntil);
      }

      const remainingOnCode = Math.max(0, MAX_ATTEMPTS_PER_CODE - attempts);
      throw new BadRequestException(
        remainingOnCode > 0
          ? `Code incorrect. Il vous reste ${remainingOnCode} essai(s) sur ce code.`
          : 'Code incorrect. Demandez un nouveau code.',
      );
    }

    await this.prisma.authToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    await this.clearThrottle(userId, type);
  }

  get ttlSeconds(): number {
    return CODE_TTL_SECONDS;
  }
}
