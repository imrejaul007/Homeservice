import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import PlatformSettings from '../models/settings.model';
import logger from '../utils/logger';

type MaintenanceJwt = { id?: string; role?: string };

const SKIP_PREFIXES = [
  '/api/health',
  '/health',
  '/api/platform/maintenance',
  '/api/admin',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh-token',
  '/api/auth/csrf-token',
  '/api/verify',
  '/api/webhooks',
  '/api/integrations',
];

function shouldSkipPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

function getAdminRoleFromRequest(req: Request): string | null {
  const user = (req as Request & { user?: { role?: string } }).user;
  if (user?.role) return user.role;

  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const token = auth.slice(7);
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET as string
    ) as MaintenanceJwt;
    return decoded.role || null;
  } catch {
    return null;
  }
}

/**
 * Blocks non-admin API traffic when maintenance mode is enabled.
 * Admins bypass via JWT role (decoded here because this runs before route auth).
 */
export const checkMaintenanceMode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const path = req.path.toLowerCase();

    if (shouldSkipPath(path)) {
      next();
      return;
    }

    if (path.includes('.') && !path.includes('/api/')) {
      next();
      return;
    }

    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    const settings = await PlatformSettings.getSettings();

    if (!settings.maintenanceMode) {
      next();
      return;
    }

    const role = getAdminRoleFromRequest(req);
    if (role === 'admin') {
      res.setHeader('X-Maintenance-Mode', 'true');
      next();
      return;
    }

    res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message:
        settings.maintenanceMessage ||
        'The platform is currently under maintenance. Please try again later.',
      maintenanceMode: true,
      estimatedDuration: settings.maintenanceEstimatedDuration || null,
      supportEmail: settings.supportEmail || null,
    });
  } catch (error) {
    logger.error('Maintenance mode check error', {
      context: 'MaintenanceMiddleware',
      action: 'CHECK_ERROR',
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
};

export const forceMaintenanceCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await PlatformSettings.getSettings();

    if (settings.maintenanceMode) {
      const role = getAdminRoleFromRequest(req);
      if (role !== 'admin') {
        res.status(503).json({
          success: false,
          error: 'Service Unavailable',
          message: settings.maintenanceMessage || 'The platform is currently under maintenance.',
          maintenanceMode: true,
        });
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('Force maintenance check error', {
      context: 'MaintenanceMiddleware',
      action: 'FORCE_CHECK_ERROR',
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
};

export default checkMaintenanceMode;
