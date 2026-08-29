import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/**
 * Neon (Postgres serverless) ferme les connexions inactives et met le compute en veille
 * après quelques minutes. Résultat : "Error in PostgreSQL connection: Error { kind: Closed }".
 *
 * Ce service :
 *  - émet les logs Prisma en événements (pour ne pas polluer la sortie et éviter tout crash) ;
 *  - envoie un "ping" périodique (SELECT 1) pour garder la connexion vivante et le compute réveillé ;
 *  - se reconnecte automatiquement si la connexion a été coupée.
 */
@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;
  private keepAliveTimer?: NodeJS.Timeout;
  /** Résout quand la première tentative de connexion (avec retries) est terminée. Utile pour les tests. */
  connectionAttempt: Promise<void> = Promise.resolve();

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
      datasourceUrl: process.env.DATABASE_URL,
    });

    // On capture les erreurs du moteur Prisma pour qu'elles ne remontent jamais
    // comme "unhandledRejection" et ne coupent pas le serveur.
    this.$on('error', (event) => {
      const message = event.message || '';
      if (/kind:\s*Closed|Connection\s*reset|terminating connection|server closed the connection/i.test(message)) {
        this.isConnected = false;
        this.logger.warn(
          'Connexion PostgreSQL fermée par le serveur (veille Neon ?). Reconnexion au prochain appel / ping.',
        );
        return;
      }
      this.logger.error(`Prisma: ${message}`);
    });

    this.$on('warn', (event) => this.logger.warn(`Prisma: ${event.message}`));
  }

  async onModuleInit() {
    // Connexion non bloquante : le serveur démarre même si la base est momentanément indisponible.
    this.connectionAttempt = this.connectWithRetry().catch((err) => {
      this.logger.error('Échec de connexion à la base après plusieurs tentatives', err);
    });

    this.startKeepAlive();
  }

  private async connectWithRetry(retries = 2, delay = 100) {
    while (retries > 0) {
      try {
        await this.$connect();
        await this.$executeRawUnsafe('SELECT 1');
        this.isConnected = true;
        this.logger.log('✅ Connexion à la base de données établie');
        return;
      } catch (err) {
        retries--;
        if (retries > 0) {
          this.logger.warn(
            `Tentative de connexion échouée. Nouvel essai dans ${delay}ms... (${retries} restante(s))`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.error(
            '❌ Connexion à la base impossible pour le moment. Le serveur continue ; les routes utilisant la base échoueront jusqu\'au rétablissement.',
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }
  }

  /**
   * Ping périodique pour empêcher Neon de fermer la connexion / mettre le compute en veille.
   * Désactivable avec DB_KEEPALIVE_MS=0.
   */
  private startKeepAlive() {
    const intervalMs = Number(process.env.DB_KEEPALIVE_MS ?? 240_000); // 4 min par défaut
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return;
    }

    this.keepAliveTimer = setInterval(() => {
      this.$queryRawUnsafe('SELECT 1')
        .then(() => {
          if (!this.isConnected) {
            this.isConnected = true;
            this.logger.log('✅ Connexion à la base rétablie');
          }
        })
        .catch(async (err) => {
          this.isConnected = false;
          this.logger.warn(`Ping base échoué (${err?.message ?? err}). Tentative de reconnexion...`);
          try {
            await this.$disconnect();
          } catch {
            /* ignore */
          }
          try {
            await this.$connect();
            this.isConnected = true;
            this.logger.log('✅ Reconnexion à la base réussie');
          } catch (reconnectErr) {
            this.logger.warn(
              `Reconnexion impossible pour l'instant : ${
                reconnectErr instanceof Error ? reconnectErr.message : String(reconnectErr)
              }`,
            );
          }
        });
    }, intervalMs);

    // Ne pas empêcher l'arrêt propre du process.
    this.keepAliveTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
    }
    await this.$disconnect().catch(() => undefined);
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}
