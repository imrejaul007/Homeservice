import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';

/**
 * Tenant validation middleware to ensure users can only access resources
 * within their own tenant context.
 *
 * This middleware validates that:
 * 1. A tenant context exists (tenantId is set on request)
 * 2. The authenticated user's tenant matches the request's tenant context
 * 3. Prevents cross-tenant data access (IDOR protection for tenants)
 */
export const validateTenantAccess = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const tenantId = (req as any).tenantId;
  const user = req.user;

  // Check if tenant context exists
  if (!tenantId) {
    logger.warn('Tenant validation failed: No tenant context', {
      action: 'TENANT_VALIDATION_FAILED',
      userId: user?._id?.toString(),
      path: req.path,
      ip: req.ip,
    });
    throw new ApiError(400, 'Tenant context is required');
  }

  // Validate tenantId format
  const validTenantIdFormats = ['000000000000000000000000']; // Default tenant
  const isValidFormat = validTenantIdFormats.includes(tenantId) ||
                        mongoose.Types.ObjectId.isValid(tenantId);

  if (!isValidFormat) {
    logger.warn('Tenant validation failed: Invalid tenant ID format', {
      action: 'INVALID_TENANT_FORMAT',
      tenantId,
      userId: user?._id?.toString(),
      path: req.path,
    });
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // If user is authenticated, validate their tenant matches the request tenant
  if (user) {
    const userTenantId = user.tenantId?.toString();

    // User's tenant must match the request's tenant context
    // Exception: Admins can access any tenant
    if (user.role !== 'admin' && userTenantId && userTenantId !== tenantId) {
      logger.warn('Cross-tenant access attempt blocked', {
        action: 'CROSS_TENANT_ACCESS_BLOCKED',
        userId: user._id.toString(),
        userTenantId,
        requestTenantId: tenantId,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });
      throw new ApiError(403, 'Access denied: You do not have permission to access this tenant');
    }

    // Log successful tenant validation
    logger.debug('Tenant access validated', {
      action: 'TENANT_VALIDATED',
      userId: user._id.toString(),
      tenantId,
      role: user.role,
    });
  }

  next();
});

/**
 * Optional tenant validation - logs warning but doesn't block if no tenant context
 * Use for public endpoints that should work with or without tenant context
 */
export const validateTenantAccessOptional = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const tenantId = (req as any).tenantId;
  const user = req.user;

  // If no tenant context, allow but log
  if (!tenantId) {
    logger.debug('No tenant context for optional validation', {
      path: req.path,
      userId: user?._id?.toString(),
    });
    return next();
  }

  // Validate tenantId format
  const validTenantIdFormats = ['000000000000000000000000'];
  const isValidFormat = validTenantIdFormats.includes(tenantId) ||
                        mongoose.Types.ObjectId.isValid(tenantId);

  if (!isValidFormat) {
    logger.warn('Optional tenant validation failed: Invalid tenant ID format', {
      action: 'INVALID_TENANT_FORMAT_OPTIONAL',
      tenantId,
      userId: user?._id?.toString(),
    });
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // If user is authenticated, validate their tenant matches
  if (user) {
    const userTenantId = user.tenantId?.toString();

    if (user.role !== 'admin' && userTenantId && userTenantId !== tenantId) {
      logger.warn('Cross-tenant access attempt blocked (optional validation)', {
        action: 'CROSS_TENANT_ACCESS_BLOCKED_OPTIONAL',
        userId: user._id.toString(),
        userTenantId,
        requestTenantId: tenantId,
        path: req.path,
      });
      throw new ApiError(403, 'Access denied: You do not have permission to access this tenant');
    }
  }

  next();
});

export default {
  validateTenantAccess,
  validateTenantAccessOptional,
};
