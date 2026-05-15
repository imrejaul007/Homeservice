import { Request, Response, NextFunction } from 'express';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { rbacService, PERMISSION_CATEGORIES } from '../services/rbac.service';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

declare global {
  namespace Express {
    interface Request {
      permissions?: string[];
      effectivePermissions?: string[];
    }
  }
}

export type Permission =
  | 'booking:create'
  | 'booking:read'
  | 'booking:read:all'
  | 'booking:update'
  | 'booking:update:all'
  | 'booking:delete'
  | 'service:create'
  | 'service:read'
  | 'service:read:all'
  | 'service:update'
  | 'service:update:all'
  | 'service:delete'
  | 'user:read'
  | 'user:read:all'
  | 'user:update'
  | 'user:update:all'
  | 'user:delete'
  | 'provider:read'
  | 'provider:read:all'
  | 'provider:approve'
  | 'provider:suspend'
  | 'provider:delete'
  | 'analytics:read'
  | 'analytics:export'
  | 'analytics:dashboard'
  | 'settings:read'
  | 'settings:manage'
  | 'settings:system'
  | 'finance:read'
  | 'finance:manage'
  | 'wallet:manage'
  | 'payout:process'
  | 'commission:view'
  | 'content:create'
  | 'content:read'
  | 'content:update'
  | 'content:delete'
  | 'category:manage'
  | 'security:audit'
  | 'security:logs'
  | 'security:configure'
  | 'role:manage'
  | 'permission:assign'
  | 'compliance:view'
  | 'compliance:reports'
  | 'gdpr:manage'
  | 'consent:manage'
  | 'admin:all'
  | '*';

export type ResourceAction = {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
};

// ============================================
// Core Permission Middleware
// ============================================

/**
 * Load and attach user permissions to request
 */
export const loadPermissions = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    try {
      const permissions = await rbacService.getUserPermissions(req.user._id.toString());
      req.permissions = permissions;
      req.effectivePermissions = permissions;

      next();
    } catch (error) {
      logger.error('Failed to load user permissions', {
        userId: req.user._id,
        error: (error as Error).message,
      });
      next(error);
    }
  }
);

/**
 * Check if user has a specific permission
 */
export const requirePermission = (permission: Permission) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    // Load permissions if not already loaded
    if (!req.permissions) {
      req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
    }

    // Check for wildcard permission (admin:all grants all)
    if (req.permissions.includes('admin:all') || req.permissions.includes('*')) {
      return next();
    }

    // Check for the specific permission
    if (!req.permissions.includes(permission)) {
      // Check for wildcard on the resource (e.g., 'booking:*' covers 'booking:read')
      const [resource, action] = permission.split(':');
      const wildcardPermission = `${resource}:*`;

      if (!req.permissions.includes(wildcardPermission)) {
        logger.warn('Permission denied', {
          userId: req.user._id,
          requiredPermission: permission,
          userPermissions: req.permissions,
          path: req.path,
        });

        throw new ApiError(
          403,
          `Permission denied: '${permission}' required`,
          [],
          ERROR_CODES.ACCESS_DENIED
        );
      }
    }

    next();
  });
};

/**
 * Check if user has ALL of the specified permissions
 */
