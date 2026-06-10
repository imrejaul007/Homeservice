/**
 * Web Push Notification Service
 * Handles Web Push API implementation for browser notifications
 *
 * Features:
 * - Web Push API implementation
 * - VAPID key management
 * - Send push notifications
 * - Subscription management
 * - Payload encryption
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import User from '../../models/user.model';
import BookingNotification from '../../models/bookingNotification.model';
import { withRetry, retryConfigs } from '../../utils/retry.util';
import logger from '../../utils/logger';
import { ApiError, ERROR_CODES } from '../../utils/ApiError';
import { createCircuitBreaker, CIRCUIT_NAMES } from '../circuitBreaker.service';
import { cache } from '../../config/redis';

// ============================================
// Types
// ============================================

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  expirationTime?: number | null;
}

export interface WebPushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  requireInteraction?: boolean;
  silent?: boolean;
  dir?: 'auto' | 'ltr' | 'rtl';
  lang?: string;
}

export interface PushSubscriptionRecord {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: Date;
  lastUsed: Date;
  userAgent?: string;
}

// VAPID Keys configuration
interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

// ============================================
// VAPID Key Management
// ============================================

/**
 * Generate VAPID keys for Web Push
 * These keys are used for encrypting push notifications
 */
function generateVapidKeys(): VapidKeys {
  // VAPID requires ECDSA P-256 key pair
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();

  const publicKey = ecdh.getPublicKey('base64url');
  const privateKey = ecdh.getPrivateKey('base64url');

  return { publicKey, privateKey };
}

/**
 * Get or create VAPID keys from environment/config
 */
const getVapidKeys = (): VapidKeys | null => {
  const storedPublicKey = process.env.WEBPUSH_VAPID_PUBLIC_KEY;
  const storedPrivateKey = process.env.WEBPUSH_VAPID_PRIVATE_KEY;

  // If keys are stored in environment, use them
  if (storedPublicKey && storedPrivateKey) {
    return { publicKey: storedPublicKey, privateKey: storedPrivateKey };
  }

  // For development, generate and persist keys to file
  if (process.env.NODE_ENV !== 'production') {
    const keysPath = path.join(process.cwd(), '.vapid-keys.json');

    // Try to load existing keys from file
    if (fs.existsSync(keysPath)) {
      try {
        const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
        if (keysData.publicKey && keysData.privateKey) {
          logger.debug('Loaded VAPID keys from file', {
            context: 'WebPushService',
            action: 'VAPID_KEYS_LOADED',
          });
          return keysData;
        }
      } catch (error) {
        logger.warn('Failed to parse existing VAPID keys file, generating new keys', {
          context: 'WebPushService',
          action: 'VAPID_KEYS_PARSE_ERROR',
        });
      }
    }

    // Generate new keys and persist to file
    const keys = generateVapidKeys();
    try {
      fs.writeFileSync(keysPath, JSON.stringify(keys), { mode: 0o600 });
      logger.info('Generated new VAPID keys and saved to .vapid-keys.json', {
        context: 'WebPushService',
        action: 'VAPID_KEYS_GENERATED',
      });
    } catch (error) {
      logger.warn('Failed to persist VAPID keys to file', {
        context: 'WebPushService',
        action: 'VAPID_KEYS_PERSIST_ERROR',
      });
    }
    return keys;
  }

  // In production without keys, return null (service disabled)
  logger.error('Web Push VAPID keys not configured - Web Push notifications disabled', {
    context: 'WebPushService',
    action: 'VAPID_KEYS_MISSING',
  });
  return null;
};

const vapidKeys = getVapidKeys();

// ============================================
// Constants
// ============================================

const PUSH_GATEWAY_URL = 'https://fcm.googleapis.com/fcm/send';
const MAX_PAYLOAD_SIZE = 4096; // Maximum Web Push payload size
const TTL_SECONDS = 24 * 60 * 60; // 24 hours default TTL
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_PUSH = 100;

