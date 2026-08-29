import { Logger } from '@nestjs/common';
import type { CacheModuleOptions } from '@nestjs/cache-manager';

const logger = new Logger('CacheConfig');

/**
 * Cache applicatif.
 * - Si REDIS_URL est défini : store Redis partagé (recommandé en production / multi-instances).
 * - Sinon : cache mémoire local (dev, ou instance unique).
 *
 * REDIS_URL exemples :
 *   redis://localhost:6379
 *   rediss://default:xxxxx@eu1-xxx.upstash.io:6379   (Upstash, TLS)
 */
export async function buildCacheOptions(): Promise<CacheModuleOptions> {
  const ttl = Number(process.env.CACHE_TTL_MS ?? 300_000); // 5 min

  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    logger.log('Cache : mémoire locale (REDIS_URL non défini).');
    return { ttl, max: 1000 };
  }

  try {
    const { createKeyv } = await import('@keyv/redis');
    const keyv = createKeyv(redisUrl, { namespace: 'edoteam' });
    keyv.on('error', (err: any) => {
      logger.warn(`Redis cache indisponible (${err?.message ?? err}) — bascule silencieuse sur la base.`);
    });
    logger.log('Cache : Redis connecté.');
    return { stores: [keyv], ttl };
  } catch (err) {
    logger.error(
      `Échec init Redis (${err instanceof Error ? err.message : String(err)}). Repli sur le cache mémoire.`,
    );
    return { ttl, max: 1000 };
  }
}
