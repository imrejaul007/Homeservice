import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';

/**
 * Webhook Signature Verification Middleware
 *
 * Verifies HMAC signatures for incoming webhook requests to ensure
 * authenticity and integrity. Uses crypto.timingSafeEqual for
 * timing-attack resistant comparison.
 */

// Signature header names
const SIGNATURE_HEADER = 'x-webhook-signature';
const TIMESTAMP_HEADER = 'x-webhook-timestamp';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

// Tolerance for timestamp validation (5 minutes in seconds)
const TOLERANCE_SECONDS = 300;

interface SignedRequest extends Request {
  webhookSignatureValid?: boolean;
  webhookTimestamp?: number;
  rawBody?: Buffer;
}

/**
 * Verify HMAC signature for webhook requests
 *
 * Signature format: sha256=<hex_digest>
 * The signed payload is: timestamp.payload
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

  // Validate timestamp
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
  // The body should already be parsed, so we need to reconstruct
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

  // Compute expected signature
  const secret = WEBHOOK_SECRET;
  if (!secret) {
    logger.error('WEBHOOK_SECRET environment variable not set', {
      action: 'WEBHOOK_SECRET_MISSING'
    });
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Extract the hex digest from 'sha256=<hex>' format
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
  req.webhookTimestamp = ts;

  logger.debug('Webhook signature verified successfully', {
    ip: req.ip,
    path: req.path,
    timestamp: ts,
    action: 'WEBHOOK_SIGNATURE_VALID'
  });

  next();
};

/**
 * Verify HMAC signature from a buffer (for testing or manual verification)
 */
export const verifySignatureBuffer = (
  payload: string,
  signature: string,
  secret: string
): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  const signatureHash = signature.startsWith('sha256=')
    ? signature.slice(7)
    : signature;

  try {
    const signatureBuffer = Buffer.from(signatureHash, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
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

export default {
  verifyWebhookSignature,
  verifySignatureBuffer,
  generateWebhookSignature
};
