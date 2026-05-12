import mongoose, { Model } from 'mongoose';
import Redis from 'ioredis';
import logger from './logger';

// Cache configuration
const CACHE_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'nilin:cache:',
    retryDelayMs: 100,
    maxRetries: 3,
  },
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL || '300'), // 5 minutes
  maxTTL: parseInt(process.env.CACHE_MAX_TTL || '3600'), // 1 hour
};

// Redis client singleton
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
function getRedisClient(): Redis | null {
  if (process.env.REDIS_ENABLED !== 'true') {
    return null;
  }

  if (!redisClient) {
    try {
      redisClient = new Redis({
        host: CACHE_CONFIG.redis.host,
        port: CACHE_CONFIG.redis.port,
        password: CACHE_CONFIG.redis.password,
        db: CACHE_CONFIG.redis.db,
        keyPrefix: CACHE_CONFIG.redis.keyPrefix,
        retryStrategy: (times: number) => {
          if (times > CACHE_CONFIG.redis.maxRetries) {
            logger.warn('Redis connection failed, caching disabled');
            return null;
          }
          return Math.min(times * CACHE_CONFIG.redis.retryDelayMs, 2000);
        },
        lazyConnect: true,
      });

      redisClient.on('error', (err) => {
        logger.warn('Redis connection error:', err.message);
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected successfully');
      });

      // Try to connect
      redisClient.connect().catch((err) => {
        logger.warn('Redis initial connection failed:', err.message);
      });
    } catch (error) {
      logger.warn('Failed to initialize Redis client:', error);
      return null;
    }
  }

  return redisClient;
}

/**
 * Ensure all indexes are created for optimal query performance
 */
export async function ensureIndexes(): Promise<void> {
  const startTime = Date.now();

  try {
    logger.info('Starting index creation...');

    // User indexes
    const userIndexes = [
      { key: { email: 1, role: 1 }, name: 'idx_user_email_role' },
      { key: { isActive: 1, isDeleted: 1 }, name: 'idx_user_active_deleted' },
      { key: { accountStatus: 1, role: 1 }, name: 'idx_user_status_role' },
      { key: { createdAt: -1 }, name: 'idx_user_created' },
      { key: { lastLogin: -1 }, name: 'idx_user_lastlogin' },
      { key: { 'address.coordinates': '2dsphere' }, name: 'idx_user_location' },
      { key: { 'loyaltySystem.tier': 1 }, name: 'idx_user_loyalty_tier' },
      { key: { 'loyaltySystem.referralCode': 1 }, name: 'idx_user_referral_code', sparse: true },
      { key: { 'socialProfiles.followers': 1 }, name: 'idx_user_followers' },
      { key: { 'socialProfiles.following': 1 }, name: 'idx_user_following' },
      { key: { 'aiPersonalization.preferences.preferredServiceTypes': 1 }, name: 'idx_user_preferred_services' },
    ];

    await ensureIndexesForModel('User', userIndexes);

    // Booking indexes (if exists)
    const bookingIndexes = [
      { key: { customerId: 1, status: 1 }, name: 'idx_booking_customer_status' },
      { key: { providerId: 1, status: 1 }, name: 'idx_booking_provider_status' },
      { key: { status: 1, scheduledDate: 1 }, name: 'idx_booking_status_date' },
      { key: { createdAt: -1 }, name: 'idx_booking_created' },
      { key: { 'location.coordinates': '2dsphere' }, name: 'idx_booking_location' },
    ];

    await ensureIndexesForModel('Booking', bookingIndexes);

    // Service indexes (if exists)
    const serviceIndexes = [
      { key: { providerId: 1, isActive: 1 }, name: 'idx_service_provider_active' },
      { key: { category: 1, isActive: 1 }, name: 'idx_service_category_active' },
      { key: { status: 1 }, name: 'idx_service_status' },
      { key: { 'location.coordinates': '2dsphere' }, name: 'idx_service_location' },
      { key: { 'searchMetadata.popularityScore': -1 }, name: 'idx_service_popularity' },
      { key: { 'rating.average': -1 }, name: 'idx_service_rating' },
    ];

    await ensureIndexesForModel('Service', serviceIndexes);

    // Review indexes (if exists)
    const reviewIndexes = [
      { key: { serviceId: 1, rating: -1 }, name: 'idx_review_service_rating' },
      { key: { customerId: 1, createdAt: -1 }, name: 'idx_review_customer' },
      { key: { providerId: 1, createdAt: -1 }, name: 'idx_review_provider' },
    ];

    await ensureIndexesForModel('Review', reviewIndexes);

    const duration = Date.now() - startTime;
    logger.info(`Index creation completed in ${duration}ms`);
  } catch (error) {
    logger.error('Error creating indexes:', error);
    throw error;
  }
}

