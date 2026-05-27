import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Maintenance Window Middleware
 * 
 * Checks if the system is in maintenance mode before processing webhooks.
 * Queues webhooks for later processing instead of rejecting them.
 */

// In-memory maintenance state (in production, this would be in Redis)
let isMaintenanceMode = false;
let maintenanceMessage = '';
let maintenanceEndTime: Date | null = null;

/**
 * Check if maintenance mode is active
 */
export const isInMaintenanceMode = (): boolean => {
  if (!isMaintenanceMode) return false;
  
  // Check if maintenance window has ended
  if (maintenanceEndTime && new Date() > maintenanceEndTime) {
    isMaintenanceMode = false;
    maintenanceEndTime = null;
    logger.info('Maintenance window ended', { action: 'MAINTENANCE_ENDED' });
    return false;
  }
  
  return true;
};

/**
 * Set maintenance mode
 */
export const setMaintenanceMode = (
  enabled: boolean,
  message: string = 'System under maintenance',
  endTime?: Date
): void => {
  isMaintenanceMode = enabled;
  maintenanceMessage = message;
  maintenanceEndTime = endTime || null;
  
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
 * Used for webhook endpoints
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
      action: 'MAINTENANCE_WEBHOOK_REJECTED'
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
 * Use this for critical webhook endpoints
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
    action: 'MAINTENANCE_WEBHOOK_QUEUED'
  });

  // In a real implementation, this would queue the webhook for later processing
  // For now, we'll return a 503 with retry guidance
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
  isInMaintenanceMode
};
