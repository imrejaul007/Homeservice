/**
 * LoginAlerts Component
 * Display recent login activity and security alerts
 */

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';

// Types
interface LoginAlert {
  id: string;
  type: 'impossible_travel' | 'new_location' | 'new_device' | 'failed_login' | 'password_changed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: {
    ip?: string;
    location?: string;
    device?: string;
    timestamp: Date;
    resolved?: boolean;
  };
  detectedAt: Date;
}

interface LoginSession {
  id: string;
  device: string;
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  timestamp: Date;
  isCurrent: boolean;
  suspicious?: boolean;
}

interface LoginAlertsProps {
  userId: string;
  onAlertResolved?: (alertId: string) => void;
  onSessionRevoked?: (sessionId: string) => void;
  onAllRevoked?: () => void;
  maxConcurrentSessions?: number; // Max allowed concurrent sessions (0 = unlimited)
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const LoginAlerts: React.FC<LoginAlertsProps> = ({
  userId,
  onAlertResolved,
  onSessionRevoked,
  onAllRevoked,
  maxConcurrentSessions = 0, // 0 = unlimited
}) => {
  const [alerts, setAlerts] = useState<LoginAlert[]>([]);
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'activity'>('alerts');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sessionLimit, setSessionLimit] = useState<number>(maxConcurrentSessions);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInput, setLimitInput] = useState(maxConcurrentSessions.toString());

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [alertsRes, sessionsRes] = await Promise.all([
        api.get(`/security/alerts?userId=${userId}`),
        api.get(`/security/sessions?userId=${userId}`),
      ]);

      const alertsData: ApiResponse<{ alerts: any[] }> = alertsRes.data;
      const sessionsData: ApiResponse<{ sessions: any[] }> = sessionsRes.data;

      if (alertsData.success && alertsData.data) {
        setAlerts(alertsData.data.alerts.map(a => ({
          ...a,
          detectedAt: new Date(a.detectedAt),
          details: {
            ...a.details,
            timestamp: new Date(a.details.timestamp),
          },
        })));
      }

      if (sessionsData.success && sessionsData.data) {
        setSessions(sessionsData.data.sessions.map(s => ({
          ...s,
          timestamp: new Date(s.timestamp),
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Resolve alert
  const handleResolveAlert = async (alertId: string) => {
    try {
      setActionLoading(alertId);

      await api.post(`/security/alerts/${alertId}/resolve`, { userId });

      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, details: { ...a.details, resolved: true } } : a
      ));
      onAlertResolved?.(alertId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve alert');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      setActionLoading(sessionId);

      await api.post(`/security/sessions/${sessionId}/revoke`, { userId });

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      onSessionRevoked?.(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke all other sessions
  const handleRevokeAllSessions = async () => {
    try {
      setActionLoading('revoke-all');

      await api.post('/security/sessions/revoke-all', { userId });

      setSessions(prev => prev.filter(s => s.isCurrent));
      onAllRevoked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setActionLoading(null);
    }
  };

  // Save session limit setting
  const handleSaveSessionLimit = async () => {
    const limit = parseInt(limitInput, 10);
    if (isNaN(limit) || limit < 0) {
      setError('Please enter a valid number (0 for unlimited)');
      return;
    }
    try {
      setActionLoading('save-limit');
      await api.post('/security/sessions/limit', { userId, maxSessions: limit });
      setSessionLimit(limit);
      setShowLimitModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session limit');
    } finally {
      setActionLoading(null);
    }
  };

  // Check if sessions exceed limit
  const activeSessionsCount = sessions.filter(s => !s.isCurrent).length;
  const exceedsLimit = sessionLimit > 0 && activeSessionsCount > sessionLimit;

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-100', border: 'border-red-300', icon: 'text-red-600', text: 'text-red-800' };
      case 'high':
        return { bg: 'bg-orange-100', border: 'border-orange-300', icon: 'text-orange-600', text: 'text-orange-800' };
      case 'medium':
        return { bg: 'bg-yellow-100', border: 'border-yellow-300', icon: 'text-yellow-600', text: 'text-yellow-800' };
      default:
        return { bg: 'bg-blue-100', border: 'border-blue-300', icon: 'text-blue-600', text: 'text-blue-800' };
    }
  };

  // Get alert type icon
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'impossible_travel':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        );
      case 'new_location':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'new_device':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'failed_login':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
    }
  };

  // Format date
  // Mask IP address for privacy (hide middle octets for IPv4, last two segments for IPv6)
  const maskIpAddress = (ip: string): string => {
    if (!ip) return 'Unknown';

    // IPv4: mask middle octets (e.g., 192.168.xxx.xxx)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
      const parts = ip.split('.');
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }

    // IPv6: mask last two segments
    if (ip.includes(':')) {
      const parts = ip.split(':');
      const lastTwo = parts.slice(-2).map(() => 'xxxx').join(':');
      return [...parts.slice(0, 6 - 2), lastTwo].join(':');
    }

    return ip;
  };

  // Format date
  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Filter alerts
  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const unresolvedAlerts = filteredAlerts.filter(a => !a.details.resolved);
  const resolvedAlerts = filteredAlerts.filter(a => a.details.resolved);

  if (loading) {
    return (
      <div className="login-alerts">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
          <div className="h-24 bg-gray-200 rounded" />
        </div>
        <style>{`.login-alerts { padding: 16px; }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login-alerts">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
        <style>{`.login-alerts { padding: 16px; }`}</style>
      </div>
    );
  }

  return (
    <div className="login-alerts">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Login & Security</h2>
        <p className="text-sm text-gray-500 mt-1">
          Monitor your account activity and manage security alerts.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'alerts'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Security Alerts
          {unresolvedAlerts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
              {unresolvedAlerts.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeTab === 'activity'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Recent Activity
        </button>
      </div>

      {activeTab === 'alerts' && (
        <>
          {/* Severity Filter */}
          <div className="flex gap-2 mb-4">
            {['all', 'critical', 'high', 'medium', 'low'].map(severity => (
              <button
                key={severity}
                onClick={() => setFilterSeverity(severity)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  filterSeverity === severity
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </button>
            ))}
          </div>

          {/* Unresolved Alerts */}
          {unresolvedAlerts.length > 0 && (
            <div className="space-y-3 mb-6">
              <h3 className="text-sm font-medium text-gray-700">Active Alerts</h3>
              {unresolvedAlerts.map(alert => {
                const colors = getSeverityColor(alert.severity);
                return (
                  <div
                    key={alert.id}
                    className={`${colors.bg} border ${colors.border} rounded-lg p-4`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${colors.icon}`}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.text} bg-white/50`}>
                              {alert.severity.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(alert.detectedAt)}
                            </span>
                          </div>
                          <p className={`mt-1 font-medium ${colors.text}`}>{alert.message}</p>
                          <div className="mt-2 text-sm text-gray-600 space-y-1">
                            {alert.details.location && <p>Location: {alert.details.location}</p>}
                            {alert.details.ip && <p>IP: {alert.details.ip}</p>}
                            {alert.details.device && <p>Device: {alert.details.device}</p>}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        disabled={actionLoading === alert.id}
                        className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                      >
                        {actionLoading === alert.id ? 'Resolving...' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resolved Alerts */}
          {resolvedAlerts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500">Resolved</h3>
              {resolvedAlerts.slice(0, 5).map(alert => (
                <div
                  key={alert.id}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-4 opacity-75"
                >
                  <div className="flex items-center gap-2 text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">{alert.message}</span>
                    <span className="text-xs">• {formatDate(alert.detectedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {alerts.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">All Clear</h3>
              <p className="text-sm text-gray-500">No security alerts for your account.</p>
            </div>
          )}
        </>
      )}

      {activeTab === 'activity' && (
        <>
          {/* Session Limit Controls */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              {sessionLimit > 0 ? (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{activeSessionsCount}</span> active sessions (max: {sessionLimit})
                  {exceedsLimit && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                      Limit exceeded
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{activeSessionsCount}</span> active sessions (unlimited)
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setLimitInput(sessionLimit.toString());
                  setShowLimitModal(true);
                }}
                className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                {sessionLimit > 0 ? 'Change Limit' : 'Set Limit'}
              </button>
              {sessions.length > 1 && (
                <button
                  onClick={handleRevokeAllSessions}
                  disabled={actionLoading === 'revoke-all'}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionLoading === 'revoke-all' ? 'Revoking...' : 'Revoke All Others'}
                </button>
              )}
            </div>
          </div>

          {/* Session Limit Modal */}
          {showLimitModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Set Session Limit</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Limit the number of concurrent sessions. Set to 0 for unlimited.
                </p>
                <input
                  type="number"
                  min="0"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter max sessions (0 = unlimited)"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowLimitModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSessionLimit}
                    disabled={actionLoading === 'save-limit'}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'save-limit' ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-3">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`bg-white border ${session.isCurrent ? 'border-blue-300' : 'border-gray-200'} rounded-lg p-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${session.isCurrent ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{session.device}</h4>
                        {session.isCurrent && (
                          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                            Current Session
                          </span>
                        )}
                        {session.suspicious && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                            Suspicious
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-gray-500 space-y-0.5">
                        {session.browser && <p>{session.browser} on {session.os || 'Unknown OS'}</p>}
                        {session.location && <p>{session.location}</p>}
                        {session.ip && <p className="font-mono text-xs">{maskIpAddress(session.ip)}</p>}
                        <p className="text-xs">{formatDate(session.timestamp)}</p>
                      </div>
                    </div>
                  </div>

                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={actionLoading === session.id}
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {actionLoading === session.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {sessions.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No recent activity</h3>
              <p className="text-sm text-gray-500">Your login history will appear here.</p>
            </div>
          )}
        </>
      )}

      <style>{`
        .login-alerts {
          padding: 16px;
        }
      `}</style>
    </div>
  );
};

export default LoginAlerts;
