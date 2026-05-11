import Redis from 'ioredis';
import logger from '../utils/logger';

// Redis configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Connection options
const connectionOptions = {
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 10) {
      logger.error('Redis connection failed after 10 retries');
      return null;
    }
    return Math.min(times * 100, 3000);
  },
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
    return targetErrors.some(targetError => err.message.includes(targetError));
  },
};

// Create Redis clients
const createRedisClient = (name: string): Redis => {
  const client = new Redis(REDIS_URL, {
    ...connectionOptions,
    name,
  });

  client.on('connect', () => {
    logger.info(`Redis client connected: ${name}`, {
      name,
      action: 'REDIS_CONNECTED',
    });
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
  });

  return client;
};

// Main Redis client for general use
export const redis = createRedisClient('main');

// Cache-specific Redis client
export const cacheRedis = createRedisClient('cache');

// Queue-specific Redis client
export const queueRedis = createRedisClient('queue');

// Metrics-specific Redis client
export const metricsRedis = createRedisClient('metrics');

// Health check
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    return false;
  }
};

// Graceful shutdown
export const closeRedisConnections = async (): Promise<void> => {
  logger.info('Closing Redis connections...');

  await Promise.all([
    redis.quit(),
    cacheRedis.quit(),
    queueRedis.quit(),
    metricsRedis.quit(),
  ]);

  logger.info('All Redis connections closed');
};

export default {
  redis,
  cacheRedis,
  queueRedis,
  metricsRedis,
  checkRedisConnection,
  closeRedisConnections,
};
