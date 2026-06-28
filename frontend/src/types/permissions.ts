/**
 * Admin Role Types and Permissions System
 *
 * Defines the role hierarchy and permission constants for admin pages.
 * Used by PermissionGate component and usePermissions hook.
 */

/**
 * Admin roles with decreasing privilege levels.
 * Higher roles inherit permissions from lower roles.
 */
export type AdminRole =
  | 'super_admin'    // Full system access including settings and user management
  | 'admin'          // Standard admin with most operational access
  | 'moderator'      // Limited to viewing and basic operations
  | 'viewer';        // Read-only access to dashboards and reports

/**
 * Permission strings following the format "resource:action"
 * Permissions are cumulative - each role gets all permissions of roles below it.
 */
export type Permission =
  // Dashboard
  | 'dashboard:view'
  | 'dashboard:refresh'

  // Reports & Analytics
  | 'reports:view'
  | 'reports:export'
  | 'reports:funnel'
  | 'reports:geographic'
  | 'reports:churn'

  // Users
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:delete'
  | 'users:suspend'

  // Providers
  | 'providers:view'
  | 'providers:approve'
  | 'providers:reject'
  | 'providers:suspend'
  | 'providers:metrics:view'

  // Services
  | 'services:view'
  | 'services:approve'
  | 'services:reject'
  | 'services:edit'
  | 'services:delete'

  // Payouts
  | 'payouts:view'
  | 'payouts:approve'
  | 'payouts:reject'
  | 'payouts:process'

  // Categories
  | 'categories:view'
  | 'categories:create'
  | 'categories:edit'
  | 'categories:delete'

  // Offers & Coupons
  | 'offers:view'
  | 'offers:create'
  | 'offers:edit'
  | 'offers:delete'
  | 'coupons:view'
  | 'coupons:create'
  | 'coupons:edit'
  | 'coupons:delete'

  // Reviews
  | 'reviews:view'
  | 'reviews:moderate'
  | 'reviews:delete'

  // Content Management
  | 'chatbot:view'
  | 'chatbot:configure'
  | 'trending:view'
  | 'trending:edit'

  // System
  | 'audit:view'
  | 'api-keys:view'
  | 'api-keys:manage'
  | 'settings:view'
  | 'settings:edit'
  | 'maintenance:view'
  | 'maintenance:toggle';

/**
 * Maps each admin role to its allowed permissions.
 * Roles inherit permissions from lower roles.
 */
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  viewer: [
    // Read-only dashboard access
    'dashboard:view',
    'reports:view',
    'reports:funnel',
    'reports:geographic',
    'reports:churn',
    'users:view',
    'providers:view',
    'providers:metrics:view',
    'services:view',
    'payouts:view',
    'categories:view',
    'offers:view',
    'coupons:view',
    'reviews:view',
    'audit:view',
  ],

  moderator: [
    // Inherits viewer permissions
    'dashboard:view',
    'dashboard:refresh',
    'reports:view',
    'reports:export',
    'reports:funnel',
    'reports:geographic',
    'reports:churn',
    'users:view',
    'providers:view',
    'providers:approve',
    'providers:reject',
    'providers:metrics:view',
    'services:view',
    'services:approve',
    'services:reject',
    'payouts:view',
    'categories:view',
    'offers:view',
    'coupons:view',
    'reviews:view',
    'reviews:moderate',
    'audit:view',
  ],

  admin: [
    // Inherits moderator permissions
    'dashboard:view',
    'dashboard:refresh',
    'reports:view',
    'reports:export',
    'reports:funnel',
    'reports:geographic',
    'reports:churn',
    'users:view',
    'users:create',
    'users:edit',
    'providers:view',
    'providers:approve',
    'providers:reject',
    'providers:suspend',
    'providers:metrics:view',
    'services:view',
    'services:approve',
    'services:reject',
    'services:edit',
    'payouts:view',
    'payouts:approve',
    'payouts:reject',
    'categories:view',
    'categories:create',
    'categories:edit',
    'offers:view',
    'offers:create',
    'offers:edit',
    'coupons:view',
    'coupons:create',
    'coupons:edit',
    'reviews:view',
    'reviews:moderate',
    'audit:view',
    'chatbot:view',
    'chatbot:configure',
    'trending:view',
    'trending:edit',
    'api-keys:view',
    'api-keys:manage',
    'settings:view',
    'settings:edit',
    'maintenance:view',
    'maintenance:toggle',
  ],

  super_admin: [
    // Full access - all permissions
    'dashboard:view',
    'dashboard:refresh',
    'reports:view',
    'reports:export',
    'reports:funnel',
    'reports:geographic',
    'reports:churn',
    'users:view',
    'users:create',
    'users:edit',
    'users:delete',
    'users:suspend',
    'providers:view',
    'providers:approve',
    'providers:reject',
    'providers:suspend',
    'providers:metrics:view',
    'services:view',
    'services:approve',
    'services:reject',
    'services:edit',
    'services:delete',
    'payouts:view',
    'payouts:approve',
    'payouts:reject',
    'payouts:process',
    'categories:view',
    'categories:create',
    'categories:edit',
    'categories:delete',
    'offers:view',
    'offers:create',
    'offers:edit',
    'offers:delete',
    'coupons:view',
    'coupons:create',
    'coupons:edit',
    'coupons:delete',
    'reviews:view',
    'reviews:moderate',
    'reviews:delete',
    'chatbot:view',
    'chatbot:configure',
    'trending:view',
    'trending:edit',
    'audit:view',
    'api-keys:view',
    'api-keys:manage',
    'settings:view',
    'settings:edit',
    'maintenance:view',
    'maintenance:toggle',
  ],
};

