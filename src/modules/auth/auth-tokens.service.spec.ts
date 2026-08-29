import { AuthTokensService } from './auth-tokens.service';

type TokenRow = {
  id: string;
  userId: string;
  type: string;
  attempts: number;
  expiresAt: Date;
  usedAt: Date | null;
  tokenHash: string;
  createdAt: Date;
};

type ThrottleRow = {
  userId: string;
  type: string;
  failedCount: number;
  windowStart: Date;
  lockedUntil: Date | null;
};

/** Faux PrismaService en mémoire pour authToken + authThrottle. */
const makePrisma = () => {
  let tokens: TokenRow[] = [];
  let throttles: ThrottleRow[] = [];
  let seq = 0;

  return {
    _tokens: () => tokens,
    _throttles: () => throttles,
    authToken: {
      deleteMany: jest.fn(async ({ where }: any) => {
        tokens = tokens.filter(
          (r) => !(r.userId === where.userId && r.type === where.type && (where.usedAt === null ? r.usedAt === null : true)),
        );
        return { count: 0 };
      }),
      create: jest.fn(async ({ data }: any) => {
        const row: TokenRow = { id: `t${seq++}`, attempts: 0, usedAt: null, createdAt: new Date(Date.now() + seq), ...data };
        tokens.push(row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          tokens
            .filter((r) => r.userId === where.userId && r.type === where.type && r.usedAt === null)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null
        );
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = tokens.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return row;
      }),
      delete: jest.fn(async ({ where }: any) => {
        tokens = tokens.filter((r) => r.id !== where.id);
        return {};
      }),
    },
    authThrottle: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { userId, type } = where.userId_type;
        return throttles.find((t) => t.userId === userId && t.type === type) || null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const { userId, type } = where.userId_type;
        const existing = throttles.find((t) => t.userId === userId && t.type === type);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row: ThrottleRow = { failedCount: 0, windowStart: new Date(), lockedUntil: null, ...create };
        throttles.push(row);
        return row;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        throttles = throttles.filter((t) => !(t.userId === where.userId && t.type === where.type));
        return { count: 0 };
      }),
    },
  };
};

const wrongOf = (code: string) => (code === '000000' ? '111111' : '000000');

describe('AuthTokensService', () => {
  const uid = 'user-1';

  it('émet un code à 6 chiffres et le consomme une seule fois', async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);

    const { code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any);
    expect(code).toMatch(/^\d{6}$/);

    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, code)).resolves.toBeUndefined();
    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, code)).rejects.toThrow();
  });

  it('un code valide réinitialise le compteur de verrouillage', async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);
    let { code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any);
    await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code)).catch(() => {});
    ({ code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any));
    await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, code);
    expect(prisma._throttles()).toHaveLength(0);
  });

  it('supprime le code après 5 essais incorrects', async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);
    const { code } = await service.issueCode(uid, 'PASSWORD_RESET' as any);
    const wrong = wrongOf(code);

    for (let i = 0; i < 5; i++) {
      await expect(service.consumeCode(uid, 'PASSWORD_RESET' as any, wrong)).rejects.toThrow(/incorrect/i);
    }
    // code supprimé -> il faut en redemander un
    await expect(service.consumeCode(uid, 'PASSWORD_RESET' as any, code)).rejects.toThrow(/nouveau code/i);
  });

  it('verrouille ~1 h après 8 échecs cumulés (sur plusieurs codes)', async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);

    // 1er code : 5 échecs -> code supprimé, failedCount = 5
    let { code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any);
    for (let i = 0; i < 5; i++) {
      await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code)).catch(() => {});
    }
    // 2e code : 2 échecs (total 7) -> pas encore verrouillé
    ({ code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any));
    await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code)).catch(() => {});
    await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code)).catch(() => {});

    // 8e échec -> verrouillage
    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code))).rejects.toThrow(/réessayez dans/i);

    // verrouillé : même un bon code / une nouvelle demande est refusée
    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, '123456')).rejects.toThrow(/réessayez dans/i);
    await expect(service.issueCode(uid, 'EMAIL_VERIFICATION' as any)).rejects.toThrow(/réessayez dans/i);
    await expect(service.assertNotLocked(uid, 'EMAIL_VERIFICATION' as any)).rejects.toThrow(/réessayez dans/i);

    const lock = prisma._throttles()[0].lockedUntil!;
    const minutes = (lock.getTime() - Date.now()) / 60000;
    expect(minutes).toBeGreaterThan(55);
    expect(minutes).toBeLessThanOrEqual(61);
  });

  it("le verrouillage d'un type n'affecte pas l'autre type", async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);
    let { code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any);
    for (let i = 0; i < 5; i++) await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code)).catch(() => {});
    ({ code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any));
    for (let i = 0; i < 3; i++) await service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, wrongOf(code)).catch(() => {});

    // PASSWORD_RESET reste utilisable
    await expect(service.assertNotLocked(uid, 'PASSWORD_RESET' as any)).resolves.toBeUndefined();
  });

  it('rejette un code expiré', async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);
    const { code } = await service.issueCode(uid, 'EMAIL_VERIFICATION' as any);
    prisma._tokens()[0].expiresAt = new Date(Date.now() - 1000);
    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, code)).rejects.toThrow(/expiré/i);
  });

  it('rejette un format de code invalide', async () => {
    const prisma = makePrisma();
    const service = new AuthTokensService(prisma as any);
    await service.issueCode(uid, 'EMAIL_VERIFICATION' as any);
    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, 'abc')).rejects.toThrow();
    await expect(service.consumeCode(uid, 'EMAIL_VERIFICATION' as any, '12345')).rejects.toThrow();
  });
});
