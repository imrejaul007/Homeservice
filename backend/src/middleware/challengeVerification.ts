/**
 * Challenge-Response Verification Middleware
 *
 * Implements a simple math challenge to verify human interaction.
 * When suspicious activity is detected, the server issues a challenge
 * that must be solved before the action completes.
 *
 * FIX: Now uses Redis for storage when available, with in-memory fallback
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { cache, isRedisAvailable } from '../config/redis';
import logger from '../utils/logger';

// In-memory store fallback when Redis is unavailable
const challengeStore = new Map<string, ChallengeData>();

interface ChallengeData {
  challengeId: string;   // The challenge ID (map key)
  challenge: string;     // The challenge (e.g., "3+7")
  answer: string;       // The correct answer
  userId: string;       // User who received the challenge
  createdAt: number;   // When challenge was created
  attempts: number;     // Number of attempts
  maxAttempts: number;  // Max allowed attempts
  expiresAt: number;   // When challenge expires
}

interface ChallengeConfig {
  expiryMs: number;       // Challenge expires after this many ms
  maxAttempts: number;    // Max wrong attempts before invalidation
  minIntervalMs: number;  // Min time between challenge requests (prevents rapid guessing)
}

// Default config
const DEFAULT_CONFIG: ChallengeConfig = {
  expiryMs: 5 * 60 * 1000,    // 5 minutes
  maxAttempts: 3,                // 3 wrong attempts
  minIntervalMs: 30 * 1000,     // 30 seconds between requests
};

const CHALLENGE_PREFIX = 'challenge:';

/**
 * Generate a random challenge
 * Uses simple arithmetic that's easy for humans but difficult for bots
 */
function generateChallenge(): { challenge: string; answer: string } {
  // Generate two numbers that are easy to add/subtract
  const num1 = Math.floor(Math.random() * 10) + 1;  // 1-10
  const num2 = Math.floor(Math.random() * 10) + 1;  // 1-10

  // Alternate between addition and subtraction
  const isAddition = Math.random() > 0.5;

  if (isAddition) {
    return {
      challenge: `${num1} + ${num2}`,
      answer: String(num1 + num2),
    };
  } else {
    // Ensure result is positive
    const larger = Math.max(num1, num2);
    const smaller = Math.min(num1, num2);
    return {
      challenge: `${larger} - ${smaller}`,
      answer: String(larger - smaller),
    };
  }
}

/**
 * Generate a unique challenge ID
 */
function generateChallengeId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Store challenge data (Redis with fallback)
 */
async function storeChallenge(challengeId: string, data: ChallengeData): Promise<void> {
  if (isRedisAvailable()) {
    const key = `${CHALLENGE_PREFIX}${challengeId}`;
    const ttlSeconds = Math.ceil((data.expiresAt - Date.now()) / 1000);
    await cache.set(key, JSON.stringify(data), ttlSeconds);
  }
  // Always store in memory as backup
  challengeStore.set(challengeId, data);
}

/**
 * Get challenge data (Redis with fallback)
 */
async function getChallenge(challengeId: string): Promise<ChallengeData | null> {
  // Try memory first (faster)
  const memoryData = challengeStore.get(challengeId);
  if (memoryData && memoryData.expiresAt > Date.now()) {
    return memoryData;
  }

  if (isRedisAvailable()) {
    const key = `${CHALLENGE_PREFIX}${challengeId}`;
    const data = await cache.get(key);
    if (data) {
      try {
        const parsed = JSON.parse(data) as ChallengeData;
        if (parsed.expiresAt > Date.now()) {
          // Restore to memory
          challengeStore.set(challengeId, parsed);
          return parsed;
        }
      } catch {
        // Invalid data
      }
    }
  }

  return null;
}

/**
 * Delete challenge data
 */
async function deleteChallenge(challengeId: string): Promise<void> {
  challengeStore.delete(challengeId);
  if (isRedisAvailable()) {
    await cache.del(`${CHALLENGE_PREFIX}${challengeId}`);
  }
}

/**
 * Update challenge data
 */
async function updateChallenge(challengeId: string, data: ChallengeData): Promise<void> {
  if (isRedisAvailable()) {
    const key = `${CHALLENGE_PREFIX}${challengeId}`;
    const ttlSeconds = Math.ceil((data.expiresAt - Date.now()) / 1000);
    await cache.set(key, JSON.stringify(data), ttlSeconds);
  }
  challengeStore.set(challengeId, data);
}

/**
 * Clean up expired challenges (memory only - Redis handles TTL automatically)
 */
function cleanupExpiredChallenges(): void {
  const now = Date.now();
  for (const [id, data] of challengeStore.entries()) {
    if (data.expiresAt < now || data.attempts >= data.maxAttempts) {
      challengeStore.delete(id);
    }
  }
}

/**
 * Issue a new challenge for a user
 * @param userId - The user who needs to solve the challenge
 * @param config - Optional configuration
 * @returns Challenge data including the ID and the challenge string
 */
