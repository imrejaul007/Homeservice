import { authService } from './AuthService';
import { getApiUrl } from '../lib/getApiUrl';

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

// Individual audit log entry
export interface AuditLogEntry {
  _id: string;
  userId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
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

/**
 * Audit Service
 * Centralized service for logging and retrieving audit logs
 */
class AuditService {
  private baseUrl: string;
  private isEnabled: boolean = true;
  private pendingLogs: LogAuditPayload[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.baseUrl = getApiUrl();
  }

  /**
   * Enable/disable audit logging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (enabled && this.pendingLogs.length > 0) {
      this.flushPendingLogs();
    }
  }

  /**
   * Get current user info for audit logging
   */
  private getCurrentUser(): { id: string; email: string; role: string } | null {
    try {
      const user = authService.getCurrentUserFromStore();
      if (user) {
        return {
          id: user._id || user.id,
          email: user.email,
          role: user.role,
        };
      }
    } catch {
      // Auth store not available
    }
    return null;
  }

  /**
   * Get client IP address (would need backend support for accurate IP)
   */
  private getClientIP(): string | undefined {
    // This is a placeholder - actual IP would come from server
    // In browser context, we cannot reliably get the client IP
    return undefined;
  }

  /**
   * Log an admin action to the audit log
   */
  async logAction(payload: LogAuditPayload): Promise<boolean> {
    if (!this.isEnabled) {
      return false;
    }

    const user = this.getCurrentUser();
    if (!user || user.role !== 'admin') {
      console.warn('[Audit] Skipping log: user not authenticated or not admin');
      return false;
    }

    const auditEntry = {
      ...payload,
      status: payload.status || 'success',
      ipAddress: this.getClientIP(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    try {
      await authService.post<{ success: boolean }>('/audit', auditEntry);
      return true;
    } catch (error) {
      console.error('[Audit] Failed to log action:', error);
      // Queue for retry
      this.pendingLogs.push(payload);
      this.scheduleFlush();
      return false;
    }
  }

  /**
   * Log with automatic wrapping of an async operation
   * Automatically logs who, what, when, entity, and changes
   */
  async logAdminAction<T>(
    action: AuditActionType,
    resource: AuditResourceType,
    resourceId: string | undefined,
    operation: () => Promise<T>,
    options?: {
      description?: string;
      getOldValue?: () => Promise<Record<string, unknown> | undefined>;
      getNewValue?: (result: T) => Record<string, unknown>;
      suppressError?: boolean;
    }
  ): Promise<AuditActionResult<T>> {
    const startTime = Date.now();
    let oldValue: Record<string, unknown> | undefined;

    // Try to get old value before the operation
    if (options?.getOldValue) {
      try {
        oldValue = await options.getOldValue();
      } catch {
        // Old value fetch failed, continue without it
      }
    }

    try {
      const result = await operation();

      // Calculate what changed
      let newValue: Record<string, unknown> | undefined;
      if (options?.getNewValue) {
        try {
          newValue = options.getNewValue(result);
        } catch {
          newValue = { result };
        }
      } else if (result && typeof result === 'object') {
        newValue = result as Record<string, unknown>;
      }

      // Log the successful action
      const logged = await this.logAction({
        action,
        resource,
        resourceId,
        description: options?.description,
        oldValue,
        newValue,
        status: 'success',
        metadata: {
          duration: Date.now() - startTime,
        },
      });

      return {
        success: true,
        data: result,
        auditLogged: logged,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Log the failed action
      const logged = await this.logAction({
        action,
        resource,
        resourceId,
        description: options?.description,
        oldValue,
        status: 'failure',
        metadata: {
          error: errorMessage,
          duration: Date.now() - startTime,
        },
      });

      return {
        success: false,
        error: errorMessage,
        auditLogged: logged,
      };
    }
  }

  /**
   * Schedule flushing of pending logs
   */
  private scheduleFlush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
    }
    // Flush after 5 seconds of batching
    this.flushTimeout = setTimeout(() => this.flushPendingLogs(), 5000);
  }

  /**
   * Flush any pending log entries
   */
  private async flushPendingLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logs = [...this.pendingLogs];
    this.pendingLogs = [];

    for (const log of logs) {
      try {
        await this.logAction(log);
      } catch {
        // Log failed again, re-queue
        this.pendingLogs.push(log);
      }
    }

    if (this.pendingLogs.length > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse | null> {
    try {
      const params = new URLSearchParams();

      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.resourceId) params.append('resourceId', filters.resourceId);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await authService.get<AuditLogResponse>(
        `/audit${params.toString() ? `?${params.toString()}` : ''}`
      );
      return response;
    } catch (error) {
      console.error('[Audit] Failed to fetch audit logs:', error);
      return null;
    }
  }

  /**
   * Get recent audit logs (last 10)
   */
  async getRecentLogs(limit: number = 10): Promise<AuditLogEntry[]> {
    const response = await this.getAuditLogs({ limit, page: 1 });
    return response?.data?.logs || [];
  }

  /**
   * Get audit stats
   */
  async getAuditStats(): Promise<AuditStatsResponse | null> {
    try {
      const response = await authService.get<AuditStatsResponse>('/audit/stats');
      return response;
    } catch (error) {
      console.error('[Audit] Failed to fetch audit stats:', error);
      return null;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getLogsByUser(userId: string, limit: number = 20): Promise<AuditLogEntry[]> {
    try {
      const response = await authService.get<AuditLogResponse>(
        `/audit/user/${userId}?limit=${limit}`
      );
      return response?.data?.logs || [];
    } catch (error) {
      console.error('[Audit] Failed to fetch user audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a specific resource
   */
  async getLogsByResource(
    resource: AuditResourceType,
    resourceId: string,
    limit: number = 20
  ): Promise<AuditLogEntry[]> {
    try {
      const response = await authService.get<AuditLogResponse>(
        `/audit/resource/${resource}/${resourceId}?limit=${limit}`
      );
      return response?.data?.logs || [];
    } catch (error) {
      console.error('[Audit] Failed to fetch resource audit logs:', error);
      return [];
    }
  }

  /**
   * Export audit logs as CSV
   */
  async exportLogs(filters: AuditLogFilters = {}): Promise<string | null> {
    try {
      const params = new URLSearchParams();

      if (filters.userId) params.append('userId', filters.userId);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource) params.append('resource', filters.resource);
      if (filters.resourceId) params.append('resourceId', filters.resourceId);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`${this.baseUrl}/audit/export${queryString}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.getCurrentUser() ? 'token' : ''}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      return await response.text();
    } catch (error) {
      console.error('[Audit] Failed to export audit logs:', error);
      return null;
    }
  }
}

// Export singleton instance
export const auditService = new AuditService();
export default auditService;

// Export types for convenience
export type { AuditService };

// Compact recent action for badge display
export interface RecentAuditAction {
  id: string;
  action: AuditActionType;
  resource: AuditResourceType;
  description: string;
  adminName: string;
  timestamp: string;
}
