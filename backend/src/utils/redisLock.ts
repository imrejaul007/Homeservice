import { redis, isRedisAvailable } from '../config/redis';
import logger from './logger';
import { randomUUID } from 'crypto';

/**
 * Redis-based distributed lock implementation
 * Provides atomic locking mechanism to prevent race conditions in distributed systems
 */
export class RedisLock {
  private key: string;
  private value: string;
  private ttlSeconds: number;
  private acquired: boolean = false;

  constructor(key: string, ttlSeconds: number = 30) {
    // Sanitize key to ensure it doesn't contain invalid characters
    this.key = `lock:${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    this.value = randomUUID();
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Attempt to acquire the lock
   * Uses SET NX EX pattern for atomic lock acquisition
   * @returns true if lock was acquired, false if already held by another process
   */
  async acquire(): Promise<boolean> {
    if (!redis || !isRedisAvailable()) {
      logger.error('Redis unavailable - distributed lock cannot be acquired', {
        key: this.key,
        context: 'RedisLock',
        action: 'REDIS_UNAVAILABLE',
      });
      // Fail-fast: distributed locking requires Redis to be available
      // Silent fallback would create race conditions in distributed systems
      throw new Error(`Redis is required for distributed locking but is unavailable for key: ${this.key}`);
    }

    try {
      // SET key value NX EX ttl - atomic operation
      // NX: Only set if key doesn't exist
      // EX: Set expiration in seconds
      const result = await redis.set(this.key, this.value, 'EX', this.ttlSeconds, 'NX');

      if (result === 'OK') {
        this.acquired = true;
        logger.debug('Distributed lock acquired', {
          key: this.key,
          ttl: this.ttlSeconds,
          action: 'LOCK_ACQUIRED',
        });
        return true;
      }

      logger.debug('Failed to acquire lock - already held', {
        key: this.key,
        action: 'LOCK_HELD',
      });
      return false;
    } catch (error) {
      logger.error('Error acquiring distributed lock', {
        key: this.key,
        error: error instanceof Error ? error.message : String(error),
        action: 'LOCK_ERROR',
      });
      return false;
    }
  }

  /**
   * Release the lock
   * Uses Lua script for atomic check-and-delete to prevent releasing someone else's lock
   * @returns true if lock was released, false if lock was not held or expired
   */
  async release(): Promise<boolean> {
    if (!this.acquired) {
      return false;
    }

    if (!redis || !isRedisAvailable()) {
      logger.debug('Redis not available, lock released locally', {
        key: this.key,
        action: 'LOCK_RELEASED_LOCAL',
      });
      this.acquired = false;
      return true;
    }

    // Lua script for atomic check-and-delete
    // Only delete if the value matches (we own the lock)
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(luaScript, 1, this.key, this.value);

      if (result === 1) {
        this.acquired = false;
        logger.debug('Distributed lock released', {
          key: this.key,
          action: 'LOCK_RELEASED',
        });
        return true;
      }

      logger.warn('Failed to release lock - value mismatch (lock may have expired)', {
        key: this.key,
        action: 'LOCK_RELEASE_FAILED',
      });
      return false;
    } catch (error) {
      logger.error('Error releasing distributed lock', {
        key: this.key,
        error: error instanceof Error ? error.message : String(error),
        action: 'LOCK_RELEASE_ERROR',
      });
      return false;
    }
  }

  /**
   * Extend the lock TTL
   * Useful for long-running operations that need to extend their lock
   * @param additionalSeconds seconds to extend the lock by
   * @returns true if lock was extended, false if lock was not held
   */
  async extend(additionalSeconds?: number): Promise<boolean> {
    if (!this.acquired) {
      return false;
    }

    const ttl = additionalSeconds || this.ttlSeconds;

    if (!redis || !isRedisAvailable()) {
      // In non-Redis mode, just extend locally
      this.ttlSeconds = ttl;
      return true;
    }

    // Lua script for atomic check-and-extend
    const luaScript = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("EXPIRE", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;

    try {
      const result = await redis.eval(luaScript, 1, this.key, this.value, ttl);

      if (result === 1) {
        logger.debug('Distributed lock extended', {
          key: this.key,
          newTtl: ttl,
          action: 'LOCK_EXTENDED',
        });
        return true;
      }

      logger.warn('Failed to extend lock - value mismatch', {
        key: this.key,
        action: 'LOCK_EXTEND_FAILED',
      });
      return false;
    } catch (error) {
      logger.error('Error extending distributed lock', {
        key: this.key,
        error: error instanceof Error ? error.message : String(error),
        action: 'LOCK_EXTEND_ERROR',
      });
      return false;
    }
  }

  /**
   * Check if lock is currently held
   */
  isHeld(): boolean {
    return this.acquired;
  }

  /**
   * Get the lock key
   */
  getKey(): string {
    return this.key;
  }
}

/**
 * Acquire a distributed lock using the RedisLock class
 * Convenience function for one-shot lock acquisition
 *
 * @param key Lock identifier (e.g., "payout:process:123")
 * @param ttlSeconds Lock TTL in seconds (default: 30)
 * @returns RedisLock instance if acquired, null if failed
 */
export async function acquireLock(key: string, ttlSeconds: number = 30): Promise<RedisLock | null> {
  const lock = new RedisLock(key, ttlSeconds);
  const acquired = await lock.acquire();
  return acquired ? lock : null;
}

/**
 * Acquire a lock or wait/retry until it's available
 * Useful for operations that must have exclusive access
 *
 * @param key Lock identifier
 * @param ttlSeconds Lock TTL in seconds (default: 30)
 * @param maxWaitMs Maximum time to wait for lock acquisition (default: 60000)
 * @param retryIntervalMs Interval between retry attempts (default: 100)
 * @returns RedisLock instance if acquired, null if timeout
 */
export async function acquireLockWithWait(
  key: string,
  ttlSeconds: number = 30,
  maxWaitMs: number = 60000,
  retryIntervalMs: number = 100
): Promise<RedisLock | null> {
  const startTime = Date.now();
  const lock = new RedisLock(key, ttlSeconds);

  while (Date.now() - startTime < maxWaitMs) {
    const acquired = await lock.acquire();
    if (acquired) {
      return lock;
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
  }

  logger.warn('Failed to acquire lock within timeout', {
    key,
    ttlSeconds,
    maxWaitMs,
    action: 'LOCK_WAIT_TIMEOUT',
  });

  return null;
}

/**
 * Execute a function with an exclusive lock
 * Automatically acquires and releases the lock
 *
 * @param key Lock identifier
 * @param fn Function to execute while holding the lock
 * @param ttlSeconds Lock TTL in seconds (default: 30)
 * @param maxWaitMs Maximum time to wait for lock (default: 60000)
 * @returns Result of the function, or throws if lock cannot be acquired
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 30,
  maxWaitMs: number = 60000
): Promise<T> {
  const lock = await acquireLockWithWait(key, ttlSeconds, maxWaitMs);

  if (!lock) {
    throw new Error(`Failed to acquire lock for key: ${key}`);
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}

/**
 * Execute a function with a lock, but skip if lock cannot be acquired
 * Useful for batch processing where you want to skip already-processing items
 *
 * @param key Lock identifier
 * @param fn Function to execute while holding the lock
 * @param ttlSeconds Lock TTL in seconds (default: 30)
 * @returns Object with success flag and result/error
 */
export async function withLockOrSkip<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300 // 5 minutes default for batch operations
): Promise<{ success: boolean; result?: T; error?: string }> {
  const lock = await acquireLock(key, ttlSeconds);

  if (!lock) {
    return { success: false, error: 'Lock not available, skipping' };
  }

  try {
    const result = await fn();
    return { success: true, result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await lock.release();
  }
}

export default {
  RedisLock,
  acquireLock,
  acquireLockWithWait,
  withLock,
  withLockOrSkip,
};
