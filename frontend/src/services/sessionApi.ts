import { api } from './api';

// ============================================
// Session Types
// ============================================

export interface Session {
  id: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser: string;
  os: string;
  ip: string;
  location?: {
    city?: string;
    country?: string;
  };
  createdAt: string;
  lastActive: string;
  expiresAt: string;
  isCurrent: boolean;
  isActive: boolean;
  userAgent: string;
}

export interface SessionSettings {
  defaultTimeout: number;
  maxConcurrentSessions: number;
  requireReAuthOnSensitive: boolean;
  allowRememberDevice: boolean;
  enforceSingleSession: boolean;
}

export interface UpdateTimeoutPayload {
  timeout: number;
  reason?: string;
}

export interface GetSessionsOptions {
  page?: number;
  limit?: number;
  isActive?: boolean;
  deviceType?: Session['deviceType'];
  sortOrder?: 'asc' | 'desc';
}

export interface SessionStats {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  byDeviceType: Record<Session['deviceType'], number>;
  averageSessionDuration: number;
  mostUsedDevice: {
    deviceName: string;
    count: number;
  };
  mostUsedBrowser: {
    name: string;
    count: number;
  };
  sessionsByDay: Array<{
    date: string;
    totalSessions: number;
    activeSessions: number;
  }>;
}

export interface SecurityAlert {
  id: string;
  type: 'new_device' | 'new_location' | 'suspicious_activity' | 'password_changed' | 'mfa_changed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  sessionId?: string;
  ip?: string;
  location?: string;
  deviceInfo?: string;
  createdAt: string;
  isRead: boolean;
  isResolved: boolean;
}

// ============================================
// Session API Service
// ============================================