// In-memory fallback cache for rate limiting
const pushRateLimitCache = new Map<string, { count: number; windowStart: number }>();

// ============================================
// Helper Functions
// ============================================

/**
 * Base64URL encode
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(str: string): Buffer {
  // Add padding
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  base64 += '='.repeat(padding);
  return Buffer.from(base64, 'base64');
}

/**
 * Generate random bytes
 */
function generateRandomBytes(length: number): Buffer {
  return crypto.randomBytes(length);
}

/**
 * HKDF key derivation
 */
function hkdf(keyMaterial: Buffer, salt: Buffer, info: Buffer, length: number): Buffer {
  // Extract
  const extractKey = crypto.createHmac('sha256', salt);
  extractKey.update(keyMaterial);
  const prk = extractKey.digest();

  // Expand
  const expandKey = crypto.createHmac('sha256', prk);
  expandKey.update(info);
  expandKey.update(Buffer.from([1]));
  return expandKey.digest().slice(0, length);
}

/**
 * Encrypt payload for Web Push
 * Based on RFC 8291 - Message Encryption for Web Push
 */
function encryptPayload(subscription: PushSubscription, payload: Buffer): {
  ciphertext: Buffer;
  salt: Buffer;
  nonce: Buffer;
} {
  const userPublicKey = base64UrlDecode(subscription.keys.p256dh);
  const userAuth = base64UrlDecode(subscription.keys.auth);

  // Generate sender key pair (ECDH on P-256)
  const senderECDH = crypto.createECDH('prime256v1');
  senderECDH.generateKeys();

  const senderPublicKey = senderECDH.getPublicKey();
  const senderPrivateKey = senderECDH.getPrivateKey();

  // Perform ECDH
  const sharedSecret = senderECDH.computeSecret(userPublicKey);

  // Derive keys using HKDF
  const authInfo = Buffer.from('Content-Encoding: auth\0');
  const ikm = hkdf(sharedSecret, userAuth, authInfo, 32);

  // Generate salt
  const salt = generateRandomBytes(16);

  // Derive content encryption key
  const contextData = Buffer.concat([
    Buffer.from([0x00]), // Record type
    senderPublicKey,
    userPublicKey,
  ]);
  const contentEncryptionKey = hkdf(salt, ikm, Buffer.concat([Buffer.from('P-256\0'), contextData]), 16);

  // Derive nonce
  const nonce = hkdf(salt, ikm, Buffer.concat([Buffer.from('P-256\0'), contextData]), 12);

  // Encrypt using AES-128-GCM
  const cipher = crypto.createCipheriv('aes-128-gcm', contentEncryptionKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);

  // Append auth tag
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: Buffer.concat([ciphertext, authTag]),
    salt,
    nonce: Buffer.concat([Buffer.from([0x02]), nonce.slice(1)]), // Add record type prefix
  };
}

/**
 * Create JWT for Web Push authentication
 */
function createVapidJwt(privateKey: string, audience: string): string {
  const header = {
    alg: 'ES256',
    typ: 'JWT',
  };

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiration = issuedAt + 43200; // 12 hours

  const payload = {
    aud: audience,
    iss: process.env.WEBPUSH_SUBJECT || 'mailto:notifications@nilin.com',
    sub: process.env.WEBPUSH_SUBJECT || 'mailto:notifications@nilin.com',
    iat: issuedAt,
    exp: expiration,
  };

  // Create signature
  const signingInput = base64UrlEncode(Buffer.from(JSON.stringify(header))) + '.' +
    base64UrlEncode(Buffer.from(JSON.stringify(payload)));

  // Sign with ECDSA P-256
  const sign = crypto.createSign('SHA256');
  sign.update(signingInput);
  sign.end();

  const privateKeyBuffer = base64UrlDecode(privateKey);
  const signature = sign.sign({ key: privateKeyBuffer, dsaEncoding: 'ieee-p1363' });

  return signingInput + '.' + base64UrlEncode(signature);
}

