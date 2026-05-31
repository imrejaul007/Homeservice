import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

// Session expiry warning threshold (ms before expiry)
const SESSION_EXPIRY_WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes

interface UseAuthGuardOptions {
  /** Whether to redirect to login on session expiry */
  redirectOnExpiry?: boolean;
  /** Custom redirect path */
  redirectPath?: string;
  /** Callback when session is about to expire */
  onExpiryWarning?: () => void;
  /** Callback when session has expired */
  onExpired?: () => void;
}

/**
 * Hook to handle authentication state and session expiry
 *
 * Features:
 * - Detects token expiration in advance
 * - Attempts automatic token refresh before expiry
 * - Provides callbacks for UI warnings
 * - Optionally redirects to login on session expiry
 */
export function useAuthGuard(options: UseAuthGuardOptions = {}) {
  const {
    redirectOnExpiry = true,
    redirectPath = '/login',
    onExpiryWarning,
    onExpired,
  } = options;

  const navigate = useNavigate();
  const { user, tokens, isAuthenticated, refreshToken } = useAuthStore();
  const refreshAttemptedRef = useRef<Set<string>>(new Set());
  const lastRefreshAttemptRef = useRef<number>(0);

  // Parse JWT to get expiration time
  const parseTokenExpiry = useCallback((token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null; // Convert to ms
    } catch {
      return null;
    }
  }, []);

  // Check if token is about to expire
  const isTokenExpiringSoon = useCallback((token: string): boolean => {
    const expiry = parseTokenExpiry(token);
    if (!expiry) return false;

    const now = Date.now();
    const timeUntilExpiry = expiry - now;

    return timeUntilExpiry > 0 && timeUntilExpiry < SESSION_EXPIRY_WARNING_THRESHOLD;
  }, [parseTokenExpiry]);

  // Check if token is expired
  const isTokenExpired = useCallback((token: string): boolean => {
    const expiry = parseTokenExpiry(token);
    if (!expiry) return false;

    return Date.now() >= expiry;
  }, [parseTokenExpiry]);

  // Attempt to refresh tokens
  const attemptTokenRefresh = useCallback(async (): Promise<boolean> => {
    if (!tokens?.refreshToken) {
      return false;
    }

    // Debounce refresh attempts (at least 30 seconds between attempts)
    const now = Date.now();
    if (now - lastRefreshAttemptRef.current < 30000) {
      return false;
    }

    try {
      lastRefreshAttemptRef.current = now;
      await refreshToken();

      // Reset debounce tracking
      refreshAttemptedRef.current.clear();
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
    }

    return false;
  }, [tokens?.refreshToken, refreshToken]);

  // Handle session expiry
  const handleSessionExpiry = useCallback(() => {
    if (onExpired) {
      onExpired();
    }

    if (redirectOnExpiry) {
      // Clear auth state
      useAuthStore.getState().logout();

      // Redirect to login with return URL
      const returnUrl = window.location.pathname;
      navigate(`${redirectPath}?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [onExpired, redirectOnExpiry, redirectPath, navigate]);

  // Session check effect
  useEffect(() => {
    if (!isAuthenticated || !tokens?.accessToken) {
      return;
    }

    // Check token expiration
    if (isTokenExpired(tokens.accessToken)) {
      handleSessionExpiry();
      return;
    }

    // If token is expiring soon, attempt refresh
    if (isTokenExpiringSoon(tokens.accessToken)) {
      if (onExpiryWarning) {
        onExpiryWarning();
      }

      // Attempt refresh (will be debounced)
      attemptTokenRefresh();
    }
  }, [isAuthenticated, tokens?.accessToken, isTokenExpired, isTokenExpiringSoon, handleSessionExpiry, onExpiryWarning, attemptTokenRefresh]);

  // Periodic session check (every minute)
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const interval = setInterval(() => {
      if (tokens?.accessToken && isTokenExpired(tokens.accessToken)) {
        handleSessionExpiry();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, tokens?.accessToken, isTokenExpired, handleSessionExpiry]);

  return {
    isAuthenticated,
    user,
    isSessionExpiringSoon: tokens?.accessToken ? isTokenExpiringSoon(tokens.accessToken) : false,
    isSessionExpired: tokens?.accessToken ? isTokenExpired(tokens.accessToken) : true,
    attemptTokenRefresh,
    handleSessionExpiry,
  };
}

export default useAuthGuard;