export interface SessionApi {
  /**
   * Get all active sessions
   */
  getActiveSessions: (options?: GetSessionsOptions) => Promise<{
    sessions: Session[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single session by ID
   */
  getSession: (sessionId: string) => Promise<Session>;

  /**
   * Get current session
   */
  getCurrentSession: () => Promise<Session>;

  /**
   * Revoke a specific session
   */
  revokeSession: (sessionId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Revoke all sessions except current
   */
  revokeAllSessions: (excludeCurrent?: boolean) => Promise<{
    success: boolean;
    revokedCount: number;
    message: string;
  }>;

  /**
   * Update session timeout
   */
  updateSessionTimeout: (
    timeout: number,
    reason?: string
  ) => Promise<{
    success: boolean;
    newTimeout: number;
    message: string;
  }>;

  /**
   * Extend current session
   */
  extendSession: () => Promise<{
    success: boolean;
    newExpiresAt: string;
    message: string;
  }>;

  /**
   * Get session settings
   */
  getSessionSettings: () => Promise<SessionSettings>;

  /**
   * Update session settings
   */
  updateSessionSettings: (settings: Partial<SessionSettings>) => Promise<SessionSettings>;

  /**
   * Get session statistics
   */
  getSessionStats: (options?: {
    startDate?: string;
    endDate?: string;
  }) => Promise<SessionStats>;

  /**
   * Get security alerts
   */
  getSecurityAlerts: (options?: {
    page?: number;
    limit?: number;
    severity?: SecurityAlert['severity'];
    isResolved?: boolean;
  }) => Promise<{
    alerts: SecurityAlert[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Mark security alert as read
   */
  markAlertAsRead: (alertId: string) => Promise<{
    success: boolean;
    isRead: boolean;
  }>;

  /**
   * Mark all alerts as read
   */
  markAllAlertsAsRead: () => Promise<{
    success: boolean;
    markedCount: number;
  }>;

  /**
   * Resolve a security alert
   */
  resolveAlert: (
    alertId: string,
    resolution?: string
  ) => Promise<{
    success: boolean;
    isResolved: boolean;
  }>;

  /**
   * Verify current session
   */
  verifySession: (verificationCode?: string) => Promise<{
    valid: boolean;
    session: Session;
    requiresMFA?: boolean;
  }>;

  /**
   * Lock account (end all sessions)
   */
  lockAccount: (reason?: string) => Promise<{
    success: boolean;
    lockedAt: string;
    message: string;
  }>;

  /**
   * Unlock account
   */
  unlockAccount: (password: string) => Promise<{
    success: boolean;
    unlockedAt: string;
    message: string;
  }>;
}

export const sessionApi: SessionApi = {
  /**
   * Get all active sessions
   * @param options - Query options including filters and pagination
   */
  getActiveSessions: async (options = {}) => {
    const response = await api.get('/sessions', { params: options });
    return response.data.data;
  },

  /**
   * Get a single session by ID
   * @param sessionId - The session ID
   */
  getSession: async (sessionId: string) => {
    const response = await api.get(`/sessions/${sessionId}`);
    return response.data.data;
  },

  /**
   * Get the current session
   */
  getCurrentSession: async () => {
    const response = await api.get('/sessions/current');
    return response.data.data;
  },

  /**
   * Revoke a specific session
   * @param sessionId - The session ID to revoke
   */
  revokeSession: async (sessionId: string) => {
    const response = await api.delete(`/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Revoke all sessions except current
   * @param excludeCurrent - Whether to exclude current session (default: true)
   */
  revokeAllSessions: async (excludeCurrent = true) => {
    const response = await api.post('/sessions/revoke-all', { excludeCurrent });
    return response.data.data;
  },

  /**
   * Update session timeout
   * @param timeout - New timeout in minutes
   * @param reason - Optional reason for changing timeout
   */
  updateSessionTimeout: async (timeout: number, reason?: string) => {
    const response = await api.patch('/sessions/timeout', { timeout, reason });
    return response.data.data;
  },

  /**
   * Extend the current session
   */
  extendSession: async () => {
    const response = await api.post('/sessions/extend');
    return response.data.data;
  },

  /**
   * Get session security settings
   */
  getSessionSettings: async () => {
    const response = await api.get('/sessions/settings');
    return response.data.data;
  },

  /**
   * Update session security settings
   * @param settings - Settings to update
   */
  updateSessionSettings: async (settings: Partial<SessionSettings>) => {
    const response = await api.patch('/sessions/settings', settings);
    return response.data.data;
  },

  /**
   * Get session statistics
   * @param options - Optional date range
   */
  getSessionStats: async (options = {}) => {
    const response = await api.get('/sessions/stats', { params: options });
    return response.data.data;
  },

  /**
   * Get security alerts
   * @param options - Filter and pagination options
   */
  getSecurityAlerts: async (options = {}) => {
    const response = await api.get('/sessions/alerts', { params: options });
    return response.data.data;
  },

  /**
   * Mark a security alert as read
   * @param alertId - The alert ID
   */
  markAlertAsRead: async (alertId: string) => {
    const response = await api.patch(`/sessions/alerts/${alertId}/read`);
    return response.data.data;
  },

  /**
   * Mark all security alerts as read
   */
  markAllAlertsAsRead: async () => {
    const response = await api.post('/sessions/alerts/mark-all-read');
    return response.data.data;
  },

  /**
   * Resolve a security alert
   * @param alertId - The alert ID
   * @param resolution - Optional resolution notes
   */
  resolveAlert: async (alertId: string, resolution?: string) => {
    const response = await api.patch(`/sessions/alerts/${alertId}/resolve`, {
      resolution,
    });
    return response.data.data;
  },

  /**
   * Verify current session validity
   * @param verificationCode - Optional MFA code
   */
  verifySession: async (verificationCode?: string) => {
    const response = await api.post('/sessions/verify', { verificationCode });
    return response.data.data;
  },

  /**
   * Lock account and end all sessions
   * @param reason - Optional reason for locking
   */
  lockAccount: async (reason?: string) => {
    const response = await api.post('/sessions/lock', { reason });
    return response.data.data;
  },

  /**
   * Unlock account
   * @param password - Account password for verification
   */
  unlockAccount: async (password: string) => {
    const response = await api.post('/sessions/unlock', { password });
    return response.data.data;
  },
};

export default sessionApi;
