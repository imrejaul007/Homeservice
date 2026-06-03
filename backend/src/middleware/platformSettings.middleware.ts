import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import {
  getPlatformPolicySync,
  isAdminIpAllowed,
} from '../services/platformSettingsPolicy.service';
import { require2FA } from './auth.middleware';

function resolveClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '';
}

/** When IP allowlist is configured, restrict admin routes to listed IPs */
export const enforceAdminIpAllowlist = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
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
