import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const SIGNATURE_HEADER = 'x-signature';
const TIMESTAMP_HEADER = 'x-timestamp';
const SIGNATURE_TTL = 300000; // 5 minutes

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
    // Allow unsigned for internal services
    if (req.headers['x-internal-service']) {
      return next();
    }
    return res.status(401).json({ error: 'Missing signature' });
  }

  // Validate timestamp
  const ts = parseInt(timestamp);
  if (isNaN(ts) || Date.now() - ts > SIGNATURE_TTL) {
    return res.status(401).json({ error: 'Signature expired' });
  }

  // Verify signature
  const secret = process.env.API_SIGNING_SECRET || '';
  const payload = `${req.method}:${req.path}:${timestamp}:${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  req.signatureValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!req.signatureValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
};
