import { api } from './api';

// ============================================
// Device Types
// ============================================

export interface TrustedDevice {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'other';
  browser: string;
  browserVersion?: string;
  os: string;
  osVersion?: string;
  deviceId: string;
  lastActive: string;
  firstSeen: string;
  isCurrent: boolean;
  location?: {
    city?: string;
    country?: string;
    ip?: string;
  };
}

export interface LoginHistoryItem {
  id: string;
  timestamp: string;
  deviceId: string;
  deviceName: string;
  deviceType: TrustedDevice['type'];
  browser: string;
  os: string;
  ip: string;
  location?: {
    city?: string;
    country?: string;
  };
  success: boolean;
  failureReason?: string;
  userAgent: string;
}

export interface DeviceSettings {
  requireMFA: boolean;
  notifyOnNewLogin: boolean;
  notifyOnSuspiciousActivity: boolean;
  automaticDeviceApproval: boolean;
  sessionTimeout: number;
}

export interface GetDevicesOptions {
  page?: number;
  limit?: number;
  type?: TrustedDevice['type'];
  includeInactive?: boolean;
}

export interface GetLoginHistoryOptions {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  success?: boolean;
  sortOrder?: 'asc' | 'desc';
}

export interface DeviceApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ============================================
// Device API Service
// ============================================

export interface DeviceApi {
  /**
   * Get all trusted devices
   */
  getDevices: (options?: GetDevicesOptions) => Promise<{
    devices: TrustedDevice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single device by ID
   */
  getDevice: (deviceId: string) => Promise<TrustedDevice>;

  /**
   * Add a trusted device
   */
  addTrustedDevice: (
    deviceId: string,
    name?: string
  ) => Promise<TrustedDevice>;

  /**
   * Remove a trusted device
   */
  removeTrustedDevice: (deviceId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Rename a trusted device
   */
  renameDevice: (
    deviceId: string,
    name: string
  ) => Promise<{
    success: boolean;
    device: TrustedDevice;
  }>;

  /**
   * Get login history
   */
  getLoginHistory: (options?: GetLoginHistoryOptions) => Promise<{
    history: LoginHistoryItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get login history summary
   */
  getLoginHistorySummary: () => Promise<{
    totalLogins: number;
    successfulLogins: number;
    failedLogins: number;
    uniqueDevices: number;
    lastLogin: {
      timestamp: string;
      deviceName: string;
      location?: string;
      success: boolean;
    };
    suspiciousActivity: {
      count: number;
      lastDetected?: string;
    };
  }>;

  /**
   * Get device settings
   */
  getDeviceSettings: () => Promise<DeviceSettings>;

  /**
   * Update device settings
   */
  updateDeviceSettings: (settings: Partial<DeviceSettings>) => Promise<DeviceSettings>;

  /**
   * Report suspicious device
   */
  reportSuspiciousDevice: (deviceId: string, reason: string) => Promise<{
    success: boolean;
    message: string;
    actionTaken?: string;
  }>;

  /**
   * Revoke all sessions except current
   */
  revokeOtherSessions: () => Promise<{
    success: boolean;
    revokedCount: number;
    message: string;
  }>;

  /**
   * Get device statistics
   */
  getDeviceStats: () => Promise<{
    totalDevices: number;
    activeDevices: number;
    byType: Record<TrustedDevice['type'], number>;
    byBrowser: Record<string, number>;
    byOS: Record<string, number>;
    recentActivity: Array<{
      date: string;
      loginCount: number;
      uniqueDevices: number;
    }>;
  }>;

  /**
   * Verify device ownership
   */
  verifyDevice: (
    deviceId: string,
    verificationCode: string
  ) => Promise<{
    success: boolean;
    verified: boolean;
    message: string;
  }>;

  /**
   * Get current device info
   */
  getCurrentDevice: () => Promise<TrustedDevice>;
}

export const deviceApi: DeviceApi = {
  /**
   * Get all trusted devices
   * @param options - Query options including filters and pagination
   */
  getDevices: async (options = {}) => {
    const response = await api.get('/devices', { params: options });
    return response.data.data;
  },

  /**
   * Get a single device by ID
   * @param deviceId - The device ID
   */
  getDevice: async (deviceId: string) => {
    const response = await api.get(`/devices/${deviceId}`);
    return response.data.data;
  },

  /**
   * Add a device to trusted devices list
   * @param deviceId - Unique device identifier
   * @param name - Optional custom name for the device
   */
  addTrustedDevice: async (deviceId: string, name?: string) => {
    const response = await api.post('/devices/trusted', { deviceId, name });
    return response.data.data;
  },

  /**
   * Remove a device from trusted devices list
   * @param deviceId - The device ID to remove
   */
  removeTrustedDevice: async (deviceId: string) => {
    const response = await api.delete(`/devices/trusted/${deviceId}`);
    return response.data;
  },

  /**
   * Rename a trusted device
   * @param deviceId - The device ID
   * @param name - New device name
   */
  renameDevice: async (deviceId: string, name: string) => {
    const response = await api.patch(`/devices/${deviceId}`, { name });
    return response.data.data;
  },

  /**
   * Get login history with filtering
   * @param options - Filter and pagination options
   */
  getLoginHistory: async (options = {}) => {
    const response = await api.get('/devices/login-history', { params: options });
    return response.data.data;
  },

  /**
   * Get login history summary
   */
  getLoginHistorySummary: async () => {
    const response = await api.get('/devices/login-history/summary');
    return response.data.data;
  },

  /**
   * Get device security settings
   */
  getDeviceSettings: async () => {
    const response = await api.get('/devices/settings');
    return response.data.data;
  },

  /**
   * Update device security settings
   * @param settings - Settings to update
   */
  updateDeviceSettings: async (settings: Partial<DeviceSettings>) => {
    const response = await api.patch('/devices/settings', settings);
    return response.data.data;
  },

  /**
   * Report a suspicious device
   * @param deviceId - The device ID
   * @param reason - Reason for reporting
   */
  reportSuspiciousDevice: async (deviceId: string, reason: string) => {
    const response = await api.post(`/devices/${deviceId}/report`, { reason });
    return response.data.data;
  },

  /**
   * Revoke all sessions except the current one
   */
  revokeOtherSessions: async () => {
    const response = await api.post('/devices/revoke-others');
    return response.data.data;
  },

  /**
   * Get device statistics
   */
  getDeviceStats: async () => {
    const response = await api.get('/devices/stats');
    return response.data.data;
  },

  /**
   * Verify device ownership with code
   * @param deviceId - The device ID
   * @param verificationCode - Verification code sent to device
   */
  verifyDevice: async (deviceId: string, verificationCode: string) => {
    const response = await api.post(`/devices/${deviceId}/verify`, {
      verificationCode,
    });
    return response.data.data;
  },

  /**
   * Get information about the current device
   */
  getCurrentDevice: async () => {
    const response = await api.get('/devices/current');
    return response.data.data;
  },
};

export default deviceApi;
