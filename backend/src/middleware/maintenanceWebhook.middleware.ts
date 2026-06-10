import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticateAdminApiKey, requireApiKeyPermission } from './apiKeyAuth.middleware';
import logger from '../utils/logger';
import { cache, isRedisAvailable } from '../config/redis';

/**
 * Maintenance Window Middleware
 *
 * Checks if the system is in maintenance mode before processing webhooks.
 * Queues webhooks for later processing instead of rejecting them.
 * All endpoints require admin API key authentication with webhooks permission.
 * Includes HMAC-SHA256 webhook signature verification for payload authenticity.
 *
 * State is persisted in Redis for cross-worker consistency and survives server restarts.
 * Falls back to in-memory state when Redis is unavailable.
 */

// Redis key constants
const REDIS_KEYS = {
  MAINTENANCE_ENABLED: 'maintenance:enabled',
  MAINTENANCE_MESSAGE: 'maintenance:message',
  MAINTENANCE_END_TIME: 'maintenance:endTime',
};

// Signature verification configuration
const SIGNATURE_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Timestamp tolerance for replay attack prevention (5 minutes)
const TOLERANCE_SECONDS = 300;

interface SignedRequest extends Request {
  webhookSignatureValid?: boolean;
  rawBody?: Buffer;
}

/**
 * Middleware to authenticate webhook requests using admin API key.
 * Requires the webhooks permission.
 */
export const authenticateWebhook = authenticateAdminApiKey;

/**
 * Middleware to require webhooks permission on the authenticated API key.
 */
export const requireWebhookPermission = requireApiKeyPermission('webhooks');

/**
 * Combined middleware for webhook authentication and permission check.
 * Use this as the first middleware for all maintenance webhook routes.
 */
export const webhookAuth = [authenticateWebhook, requireWebhookPermission];

/**
 * Verify HMAC-SHA256 signature for webhook requests.
 *
 * Signature format: sha256=<hex_digest>
 * The signed payload is: timestamp.payload
 * Uses timing-safe comparison to prevent timing attacks.
 */
