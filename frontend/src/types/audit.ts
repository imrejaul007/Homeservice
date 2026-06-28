/**
 * Audit Logging Types
 */

// Action types for audit logging
export type AuditActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'activate'
  | 'deactivate'
  | 'login'
  | 'logout'
  | 'export'
  | 'import'
  | 'bulk_action'
  | 'settings_change'
  | 'other';

// Resource types that can be audited
export type AuditResourceType =
  | 'provider'
  | 'customer'
  | 'service'
  | 'booking'
  | 'category'
  | 'coupon'
  | 'offer'
  | 'review'
  | 'payout'
  | 'dispute'
  | 'refund'
  | 'user'
  | 'settings'
  | 'api_key'
  | 'system'
  | 'other';

// Status of the audited action
export type AuditStatus = 'success' | 'failure';

// User reference in audit log
export interface AuditUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// Individual audit log entry
export interface AuditLogEntry {
  _id: string;
  userId: AuditUser;
  action: AuditActionType;
  resource: AuditResourceType;
  resourceId?: string;
  description?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  status: AuditStatus;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

// Audit log query filters
export interface AuditLogFilters {
  page?: number;
  limit?: number;
  userId?: string;
  action?: AuditActionType | string;
  resource?: AuditResourceType | string;
  resourceId?: string;
  status?: AuditStatus;
  startDate?: string;
  endDate?: string;
}

// Audit log pagination response
export interface AuditLogPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Audit log API response
export interface AuditLogResponse {
  success: boolean;
  data: {
    logs: AuditLogEntry[];
    pagination: AuditLogPagination;
  };
}

// Audit stats response
export interface AuditStatsResponse {
  success: boolean;
  data: {
    counts: {
      today: number;
      week: number;
      month: number;
      total: number;
    };
    statusBreakdown: Record<string, number>;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
  };
}

// Payload for logging an admin action
export interface LogAuditPayload {
  action: AuditActionType;
  resource: AuditResourceType;
  resourceId?: string;
  description?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  status?: AuditStatus;
  metadata?: Record<string, unknown>;
}

// Audit action result wrapper
export interface AuditActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  auditLogged: boolean;
}

// Admin Action (alias for consistency with existing naming)
export interface AdminAction {
  adminId: string;
  action: AuditActionType;
  entityType: AuditResourceType;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
  description?: string;
  status?: AuditStatus;
}

// AuditLog (alias for AuditLogEntry)
export type AuditLog = AuditLogEntry;

// Compact recent action for badge display
export interface RecentAuditAction {
  id: string;
  action: AuditActionType;
  resource: AuditResourceType;
  description: string;
  adminName: string;
  timestamp: string;
}