/**
 * Ensure indexes exist for a specific model
 */
async function ensureIndexesForModel(
  modelName: string,
  indexes: Array<{ key: Record<string, any>; name: string; sparse?: boolean; unique?: boolean }>
): Promise<void> {
  try {
    const model = mongoose.model(modelName);

    for (const indexDef of indexes) {
      try {
        // Check if index exists
        const existingIndex = await model.collection.indexes().then((indexes) =>
          indexes.find((idx) => idx.name === indexDef.name)
        );

        if (!existingIndex) {
          // Create the index
          const indexOptions: Record<string, any> = {
            name: indexDef.name,
            background: true,
          };

          if (indexDef.sparse) {
            indexOptions.sparse = true;
          }

          if (indexDef.unique) {
            indexOptions.unique = true;
          }

          await model.collection.createIndex(indexDef.key, indexOptions);
          logger.info(`Created index ${indexDef.name} for ${modelName}`);
        }
      } catch (error) {
        // Index might already exist with different options
        logger.warn(`Index ${indexDef.name} for ${modelName}:`, (error as Error).message);
      }
    }
  } catch (error) {
    // Model might not exist yet
    logger.debug(`Model ${modelName} not found, skipping index creation`);
  }
}

/**
 * Execute a function with caching
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  const redis = getRedisClient();

  // If Redis is not available, execute directly
  if (!redis) {
    return fn();
  }

  const cacheKey = `${CACHE_CONFIG.redis.keyPrefix}${key}`;
  const effectiveTTL = Math.min(ttl, CACHE_CONFIG.maxTTL);

  try {
    // Try to get from cache
    const cached = await redis.get(cacheKey);

    if (cached) {
      logger.debug(`Cache hit for key: ${key}`);
      return JSON.parse(cached) as T;
    }

    // Execute the function
    logger.debug(`Cache miss for key: ${key}`);
    const result = await fn();

    // Store in cache
    if (result !== undefined && result !== null) {
      await redis.setex(cacheKey, effectiveTTL, JSON.stringify(result));
    }

    return result;
  } catch (error) {
    // On cache error, execute directly
    logger.warn(`Cache error for key ${key}:`, (error as Error).message);
    return fn();
  }
}

/**
 * Invalidate cache for a specific key
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    const cacheKey = `${CACHE_CONFIG.redis.keyPrefix}${key}`;
    await redis.del(cacheKey);
    logger.debug(`Cache invalidated for key: ${key}`);
  } catch (error) {
    logger.warn(`Failed to invalidate cache for key ${key}:`, error);
  }
}

/**
 * Invalidate cache for a pattern
 */
export async function invalidateCachePattern(pattern: string): Promise<number> {
  const redis = getRedisClient();

  if (!redis) {
    return 0;
  }

  try {
    const fullPattern = `${CACHE_CONFIG.redis.keyPrefix}${pattern}`;
    const keys = await redis.keys(fullPattern);

    if (keys.length > 0) {
      const deleted = await redis.del(...keys);
      logger.debug(`Cache invalidated for pattern ${pattern}: ${deleted} keys`);
      return deleted;
    }

    return 0;
  } catch (error) {
    logger.warn(`Failed to invalidate cache pattern ${pattern}:`, error);
    return 0;
  }
}

/**
 * Get cached value without executing function
 */