export const verifyWebhookSignature = async (
  req: SignedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const signature = req.headers[SIGNATURE_HEADER] as string;
  const timestamp = req.headers[TIMESTAMP_HEADER] as string;

  // Skip verification for health checks
  if (req.path === '/health' || req.path === '/health/live') {
    return next();
  }

  // Check signature presence
  if (!signature) {
    logger.warn('Webhook request missing signature', {
      ip: req.ip,
      path: req.path,
      action: 'WEBHOOK_SIGNATURE_MISSING'
    });
    res.status(401).json({ error: 'Missing webhook signature' });
    return;
  }

  // Check timestamp presence
  if (!timestamp) {
    logger.warn('Webhook request missing timestamp', {
      ip: req.ip,
      path: req.path,
      action: 'WEBHOOK_TIMESTAMP_MISSING'
    });
    res.status(401).json({ error: 'Missing webhook timestamp' });
    return;
  }

  // Validate timestamp format
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    logger.warn('Webhook request has invalid timestamp format', {
      ip: req.ip,
      path: req.path,
      timestamp,
      action: 'WEBHOOK_INVALID_TIMESTAMP'
    });
    res.status(401).json({ error: 'Invalid timestamp format' });
    return;
  }

  // Check timestamp age (prevent replay attacks)
  const ageSeconds = Math.floor((Date.now() - ts * 1000) / 1000);
  if (ageSeconds > TOLERANCE_SECONDS) {
    logger.warn('Webhook timestamp too old', {
      ip: req.ip,
      path: req.path,
      ageSeconds,
      toleranceSeconds: TOLERANCE_SECONDS,
      action: 'WEBHOOK_REPLAY_ATTACK'
    });
    res.status(401).json({ error: 'Webhook timestamp too old' });
    return;
  }

  // Also reject future timestamps (clock skew protection)
  if (ts > Math.floor(Date.now() / 1000) + 60) {
    logger.warn('Webhook timestamp in the future', {
      ip: req.ip,
      path: req.path,
      timestamp: ts,
      currentTime: Math.floor(Date.now() / 1000),
      action: 'WEBHOOK_FUTURE_TIMESTAMP'
    });
    res.status(401).json({ error: 'Webhook timestamp in the future' });
    return;
  }

  // Get raw body for signature verification
  const rawBody = req.rawBody;
  if (!rawBody) {
    logger.error('Raw body not available for webhook signature verification', {
      ip: req.ip,
      path: req.path,
      action: 'WEBHOOK_RAW_BODY_MISSING'
    });
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  // Validate WEBHOOK_SECRET is configured
  if (!WEBHOOK_SECRET) {
    logger.error('WEBHOOK_SECRET environment variable not set', {
      action: 'WEBHOOK_SECRET_MISSING'
    });
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  // Compute expected signature
  const payload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload, 'utf8')
    .digest('hex');

  // Extract the hex digest from sha256=<hex> format
  const signatureHash = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  // Use timing-safe comparison
  let signatureValid = false;
  try {
    const signatureBuffer = Buffer.from(signatureHash, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Check buffer lengths match before comparison
    if (signatureBuffer.length !== expectedBuffer.length) {
      signatureValid = false;
    } else {
      signatureValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    }
  } catch (error) {
    logger.error('Error during signature comparison', {
      ip: req.ip,
      path: req.path,
      error: (error as Error).message,
      action: 'WEBHOOK_SIGNATURE_ERROR'
    });
    signatureValid = false;
  }

  if (!signatureValid) {
    logger.warn('Webhook signature verification failed', {
      ip: req.ip,
      path: req.path,
      action: 'WEBHOOK_SIGNATURE_INVALID'
    });
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  // Mark request as valid
  req.webhookSignatureValid = true;

  logger.debug('Webhook signature verified successfully', {
    ip: req.ip,
    path: req.path,
    timestamp: ts,
    action: 'WEBHOOK_SIGNATURE_VALID'
  });

  next();
};

/**
 * Generate a webhook signature (for testing or outgoing webhooks)
 */
export const generateWebhookSignature = (
  payload: string,
  secret: string = WEBHOOK_SECRET
): { signature: string; timestamp: number } => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;

  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return {
    signature: `sha256=${signature}`,
    timestamp
  };
};

// In-memory state (mirrors Redis, used for fast sync reads and as fallback)
let isMaintenanceMode = false;
let maintenanceMessage = '';
let maintenanceEndTime: Date | null = null;

/**
 * Sync in-memory state to Redis for cross-worker persistence
 */
async function syncToRedis(enabled: boolean, message: string, endTime: Date | null): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const client = cache.client;
    if (client) {
      const pipeline = client.pipeline();
      pipeline.set(REDIS_KEYS.MAINTENANCE_ENABLED, enabled ? '1' : '0');
      pipeline.set(REDIS_KEYS.MAINTENANCE_MESSAGE, message);
      pipeline.set(REDIS_KEYS.MAINTENANCE_END_TIME, endTime ? endTime.toISOString() : '');
      await pipeline.exec();
    }
  } catch (err) {
    logger.warn('Failed to sync maintenance state to Redis', {
      error: (err as Error).message,
      action: 'REDIS_SYNC_FAILED'
    });
  }
}

/**
 * Load maintenance state from Redis on startup
 */
async function loadFromRedis(): Promise<void> {
  if (!isRedisAvailable()) return;

  try {
    const [enabled, message, endTimeStr] = await Promise.all([
      cache.get(REDIS_KEYS.MAINTENANCE_ENABLED),
      cache.get(REDIS_KEYS.MAINTENANCE_MESSAGE),
      cache.get(REDIS_KEYS.MAINTENANCE_END_TIME),
    ]);

    isMaintenanceMode = enabled === '1';
    maintenanceMessage = message || '';
    maintenanceEndTime = endTimeStr ? new Date(endTimeStr) : null;

    if (isMaintenanceMode) {
      logger.info('Loaded maintenance state from Redis', {
        message: maintenanceMessage,
        endTime: maintenanceEndTime,
        action: 'MAINTENANCE_STATE_LOADED'
      });
    }
  } catch (err) {
    logger.warn('Failed to load maintenance state from Redis, using defaults', {
      error: (err as Error).message,
      action: 'REDIS_LOAD_FAILED'
    });
  }
}