export function issueChallenge(
  userId: string,
  config: Partial<ChallengeConfig> = {}
): { challengeId: string; challenge: string; expiresIn: number } {
  // Clean up old challenges periodically
  cleanupExpiredChallenges();

  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const { challenge, answer } = generateChallenge();
  const challengeId = generateChallengeId();
  const now = Date.now();

  const challengeData: ChallengeData = {
    challengeId,
    challenge,
    answer,
    userId,
    createdAt: now,
    attempts: 0,
    maxAttempts: fullConfig.maxAttempts,
    expiresAt: now + fullConfig.expiryMs,
  };

  // Store (async, but we don't await)
  storeChallenge(challengeId, challengeData).catch(err => {
    logger.error('Failed to store challenge in Redis', {
      context: 'ChallengeVerification',
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return {
    challengeId,
    challenge,
    expiresIn: fullConfig.expiryMs,
  };
}

/**
 * Verify a challenge response
 * @param challengeId - The ID of the challenge
 * @param userId - The user attempting to verify
 * @param response - The user's answer
 * @returns Verification result
 */
export async function verifyChallenge(
  challengeId: string,
  userId: string,
  response: string
): Promise<{ valid: boolean; error?: string }> {
  let challenge = challengeStore.get(challengeId);

  if (!challenge) {
    // Try Redis if not in memory
    const redisData = await getChallenge(challengeId);
    if (redisData) {
      challengeStore.set(challengeId, redisData);
      challenge = redisData;
    }
  }

  if (!challenge) {
    return { valid: false, error: 'Challenge not found or expired' };
  }

  // Verify the user matches
  if (challenge.userId !== userId) {
    return { valid: false, error: 'Challenge belongs to different user' };
  }

  // Check if expired
  if (challenge.expiresAt < Date.now()) {
    await deleteChallenge(challengeId);
    return { valid: false, error: 'Challenge has expired' };
  }

  // Check attempts
  if (challenge.attempts >= challenge.maxAttempts) {
    await deleteChallenge(challengeId);
    return { valid: false, error: 'Too many failed attempts' };
  }

  // Increment attempts
  challenge.attempts++;

  // Verify the answer (case-insensitive)
  if (challenge.answer.toLowerCase() === response.toLowerCase().trim()) {
    await deleteChallenge(challengeId);
    return { valid: true };
  }

  // Update in memory and Redis
  challengeStore.set(challengeId, challenge);
  if (challenge.expiresAt > Date.now()) {
    await updateChallenge(challengeId, challenge).catch(() => {});
  }

  // Wrong answer
  if (challenge.attempts >= challenge.maxAttempts) {
    await deleteChallenge(challengeId);
    return { valid: false, error: 'Too many failed attempts' };
  }

  return {
    valid: false,
    error: `Incorrect answer. ${challenge.maxAttempts - challenge.attempts} attempts remaining`
  };
}

/**
 * Check if a user has a pending challenge
 */
export function hasPendingChallenge(userId: string): boolean {
  const now = Date.now();
  for (const [, data] of challengeStore.entries()) {
    if (data.userId === userId && data.expiresAt > now && data.attempts < data.maxAttempts) {
      return true;
    }
  }
  return false;
}

/**
 * Clear all challenges for a user
 */
export async function clearUserChallenges(userId: string): Promise<void> {
  for (const [id, data] of challengeStore.entries()) {
    if (data.userId === userId) {
      challengeStore.delete(id);
    }
  }
  if (isRedisAvailable()) {
    // Use SCAN to find matching keys
    const keys = await cache.keys(`${CHALLENGE_PREFIX}*`);
    for (const key of keys) {
      try {
        const data = await cache.get(key);
        if (data) {
          const parsed = JSON.parse(data) as ChallengeData;
          if (parsed.userId === userId) {
            await cache.del(key);
          }
        }
      } catch {
        // Skip invalid entries
      }
    }
  }
}

/**
 * Get pending challenge for a user
 */
export function getPendingChallenge(userId: string): ChallengeData | null {
  const now = Date.now();
  for (const [, data] of challengeStore.entries()) {
    if (data.userId === userId && data.expiresAt > now && data.attempts < data.maxAttempts) {
      return data;
    }
  }
  return null;
}

/**
 * Express middleware to require challenge verification
 * Returns a challenge in the response if needed
 */
export function requireChallenge(req: Request, res: Response, next: NextFunction): void {
  const userId = (req as Request & { user?: { id?: string } }).user?.id;

  if (!userId) {
    next();
    return;
  }

  // Check if user has a pending challenge
  const pending = getPendingChallenge(userId);
  if (pending) {
    res.status(403).json({
      success: false,
      requiresChallenge: true,
      challengeId: pending,
      message: 'Please complete the challenge',
    });
    return;
  }

  next();
}

/**
 * Generate challenge stats for monitoring
 */
export function getChallengeStats(): { active: number; expired: number } {
  cleanupExpiredChallenges();
  return {
    active: challengeStore.size,
    expired: 0,
  };
}

// Export for testing
export { challengeStore, generateChallenge };
