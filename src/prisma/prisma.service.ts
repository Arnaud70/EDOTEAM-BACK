import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: ['error', 'warn'],
      datasourceUrl: process.env.DATABASE_URL + '&connection_limit=2&pool_timeout=0',
    });
  }

  async onModuleInit() {
    let retries = 5;
    while (retries > 0) {
      try {
        await this.$connect();
        this.logger.log('Successfully connected to the database');
        break;
      } catch (err) {
        retries--;
        this.logger.error(`Failed to connect to the database. Retries left: ${retries}`, err.stack);
        if (retries === 0) throw err;
        // Wait for 2 seconds before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
