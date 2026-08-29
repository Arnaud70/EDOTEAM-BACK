import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalKeepAlive = process.env.DB_KEEPALIVE_MS;

  beforeAll(() => {
    // Pas de ping périodique pendant les tests.
    process.env.DB_KEEPALIVE_MS = '0';
  });

  afterAll(() => {
    process.env.DB_KEEPALIVE_MS = originalKeepAlive;
  });

  it('should not block app startup when the database is unavailable', async () => {
    const service = new PrismaService();
    const connectSpy = jest.spyOn(service, '$connect').mockRejectedValue(new Error('db down'));
    const rawSpy = jest.spyOn(service as any, '$executeRawUnsafe').mockRejectedValue(new Error('db down'));

    // onModuleInit ne doit jamais rejeter ni bloquer le démarrage.
    await expect(service.onModuleInit()).resolves.toBeUndefined();

    // La tentative de connexion (avec retries) se poursuit en arrière-plan.
    await service.connectionAttempt;

    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(rawSpy).not.toHaveBeenCalled();

    await service.onModuleDestroy();
  });
});