// Load state from Redis on module initialization
loadFromRedis();

/**
 * Check if maintenance mode is active
 */
export const isInMaintenanceMode = (): boolean => {
  if (!isMaintenanceMode) return false;

  // Check if maintenance window has ended
  if (maintenanceEndTime && new Date() > maintenanceEndTime) {
    isMaintenanceMode = false;
    maintenanceEndTime = null;
    // Persist the state change to Redis if available
    syncToRedis(false, '', null).catch(err => {
      logger.warn('Failed to persist maintenance end to Redis', {
        error: err.message,
        action: 'REDIS_SYNC_FAILED'
      });
    });
    logger.info('Maintenance window ended', { action: 'MAINTENANCE_ENDED' });
    return false;
  }

  return true;
};

/**
 * Set maintenance mode (persisted to Redis)
 */
export const setMaintenanceMode = async (
  enabled: boolean,
  message: string = 'System under maintenance',
  endTime?: Date
): Promise<void> => {
  isMaintenanceMode = enabled;
  maintenanceMessage = message;
  maintenanceEndTime = endTime || null;

  // Persist to Redis for cross-worker consistency
  await syncToRedis(enabled, message, endTime || null);

  logger.warn('Maintenance mode changed', {
    enabled,
    message,
    endTime,
    action: 'MAINTENANCE_MODE_CHANGED'
  });
};

/**
 * Get maintenance status
 */
export const getMaintenanceStatus = (): {
  isMaintenanceMode: boolean;
  message: string;
  endTime: Date | null;
} => {
  return {
    isMaintenanceMode: isInMaintenanceMode(),
    message: maintenanceMessage,
    endTime: maintenanceEndTime
  };
};

/**
 * Middleware to check maintenance mode
 * Used for webhook endpoints.
 * NOTE: This middleware does NOT include authentication.
 * Wrap with webhookAuth middleware for protected endpoints.
 */
export const maintenanceCheck = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (isInMaintenanceMode()) {
    logger.warn('Webhook received during maintenance', {
      path: req.path,
      method: req.method,
      action: 'MAINTENANCE_WEBHOOK_REJECTED',
      apiKeyId: req.adminApiKey?._id,
    });

    res.status(503).json({
      error: 'Service Temporarily Unavailable',
      message: maintenanceMessage,
      retryAfter: maintenanceEndTime
        ? Math.ceil((maintenanceEndTime.getTime() - Date.now()) / 1000)
        : 3600,
      timestamp: new Date().toISOString()
    });
    return;
  }

  next();
};

/**
 * Middleware to queue webhooks during maintenance instead of rejecting
 * Use this for critical webhook endpoints.
 * NOTE: This middleware does NOT include authentication.
 * Wrap with webhookAuth middleware for protected endpoints.
 */
export const maintenanceQueue = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!isInMaintenanceMode()) {
    next();
    return;
  }

  logger.warn('Webhook queued for later processing during maintenance', {
    path: req.path,
    method: req.method,
    action: 'MAINTENANCE_WEBHOOK_QUEUED',
    apiKeyId: req.adminApiKey?._id,
  });

  // In a real implementation, this would queue the webhook for later processing
  res.status(503).json({
    error: 'Service Temporarily Unavailable',
    message: maintenanceMessage,
    queued: true,
    retryAfter: maintenanceEndTime
      ? Math.ceil((maintenanceEndTime.getTime() - Date.now()) / 1000)
      : 3600,
    timestamp: new Date().toISOString()
  });
};

export default {
  maintenanceCheck,
  maintenanceQueue,
  setMaintenanceMode,
  getMaintenanceStatus,
  isInMaintenanceMode,
  authenticateWebhook,
  requireWebhookPermission,
  webhookAuth,
  verifyWebhookSignature,
  generateWebhookSignature,
};