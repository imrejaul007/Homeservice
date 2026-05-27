import React, { useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, X, CloudOff, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useHaptics } from '../../hooks/useHaptics';
// Note: Using web event listeners for network detection
// Capacitor Network plugin can be added if needed

/**
 * Sync status tracking
 */
interface SyncStatus {
  isSyncing: boolean;
  lastSynced: Date | null;
  pendingChanges: number;
}

/**
 * OfflineBanner Component
 *
 * Shows a branded banner when the device goes offline.
 * NILIN-themed styling with warm luxury palette.
 * Auto-dismisses when back online.
 * Shows sync status and last sync time when online.
 */
interface OfflineBannerProps {
  className?: string;
  autoHideDelay?: number; // ms before auto-hide after coming back online
  showCloseButton?: boolean;
  onOnline?: () => void;
  onOffline?: () => void;
  /** Custom sync status from parent (e.g., OfflineSync service) */
  syncStatus?: SyncStatus;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  className,
  autoHideDelay = 3000,
  showCloseButton = true,
  onOnline,
  onOffline,
  syncStatus,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [localSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSynced: null,
    pendingChanges: 0,
  });
  const { notification } = useHaptics();

  // Use provided sync status or local state
  const currentSyncStatus = syncStatus || localSyncStatus;

  // Format last sync time
  const formatLastSyncTime = useCallback((date: Date | null): string => {
    if (!date) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString();
  }, []);

  useEffect(() => {
    // Check initial state
    if (!navigator.onLine) {
      setIsVisible(true);
      setWasOffline(true);
      onOffline?.();
      notification('warning');
    }

    const handleOnline = () => {
      setWasOffline(true);
      onOnline?.();
      notification('success');

      // Auto-hide after coming back online
      setTimeout(() => {
        setIsVisible(false);
        setWasOffline(false);
      }, autoHideDelay);
    };

    const handleOffline = () => {
      setIsVisible(true);
      setWasOffline(true);
      onOffline?.();
      notification('warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoHideDelay, onOnline, onOffline, notification]);

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible || !wasOffline) {
    return null;
  }

  const isOnline = navigator.onLine;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[9999]',
        'transform transition-all duration-300 ease-out',
        isVisible ? 'translate-y-0' : '-translate-y-full',
        className
      )}
      role="alert"
      aria-live="polite"
      aria-label={isOnline ? 'Connection restored' : 'You are currently offline'}
    >
      <div
        className={cn(
          'relative overflow-hidden',
          // NILIN branded background with gradient
          isOnline
            ? 'bg-gradient-to-r from-green-600 via-emerald-600 to-green-600'
            : 'bg-gradient-to-r from-nilin-charcoal via-gray-800 to-nilin-charcoal',
          // Glass effect overlay
          'before:absolute before:inset-0 before:bg-gradient-to-r before:from-nilin-coral/10 before:to-nilin-rose/10',
          // Subtle border
          'border-b border-nilin-coral/20'
        )}
      >
        <div className="relative px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Icon and Text */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Status Icon */}
              <div
                className={cn(
                  'flex-shrink-0 p-2 rounded-full',
                  isOnline ? 'bg-white/20' : 'bg-nilin-coral/20',
                  isOnline ? 'animate-pulse' : 'animate-pulse'
                )}
              >
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-white" />
                ) : currentSyncStatus.isSyncing ? (
                  <RefreshCw className="w-4 h-4 text-nilin-coral animate-spin" />
                ) : currentSyncStatus.pendingChanges > 0 ? (
                  <CloudOff className="w-4 h-4 text-nilin-coral" />
                ) : (
                  <WifiOff className="w-4 h-4 text-nilin-coral" />
                )}
              </div>

              {/* Text Content */}
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    'text-sm font-medium text-white',
                    'truncate'
                  )}
                >
                  {isOnline
                    ? 'Connection restored'
                    : currentSyncStatus.isSyncing
                    ? 'Syncing...'
                    : currentSyncStatus.pendingChanges > 0
                    ? `Offline - ${currentSyncStatus.pendingChanges} pending`
                    : "You're offline"}
                </span>
                <div className="flex items-center gap-2">
                  {/* Sync Status */}
                  {currentSyncStatus.pendingChanges > 0 && !isOnline && (
                    <span
                      className={cn(
                        'text-xs text-white/70',
                        'hidden sm:block truncate'
                      )}
                    >
                      Changes will sync when online
                    </span>
                  )}
                  {/* Last Sync Time */}
                  <span
                    className={cn(
                      'text-xs text-white/60',
                      'flex items-center gap-1'
                    )}
                  >
                    <Clock className="w-3 h-3" />
                    Last sync: {formatLastSyncTime(currentSyncStatus.lastSynced)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Close Button */}
            {showCloseButton && (
              <button
                onClick={handleClose}
                className={cn(
                  'flex-shrink-0 p-2 rounded-full',
                  'bg-white/10 hover:bg-white/20',
                  'transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50'
                )}
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4 text-white/80" />
              </button>
            )}
          </div>

          {/* Progress indicator for auto-hide when coming back online */}
          {isOnline && (
            <div
              className={cn(
                'absolute bottom-0 left-0 h-0.5',
                'bg-gradient-to-r from-white/50 to-white'
              )}
              style={{
                width: '100%',
                transition: 'all 3000ms ease-linear',
                animation: `shrink ${autoHideDelay}ms ease-in-out forwards`,
              }}
            />
          )}
        </div>
      </div>

      {/* CSS Keyframe for progress bar */}
      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

/**
 * Compact inline offline indicator
 * Use this when you want a smaller indicator without taking up full width
 */
interface OfflineIndicatorProps {
  className?: string;
  showText?: boolean;
  /** Show sync status indicator */
  showSyncStatus?: boolean;
  /** Current sync status */
  syncStatus?: SyncStatus;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  showText = false,
  showSyncStatus = false,
  syncStatus,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [localSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSynced: null,
    pendingChanges: 0,
  });

  const currentSyncStatus = syncStatus || localSyncStatus;

  // Format last sync time
  const formatLastSyncTime = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Show sync status indicator when online and requested
  if (isOnline && showSyncStatus) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2',
          'px-2 py-1 rounded-full',
          currentSyncStatus.isSyncing
            ? 'bg-blue-100 border border-blue-200'
            : currentSyncStatus.pendingChanges > 0
            ? 'bg-amber-100 border border-amber-200'
            : 'bg-green-100 border border-green-200',
          className
        )}
        role="status"
        aria-live="polite"
      >
        {currentSyncStatus.isSyncing ? (
          <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
        ) : currentSyncStatus.pendingChanges > 0 ? (
          <CloudOff className="w-3 h-3 text-amber-600" />
        ) : (
          <Wifi className="w-3 h-3 text-green-600" />
        )}
        <span className="text-xs font-medium text-gray-700">
          {currentSyncStatus.isSyncing
            ? 'Syncing...'
            : currentSyncStatus.pendingChanges > 0
            ? `${currentSyncStatus.pendingChanges} pending`
            : `Synced ${formatLastSyncTime(currentSyncStatus.lastSynced)}`}
        </span>
      </div>
    );
  }

  if (isOnline) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2',
        'px-2 py-1 rounded-full',
        'bg-nilin-charcoal/10 border border-nilin-charcoal/20',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <WifiOff className="w-3 h-3 text-nilin-charcoal/70" />
      {showText && (
        <span className="text-xs font-medium text-nilin-charcoal/70">
          Offline
        </span>
      )}
    </div>
  );
};

export default OfflineBanner;