export const requirePermissions = (permissions: Permission[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    // Load permissions if not already loaded
    if (!req.permissions) {
      req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
    }

    // Check for wildcard permission (admin:all grants all)
    if (req.permissions.includes('admin:all') || req.permissions.includes('*')) {
      return next();
    }

    const missingPermissions = permissions.filter(
      (p) => !req.permissions!.includes(p)
    );

    // Check for wildcards that might cover missing permissions
    const coveredByWildcard = missingPermissions.filter((mp) => {
      const [resource] = mp.split(':');
      return req.permissions!.includes(`${resource}:*`);
    });

    const trulyMissing = missingPermissions.filter(
      (mp) => !coveredByWildcard.includes(mp)
    );

    if (trulyMissing.length > 0) {
      logger.warn('Permissions denied', {
        userId: req.user._id,
        requiredPermissions: permissions,
        missingPermissions: trulyMissing,
        path: req.path,
      });

      throw new ApiError(
        403,
        `Missing permissions: ${trulyMissing.join(', ')}`,
        [],
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  });
};

/**
 * Check if user has ANY of the specified permissions
 */
export const requireAnyPermission = (permissions: Permission[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    // Load permissions if not already loaded
    if (!req.permissions) {
      req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
    }

    // Check for wildcard permission (admin:all grants all)
    if (req.permissions.includes('admin:all') || req.permissions.includes('*')) {
      return next();
    }

    const hasAnyPermission = permissions.some(
      (p) => req.permissions!.includes(p)
    );

    // Also check for wildcards
    const hasWildcardCoverage = permissions.some((p) => {
      const [resource] = p.split(':');
      return req.permissions!.includes(`${resource}:*`);
    });

    if (!hasAnyPermission && !hasWildcardCoverage) {
      logger.warn('No matching permission found', {
        userId: req.user._id,
        checkedPermissions: permissions,
        userPermissions: req.permissions,
        path: req.path,
      });

      throw new ApiError(
        403,
        'Access denied: insufficient permissions',
        [],
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  });
};

// ============================================
// Resource-Based Permission Middleware
// ============================================

/**
 * Check permission for a specific resource action
 */
export const requireResourcePermission = (
  resource: string,
  action: 'create' | 'read' | 'update' | 'delete'
) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    // Load permissions if not already loaded
    if (!req.permissions) {
      req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
    }

    // Build permission string
    const permission = `${resource}:${action === 'create' ? 'create' : action}`;
    const allPermission = `${resource}:${action}:all`;

    // Check for wildcard permission (admin:all grants all)
    if (req.permissions.includes('admin:all') || req.permissions.includes('*')) {
      return next();
    }

    // Check for specific permission or :all variant
    if (!req.permissions.includes(permission) && !req.permissions.includes(allPermission)) {
      // Check for wildcard
      const [res] = permission.split(':');
      if (!req.permissions.includes(`${res}:*`)) {
        throw new ApiError(
          403,
          `Permission denied: cannot ${action} this ${resource}`,
          [],
          ERROR_CODES.ACCESS_DENIED
        );
      }
    }

    next();
  });
};

// ============================================
// Admin Hierarchy Middleware
// ============================================

/**
 * Check if user is in admin hierarchy
 */
export const requireAdmin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    const isAdmin = await rbacService.isInAdminHierarchy(req.user._id.toString());

    if (!isAdmin) {
      throw new ApiError(
        403,
        'Admin access required',
        [],
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  }
);

/**
 * Check if user can manage another user
 */
export const requireCanManageUser = (targetUserIdParam: string = 'userId') => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    const targetUserId = req.params[targetUserIdParam] || req.body[targetUserIdParam];

    // Users can always manage themselves
    if (targetUserId === req.user._id.toString()) {
      return next();
    }

    const canManage = await rbacService.canManageUser(
      req.user._id.toString(),
      targetUserId
    );

    if (!canManage) {
      throw new ApiError(
        403,
        'You do not have permission to manage this user',
        [],
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  });
};

// ============================================
// Role Management Middleware
// ============================================

/**
 * Check if user can manage roles
 */
export const requireRoleManagement = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    // Load permissions if not already loaded
    if (!req.permissions) {
      req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
    }

    const canManageRoles =
      req.permissions.includes('role:manage') ||
      req.permissions.includes('security:configure') ||
      req.permissions.includes('admin:all') ||
      req.permissions.includes('*');

    if (!canManageRoles) {
      throw new ApiError(
        403,
        'Role management permission required',
        [],
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  }
);

/**
 * Check if user can assign permissions
 */