export async function getCachedValue<T>(key: string): Promise<T | null> {
  const redis = getRedisClient();

  if (!redis) {
    return null;
  }

  try {
    const cacheKey = `${CACHE_CONFIG.redis.keyPrefix}${key}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as T;
    }

    return null;
  } catch (error) {
    logger.warn(`Failed to get cached value for key ${key}:`, error);
    return null;
  }
}

/**
 * Set cached value with TTL
 */
export async function setCachedValue<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<void> {
  const redis = getRedisClient();

  if (!redis) {
    return;
  }

  try {
    const cacheKey = `${CACHE_CONFIG.redis.keyPrefix}${key}`;
    const effectiveTTL = Math.min(ttl || CACHE_CONFIG.defaultTTL, CACHE_CONFIG.maxTTL);

    await redis.setex(cacheKey, effectiveTTL, JSON.stringify(value));
    logger.debug(`Cached value for key: ${key} (TTL: ${effectiveTTL}s)`);
  } catch (error) {
    logger.warn(`Failed to set cached value for key ${key}:`, error);
  }
}

/**
 * Close Redis connection
 */
export async function closeCache(): Promise<void> {
  if (redisClient) {
    try {
      await redisClient.quit();
      redisClient = null;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.warn('Error closing Redis connection:', error);
    }
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  enabled: boolean;
  connected: boolean;
  hits: number;
  misses: number;
  keys: number;
}> {
  const redis = getRedisClient();

  if (!redis) {
    return {
      enabled: false,
      connected: false,
      hits: 0,
      misses: 0,
      keys: 0,
    };
  }

  try {
    const info = await redis.info('stats');
    const infoLines = info.split('\r\n');

    let hits = 0;
    let misses = 0;

    for (const line of infoLines) {
      if (line.startsWith('keyspace_hits:')) {
        hits = parseInt(line.split(':')[1]) || 0;
      }
      if (line.startsWith('keyspace_misses:')) {
        misses = parseInt(line.split(':')[1]) || 0;
      }
    }

    const keys = await redis.dbsize();

    return {
      enabled: true,
      connected: redis.status === 'ready',
      hits,
      misses,
      keys,
    };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      hits: 0,
      misses: 0,
      keys: 0,
    };
  }
}

/**
 * Create a query helper for common patterns
 */
export function createQueryHelper<T>(
  model: Model<T>,
  options: {
    defaultSort?: Record<string, 1 | -1>;
    defaultSelect?: string;
    cacheable?: boolean;
    cacheTTL?: number;
  } = {}
) {
  const { defaultSort = { createdAt: -1 }, defaultSelect, cacheTTL = CACHE_CONFIG.defaultTTL } = options;

  return {
    /**
     * Find with caching
     */
    async findWithCache(
      query: Record<string, any>,
      projection?: any,
      options: any = {}
    ): Promise<T[]> {
      const cacheKey = `${model.modelName}:find:${JSON.stringify({ query, projection, options })}`;

      return withCache(cacheKey, cacheTTL, async () => {
        let q = model.find(query, projection);

        if (defaultSort) {
          q = q.sort(defaultSort);
        }

        if (options.skip) {
          q = q.skip(options.skip);
        }

        if (options.limit) {
          q = q.limit(options.limit);
        }

        if (defaultSelect) {
          q = q.select(defaultSelect);
        }

        if (options.populate) {
          q = q.populate(options.populate);
        }

        return q.lean().exec() as Promise<T[]>;
      });
    },

    /**
     * Find one with caching
     */
    async findOneWithCache(
      query: Record<string, any>,
      projection?: any
    ): Promise<T | null> {
      const cacheKey = `${model.modelName}:findOne:${JSON.stringify({ query, projection })}`;

      return withCache(cacheKey, cacheTTL, async () => {
        let q = model.findOne(query, projection);

        if (defaultSelect) {
          q = q.select(defaultSelect);
        }

        return q.lean().exec() as Promise<T | null>;
      });
    },

    /**
     * Count with caching
     */
    async countWithCache(query: Record<string, any>): Promise<number> {
      const cacheKey = `${model.modelName}:count:${JSON.stringify(query)}`;

      return withCache(cacheKey, cacheTTL, async () => {
        return model.countDocuments(query).lean().exec();
      });
    },

    /**
     * Invalidate cache for this model
     */
    async invalidateCache(id?: string): Promise<void> {
      if (id) {
        await invalidateCachePattern(`${model.modelName}:*${id}*`);
      } else {
        await invalidateCachePattern(`${model.modelName}:*`);
      }
    },
  };
}

/**
 * Pagination helper
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  maxLimit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export async function paginate<T>(
  model: Model<T>,
  query: Record<string, any>,
  options: PaginationOptions = {},
  additionalOptions: any = {}
): Promise<PaginatedResult<T>> {
  const {
    page = 1,
    limit = 20,
    maxLimit = 100,
  } = options;

  const effectiveLimit = Math.min(limit, maxLimit);
  const skip = (page - 1) * effectiveLimit;

  const [data, total] = await Promise.all([
    model
      .find(query, additionalOptions.projection)
      .skip(skip)
      .limit(effectiveLimit)
      .sort(additionalOptions.sort || { createdAt: -1 })
      .populate(additionalOptions.populate)
      .lean()
      .exec(),
    model.countDocuments(query).lean().exec(),
  ]);

  const totalPages = Math.ceil(total / effectiveLimit);

  return {
    data: data as T[],
    pagination: {
      page,
      limit: effectiveLimit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

export default {
  ensureIndexes,
  withCache,
  invalidateCache,
  invalidateCachePattern,
  getCachedValue,
  setCachedValue,
  closeCache,
  getCacheStats,
  createQueryHelper,
  paginate,
};
