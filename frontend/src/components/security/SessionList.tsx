/**
 * SessionList Component
 * Display and manage active user sessions
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface Session {
  id: string;
  device: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  browser?: string;
  os?: string;
  ip?: string;
  location?: string;
  createdAt: Date;
  lastActive: Date;
  expiresAt: Date;
  isCurrent: boolean;
  isTrusted: boolean;
}

interface SessionListProps {
  userId: string;
  onSessionRevoked?: (sessionId: string) => void;
  onAllRevoked?: () => void;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export const SessionList: React.FC<SessionListProps> = ({
  userId,
  onSessionRevoked,
  onAllRevoked,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'current' | 'other'>('all');

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/sessions?userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }

      const result: ApiResponse<{ sessions: any[] }> = await response.json();

      if (result.success && result.data) {
        setSessions(result.data.sessions.map(s => ({
          ...s,
          createdAt: new Date(s.createdAt),
          lastActive: new Date(s.lastActive),
          expiresAt: new Date(s.expiresAt),
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Revoke single session
  const handleRevokeSession = async (sessionId: string) => {
    try {
      setActionLoading(sessionId);

      const response = await fetch(`/api/sessions/${sessionId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke session');
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      onSessionRevoked?.(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke all other sessions
  const handleRevokeAllOther = async () => {
    try {
      setActionLoading('revoke-all');

      const response = await fetch(`/api/sessions/revoke-others`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }

      setSessions(prev => prev.filter(s => s.isCurrent));
      onAllRevoked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
    } finally {
      setActionLoading(null);
    }
  };

  // Revoke all sessions
  const handleRevokeAll = async () => {
    try {
      setActionLoading('revoke-all');

      const response = await fetch(`/api/sessions/revoke-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke sessions');
      }

      setSessions(prev => prev.filter(s => s.isCurrent));
      onAllRevoked?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke sessions');
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

  // Format date/time
  const formatDateTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get session status
  const getSessionStatus = (session: Session) => {
    if (session.isCurrent) {
      return { label: 'Current', color: 'bg-blue-100 text-blue-700', icon: 'check' };
    }
    if (session.lastActive && (Date.now() - session.lastActive.getTime()) < 5 * 60 * 1000) {
      return { label: 'Active', color: 'bg-green-100 text-green-700', icon: 'pulse' };
    }
    return { label: 'Inactive', color: 'bg-gray-100 text-gray-600', icon: 'none' };
  };

  // Filter sessions
  const filteredSessions = sessions.filter(s => {
    if (filter === 'current') return s.isCurrent;
    if (filter === 'other') return !s.isCurrent;
    return true;
  });

  if (loading) {
    return (
      <div className="session-list">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg" />
          ))}
        </div>
        <style>{`.session-list { padding: 16px; }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-list">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchSessions}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
        <style>{`.session-list { padding: 16px; }`}</style>
      </div>
    );
  }

  const currentSession = sessions.find(s => s.isCurrent);
  const otherSessions = sessions.filter(s => !s.isCurrent);

  return (
    <div className="session-list">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Active Sessions</h2>
          <p className="text-sm text-gray-500 mt-1">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} across all devices
          </p>
        </div>

        {otherSessions.length > 0 && (
          <button
            onClick={handleRevokeAllOther}
            disabled={actionLoading === 'revoke-all'}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            {actionLoading === 'revoke-all' ? 'Revoking...' : 'Sign out all other sessions'}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 mb-4">
        {[
          { key: 'all', label: 'All', count: sessions.length },
          { key: 'current', label: 'Current', count: currentSession ? 1 : 0 },
          { key: 'other', label: 'Other Devices', count: otherSessions.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
              filter === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              filter === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {filteredSessions.map(session => {
          const status = getSessionStatus(session);
          return (
            <div
              key={session.id}
              className={`bg-white border ${
                session.isCurrent ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
              } rounded-lg p-4 transition-shadow hover:shadow-sm`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {/* Device Icon */}
                  <div className={`p-2.5 rounded-lg ${
                    session.isCurrent ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {getDeviceIcon(session.deviceType)}
                  </div>

                  {/* Session Info */}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-gray-900">{session.device}</h4>
                      {session.isCurrent && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
                          This Device
                        </span>
                      )}
                      {session.isTrusted && !session.isCurrent && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Trusted
                        </span>
                      )}
                    </div>

                    <div className="mt-2 space-y-1">
                      {session.browser && (
                        <p className="text-sm text-gray-500">
                          {session.browser} {session.os && `on ${session.os}`}
                        </p>
                      )}
                      {session.location && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          {session.location}
                        </p>
                      )}
                      {session.ip && (
                        <p className="text-sm text-gray-400 font-mono">{session.ip}</p>
                      )}
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Last active: {formatDateTime(session.lastActive)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Signed in: {formatDateTime(session.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {!session.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={actionLoading === session.id}
                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {actionLoading === session.id ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Signing out...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Sign out
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredSessions.length === 0 && (
        <div className="text-center py-12">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No sessions found</h3>
          <p className="text-sm text-gray-500">
            {filter === 'other' ? 'No sessions on other devices.' : 'Your active sessions will appear here.'}
          </p>
        </div>
      )}

      {/* Session Security Info */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About Sessions
        </h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>Sessions automatically expire after 30 days of inactivity</li>
          <li>Only sessions from trusted devices can bypass two-factor authentication</li>
          <li>You can have up to 10 active sessions at once</li>
        </ul>
      </div>

      {/* Danger Zone */}
      {sessions.length > 1 && (
        <div className="mt-6 p-4 border border-red-200 bg-red-50 rounded-lg">
          <h4 className="text-sm font-medium text-red-900 mb-2">Danger Zone</h4>
          <p className="text-sm text-red-700 mb-3">
            Signing out of all sessions will immediately end all active sessions including this one.
            You will need to log in again on all devices.
          </p>
          <button
            onClick={handleRevokeAll}
            disabled={actionLoading === 'revoke-all'}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            Sign out of all sessions everywhere
          </button>
        </div>
      )}

      <style>{`
        .session-list {
          padding: 16px;
        }
      `}</style>
    </div>
  );
};

export default SessionList;