/**
 * Compress payload using brotli (preferred) or gzip
 */
async function compressPayload(payload: Buffer): Promise<Buffer> {
  // Dynamic import to handle optional dependency
  try {
    const zlib = await import('zlib');
    return zlib.default.brotliCompressSync(payload, {
      params: {
        [zlib.default.constants.BROTLI_PARAM_QUALITY]: 11,
      },
    });
  } catch {
    // Fallback to gzip if brotli not available
    const zlib = await import('zlib');
    return zlib.default.gzipSync(payload);
  }
}

/**
 * Check rate limit for push notifications
 */
async function checkPushRateLimit(userId: string): Promise<boolean> {
  const cacheKey = `webpush:rate:${userId}`;
  const now = Date.now();

  // Try Redis first
  try {
    const redisClient = (cache as any).client;
    if (redisClient) {
      const exists = await redisClient.exists(cacheKey);
      if (exists) {
        const count = await redisClient.get(cacheKey);
        if (count && parseInt(count, 10) >= RATE_LIMIT_MAX_PUSH) {
          logger.debug('Web Push rate limited (Redis)', {
            context: 'WebPushService',
            action: 'RATE_LIMITED',
            userId,
          });
          return false;
        }
        await redisClient.incr(cacheKey);
        return true;
      }
      await redisClient.set(cacheKey, '1', 'EX', Math.ceil(RATE_LIMIT_WINDOW_MS / 1000));
      return true;
    }
  } catch (error) {
    logger.warn('Redis push rate limit check failed, using in-memory fallback', {
      context: 'WebPushService',
      action: 'RATE_LIMIT_FALLBACK',
      error: (error as Error).message,
    });
  }

  // Fallback to in-memory cache
  const entry = pushRateLimitCache.get(userId);
  if (entry && now - entry.windowStart < RATE_LIMIT_WINDOW_MS) {
    if (entry.count >= RATE_LIMIT_MAX_PUSH) {
      return false;
    }
    entry.count++;
    return true;
  }

  pushRateLimitCache.set(userId, { count: 1, windowStart: now });
  return true;
}

/**
 * Serialize push subscription for storage
 */
function serializeSubscription(subscription: PushSubscription): string {
  return JSON.stringify(subscription);
}

/**
 * Deserialize push subscription from storage
 */
function deserializeSubscription(data: string): PushSubscription {
  const parsed = JSON.parse(data);
  if (parsed && typeof parsed === 'object') {
    delete parsed.__proto__;
    delete parsed.constructor;
  }
  return parsed as PushSubscription;
}

// ============================================
// Web Push Service Class
// ============================================

export class WebPushService {
  private readonly isConfigured: boolean;
  private readonly publicKey: string | null;

  constructor() {
    this.isConfigured = vapidKeys !== null;
    this.publicKey = vapidKeys?.publicKey || null;
  }

  /**
   * Get the public VAPID key for client-side subscription
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Get application server key (same as public key, used by clients)
   */
  getApplicationServerKey(): string | null {
    return this.publicKey;
  }

  /**
   * Check if service is configured
   */
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  // ========================================
  // Subscription Management
  // ========================================

  /**
   * Save a push subscription for a user
   */
  async saveSubscription(
    userId: string,
    subscription: PushSubscription,
    userAgent?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate subscription
      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        return { success: false, error: 'Invalid subscription data' };
      }

      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      // Initialize pushSubscriptions array if it doesn't exist
      if (!user.pushSubscriptions) {
        user.pushSubscriptions = [];
      }

      // Check if subscription already exists (by endpoint)
      const existingIndex = user.pushSubscriptions.findIndex(
        (s: any) => s.endpoint === subscription.endpoint
      );

      if (existingIndex >= 0) {
        // Update existing subscription
        user.pushSubscriptions[existingIndex] = {
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          lastUsed: new Date(),
          userAgent,
        };
      } else {
        // Add new subscription
        user.pushSubscriptions.push({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          createdAt: new Date(),
          lastUsed: new Date(),
          userAgent,
        });

        // Limit subscriptions per user (max 5)
        if (user.pushSubscriptions.length > 5) {
          // Remove oldest subscription
          user.pushSubscriptions.shift();
        }
      }

