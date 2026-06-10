import { cache } from '../config/redis';
import logger from '../utils/logger';

const CACHE_KEY = 'contact:public:config';
const CACHE_TTL = 3600; // 1 hour

export const contactConfigCache = {
  async get<T>(): Promise<T | null> {
    try {
      const raw = await cache.get(CACHE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async set<T>(data: T): Promise<void> {
    try {
      await cache.set(CACHE_KEY, JSON.stringify(data), CACHE_TTL);
    } catch (error) {
      logger.debug('Contact config cache set failed', {
        error: (error as Error).message,
        action: 'CONTACT_CONFIG_CACHE_SET_FAILED',
      });
    }
  },

  async invalidate(): Promise<void> {
    try {
      await cache.del(CACHE_KEY);
    } catch {
      // non-critical
    }
  },
};
