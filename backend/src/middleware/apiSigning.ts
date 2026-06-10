import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SIGNATURE_HEADER = 'x-signature';
const TIMESTAMP_HEADER = 'x-timestamp';
const INTERNAL_SERVICE_HEADER = 'x-internal-service';
const SIGNATURE_TTL = 300000; // 5 minutes

// Internal service token - must be set in environment variables
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

// API signing secret - must be set in environment variables (fail fast if missing)
const API_SIGNING_SECRET = process.env.API_SIGNING_SECRET;
if (!API_SIGNING_SECRET) {
  throw new Error('API_SIGNING_SECRET environment variable is required but not set');
}

interface SignedRequest extends Request {
  signatureValid?: boolean;
}

export const verifySignature = async (
  req: SignedRequest,
  res: Response,
  next: NextFunction
) => {
  const signature = req.headers[SIGNATURE_HEADER] as string;
  const timestamp = req.headers[TIMESTAMP_HEADER] as string;

  // Skip for public endpoints
  const publicPaths = ['/health', '/api/public', '/webhook'];
  if (publicPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  // Check signature presence
  if (!signature || !timestamp) {
    // Allow unsigned for internal services only with valid token
    const internalServiceHeader = req.headers[INTERNAL_SERVICE_HEADER] as string | undefined;
    if (internalServiceHeader && INTERNAL_SERVICE_TOKEN) {
      // Use timing-safe comparison to prevent timing attacks
      const headerBuffer = Buffer.from(internalServiceHeader);
      const tokenBuffer = Buffer.from(INTERNAL_SERVICE_TOKEN);
      if (headerBuffer.length === tokenBuffer.length &&
          crypto.timingSafeEqual(headerBuffer, tokenBuffer)) {
        return next();
      }
    }
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Validate timestamp
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Date.now() - ts > SIGNATURE_TTL) {
    return res.status(401).json({ error: 'Signature expired' });
  }

  // Verify signature format (must be valid 64-char hex for sha256)
  if (!/^[a-f0-9]{64}$/i.test(signature)) {
    return res.status(401).json({ error: 'Invalid signature format' });
  }

  // Verify signature
  const secret = API_SIGNING_SECRET;
  const payload = `${req.method}:${req.path}:${timestamp}:${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  // timingSafeEqual throws TypeError if lengths differ - must check first
  if (signatureBuffer.length !== expectedBuffer.length) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  req.signatureValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!req.signatureValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};
