import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Apply authentication and admin role validation
router.use(authenticate);
router.use(requireRole('admin'));

// Define available roles in the system
const AVAILABLE_ROLES = [
  'customer',
  'provider',
  'admin',
  'superadmin',
] as const;

type RoleName = typeof AVAILABLE_ROLES[number];

// Define permissions for each role
const ROLE_PERMISSIONS: Record<RoleName, string[]> = {
  customer: [
    'bookings:read',
    'bookings:create',
    'bookings:cancel',
    'favorites:read',
    'favorites:create',
    'favorites:delete',
    'reviews:read',
    'reviews:create',
    'profile:read',
    'profile:update',
  ],
  provider: [
    'bookings:read',
    'bookings:update',
    'bookings:complete',
    'services:read',
    'services:create',
    'services:update',
    'services:delete',
    'earnings:read',
    'reviews:read',
    'reviews:respond',
    'profile:read',
    'profile:update',
  ],
  admin: [
    'users:read',
    'users:update',
    'users:delete',
    'providers:read',
    'providers:approve',
    'providers:reject',
    'bookings:read',
    'bookings:update',
    'bookings:cancel',
    'categories:read',
    'categories:create',
    'categories:update',
    'categories:delete',
    'services:read',
    'services:update',
    'services:delete',
    'analytics:read',
    'rbac:read',
    'rbac:update',
  ],
  superadmin: [
    '*',
  ],
};

// GET /admin/rbac/roles/stats - User counts per role (read-only viewer)
router.get('/roles/stats', asyncHandler(async (_req: Request, res: Response) => {
  const User = (await import('../models/user.model')).default;
  const counts = await User.aggregate([
    { $group: { _id: '$role', userCount: { $sum: 1 } } },
  ]);

  res.json({
    success: true,
    data: {
      stats: counts.map((row: { _id: string; userCount: number }) => ({
        role: row._id,
        userCount: row.userCount,
        isSystem: true,
        isActive: true,
        permissionCount: ROLE_PERMISSIONS[row._id as RoleName]?.length ?? 0,
      })),
    },
  });
}));

// GET /admin/rbac/roles - List all available roles
router.get('/roles', asyncHandler(async (req: Request, res: Response) => {
  const roles = AVAILABLE_ROLES.map(role => ({
    name: role,
    permissions: ROLE_PERMISSIONS[role],
  }));

  res.json({
    success: true,
    data: {
      roles,
      total: roles.length,
    },
  });
}));

// GET /admin/rbac/roles/:role - Get permissions for a specific role
router.get('/roles/:role', asyncHandler(async (req: Request, res: Response) => {
  const { role } = req.params;

  if (!AVAILABLE_ROLES.includes(role as RoleName)) {
    res.status(400).json({
      success: false,
      error: 'Invalid role',
      details: `Role '${role}' does not exist. Available roles: ${AVAILABLE_ROLES.join(', ')}`,
    });
    return;
  }

  res.json({
    success: true,
    data: {
      name: role,
      permissions: ROLE_PERMISSIONS[role as RoleName],
    },
  });
}));

// GET /admin/rbac/permissions - List all available permissions
router.get('/permissions', asyncHandler(async (req: Request, res: Response) => {
  // Extract unique permissions from all roles (excluding superadmin wildcard)
  const allPermissions = new Set<string>();
  AVAILABLE_ROLES.forEach(role => {
    if (role !== 'superadmin') {
      ROLE_PERMISSIONS[role].forEach(perm => allPermissions.add(perm));
    }
  });

  res.json({
    success: true,
    data: {
      permissions: Array.from(allPermissions).sort(),
      total: allPermissions.size,
    },
  });
}));

export default router;
