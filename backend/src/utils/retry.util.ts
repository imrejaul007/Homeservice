import logger from './logger';
import mongoose from 'mongoose';

// ============================================
// Dead Letter Queue MongoDB Schema (Persistence)
// ============================================

const DLQEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  originalFunction: { type: String, required: true },
  error: {
    message: { type: String, required: true },
    name: { type: String, default: 'Error' },
    stack: { type: String }
  },
  attempts: { type: Number, required: true },
  lastAttempt: { type: Date, required: true },
  timestamp: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  processed: { type: Boolean, default: false },
  reprocessedAt: { type: Date }
}, {
  timestamps: true,
  expireAfterSeconds: 30 * 24 * 60 * 60 // 30 days TTL
});

const DLQEntry = mongoose.models.DLQEntry || mongoose.model('DLQEntry', DLQEntrySchema);

// In-memory dead letter queue for fallback (non-persistent operations)
const inMemoryDLQ: DeadLetterEntry[] = [];
const MAX_IN_MEMORY_ENTRIES = 100;

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: (string | RegExp)[];
  onRetry?: (attempt: number, error: Error, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalTimeMs: number;
  retries: number;
}

const DEFAULT_RETRYABLE_ERRORS = [
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
  /ECONNRESET/i,
  /NetworkError/i,
  /fetch failed/i,
  /timeout/i,
  /429/,
  /503/,
  /504/,
];

const isRetryableError = (error: Error, retryableErrors: (string | RegExp)[]): boolean => {
  const errorMessage = error.message || '';
  return retryableErrors.some(pattern => {
    if (pattern instanceof RegExp) {
      return pattern.test(errorMessage);
    }
    return errorMessage.includes(pattern);
  });
};

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const calculateDelay = (
  attempt: number,
  initialDelay: number,
  multiplier: number,
  maxDelay: number
): number => {
  const delay = initialDelay * Math.pow(multiplier, attempt - 1);
  // Add jitter (±25%)
  const jitter = delay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(delay + jitter, maxDelay);
};

export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<RetryResult<T>> => {
  const startTime = Date.now();

  const config: RetryOptions = {
    maxAttempts: options.maxAttempts ?? 3,
    initialDelayMs: options.initialDelayMs ?? 1000,
    maxDelayMs: options.maxDelayMs ?? 30000,
    backoffMultiplier: options.backoffMultiplier ?? 2,
    retryableErrors: options.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS,
    onRetry: options.onRetry,
  };

  let lastError: Error | undefined;
  let retries = 0;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attempt,
        totalTimeMs: Date.now() - startTime,
        retries,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isLastAttempt = attempt === config.maxAttempts;
      const shouldRetry = !isLastAttempt && isRetryableError(lastError, config.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS);

      if (!shouldRetry) {
        logger.error(`[Retry] Non-retryable error on attempt ${attempt}/${config.maxAttempts}`, {
          error: lastError.message,
          attempts: attempt,
        });

        return {
          success: false,
          error: lastError,
          attempts: attempt,
          totalTimeMs: Date.now() - startTime,
          retries,
        };
      }

      retries++;
      const delay = calculateDelay(
        attempt,
        config.initialDelayMs,
        config.backoffMultiplier,
        config.maxDelayMs
      );

      logger.warn(`[Retry] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`, {
        error: lastError.message,
        attempt,
        maxAttempts: config.maxAttempts,
        delayMs: delay,
        retry: retries,
      });

      config.onRetry?.(attempt, lastError, delay);
      await sleep(delay);
    }
  }

  logger.error(`[Retry] All ${config.maxAttempts} attempts failed`, {
    error: lastError?.message,
    totalAttempts: config.maxAttempts,
    totalRetries: retries,
    totalTimeMs: Date.now() - startTime,
  });

  return {
    success: false,
    error: lastError,
    attempts: config.maxAttempts,
    totalTimeMs: Date.now() - startTime,
    retries,
  };
};

// Dead letter queue entry type
export interface DeadLetterEntry {
  id: string;
  originalFunction: string;
  error: Error;
  timestamp: Date;
  attempts: number;
  lastAttempt: Date;
  metadata?: Record<string, any>;
}

