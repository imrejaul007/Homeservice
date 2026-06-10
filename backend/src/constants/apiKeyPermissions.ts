/**
 * Valid API key permissions.
 * These must match the enum in the AdminApiKey model.
 */
export const API_KEY_PERMISSIONS = [
  'read',
  'write',
  'delete',
  'admin',
  'analytics',
  'webhooks',
  'broadcast',
  'coupons',
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];

/**
 * Validate that a permission string is a valid API key permission.
 */
export function isValidPermission(permission: string): permission is ApiKeyPermission {
  return (API_KEY_PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * Validate an array of permissions, returning only valid ones.
 * Throws if any permission is invalid or empty.
 */
export function validatePermissions(permissions: string[]): ApiKeyPermission[] {
  if (!Array.isArray(permissions)) {
    throw new Error('Permissions must be an array');
  }

  const invalidPermissions = permissions.filter((p) => {
    if (typeof p !== 'string' || p.trim() === '') {
      return true;
    }
    return !isValidPermission(p);
  });

  if (invalidPermissions.length > 0) {
    throw new Error(
      `Invalid permission(s): ${invalidPermissions.join(', ')}. Valid permissions are: ${API_KEY_PERMISSIONS.join(', ')}`
    );
  }

  return permissions as ApiKeyPermission[];
}
