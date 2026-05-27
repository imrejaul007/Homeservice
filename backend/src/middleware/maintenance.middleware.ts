import { Request, Response, NextFunction } from 'express';
import PlatformSettings from '../models/settings.model';
import logger from '../utils/logger';

/**
 * Maintenance Mode Middleware
 *
 * Checks if the platform is in maintenance mode and blocks non-admin users.
 * Admins can still access the site during maintenance.
 *
 * Excluded paths:
 * - /api/health (health checks)
 * - /api/auth/* (authentication routes)
 * - /api/verify/* (email verification)
 * - Static assets
 * - Admin routes (already protected)
 */
export const checkMaintenanceMode = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip maintenance check for certain paths
    const skipPaths = [
      '/api/health',
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/verify',
      '/api/analytics', // Admin-only anyway
      '/api/settings',   // Admin-only anyway
    ];

    const path = req.path.toLowerCase();

    // Skip for excluded paths
    if (skipPaths.some(p => path.startsWith(p.toLowerCase()))) {
      next();
      return;
    }

    // Skip for static files
    if (path.includes('.') && !path.includes('/api/')) {
      next();
      return;
    }

    // Skip OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    // Get settings (with caching)
    const settings = await PlatformSettings.getSettings();

    // Check if maintenance mode is enabled
    if (settings.maintenanceMode) {
      // Check if user is admin
      const user = (req as any).user;

      if (user?.role !== 'admin') {
        res.status(503).json({
          success: false,
          error: 'Service Unavailable',
          message: settings.maintenanceMessage || 'The platform is currently under maintenance. Please try again later.',
          maintenanceMode: true,
          estimatedDuration: settings.maintenanceEstimatedDuration || null,
          supportEmail: settings.supportEmail || null,
        });
        return;
      }

      // Add maintenance header for admin awareness
      res.setHeader('X-Maintenance-Mode', 'true');
    }

    next();
  } catch (error) {
    // If settings can't be loaded, allow the request (fail open for non-critical errors)
    logger.error('Maintenance mode check error', {
      context: 'MaintenanceMiddleware',
      action: 'CHECK_ERROR',
      path: req.path,
      error: error instanceof Error ? error.message : String(error),
    });
    next();
  }
};

/**
 * Middleware to force maintenance mode check (for specific routes)
 * Use this when you need to ensure maintenance mode is checked
 */
export const forceMaintenanceCheck = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await PlatformSettings.getSettings();

    if (settings.maintenanceMode) {
      const user = (req as any).user;

      if (user?.role !== 'admin') {
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
