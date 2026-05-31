import { cache } from '../config/redis';
import logger from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

const DEFAULT_TTL = 300; // 5 minutes

// Cache keys
export const CACHE_KEYS = {
  USER: 'user',
  PROVIDER: 'provider',
  SERVICE: 'service',
  BOOKING: 'booking',
  CATEGORY: 'category',
  SEARCH: 'search',
  ANALYTICS: 'analytics',
} as const;

// Generate cache key
const generateKey = (prefix: string, key: string): string => {
  return `${prefix}:${key}`;
};

// Get from cache
export const get = async <T>(key: string, options?: CacheOptions): Promise<T | null> => {
  try {
    const fullKey = generateKey(options?.prefix || 'cache', key);
    const cached = await cache.get(fullKey);

    if (cached) {
      logger.debug('Cache hit', { key: fullKey });
      return JSON.parse(cached) as T;
    }

    logger.debug('Cache miss', { key: fullKey });
    return null;
  } catch (error) {
    logger.error('Cache get error', { key, error });
    return null;
  }
};

// Set in cache
export const set = async <T>(
  key: string,
  value: T,
  options?: CacheOptions
): Promise<void> => {
  try {
    const fullKey = generateKey(options?.prefix || 'cache', key);
    const ttl = options?.ttl || DEFAULT_TTL;

    await cache.set(fullKey, JSON.stringify(value), ttl);

    logger.debug('Cache set', { key: fullKey, ttl });
  } catch (error) {
    logger.error('Cache set error', { key, error });
  }
};

// Delete from cache
export const del = async (key: string, options?: CacheOptions): Promise<void> => {
  try {
    const fullKey = generateKey(options?.prefix || 'cache', key);
    await cache.del(fullKey);
    logger.debug('Cache deleted', { key: fullKey });
  } catch (error) {
    logger.error('Cache delete error', { key, error });
  }
};

// Delete by pattern using SCAN (O(1) per iteration, non-blocking)
export const delByPattern = async (pattern: string): Promise<number> => {
  try {
    const client = cache.client;
    if (!client) return 0;

    let cursor = 0;
    let deletedCount = 0;
    const searchPattern = `cache:${pattern}`;

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        searchPattern,
        'COUNT',
        100
      );
      cursor = parseInt(nextCursor, 10);

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);

    if (deletedCount > 0) {
      logger.debug('Cache pattern deleted', { pattern, count: deletedCount });
    }
    return deletedCount;
  } catch (error) {
    logger.error('Cache pattern delete error', { pattern, error });
    return 0;
  }
};

// Clear all cache using SCAN (O(1) per iteration, non-blocking)
export const clear = async (prefix?: string): Promise<number> => {
  try {
    const client = cache.client;
    if (!client) return 0;

    let cursor = 0;
    let deletedCount = 0;
    const searchPattern = prefix ? `cache:${prefix}:*` : 'cache:*';

    do {
      const [nextCursor, keys] = await client.scan(
        cursor,
        'MATCH',
        searchPattern,
        'COUNT',
        100
      );
      cursor = parseInt(nextCursor, 10);

      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== 0);

    if (deletedCount > 0) {
      logger.info('Cache cleared', { prefix, count: deletedCount });
    }
    return deletedCount;
  } catch (error) {
    logger.error('Cache clear error', { error });
    return 0;
  }
};

// Get or set (cache-aside pattern)
export const getOrSet = async <T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: CacheOptions
): Promise<T> => {
  const cached = await get<T>(key, options);

  if (cached !== null) {
    return cached;
  }

  const value = await fetchFn();
  await set(key, value, options);

  return value;
};

// Increment counter
export const incr = async (key: string, options?: CacheOptions): Promise<number> => {
  try {
    const fullKey = generateKey(options?.prefix || 'cache', key);
    const client = cache.client;
    if (!client) return 0;
    const result = await client.incr(fullKey);

    if (options?.ttl) {
      await client.expire(fullKey, options.ttl);
    }

    return result;
  } catch (error) {
    logger.error('Cache incr error', { key, error });
    return 0;
  }
};

// Decrement counter
export const decr = async (key: string): Promise<number> => {
  try {
    const fullKey = generateKey('cache', key);
    const client = cache.client;
    if (!client) return 0;
    return await client.decr(fullKey);
  } catch (error) {
    logger.error('Cache decr error', { key, error });
    return 0;
  }
};

// Rate limiting with Redis
export const rateLimit = async (
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> => {
  try {
    const client = cache.client;
    if (!client) {
      return { allowed: true, remaining: maxRequests, resetAt: 0 };
    }

    const fullKey = `ratelimit:${key}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Remove old requests outside window
    await client.zremrangebyscore(fullKey, 0, windowStart);

    // Count current requests
    const count = await client.zcard(fullKey);

    if (count >= maxRequests) {
      const oldestRequest = await client.zrange(fullKey, 0, 0, 'WITHSCORES');
      const resetAt = oldestRequest.length > 1 ? parseInt(oldestRequest[1]) + windowSeconds : now + windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current request
    await client.zadd(fullKey, now, `${now}-${Math.random()}`);
    await client.expire(fullKey, windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - count - 1,
      resetAt: now + windowSeconds,
    };
  } catch (error) {
    logger.error('Rate limit error', { key, error });
    return { allowed: true, remaining: maxRequests, resetAt: 0 };
  }
};

// Session store
export const session = {
  async set<T>(sessionId: string, data: T, ttl: number = 86400): Promise<void> {
    await set(sessionId, data, { prefix: 'session', ttl });
  },

  async get<T>(sessionId: string): Promise<T | null> {
    return get<T>(sessionId, { prefix: 'session' });
  },

  async delete(sessionId: string): Promise<void> {
    await del(sessionId, { prefix: 'session' });
  },
};

export default {
  CACHE_KEYS,
  get,
  set,
  del,
  delByPattern,
  clear,
  getOrSet,
  incr,
  decr,
  rateLimit,
  session,
};
