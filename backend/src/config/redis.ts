import Redis from 'ioredis';
import logger from '../utils/logger';
import dotenv from 'dotenv';
import path from 'path';

// Load env first
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Redis configuration - optional in development
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI;
let redisAvailable = false;

let redis: Redis | null = null;
let cacheRedis: Redis | null = null;
let queueRedis: Redis | null = null;
let metricsRedis: Redis | null = null;

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

    client.on('connect', () => {
      logger.info(`Redis client connected: ${name}`, {
        name,
        action: 'REDIS_CONNECTED',
      });
      redisAvailable = true;
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
      redisAvailable = false;
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

// Export clients (may be null if Redis not configured)
export { redis, cacheRedis, queueRedis, metricsRedis };

// Helper to check if Redis is available
export const isRedisAvailable = (): boolean => redisAvailable;

// Safe cache wrapper that handles null cacheRedis
export const cache = {
  async get(key: string): Promise<string | null> {
    return cacheRedis?.get(key) ?? null;
  },
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (cacheRedis) {
      if (ttl) {
        await cacheRedis.setex(key, ttl, value);
      } else {
        await cacheRedis.set(key, value);
      }
    }
  },
  async del(...keys: string[]): Promise<void> {
    if (cacheRedis && keys.length > 0) {
      await cacheRedis.del(...keys);
    }
  },
  async keys(pattern: string): Promise<string[]> {
    return cacheRedis?.keys(pattern) ?? [];
  },
  get client(): Redis | null {
    return cacheRedis;
  }
};
