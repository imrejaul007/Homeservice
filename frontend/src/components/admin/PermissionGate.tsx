import { useMemo, type ReactNode } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { normalizeAdminRole, type AdminRole, type Permission } from '../../types/permissions';
import { usePermissions } from '../../hooks/usePermissions';

interface PermissionGateProps {
  /**
   * Permission(s) required to render children.
   * If multiple, ALL must be granted (AND logic).
   */
  permission?: Permission | Permission[];

  /**
   * If true, user must have ANY of the specified permissions.
   * If false (default), user must have ALL specified permissions.
   */
  any?: boolean;

  /**
   * Role(s) required to render children.
   * If multiple, user must have at least one of the roles.
   */
  role?: AdminRole | AdminRole[];

  /**
   * If true, children are rendered even if user is not authenticated.
   * Useful for non-sensitive content that should be visible to everyone.
   */
  allowAnonymous?: boolean;

  /**
   * Content to render when permission is denied.
   * If not provided, renders nothing.
   */
  fallback?: ReactNode;

  /**
   * If true, shows fallback when permission is denied instead of hiding content.
   */
  showFallback?: boolean;

  /**
   * Children to render if permission is granted.
   */
  children: ReactNode;

  /**
   * Optional className for the wrapper element.
   * Only applied when fallback is shown.
   */
  className?: string;
}

/**
 * PermissionGate component for conditional rendering based on user permissions.
 *
 * Usage:
 * <PermissionGate permission="services:edit">
 *   <EditButton />
 * </PermissionGate>
 *
 * <PermissionGate permission={['services:edit', 'services:delete']} fallback={<NoAccess />}>
 *   <Actions />
 * </PermissionGate>
 *
 * <PermissionGate role="admin">
 *   <AdminPanel />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  any: anyPermission = false,
  role,
  allowAnonymous = false,
  fallback = null,
  showFallback = false,
  children,
  className,
}: PermissionGateProps) {
  const { user, isAuthenticated } = useAuthStore();
  const { hasPermission, hasAnyRole } = usePermissions();

  // Check authentication
  const isAuthenticated_ = useMemo(() => {
    if (allowAnonymous) return true;
    return isAuthenticated && !!user;
  }, [allowAnonymous, isAuthenticated, user]);

  // Check permissions
  const hasPermission_ = useMemo(() => {
    if (!permission) return true; // No permission required
    if (!isAuthenticated_) return false;

    const permissions = Array.isArray(permission) ? permission : [permission];
    if (permissions.length === 0) return true;

    if (anyPermission) {
      return permissions.some(p => hasPermission(p));
    }
    return permissions.every(p => hasPermission(p));
  }, [permission, anyPermission, isAuthenticated_, hasPermission]);

  // Check roles
  const hasRole_ = useMemo(() => {
    if (!role) return true; // No role required
    if (!isAuthenticated_) return false;

    const roles = Array.isArray(role) ? role : [role];
    if (roles.length === 0) return true;

    return hasAnyRole(roles);
  }, [role, isAuthenticated_, hasAnyRole]);

  // Combined check: authenticated AND has required permissions AND has required role
  const isAllowed = isAuthenticated_ && hasPermission_ && hasRole_;

  // Render logic
  if (isAllowed) {
    return <>{children}</>;
  }

  // If showFallback is true and we have fallback content, render it
  if (showFallback && fallback) {
    return (
      <div className={className} data-permission-gate="denied">
        {fallback}
      </div>
    );
  }

  // Default: render nothing
  return null;
}

export default PermissionGate;