export const requirePermissionAssignment = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required', [], ERROR_CODES.UNAUTHORIZED);
    }

    // Load permissions if not already loaded
    if (!req.permissions) {
      req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
    }

    const canAssignPermissions =
      req.permissions.includes('permission:assign') ||
      req.permissions.includes('security:configure') ||
      req.permissions.includes('admin:all') ||
      req.permissions.includes('*');

    if (!canAssignPermissions) {
      throw new ApiError(
        403,
        'Permission assignment not allowed',
        [],
        ERROR_CODES.ACCESS_DENIED
      );
    }

    next();
  }
);

// ============================================
// Conditional Permission Middleware
// ============================================

/**
 * Skip middleware if condition is met
 */
export const skipIf = (condition: (req: Request) => boolean) => {
  return (middleware: any) => {
    return asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
      if (condition(req)) {
        return next();
      }
      return middleware(req, res, next);
    });
  };
};

/**
 * Conditional permission check (only require if user is authenticated)
 */
export const requirePermissionIfAuthenticated = (permission: Permission) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    // Skip if not authenticated
    if (!req.user) {
      return next();
    }

    // Skip if loading permissions fails
    if (!req.permissions) {
      try {
        req.permissions = await rbacService.getUserPermissions(req.user._id.toString());
      } catch {
        return next();
      }
    }

    // Check permission
    if (req.permissions.includes('admin:all') || req.permissions.includes('*')) {
      return next();
    }

    if (!req.permissions.includes(permission)) {
      const [resource] = permission.split(':');
      if (!req.permissions.includes(`${resource}:*`)) {
        throw new ApiError(
          403,
          `Permission denied: '${permission}' required`,
          [],
          ERROR_CODES.ACCESS_DENIED
        );
      }
    }

    next();
  });
};

// ============================================
// Permission Utilities
// ============================================

/**
 * Get available permissions by category
 */
export const getAvailablePermissions = () => {
  return PERMISSION_CATEGORIES;
};

/**
 * Check if a permission string is valid
 */
export const isValidPermission = (permission: string): boolean => {
  const validPermissions = Object.values(PERMISSION_CATEGORIES).flatMap(
    (cat) => cat.permissions
  ) as string[];
  return (
    validPermissions.includes(permission) ||
    permission === 'admin:all' ||
    permission.endsWith(':*')
  );
};

/**
 * Get permissions that a user doesn't have but could be assigned
 */
export const getAssignablePermissions = async (
  userId: string
): Promise<string[]> => {
  const userPermissions = await rbacService.getUserPermissions(userId);
  const allPermissions = Object.values(PERMISSION_CATEGORIES).flatMap(
    (cat) => cat.permissions
  );

  // Users with role:manage or permission:assign can assign any permission
  if (
    userPermissions.includes('role:manage') ||
    userPermissions.includes('permission:assign') ||
    userPermissions.includes('admin:all')
  ) {
    return allPermissions;
  }

  // Otherwise, users can only assign permissions they have
  return userPermissions.filter((p) => (allPermissions as string[]).includes(p));
};

// ============================================
// Audit Logging Middleware
// ============================================

/**
 * Audit permission check result
 */
export const auditPermissionCheck = (
  action: string,
  getPermission: (req: Request) => Permission[]
) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    const startTime = Date.now();
    const permissions = getPermission(req);

    next();

    const duration = Date.now() - startTime;

    logger.info('Permission check audit', {
      userId: req.user._id,
      userRole: req.user.role,
      action,
      requiredPermissions: permissions,
      granted: !!(req as any).permissionDenied,
      duration,
      path: req.path,
      method: req.method,
    });
  });
};

// ============================================
// Export all middleware
// ============================================

export default {
  loadPermissions,
  requirePermission,
  requirePermissions,
  requireAnyPermission,
  requireResourcePermission,
  requireAdmin,
  requireCanManageUser,
  requireRoleManagement,
  requirePermissionAssignment,
  skipIf,
  requirePermissionIfAuthenticated,
  getAvailablePermissions,
  isValidPermission,
  getAssignablePermissions,
  auditPermissionCheck,
};
