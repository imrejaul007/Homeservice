/**
 * DeviceManagement Component
 * Manage trusted devices and view device list
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

// Types
interface Device {
  id: string;
  fingerprint: string;
  deviceName: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
  firstSeen: Date;
  lastActive: Date;
  isTrusted: boolean;
  verified: boolean;
  verifiedAt?: Date;
}

interface DeviceManagementProps {
  userId: string;
  onDeviceRemoved?: (deviceId: string) => void;
  onDeviceTrusted?: (deviceId: string) => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const DeviceManagement: React.FC<DeviceManagementProps> = ({
  userId,
  onDeviceRemoved,
  onDeviceTrusted,
}) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  // Fetch devices
  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get<ApiResponse<{ devices: Device[] }>>(`/devices?userId=${userId}`);
      const result = response.data;

      if (result.success && result.data) {
        setDevices(result.data.devices.map(d => ({
          ...d,
          firstSeen: new Date(d.firstSeen),
          lastActive: new Date(d.lastActive),
          verifiedAt: d.verifiedAt ? new Date(d.verifiedAt) : undefined,
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Remove device
  const handleRemoveDevice = async (deviceId: string) => {
    try {
      setActionLoading(deviceId);

      await api.delete(`/devices/${deviceId}`, { data: { userId } });

      setDevices(prev => prev.filter(d => d.id !== deviceId));
      onDeviceRemoved?.(deviceId);
      setShowRemoveConfirm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove device');
    } finally {
      setActionLoading(null);
    }
  };

  // Trust device
  const handleTrustDevice = async (deviceId: string) => {
    try {
      setActionLoading(deviceId);

      await api.post(`/devices/${deviceId}/trust`, { userId });

      setDevices(prev => prev.map(d =>
        d.id === deviceId
          ? { ...d, isTrusted: true, verified: true, verifiedAt: new Date() }
          : d
      ));
      onDeviceTrusted?.(deviceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trust device');
    } finally {
      setActionLoading(null);
    }
  };

  // Rename device
  const [editingDevice, setEditingDevice] = useState<string | null>(null);
  const [newDeviceName, setNewDeviceName] = useState('');

  const handleRenameDevice = async (deviceId: string) => {
    if (!newDeviceName.trim()) return;

    try {
      setActionLoading(deviceId);

      await api.patch(`/devices/${deviceId}/rename`, { name: newDeviceName });

      setDevices(prev => prev.map(d =>
        d.id === deviceId ? { ...d, deviceName: newDeviceName } : d
      ));
      setEditingDevice(null);
      setNewDeviceName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename device');
    } finally {
      setActionLoading(null);
    }
  };

  // Get device icon
  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'mobile':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      case 'tablet':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Get browser name
  const getBrowserName = (browser?: string) => {
    if (!browser) return null;
    const browserMap: Record<string, string> = {
      Chrome: 'Google Chrome',
      Firefox: 'Mozilla Firefox',
      Safari: 'Safari',
      Edge: 'Microsoft Edge',
      Opera: 'Opera',
    };
    return browserMap[browser] || browser;
  };

  if (loading) {
    return (
      <div className="device-management">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 rounded-lg h-24" />
            </div>
          ))}
        </div>
        <style>{`
          .device-management {
            padding: 16px;
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="device-management">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDevices}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const trustedDevices = devices.filter(d => d.isTrusted);
  const otherDevices = devices.filter(d => !d.isTrusted);

  return (
    <div className="device-management">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Device Management</h2>
        <p className="text-sm text-gray-500 mt-1">
          Manage devices that can access your account without additional verification.
        </p>
      </div>

      {/* Trusted Devices Section */}
      {trustedDevices.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Trusted Devices ({trustedDevices.length})
          </h3>

          <div className="space-y-3">
            {trustedDevices.map(device => (
              <div
                key={device.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {editingDevice === device.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={newDeviceName}
                              onChange={e => setNewDeviceName(e.target.value)}
                              className="text-sm font-medium border border-gray-300 rounded px-2 py-1"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameDevice(device.id);
                                if (e.key === 'Escape') {
                                  setEditingDevice(null);
                                  setNewDeviceName('');
                                }
                              }}
                            />
                            <button
                              onClick={() => handleRenameDevice(device.id)}
                              className="text-blue-600 text-sm"
                              disabled={actionLoading === device.id}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <h4 className="font-medium text-gray-900">{device.deviceName}</h4>
                        )}
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                          Trusted
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                        {device.browser && (
                          <p>{getBrowserName(device.browser)} on {device.os || 'Unknown OS'}</p>
                        )}
                        <p>Last active: {formatDate(device.lastActive)}</p>
                        {device.verifiedAt && (
                          <p>Verified: {formatDate(device.verifiedAt)}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingDevice(device.id);
                        setNewDeviceName(device.deviceName);
                      }}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      title="Rename device"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowRemoveConfirm(device.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Remove device"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Remove Confirmation */}
                {showRemoveConfirm === device.id && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-3">
                      Are you sure you want to remove this device? You will need to verify it again on next login.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                        disabled={actionLoading === device.id}
                      >
                        {actionLoading === device.id ? 'Removing...' : 'Remove Device'}
                      </button>
                      <button
                        onClick={() => setShowRemoveConfirm(null)}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Other Devices Section */}
      {otherDevices.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Other Devices ({otherDevices.length})
          </h3>

          <div className="space-y-3">
            {otherDevices.map(device => (
              <div
                key={device.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                      {getDeviceIcon(device.deviceType)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{device.deviceName}</h4>
                      <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                        {device.browser && (
                          <p>{getBrowserName(device.browser)} on {device.os || 'Unknown OS'}</p>
                        )}
                        <p>First seen: {formatDate(device.firstSeen)}</p>
                        <p>Last active: {formatDate(device.lastActive)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTrustDevice(device.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                      disabled={actionLoading === device.id || trustedDevices.length >= 5}
                      title={trustedDevices.length >= 5 ? 'Maximum trusted devices reached' : 'Trust this device'}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Trust
                    </button>
                    <button
                      onClick={() => setShowRemoveConfirm(device.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="Remove device"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {showRemoveConfirm === device.id && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-700 mb-3">
                      Are you sure you want to remove this device?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRemoveDevice(device.id)}
                        className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50"
                        disabled={actionLoading === device.id}
                      >
                        {actionLoading === device.id ? 'Removing...' : 'Remove Device'}
                      </button>
                      <button
                        onClick={() => setShowRemoveConfirm(null)}
                        className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {devices.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No devices registered</h3>
          <p className="text-sm text-gray-500">
            Devices you use to access your account will appear here.
          </p>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-sm font-medium text-blue-900 mb-1">About Trusted Devices</h4>
        <p className="text-sm text-blue-700">
          Trusted devices can access your account without requiring additional verification.
          You can have up to 5 trusted devices. Removing a trusted device will require
          verification on next login from that device.
        </p>
      </div>

      <style>{`
        .device-management {
          padding: 16px;
        }
      `}</style>
    </div>
  );
};

export default DeviceManagement;
