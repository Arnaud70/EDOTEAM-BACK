import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  constructor() {
    super({
      log: ['error', 'warn'],
      datasourceUrl: process.env.DATABASE_URL,
    });
  }

  async onModuleInit() {
    // Try to connect without blocking startup
    this.connectWithRetry().catch(err => {
      this.logger.error('Failed to connect to database after retries', err);
    });
  }

  private async connectWithRetry(retries = 2, delay = 100) {
    while (retries > 0) {
      try {
        await this.$connect();
        await this.$executeRawUnsafe('SELECT 1');
        this.isConnected = true;
        this.logger.log('✅ Successfully connected to the database');
        return;
      } catch (err) {
        retries--;
        if (retries > 0) {
          this.logger.warn(
            `Database connection attempt failed. Retrying in ${delay}ms... (${retries} left)`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          this.logger.error(
            '❌ Database connection failed after retries. Continuing startup - DB-dependent routes will fail until database is available.',
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  isHealthy(): boolean {
    return this.isConnected;
  }
}
