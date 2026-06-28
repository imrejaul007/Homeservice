import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  normalizeAdminRole,
  ROLE_PERMISSIONS,
  ROLE_HIERARCHY,
  hasMinimumRole,
  type AdminRole,
  type Permission,
} from '../types/permissions';

/**
 * Hook for checking user permissions in admin pages.
 *
 * Usage:
 * const { hasPermission, hasAnyRole, hasMinimumRole: checkRole } = usePermissions();
 *
 * if (hasPermission('services:edit')) {
 *   // Show edit button
 * }
 *
 * if (checkRole('admin', 'super_admin')) {
 *   // Show admin-only content
 * }
 */
export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  /**
   * Get the normalized admin role from the current user.
   */
  const adminRole = useMemo((): AdminRole => {
    if (!user) return 'viewer';
    // Backend sends role as 'admin' for admin users
    // Map to our extended role system
    return normalizeAdminRole(user.role);
  }, [user?.role]);

  /**
   * Get all permissions for the current user's role.
   */
  const userPermissions = useMemo((): Permission[] => {
    return ROLE_PERMISSIONS[adminRole] || [];
  }, [adminRole]);

  /**
   * Check if the current user has a specific permission.
   *
   * @param permission - The permission string to check (e.g., 'services:edit')
   * @returns true if the user has the permission, false otherwise
   */
  const hasPermission = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      return userPermissions.includes(permission);
    },
    [user, userPermissions]
  );

  /**
   * Check if the current user has any of the specified permissions.
   *
   * @param permissions - Array of permission strings to check
   * @returns true if the user has at least one of the permissions
   */
  const hasAnyPermission = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false;
      return permissions.some((p) => userPermissions.includes(p));
    },
    [user, userPermissions]
  );

  /**
   * Check if the current user has all of the specified permissions.
   *
   * @param permissions - Array of permission strings to check
   * @returns true if the user has all of the permissions
   */
  const hasAllPermissions = useCallback(
    (permissions: Permission[]): boolean => {
      if (!user) return false;
      return permissions.every((p) => userPermissions.includes(p));
    },
    [user, userPermissions]
  );

  /**
   * Check if the current user has any of the specified roles.
   *
   * @param roles - Role(s) to check
   * @returns true if the user has at least one of the roles
   */
  const hasAnyRole = useCallback(
    (roles: AdminRole | AdminRole[]): boolean => {
      if (!user) return false;
      const roleArray = Array.isArray(roles) ? roles : [roles];
      return roleArray.includes(adminRole);
    },
    [user, adminRole]
  );

  /**
   * Check if the current user has the minimum required role.
   *
   * @param minimumRole - The minimum role required
   * @returns true if the user has the minimum role or higher
   */
  const hasMinimumRoleFn = useCallback(
    (minimumRole: AdminRole): boolean => {
      if (!user) return false;
      return hasMinimumRole(adminRole, minimumRole);
    },
    [user, adminRole]
  );

  /**
   * Check if the user has exactly the specified role (no higher roles).
   *
   * @param role - The exact role to check
   * @returns true if the user has exactly that role
   */
  const hasExactRole = useCallback(
    (role: AdminRole): boolean => {
      if (!user) return false;
      return adminRole === role;
    },
    [user, adminRole]
  );

  /**
   * Get the role level (0-3) for the current user.
   * Useful for comparing role privileges.
   *
   * @returns Role level (0=viewer, 1=moderator, 2=admin, 3=super_admin)
   */
  const roleLevel = useMemo((): number => {
    return ROLE_HIERARCHY.indexOf(adminRole);
  }, [adminRole]);

  /**
   * Check if the user is a super admin.
   *
   * @returns true if the user has super_admin role
   */
  const isSuperAdmin = useMemo((): boolean => {
    return adminRole === 'super_admin';
  }, [adminRole]);

  /**
   * Check if the user is an admin (admin or super_admin).
   *
   * @returns true if the user has admin or super_admin role
   */
  const isAdmin = useMemo((): boolean => {
    return adminRole === 'admin' || adminRole === 'super_admin';
  }, [adminRole]);

  /**
   * Check if the user can export data.
   * Requires 'reports:export' permission.
   *
   * @returns true if the user can export reports
   */
  const canExport = useCallback((): boolean => {
    return hasPermission('reports:export');
  }, [hasPermission]);

  /**
   * Check if the user can manage settings.
   * Requires 'settings:edit' permission.
   *
   * @returns true if the user can edit settings
   */
  const canManageSettings = useCallback((): boolean => {
    return hasPermission('settings:edit');
  }, [hasPermission]);

  /**
   * Check if the user can toggle maintenance mode.
   * Requires 'maintenance:toggle' permission.
   *
   * @returns true if the user can toggle maintenance mode
   */
  const canToggleMaintenance = useCallback((): boolean => {
    return hasPermission('maintenance:toggle');
  }, [hasPermission]);

  /**
   * Check if the user can approve providers.
   * Requires 'providers:approve' permission.
   *
   * @returns true if the user can approve providers
   */
  const canApproveProviders = useCallback((): boolean => {
    return hasPermission('providers:approve');
  }, [hasPermission]);

  /**
   * Check if the user can delete content.
   * Requires 'services:delete' or 'coupons:delete' permission.
   *
   * @param resourceType - The type of resource (e.g., 'services', 'coupons')
   * @returns true if the user can delete that resource type
   */
  const canDelete = useCallback(
    (resourceType: 'services' | 'coupons' | 'users' | 'reviews'): boolean => {
      const deletePermission: Permission = `${resourceType}:delete` as Permission;
      return hasPermission(deletePermission);
    },
    [hasPermission]
  );

  return {
    // Current user info
    adminRole,
    userPermissions,
    roleLevel,
    isSuperAdmin,
    isAdmin,

    // Permission checks
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,

    // Role checks
    hasAnyRole,
    hasMinimumRole: hasMinimumRoleFn,
    hasExactRole,

    // Convenience methods
    canExport,
    canManageSettings,
    canToggleMaintenance,
    canApproveProviders,
    canDelete,
  };
}

export default usePermissions;
