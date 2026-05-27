import { cache } from '../config/redis';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

interface SecretConfig {
  name: string;
  current: string;
  previous?: string;
  rotatedAt?: Date;
  expiresAt: Date;
}

class SecretRotation {
  private secrets = new Map<string, SecretConfig>();

  async initialize(secrets: { name: string; value: string; ttl: number }[]): Promise<void> {
    for (const secret of secrets) {
      this.secrets.set(secret.name, {
        name: secret.name,
        current: secret.value,
        expiresAt: new Date(Date.now() + secret.ttl * 1000),
      });

      // Cache in Redis
      await cache.set(`secret:${secret.name}`, secret.value, secret.ttl);
    }

    logger.info('Secrets initialized', { count: secrets.length });
  }

  async rotate(name: string, newValue: string): Promise<void> {
    const secret = this.secrets.get(name);
    if (!secret) {
      throw ApiError.notFound(`Secret not found: ${name}`, ERROR_CODES.NOT_FOUND);
    }

    // Store previous
    const previous = secret.current;

    // Update secret
    secret.previous = previous;
    secret.current = newValue;
    secret.rotatedAt = new Date();

    // Update cache
    const ttl = Math.floor(
      (secret.expiresAt.getTime() - Date.now()) / 1000
    );
    await cache.set(`secret:${name}`, newValue, ttl);

    logger.info('Secret rotated', { name, rotatedAt: secret.rotatedAt });
  }

  async get(name: string): Promise<string | null> {
    // Try cache first
    const cached = await cache.get(`secret:${name}`);
    if (cached) return cached;

    // Fall back to memory
    const secret = this.secrets.get(name);
    return secret?.current || null;
  }

  async isExpiringSoon(name: string, hoursThreshold = 24): Promise<boolean> {
    const secret = this.secrets.get(name);
    if (!secret) return false;

    const hoursUntilExpiry =
      (secret.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);

    return hoursUntilExpiry <= hoursThreshold;
  }

  async getExpiringSoon(hoursThreshold = 24): Promise<string[]> {
    const expiring: string[] = [];

    for (const [name] of this.secrets) {
      if (await this.isExpiringSoon(name, hoursThreshold)) {
        expiring.push(name);
      }
    }

    return expiring;
  }
}

export const secretRotation = new SecretRotation();
