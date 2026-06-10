import { Request, Response, NextFunction } from 'express';
import PlatformSettings from '../models/settings.model';
import logger from '../utils/logger';

const SKIP_PREFIXES = [
  '/api/health',
  '/health',
  '/api/platform/settings',
  '/api/admin/auth',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh-token',
  '/api/auth/csrf-token',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/verify',
  '/api/webhooks',
  '/api/integrations',
];

function shouldSkipPath(path: string): boolean {
  const normalized = path.toLowerCase();
  return SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix.toLowerCase()));
}

function getAdminRoleFromRequest(req: Request): string | null {
  // Use req.user populated by auth middleware - follows established pattern
  const user = (req as Request & { user?: { role?: string } }).user;
  return user?.role || null;
}

/**
 * Blocks non-admin API traffic when maintenance mode is enabled.
 * Admins bypass by checking req.user.role (populated by auth middleware).
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

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-cache, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const durationMs = parseInt(settings.maintenanceEstimatedDuration || '0', 10);
    const retryAfter = durationMs > 0
      ? Math.max(300, Math.ceil(durationMs / 1000))
      : 3600;
    res.setHeader('Retry-After', String(retryAfter));

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
    logger.error('Maintenance mode check error - failing closed for security', {
      context: 'MaintenanceMiddleware',
      action: 'CHECK_ERROR',
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
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
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, no-cache, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Retry-After', '3600');

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
    logger.error('Force maintenance check error - failing closed for security', {
      context: 'MaintenanceMiddleware',
      action: 'FORCE_CHECK_ERROR',
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
    });
    next(error);
  }
};

export default checkMaintenanceMode;
