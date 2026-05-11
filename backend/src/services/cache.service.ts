import { cacheRedis } from '../config/redis';
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
    const cached = await cacheRedis.get(fullKey);

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

    await cacheRedis.setex(fullKey, ttl, JSON.stringify(value));

    logger.debug('Cache set', { key: fullKey, ttl });
  } catch (error) {
    logger.error('Cache set error', { key, error });
  }
};

// Delete from cache
export const del = async (key: string, options?: CacheOptions): Promise<void> => {
  try {
    const fullKey = generateKey(options?.prefix || 'cache', key);
    await cacheRedis.del(fullKey);
    logger.debug('Cache deleted', { key: fullKey });
  } catch (error) {
    logger.error('Cache delete error', { key, error });
  }
};

// Delete by pattern
export const delByPattern = async (pattern: string): Promise<void> => {
  try {
    const keys = await cacheRedis.keys(`cache:${pattern}`);

    if (keys.length > 0) {
      await cacheRedis.del(...keys);
      logger.debug('Cache pattern deleted', { pattern, count: keys.length });
    }
  } catch (error) {
    logger.error('Cache pattern delete error', { pattern, error });
  }
};

// Clear all cache
export const clear = async (prefix?: string): Promise<void> => {
  try {
    const pattern = prefix ? `cache:${prefix}:*` : 'cache:*';
    const keys = await cacheRedis.keys(pattern);

    if (keys.length > 0) {
      await cacheRedis.del(...keys);
      logger.info('Cache cleared', { prefix, count: keys.length });
    }
  } catch (error) {
    logger.error('Cache clear error', { error });
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
    const result = await cacheRedis.incr(fullKey);

    if (options?.ttl) {
      await cacheRedis.expire(fullKey, options.ttl);
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
    return await cacheRedis.decr(fullKey);
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
    const fullKey = `ratelimit:${key}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Remove old requests outside window
    await cacheRedis.zremrangebyscore(fullKey, 0, windowStart);

    // Count current requests
    const count = await cacheRedis.zcard(fullKey);

    if (count >= maxRequests) {
      const oldestRequest = await cacheRedis.zrange(fullKey, 0, 0, 'WITHSCORES');
      const resetAt = oldestRequest.length > 1 ? parseInt(oldestRequest[1]) + windowSeconds : now + windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add current request
    await cacheRedis.zadd(fullKey, now, `${now}-${Math.random()}`);
    await cacheRedis.expire(fullKey, windowSeconds);

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
