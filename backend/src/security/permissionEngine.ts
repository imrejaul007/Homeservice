import { ApiError, ERROR_CODES } from '../utils/ApiError';
import User from '../models/user.model';

export interface Permission {
  resource: string;
  action: string;
  scope?: string;
}

export interface RolePermissions {
  [role: string]: Permission[];
}

const ROLE_PERMISSIONS: RolePermissions = {
  customer: [
    { resource: 'booking', action: 'create' },
    { resource: 'booking', action: 'read', scope: 'own' },
    { resource: 'booking', action: 'cancel', scope: 'own' },
    { resource: 'wallet', action: 'read', scope: 'own' },
    { resource: 'wallet', action: 'topup', scope: 'own' },
    { resource: 'review', action: 'create' },
    { resource: 'review', action: 'read', scope: 'own' },
  ],

  provider: [
    { resource: 'booking', action: 'read', scope: 'own' },
    { resource: 'booking', action: 'update', scope: 'own' },
    { resource: 'availability', action: 'manage', scope: 'own' },
    { resource: 'earnings', action: 'read', scope: 'own' },
    { resource: 'wallet', action: 'read', scope: 'own' },
  ],

  admin: [
    { resource: '*', action: '*' }, // Full access
  ],
};

export const hasPermission = async (
  userId: string,
  resource: string,
  action: string,
  scope?: string
): Promise<boolean> => {
  const user = await User.findById(userId);
  if (!user) return false;

  const rolePermissions = ROLE_PERMISSIONS[user.role] || [];

  // Check exact permission
  const hasExact = rolePermissions.some(
    (p) => p.resource === resource && p.action === action
  );
  if (hasExact) return true;

  // Check wildcard
  const hasWildcard = rolePermissions.some(
    (p) => p.resource === '*' && p.action === '*'
  );
  if (hasWildcard) return true;

  // Check resource wildcard
  const hasResourceWildcard = rolePermissions.some(
    (p) => p.resource === '*' && p.action === action
  );
  if (hasResourceWildcard) return true;

  return false;
};

export const checkPermission = async (
  userId: string,
  resource: string,
  action: string
): Promise<void> => {
  const allowed = await hasPermission(userId, resource, action);
  if (!allowed) {
    throw ApiError.forbidden(`Permission denied: ${action} on ${resource}`, ERROR_CODES.ACCESS_DENIED);
  }
};