      await user.save();

      logger.info('Push subscription saved', {
        context: 'WebPushService',
        action: 'SUBSCRIPTION_SAVED',
        userId,
        endpointHash: crypto.createHash('sha256').update(subscription.endpoint).digest('hex').substring(0, 16),
      });

      return { success: true };
    } catch (error) {
      logger.error('Failed to save push subscription', {
        context: 'WebPushService',
        action: 'SUBSCRIPTION_SAVE_ERROR',
        userId,
        error: (error as Error).message,
      });
      return { success: false, error: 'Failed to save subscription' };
    }
  }

  /**
   * Remove a push subscription
   */
  async removeSubscription(
    userId: string,
    endpoint: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
      }

      if (!user.pushSubscriptions) {
        return { success: true }; // Nothing to remove
      }

      const initialLength = user.pushSubscriptions.length;
      user.pushSubscriptions = user.pushSubscriptions.filter(
        (s: any) => s.endpoint !== endpoint
      );

      if (user.pushSubscriptions.length < initialLength) {
        await user.save();
        logger.info('Push subscription removed', {
          context: 'WebPushService',
          action: 'SUBSCRIPTION_REMOVED',
          userId,
        });
      }

      return { success: true };
    } catch (error) {
      logger.error('Failed to remove push subscription', {
        context: 'WebPushService',
        action: 'SUBSCRIPTION_REMOVE_ERROR',
        userId,
        error: (error as Error).message,
      });
      return { success: false, error: 'Failed to remove subscription' };
    }
  }

  /**
   * Remove all push subscriptions for a user
   */
  async removeAllSubscriptions(userId: string): Promise<void> {
    try {
      await User.findByIdAndUpdate(userId, {
        $set: { pushSubscriptions: [] },
      });

      logger.info('All push subscriptions removed', {
        context: 'WebPushService',
        action: 'ALL_SUBSCRIPTIONS_REMOVED',
        userId,
      });
    } catch (error) {
      logger.error('Failed to remove all push subscriptions', {
        context: 'WebPushService',
        action: 'ALL_SUBSCRIPTIONS_REMOVE_ERROR',
        userId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get all subscriptions for a user
   */
  async getUserSubscriptions(userId: string): Promise<PushSubscriptionRecord[]> {
    const user = await User.findById(userId).select('pushSubscriptions');
    if (!user || !user.pushSubscriptions) {
      return [];
    }

    return user.pushSubscriptions.map((s: any) => ({
      userId: user._id.toString(),
      endpoint: s.endpoint,
      p256dh: s.p256dh,
      auth: s.auth,
      createdAt: s.createdAt,
      lastUsed: s.lastUsed,
      userAgent: s.userAgent,
    }));
  }

  // ========================================
  // Send Push Notifications
  // ========================================

  /**
   * Send a push notification to a user
   */
  async sendPushNotification(
    userId: string,
    payload: WebPushPayload,
    options?: {
      notificationId?: string;
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
      ttl?: number;
    }
  ): Promise<{ success: boolean; error?: string; sent: number; failed: number }> {
    if (!this.isConfigured) {
      return { success: false, error: 'Web Push not configured', sent: 0, failed: 0 };
    }

    // Check rate limit
    if (!(await checkPushRateLimit(userId))) {
      return { success: false, error: 'Rate limit exceeded', sent: 0, failed: 0 };
    }

    // Get user subscriptions
    const subscriptions = await this.getUserSubscriptions(userId);
    if (subscriptions.length === 0) {
      return { success: false, error: 'No subscriptions found', sent: 0, failed: 0 };
    }

    // Prepare payload
    const payloadString = JSON.stringify(payload);
    const payloadBuffer = Buffer.from(payloadString);

    // Check payload size
    if (payloadBuffer.length > MAX_PAYLOAD_SIZE) {
      return { success: false, error: 'Payload too large', sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;
    const results: Array<{ success: boolean; endpoint: string }> = [];

    // Send to all subscriptions
    for (const subscription of subscriptions) {
      const result = await this.sendToSubscription(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payloadBuffer,
        options
      );

      results.push({ success: result.success, endpoint: subscription.endpoint });
      if (result.success) {
        sent++;
      } else {
        failed++;

        // If subscription is invalid (410 Gone), mark for removal
        if (result.shouldRemove) {
          await this.removeSubscription(userId, subscription.endpoint);
        }
      }
    }

    // Update notification record if provided
    if (options?.notificationId) {
      await this.updateNotificationPushStatus(options.notificationId, {
        sent: sent > 0,
        sentAt: sent > 0 ? new Date() : undefined,
        deliveryStatus: sent > 0 ? 'delivered' : failed > 0 ? 'failed' : 'pending',
      });
    }

    return {
      success: sent > 0,
      error: failed > 0 ? `${failed} failed` : undefined,
      sent,
      failed,
    };
  }

  /**
   * Send push notification to a single subscription
   */
  private async sendToSubscription(
    subscription: PushSubscription,
    payload: Buffer,
    options?: {
      notificationId?: string;
      urgency?: 'very-low' | 'low' | 'normal' | 'high';
      ttl?: number;
    }
  ): Promise<{ success: boolean; error?: string; shouldRemove?: boolean }> {
    if (!vapidKeys) {
      return { success: false, error: 'VAPID keys not configured' };
    }

    try {
      // Compress payload
      const compressedPayload = await compressPayload(payload);

      // Encrypt payload
      const { ciphertext, salt, nonce } = encryptPayload(subscription, compressedPayload);

      // Get audience from endpoint
      const url = new URL(subscription.endpoint);
      const audience = `${url.protocol}//${url.host}`;

      // Create VAPID JWT
      const jwt = createVapidJwt(vapidKeys.privateKey, audience);

      // Send to push gateway with 30-second timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
          'TTL': String(options?.ttl ?? TTL_SECONDS),
          'Urgency': options?.urgency ?? 'normal',
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          'Authorization': `vapid t=${jwt}, k=${vapidKeys.publicKey}`,
        },
        body: Buffer.concat([salt, nonce, ciphertext]),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        logger.debug('Push notification sent successfully', {
          context: 'WebPushService',
          action: 'PUSH_SENT',
          endpoint: subscription.endpoint.substring(0, 50) + '...',
        });
        return { success: true };
      }

      // Handle specific error codes
      if (response.status === 404 || response.status === 410) {
        // Subscription expired or invalid
        logger.warn('Push subscription expired or invalid', {
          context: 'WebPushService',
          action: 'SUBSCRIPTION_EXPIRED',
          status: response.status,
        });
        return { success: false, error: 'Subscription expired', shouldRemove: true };
      }

      if (response.status === 429) {
        // Rate limited by push service
        return { success: false, error: 'Push service rate limited' };
      }

      const errorText = await response.text();
      logger.error('Push notification failed', {
        context: 'WebPushService',
        action: 'PUSH_FAILED',
        status: response.status,
        error: errorText,
      });

      return { success: false, error: `HTTP ${response.status}` };
    } catch (error) {
      logger.error('Push notification error', {
        context: 'WebPushService',
        action: 'PUSH_ERROR',
        error: (error as Error).message,
      });
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Send push notification for booking events
   */
  async sendBookingPushNotification(
    userId: string,
    bookingNumber: string,
    eventType: 'confirmed' | 'reminder' | 'cancelled' | 'completed' | 'started',
    metadata?: {
      providerName?: string;
      serviceName?: string;
      scheduledDate?: string;
    }
  ): Promise<{ success: boolean; sent: number; failed: number }> {
    const messages: Record<string, { title: string; body: string }> = {
      confirmed: {
        title: 'Booking Confirmed',
        body: `Your booking #${bookingNumber} has been confirmed!${metadata?.serviceName ? ` ${metadata.serviceName}` : ''}`,
      },
      reminder: {
        title: 'Booking Reminder',
        body: `Reminder: Your booking #${bookingNumber} is coming up${metadata?.scheduledDate ? ` at ${metadata.scheduledDate}` : ''}.`,
      },
      cancelled: {
        title: 'Booking Cancelled',
        body: `Your booking #${bookingNumber} has been cancelled.`,
      },
      completed: {
        title: 'Service Completed',
        body: `Your booking #${bookingNumber} has been completed.${metadata?.providerName ? ` Thank you, ${metadata.providerName}!` : ''}`,
      },
      started: {
        title: 'Service Started',
        body: `Your service #${bookingNumber} has started.`,
      },
    };

    const message = messages[eventType];
    if (!message) {
      return { success: false, sent: 0, failed: 0 };
    }

    return this.sendPushNotification(userId, {
      title: message.title,
      body: message.body,
      icon: '/icons/icon-192x192.png',
      tag: `booking-${bookingNumber}`,
      data: {
        type: 'booking',
        bookingNumber,
        eventType,
        ...metadata,
      },
      requireInteraction: eventType === 'reminder',
    });
  }

  // ========================================
  // Subscription Validation
  // ========================================

  /**
   * Validate a push subscription
   */
  validateSubscription(subscription: any): { valid: boolean; error?: string } {
    if (!subscription) {
      return { valid: false, error: 'Subscription is required' };
    }

    if (!subscription.endpoint || typeof subscription.endpoint !== 'string') {
      return { valid: false, error: 'Invalid endpoint' };
    }

    if (!subscription.keys || typeof subscription.keys !== 'object') {
      return { valid: false, error: 'Missing keys' };
    }

    if (!subscription.keys.p256dh || typeof subscription.keys.p256dh !== 'string') {
      return { valid: false, error: 'Invalid p256dh key' };
    }

    if (!subscription.keys.auth || typeof subscription.keys.auth !== 'string') {
      return { valid: false, error: 'Invalid auth key' };
    }

    // Validate key lengths
    const p256dhBuffer = base64UrlDecode(subscription.keys.p256dh);
    if (p256dhBuffer.length !== 65) {
      return { valid: false, error: 'p256dh key must be 65 bytes' };
    }

    const authBuffer = base64UrlDecode(subscription.keys.auth);
    if (authBuffer.length < 16 || authBuffer.length > 256) {
      return { valid: false, error: 'auth key must be 16-256 bytes' };
    }

    return { valid: true };
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Update notification push channel status
   */
  private async updateNotificationPushStatus(
    notificationId: string,
    updates: Partial<{
      sent: boolean;
      sentAt: Date;
      deliveryStatus: string;
    }>
  ): Promise<void> {
    try {
      await BookingNotification.findByIdAndUpdate(notificationId, {
        $set: {
          'channels.webpush': {
            ...updates,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification push status', {
        context: 'WebPushService',
        action: 'UPDATE_NOTIFICATION_FAILED',
        notificationId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get subscription stats for a user
   */
  async getSubscriptionStats(userId: string): Promise<{
    totalSubscriptions: number;
    subscriptions: Array<{
      endpoint: string;
      createdAt: Date;
      lastUsed: Date;
    }>;
  }> {
    const subscriptions = await this.getUserSubscriptions(userId);

    return {
      totalSubscriptions: subscriptions.length,
      subscriptions: subscriptions.map(s => ({
        endpoint: s.endpoint.substring(0, 50) + '...',
        createdAt: s.createdAt,
        lastUsed: s.lastUsed,
      })),
    };
  }
}

// Export singleton instance
export const webPushService = new WebPushService();

// Export utilities for testing
export { base64UrlEncode, base64UrlDecode, encryptPayload, createVapidJwt };