// Add entry to dead letter queue (persisted to MongoDB)
export const addToDeadLetterQueue = async (
  originalFunction: string,
  error: Error,
  attempts: number,
  metadata?: Record<string, any>
): Promise<void> => {
  const entry: DeadLetterEntry = {
    id: `dlq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    originalFunction,
    error,
    timestamp: new Date(),
    attempts,
    lastAttempt: new Date(),
    metadata
  };

  // Also keep in-memory for quick access (bounded)
  inMemoryDLQ.unshift(entry);
  while (inMemoryDLQ.length > MAX_IN_MEMORY_ENTRIES) {
    inMemoryDLQ.pop();
  }

  // Persist to MongoDB if connected
  if (mongoose.connection.readyState === 1) {
    try {
      await DLQEntry.create({
        id: entry.id,
        originalFunction: entry.originalFunction,
        error: {
          message: entry.error.message,
          name: entry.error.name,
          stack: entry.error.stack
        },
        attempts: entry.attempts,
        lastAttempt: entry.lastAttempt,
        timestamp: entry.timestamp,
        metadata: entry.metadata
      });
    } catch (err) {
      logger.warn('[DeadLetterQueue] Failed to persist to MongoDB, using memory only', {
        error: (err as Error).message
      });
    }
  }

  logger.warn(`[DeadLetterQueue] Added entry for ${originalFunction}`, {
    error: error.message,
    attempts
  });
};

// Get all dead letter queue entries (from memory first, then MongoDB)
export const getDeadLetterQueue = async (): Promise<DeadLetterEntry[]> => {
  // Return in-memory entries for quick access
  if (inMemoryDLQ.length > 0) {
    return [...inMemoryDLQ];
  }

  // Fallback to MongoDB if memory is empty
  if (mongoose.connection.readyState === 1) {
    try {
      const entries = await DLQEntry.find({ processed: false })
        .sort({ timestamp: -1 })
        .limit(1000)
        .lean()
        .exec() as unknown as Array<{
        id: string;
        originalFunction: string;
        error: { message: string; name?: string; stack?: string };
        timestamp: Date;
        attempts: number;
        lastAttempt: Date;
        metadata?: Record<string, any>;
      }>;

      return entries.map(e => ({
        id: e.id,
        originalFunction: e.originalFunction,
        error: new Error(e.error.message),
        timestamp: e.timestamp,
        attempts: e.attempts,
        lastAttempt: e.lastAttempt,
        metadata: e.metadata
      }));
    } catch (err) {
      logger.warn('[DeadLetterQueue] Failed to fetch from MongoDB', {
        error: (err as Error).message
      });
    }
  }

  return [...inMemoryDLQ];
};

// Get dead letter queue statistics
export const getDeadLetterStats = async (): Promise<{
  totalEntries: number;
  recentEntries: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}> => {
  // Check memory first
  if (inMemoryDLQ.length > 0) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return {
      totalEntries: inMemoryDLQ.length,
      recentEntries: inMemoryDLQ.filter(e => e.timestamp > oneHourAgo).length,
      oldestEntry: inMemoryDLQ[inMemoryDLQ.length - 1]?.timestamp || null,
      newestEntry: inMemoryDLQ[0]?.timestamp || null
    };
  }

  // Fallback to MongoDB
  if (mongoose.connection.readyState === 1) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const entries = await DLQEntry.find({ processed: false }).lean();

      return {
        totalEntries: entries.length,
        recentEntries: entries.filter(e => e.timestamp > oneHourAgo).length,
        oldestEntry: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
        newestEntry: entries.length > 0 ? entries[0].timestamp : null
      };
    } catch (err) {
      logger.warn('[DeadLetterQueue] Failed to get stats from MongoDB', {
        error: (err as Error).message
      });
    }
  }

  return {
    totalEntries: inMemoryDLQ.length,
    recentEntries: 0,
    oldestEntry: null,
    newestEntry: null
  };
};

// Clear dead letter queue
export const clearDeadLetterQueue = async (): Promise<void> => {
  inMemoryDLQ.length = 0;

  if (mongoose.connection.readyState === 1) {
    try {
      await DLQEntry.deleteMany({});
    } catch (err) {
      logger.warn('[DeadLetterQueue] Failed to clear MongoDB', {
        error: (err as Error).message
      });
    }
  }

  logger.info('[DeadLetterQueue] Cleared');
};

// Simple retry decorator for class methods
export const retryable = (options: Partial<RetryOptions> = {}) => {
  return function <T>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T>>
  ) {
    const originalMethod = descriptor.value;

    if (originalMethod) {
      descriptor.value = async function (...args: any[]): Promise<T> {
        const result = await withRetry(
          () => originalMethod.apply(this, args),
          options
        );

        if (result.success) {
          return result.result!;
        }
        throw result.error;
      };
    }

    return descriptor;
  };
};

// Common retry configurations
export const retryConfigs = {
  // Quick retry for non-critical operations
  quick: {
    maxAttempts: 2,
    initialDelayMs: 100,
    maxDelayMs: 1000,
    backoffMultiplier: 2,
  },

  // Standard retry for most operations
  standard: {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },

  // Aggressive retry for critical operations
  aggressive: {
    maxAttempts: 5,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    backoffMultiplier: 1.5,
  },

  // Payment retry - very conservative
  payment: {
    maxAttempts: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      /stripe/i,
      /payment/i,
      /ECONNREFUSED/i,
      /ETIMEDOUT/i,
      /503/,
      /504/,
    ],
  },
};

// Timeout wrapper for promises
export const withTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  timeoutError?: string
): Promise<T> => {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutError || `Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
};