/**
 * Maps nav items to their required permissions.
 * Used by AdminNav to conditionally render nav items.
 */
export const NAV_PERMISSIONS: Record<string, Permission[]> = {
  '/admin/dashboard': ['dashboard:view'],
  '/admin/reports': ['reports:view'],
  '/admin/analytics': ['reports:view'],
  '/admin/executive': ['reports:view'],
  '/admin/search-analytics': ['reports:view'],
  '/admin/custom-reports': ['reports:export'],
  '/admin/fraud': ['reports:view'],
  '/admin/anomalies': ['reports:view'],
  '/admin/sla': ['reports:view'],
  '/admin/audit': ['audit:view'],
  '/admin/providers': ['providers:view'],
  '/admin/providers/metrics': ['providers:metrics:view'],
  '/admin/bookings': ['users:view'],
  '/admin/disputes': ['reviews:moderate'],
  '/admin/payouts': ['payouts:view'],
  '/admin/refunds': ['payouts:view'],
  '/admin/churn': ['reports:churn'],
  '/admin/categories': ['categories:view'],
  '/admin/bundles': ['services:view'],
  '/admin/offers': ['offers:view'],
  '/admin/offers-analytics': ['offers:view'],
  '/admin/curated-trending': ['trending:view'],
  '/admin/coupons': ['coupons:view'],
  '/admin/reviews': ['reviews:view'],
  '/admin/chatbot-builder': ['chatbot:view'],
  '/admin/launch': ['settings:view'],
  '/admin/api-keys': ['api-keys:view'],
  '/admin/permissions': ['settings:view'],
  '/admin/maintenance': ['maintenance:view'],
  '/admin/settings': ['settings:view'],
};

/**
 * Maps actions to their required permissions.
 * Used for conditionally rendering action buttons.
 */
export const ACTION_PERMISSIONS: Record<string, Permission> = {
  'export': 'reports:export',
  'delete': 'services:delete',
  'approve': 'providers:approve',
  'reject': 'providers:reject',
  'suspend': 'users:suspend',
  'edit': 'services:edit',
  'create': 'users:create',
  'moderate': 'reviews:moderate',
  'process_payout': 'payouts:process',
  'manage_settings': 'settings:edit',
  'toggle_maintenance': 'maintenance:toggle',
  'manage_api_keys': 'api-keys:manage',
  'configure_chatbot': 'chatbot:configure',
};

/**
 * Role hierarchy for comparison.
 * Higher index = higher privilege.
 */
export const ROLE_HIERARCHY: AdminRole[] = ['viewer', 'moderator', 'admin', 'super_admin'];

/**
 * Check if a role has equal or higher privilege than a minimum role.
 */
export function hasMinimumRole(userRole: AdminRole, minimumRole: AdminRole): boolean {
  const userLevel = ROLE_HIERARCHY.indexOf(userRole);
  const minimumLevel = ROLE_HIERARCHY.indexOf(minimumRole);
  return userLevel >= minimumLevel;
}

/**
 * Get the default role for admin users.
 * Falls back to 'admin' for unknown roles.
 */
export function normalizeAdminRole(role?: string): AdminRole {
  const roleLower = (role || '').toLowerCase();

  switch (roleLower) {
    case 'super_admin':
    case 'superadmin':
      return 'super_admin';
    case 'admin':
      return 'admin';
    case 'moderator':
    case 'mod':
      return 'moderator';
    case 'viewer':
      return 'viewer';
    default:
      // Default to 'admin' for backwards compatibility
      // Backend has 'admin' role
      return 'admin';
  }
}
