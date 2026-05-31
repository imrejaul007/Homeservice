import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';

/**
 * Session expiry warning banner that shows when session is about to expire
 * Provides option to extend session before it expires
 */
export const SessionExpiryWarning: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, tokens, refreshToken } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Parse JWT to get expiration time
  const getTokenExpiry = useCallback((): number | null => {
    if (!tokens?.accessToken) return null;

    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }, [tokens?.accessToken]);

  // Calculate time remaining until expiry
  useEffect(() => {
    if (!isAuthenticated) {
      setIsVisible(false);
      return;
    }

    const checkExpiry = () => {
      const expiry = getTokenExpiry();
      if (!expiry) {
        setIsVisible(false);
        return;
      }

      const now = Date.now();
      const remaining = expiry - now;
      const fiveMinutes = 5 * 60 * 1000;

      // Show warning if less than 5 minutes remaining
      if (remaining > 0 && remaining < fiveMinutes) {
        setTimeRemaining(remaining);
        setIsVisible(true);
      } else if (remaining <= 0) {
        // Session already expired
        setTimeRemaining(0);
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // Initial check
    checkExpiry();

    // Check every 30 seconds
    const interval = setInterval(checkExpiry, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, getTokenExpiry]);

  // Format time remaining
  const formatTimeRemaining = (ms: number): string => {
    if (ms <= 0) return '0:00';

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle session extension
  const handleExtendSession = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const success = await refreshToken();
      if (success) {
        setIsVisible(false);
        setTimeRemaining(null);
      } else {
        // Refresh failed - show error but don't dismiss
        console.error('Failed to extend session');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    useAuthStore.getState().logout();
    navigate('/login');
  };

  if (!isVisible || !isAuthenticated) {
    return null;
  }

  const isExpired = timeRemaining !== null && timeRemaining <= 0;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isExpired
          ? "bg-red-600 text-white"
          : "bg-amber-500 text-white"
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {isExpired ? (
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <Clock className="w-5 h-5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {isExpired ? (
                <p className="font-medium">Your session has expired.</p>
              ) : (
                <p className="font-medium">
                  Your session will expire in{' '}
                  <span className="font-mono font-bold">
                    {formatTimeRemaining(timeRemaining!)}
                  </span>
                </p>
              )}
              <p className="text-sm opacity-90">
                {isExpired
                  ? "Please log in again to continue."
                  : "Would you like to stay logged in?"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {isExpired ? (
              <button
                onClick={handleLogout}
                className={cn(
                  "px-4 py-2 rounded-lg font-medium transition-all",
                  "bg-white/20 hover:bg-white/30",
                  "focus:outline-none focus:ring-2 focus:ring-white/50"
                )}
              >
                Log In
              </button>
            ) : (
              <>
                <button
                  onClick={handleLogout}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    "bg-white/20 hover:bg-white/30",
                    "focus:outline-none focus:ring-2 focus:ring-white/50"
                  )}
                >
                  Log Out
                </button>
                <button
                  onClick={handleExtendSession}
                  disabled={isRefreshing}
                  className={cn(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    "bg-white text-gray-900 hover:bg-gray-100",
                    "focus:outline-none focus:ring-2 focus:ring-white/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-2"
                  )}
                >
                  {isRefreshing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    "Stay Logged In"
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => setIsVisible(false)}
              className={cn(
                "p-1.5 rounded-lg transition-all",
                "hover:bg-white/20",
                "focus:outline-none focus:ring-2 focus:ring-white/50"
              )}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionExpiryWarning;
