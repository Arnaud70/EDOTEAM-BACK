import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('should not block app startup when the database is unavailable', async () => {
    const service = new PrismaService();
    const connectSpy = jest.spyOn(service, '$connect').mockRejectedValue(new Error('db down'));
    const rawSpy = jest.spyOn(service as any, '$executeRawUnsafe').mockRejectedValue(new Error('db down'));

    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(connectSpy).toHaveBeenCalledTimes(2);
    expect(rawSpy).not.toHaveBeenCalled();
  });
});
