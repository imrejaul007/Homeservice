import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  getPlatformPolicySync,
  isAdminIpAllowed,
} from '../services/platformSettingsPolicy.service';
import { require2FA } from './auth.middleware';

/** Known trusted proxy ranges (localhost and private networks) */
const TRUSTED_PROXY_PATTERNS = [
  /^127\./,           // 127.0.0.0/8 - localhost
  /^10\./,            // 10.0.0.0/8 - private
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 - private
  /^192\.168\./,      // 192.168.0.0/16 - private
  /^169\.254\./,      // 169.254.0.0/16 - link-local (Docker, etc.)
];

function isTrustedProxy(ip: string): boolean {
  return TRUSTED_PROXY_PATTERNS.some((pattern) => pattern.test(ip));
}

function resolveClientIp(req: Request): string {
  const directIp = req.ip || req.socket.remoteAddress || '';

  // Only trust X-Forwarded-For when request comes from a trusted proxy
  if (isTrustedProxy(directIp)) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
  }

  // Fall back to direct connection IP when not from trusted proxy
  return directIp;
}

/** When IP allowlist is configured, restrict admin routes to listed IPs */
export const enforceAdminIpAllowlist = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    // Skip IP check for unauthenticated requests — authentication middleware
    // will handle rejecting them. This prevents timing attacks that could
    // reveal which IPs are in the allowlist.
    if (!req.user) {
      return next();
    }

    const policy = getPlatformPolicySync();
    if (!policy.ipAllowlist.length) {
      return next();
    }

    const clientIp = resolveClientIp(req);
    if (!isAdminIpAllowed(clientIp, policy)) {
      throw new ApiError(403, 'Admin access is not allowed from this IP address');
    }
    return next();
  }
);

/** When platform require2FA is on, all authenticated users must have 2FA enabled */
export const enforcePlatformRequire2FA = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const policy = getPlatformPolicySync();
    if (!policy.require2FA) {
      return next();
    }
    return require2FA(req, res, next);
  }
);

/** Skip audit logging when disabled in platform settings */
export const shouldRecordAuditLog = (): boolean => getPlatformPolicySync().enableAuditLogs;
