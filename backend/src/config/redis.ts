import Redis from 'ioredis';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Redis configuration - optional in development
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI;
let redisAvailable = false;

const refreshRedisAvailability = (): void => {
  redisAvailable = [redis, cacheRedis, queueRedis, metricsRedis].some(
    (client) => client?.status === 'ready'
  );
};

// In-memory cache fallback when Redis is unavailable
interface MemoryCacheEntry {
  value: string;
  expiry: number;
}
const memoryCache = new Map<string, MemoryCacheEntry>();

// Periodic cleanup of expired memory cache entries (every minute)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, cached] of memoryCache) {
    if (cached.expiry <= now) {
      memoryCache.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Memory cache cleanup: removed ${cleaned} expired entries`, {
      action: 'MEMORY_CACHE_CLEANUP',
      remaining: memoryCache.size,
    });
  }
}, 60000);

// Analytics cache TTL configuration (30 minutes for better cache hit rates)
export const ANALYTICS_CACHE_TTL = 1800; // 30 minutes

// Cache warmup data structure
interface WarmupData {
  key: string;
  value: string;
  ttl: number;
}
const warmupQueue: WarmupData[] = [];
let warmupInProgress = false;

let redis: Redis | null = null;
let cacheRedis: Redis | null = null;
let queueRedis: Redis | null = null;
let metricsRedis: Redis | null = null;

// Connection retry logic for failover support
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 5000;

const connectRedis = async (): Promise<void> => {
  if (REDIS_URL) {
    redis = createRedisClient('main');
    cacheRedis = createRedisClient('cache');
    queueRedis = createRedisClient('queue');
    metricsRedis = createRedisClient('metrics');
  }
};

const scheduleReconnect = (): void => {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.error('Max Redis reconnection attempts reached, giving up');
    return;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY * reconnectAttempts;

  logger.info(`Scheduling Redis reconnection attempt ${reconnectAttempts} in ${delay}ms`);

  setTimeout(async () => {
    try {
      await connectRedis();
      reconnectAttempts = 0;
      logger.info('Redis reconnection successful');
    } catch (error) {
      logger.error('Redis reconnection failed', { error });
      scheduleReconnect();
    }
  }, delay);
};

const createRedisClient = (name: string): Redis | null => {
  if (!REDIS_URL) {
    logger.warn(`Redis not configured, ${name} client will be null`, {
      name,
      action: 'REDIS_DISABLED',
    });
    return null;
  }

  const connectionOptions = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 10) {
        logger.error(`Redis connection failed after 10 retries for ${name}`);
        return null;
      }
      return Math.min(times * 100, 3000);
    },
    reconnectOnError: (err: Error) => {
      const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
      return targetErrors.some(targetError => err.message.includes(targetError));
    },
  };

  try {
    const client = new Redis(REDIS_URL, {
      ...connectionOptions,
      name,
    });

    client.on('ready', () => {
      logger.info(`Redis client connected: ${name}`, {
        name,
        action: 'REDIS_CONNECTED',
      });
      refreshRedisAvailability();
    });

    client.on('error', (err) => {
      logger.error(`Redis client error: ${name}`, {
        name,
        error: err.message,
        action: 'REDIS_ERROR',
      });
    });

    client.on('close', () => {
      logger.warn(`Redis client closed: ${name}`, {
        name,
        action: 'REDIS_CLOSED',
      });
      refreshRedisAvailability();
    });

    return client;
  } catch (error) {
    logger.error(`Failed to create Redis client: ${name}`, {
      name,
      error: (error as Error).message,
    });
    return null;
  }
};

// Create Redis clients only if URL is provided
if (REDIS_URL) {
  redis = createRedisClient('main');
  cacheRedis = createRedisClient('cache');
  queueRedis = createRedisClient('queue');
  metricsRedis = createRedisClient('metrics');

  // Schedule reconnection on close
  const scheduleOnClose = (client: Redis | null, name: string): void => {
    if (client) {
      client.on('close', () => {
        logger.warn(`Redis client closed: ${name}, scheduling reconnect`, {
          name,
          action: 'REDIS_CLOSED_SCHEDULE_RECONNECT',
        });
        scheduleReconnect();
      });
    }
  };
  scheduleOnClose(redis, 'main');
  scheduleOnClose(cacheRedis, 'cache');
  scheduleOnClose(queueRedis, 'queue');
  scheduleOnClose(metricsRedis, 'metrics');
} else {
  logger.warn('Redis is not configured. Caching will be disabled.', {
    action: 'REDIS_NOT_CONFIGURED',
  });
}

// Health check
export const checkRedisConnection = async (): Promise<boolean> => {
  if (!redis || !redisAvailable) {
    return false;
  }
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
};

// Enhanced Redis health check with detailed status
export const checkRedisHealth = async (): Promise<{ healthy: boolean; latencyMs?: number; error?: string }> => {
  if (!cacheRedis) {
    return { healthy: false, error: 'Redis not connected' };
  }

  const start = Date.now();
  try {
    await cacheRedis.ping();
    return { healthy: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { healthy: false, error: (error as Error).message };
  }
};

// Export clients (may be null if Redis not configured)
export { redis, cacheRedis, queueRedis, metricsRedis };

// Helper to check if Redis is available (sync — may be stale briefly during reconnect)
export const isRedisAvailable = (): boolean => {
  if (redisAvailable) return true;
  return cacheRedis?.status === 'ready';
};

/** Authoritative check for slot locks — pings cache Redis when status is uncertain */
export async function isCacheRedisReady(): Promise<boolean> {
  if (!cacheRedis) return false;
  if (cacheRedis.status === 'ready') return true;
  try {
    return (await cacheRedis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

// ============================================
// Session Store with In-Memory Fallback
// ============================================

interface SessionData {
  [key: string]: any;
  expiresAt: number;
}

const sessionMemoryStore = new Map<string, SessionData>();

// Session store that falls back to memory when Redis is unavailable
export const sessionStore = {
  /**
   * Get session data by session ID
   */
  async get(sessionId: string): Promise<SessionData | null> {
    // Try Redis first
    if (redis && redisAvailable) {
      try {
        const data = await redis.get(`session:${sessionId}`);
        if (data) {
          const parsed = JSON.parse(data) as SessionData;
          // Check expiry
          if (parsed.expiresAt > Date.now()) {
            return parsed;
          }
          // Expired, delete it
          await redis.del(`session:${sessionId}`);
        }
      } catch (err) {
        logger.warn('Redis session get failed, falling back to memory', {
          sessionId,
          action: 'REDIS_SESSION_GET_FAILED',
          error: (err as Error).message,
        });
      }
    }

    // Fallback to memory store
    const memorySession = sessionMemoryStore.get(sessionId);
    if (memorySession) {
      if (memorySession.expiresAt > Date.now()) {
        return memorySession;
      }
      sessionMemoryStore.delete(sessionId);
    }

    return null;
  },

  /**
   * Set session data
   */
  async set(sessionId: string, data: SessionData, ttlSeconds: number = 86400): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    const sessionData = { ...data, expiresAt };

    // Try Redis first
    if (redis && redisAvailable) {
      try {
        await redis.setex(`session:${sessionId}`, ttlSeconds, JSON.stringify(sessionData));
        // Remove from memory fallback if it exists
        sessionMemoryStore.delete(sessionId);
        return;
      } catch (err) {
        logger.warn('Redis session set failed, using memory only', {
          sessionId,
          action: 'REDIS_SESSION_SET_FAILED',
          error: (err as Error).message,
        });
      }
    }

    // Fallback to memory store
    sessionMemoryStore.set(sessionId, sessionData);
  },

  /**
   * Delete a session
   */
  async destroy(sessionId: string): Promise<void> {
    // Delete from Redis
    if (redis && redisAvailable) {
      try {
        await redis.del(`session:${sessionId}`);
      } catch (err) {
        logger.warn('Redis session destroy failed', {
          sessionId,
          action: 'REDIS_SESSION_DESTROY_FAILED',
          error: (err as Error).message,
        });
      }
    }

    // Delete from memory store
    sessionMemoryStore.delete(sessionId);
  },

  /**
   * Touch session to extend expiry (used for sliding expiration)
   */
  async touch(sessionId: string, ttlSeconds: number = 86400): Promise<void> {
    const session = await this.get(sessionId);
    if (session) {
      await this.set(sessionId, session, ttlSeconds);
    }
  },

  /**
   * Get session count (for monitoring)
   */
  getStats(): { redisAvailable: boolean; memoryCount: number } {
    return {
      redisAvailable,
      memoryCount: sessionMemoryStore.size,
    };
  },

  /**
   * Cleanup expired sessions from memory store
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [sessionId, session] of sessionMemoryStore) {
      if (session.expiresAt <= now) {
        sessionMemoryStore.delete(sessionId);
        cleaned++;
      }
    }
    return cleaned;
  },
};

// Periodic cleanup of expired memory sessions (every 5 minutes)
setInterval(() => {
  const cleaned = sessionStore.cleanup();
  if (cleaned > 0) {
    logger.debug(`Session memory store cleanup: removed ${cleaned} expired sessions`);
  }
}, 300000);

// Safe cache wrapper that handles null cacheRedis with in-memory fallback
export const cache = {
  async get(key: string): Promise<string | null> {
    // Try Redis first
    if (cacheRedis && redisAvailable) {
      try {
        const result = await cacheRedis.get(key);
        if (result) return result;
      } catch (err) {
        logger.warn(`Redis get failed for key ${key}, falling back to memory`, {
          key,
          action: 'REDIS_GET_FAILED',
          error: (err as Error).message,
        });
      }
    }
    // Fallback to memory cache
    const cached = memoryCache.get(key);
    if (cached) {
      if (cached.expiry > Date.now()) {
        return cached.value;
      }
      // Expired entry, remove it
      memoryCache.delete(key);
    }
    return null;
  },
  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiryTime = ttl ? Date.now() + ttl * 1000 : Infinity;

    // Try Redis first
    if (cacheRedis && redisAvailable) {
      try {
        if (ttl) {
          await cacheRedis.setex(key, ttl, value);
        } else {
          await cacheRedis.set(key, value);
        }
      } catch (err) {
        logger.warn(`Redis set failed for key ${key}, using memory only`, {
          key,
          action: 'REDIS_SET_FAILED',
          error: (err as Error).message,
        });
      }
    }

    // Always update memory fallback
    memoryCache.set(key, { value, expiry: expiryTime });
  },
  async del(...keys: string[]): Promise<void> {
    // Delete from Redis
    if (cacheRedis && redisAvailable && keys.length > 0) {
      try {
        await cacheRedis.del(...keys);
      } catch (err) {
        logger.warn(`Redis del failed for keys ${keys.join(',')}`, {
          keys,
          action: 'REDIS_DEL_FAILED',
          error: (err as Error).message,
        });
      }
    }
    // Delete from memory cache
    for (const key of keys) {
      memoryCache.delete(key);
    }
  },
  async keys(pattern: string): Promise<string[]> {
    // FIX: Use SCAN instead of KEYS command to avoid blocking Redis
    // KEYS blocks the entire Redis instance and is O(N) - dangerous in production
    if (cacheRedis && redisAvailable) {
      try {
        const matchingKeys: string[] = [];
        let cursor = 0;

        do {
          const [nextCursor, keys] = await cacheRedis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100
          );
          cursor = parseInt(nextCursor, 10);
          matchingKeys.push(...keys);
        } while (cursor !== 0);

        return matchingKeys;
      } catch (err) {
        logger.warn(`Redis SCAN failed for pattern ${pattern}, falling back to memory`, {
          pattern,
          action: 'REDIS_SCAN_FAILED',
          error: (err as Error).message,
        });
      }
    }
    // Fallback to memory cache pattern matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    const matchingKeys: string[] = [];
    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }
    return matchingKeys;
  },

  // Bulk get for efficiency
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (cacheRedis && redisAvailable) {
      try {
        return await cacheRedis.mget(keys);
      } catch (error) {
        logger.warn('Redis mget failed, using memory fallback', { error });
      }
    }

    return keys.map(key => {
      const entry = memoryCache.get(key);
      if (entry && entry.expiry > Date.now()) {
        return entry.value;
      }
      memoryCache.delete(key);
      return null;
    });
  },

  // Get or set pattern - fetch from cache or execute factory
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        // Invalid JSON, fetch fresh
      }
    }

    const value = await factory();
    await this.set(key, JSON.stringify(value), ttl);
    return value;
  },

  // Health status check
  isHealthy(): boolean {
    return cacheRedis !== null && redisAvailable;
  },

  // Connection status info
  getConnectionInfo(): { connected: boolean; inMemoryEntries: number } {
    return {
      connected: cacheRedis !== null && redisAvailable,
      inMemoryEntries: memoryCache.size,
    };
  },

  get client(): Redis | null {
    return cacheRedis;
  }
};

// Export getOrSet as standalone function for convenience
export const getOrSet = async <T>(
  key: string,
  factory: () => Promise<T>,
  ttl: number = 3600
): Promise<T> => {
  return cache.getOrSet(key, factory, ttl);
};

// Cache warmup functionality for frequently accessed data
export const cacheWarmup = {
  /**
   * Queue data to be warmed up after Redis connection is established
   */
  queue(key: string, value: string, ttl?: number): void {
    warmupQueue.push({ key, value, ttl: ttl || 3600 });
    logger.debug(`Cache warmup queued: ${key}`, {
      key,
      queueSize: warmupQueue.length,
      action: 'CACHE_WARMUP_QUEUED',
    });
  },

  /**
   * Execute warmup of queued data - call after Redis is connected
   */
  async execute(): Promise<{ warmed: number; failed: number }> {
    if (warmupInProgress) {
      logger.warn('Cache warmup already in progress', { action: 'CACHE_WARMUP_SKIPPED' });
      return { warmed: 0, failed: 0 };
    }

    if (warmupQueue.length === 0) {
      logger.debug('No cache warmup data to execute', { action: 'CACHE_WARMUP_SKIP' });
      return { warmed: 0, failed: 0 };
    }

    if (!redisAvailable) {
      logger.warn('Redis not available, cache warmup deferred', { action: 'CACHE_WARMUP_DEFERRED' });
      return { warmed: 0, failed: 0 };
    }

    warmupInProgress = true;
    let warmed = 0;
    let failed = 0;

    logger.info(`Starting cache warmup for ${warmupQueue.length} entries`, {
      action: 'CACHE_WARMUP_START',
      entries: warmupQueue.length,
    });

    for (const data of warmupQueue) {
      try {
        if (cacheRedis) {
          await cacheRedis.setex(data.key, data.ttl, data.value);
          warmed++;
        }
      } catch (err) {
        failed++;
        logger.warn(`Cache warmup failed for key: ${data.key}`, {
          key: data.key,
          error: (err as Error).message,
          action: 'CACHE_WARMUP_ENTRY_FAILED',
        });
      }
    }

    // Clear the queue after warmup
    warmupQueue.length = 0;
    warmupInProgress = false;

    logger.info(`Cache warmup completed`, {
      action: 'CACHE_WARMUP_COMPLETE',
      warmed,
      failed,
    });

    return { warmed, failed };
  },

  /**
   * Get count of items waiting in warmup queue
   */
  getQueueSize(): number {
    return warmupQueue.length;
  },

  /**
   * Check if warmup is currently in progress
   */
  isWarmingUp(): boolean {
    return warmupInProgress;
  },
};
