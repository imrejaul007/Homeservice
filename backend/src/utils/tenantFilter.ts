/**
 * Tenant Isolation Utilities
 * CRITICAL: All queries MUST include tenantId filter
 */

import { Request } from 'express';
import { ApiError, ERROR_CODES } from './ApiError';

/**
 * Get tenant ID from request context
 * Throws if no tenant context available
 */
export function getTenantId(req: Request): string {
  const tenantId = req.tenantId || (req as any).user?.tenantId;

  if (!tenantId) {
    throw ApiError.unauthorized('TENANT_CONTEXT_MISSING: No tenant context in request', ERROR_CODES.UNAUTHORIZED);
  }

  return tenantId;
}

/**
 * Get tenant ID or return undefined (for admin/system operations)
 */
export function getTenantIdOptional(req: Request): string | undefined {
  return req.tenantId || (req as any).user?.tenantId;
}

/**
 * Check if request is from admin/owner (bypass tenant filter)
 */
export function isAdminOrSystem(req: Request): boolean {
  const role = (req as any).user?.role;
  return role === 'admin' || role === 'super_admin' || role === 'system';
}

/**
 * Add tenant filter to query object
 * Automatically excludes admin/system requests from filtering
 */
export function addTenantFilter<T extends Record<string, any>>(
  query: T,
  req: Request
): T {
  // Admin/system requests bypass tenant filtering
  if (isAdminOrSystem(req)) {
    return query;
  }

  const tenantId = getTenantIdOptional(req);

  if (!tenantId) {
    // No tenant context - restrict to no results for safety
    return { ...query, tenantId: '__NO_TENANT__' };
  }

  return { ...query, tenantId };
}

/**
 * Add tenant filter to aggregation pipeline
 */
export function addTenantToAggregation(
  pipeline: any[],
  req: Request
): any[] {
  if (isAdminOrSystem(req)) {
    return pipeline;
  }

  const tenantId = getTenantIdOptional(req);

  if (!tenantId) {
    // No tenant context - match nothing
    return [...pipeline, { $match: { tenantId: '__NO_TENANT__' } }];
  }

  return [...pipeline, { $match: { tenantId } }];
}

/**
 * Inject tenant context into service call options
 */
export interface TenantContext {
  tenantId?: string;
  isAdmin?: boolean;
}

export function getTenantContext(req: Request): TenantContext {
  return {
    tenantId: getTenantIdOptional(req),
    isAdmin: isAdminOrSystem(req)
  };
}
