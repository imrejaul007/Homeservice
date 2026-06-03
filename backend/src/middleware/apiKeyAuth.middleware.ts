import { Request, Response, NextFunction } from 'express';
import AdminApiKey, { IAdminApiKey } from '../models/adminApiKey.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      adminApiKey?: IAdminApiKey;
    }
  }
}

function extractApiKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) {
    return header.trim();
  }
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return null;
}

/**
 * Authenticate requests using an admin integration API key (admin_ prefix).
 * Sets req.adminApiKey on success.
 */
export const authenticateAdminApiKey = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const plainKey = extractApiKey(req);
    if (!plainKey) {
      throw ApiError.unauthorized('API key required', ERROR_CODES.UNAUTHORIZED);
    }

    if (!plainKey.startsWith('admin_')) {
      throw ApiError.unauthorized('Invalid API key format', ERROR_CODES.UNAUTHORIZED);
    }

    const apiKey = await AdminApiKey.verifyKey(plainKey);
    if (!apiKey) {
      throw ApiError.unauthorized('Invalid or expired API key', ERROR_CODES.UNAUTHORIZED);
    }

    await apiKey.recordUsage();
    req.adminApiKey = apiKey;

    logger.debug('Admin API key authenticated', {
      action: 'API_KEY_AUTH',
      apiKeyId: apiKey._id,
      keyPrefix: apiKey.keyPrefix,
    });

    next();
  }
);

/**
 * Require one or more permissions on the authenticated API key.
 */
export const requireApiKeyPermission = (...permissions: string[]) =>
  asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const apiKey = req.adminApiKey;
    if (!apiKey) {
      throw ApiError.unauthorized('API key required', ERROR_CODES.UNAUTHORIZED);
    }

    const hasAll =
      permissions.length === 0 ||
      permissions.every((p) => apiKey.permissions.includes(p) || apiKey.permissions.includes('admin'));

    if (!hasAll) {
      throw ApiError.forbidden(
        `API key missing required permission(s): ${permissions.join(', ')}`,
        ERROR_CODES.FORBIDDEN
      );
    }

    next();
  });
