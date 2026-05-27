/**
 * useOfflineSync Hook
 *
 * React hook for managing offline synchronization state and actions.
 * Provides reactive state for pending actions, sync status, and online state.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  offlineSync,
  type PendingAction,
  type SyncStats,
  type SyncResult,
  type ActionType,
  type ConflictResolution,
  type SyncOptions,
  type SyncPriorityLevel,
} from '../services/OfflineSync';
import { useOnlineStatus } from './useOnlineStatus';

// =============================================================================
// Types
// =============================================================================

export type { SyncPriorityLevel };

export interface UseOfflineSyncOptions {
  /** Enable auto-sync when back online (default: true) */
  autoSync?: boolean;
  /** Debounce sync calls (default: 1000ms) */
  syncDebounceMs?: number;
  /** Callback when sync completes */
  onSyncComplete?: (results: SyncResult[]) => void;
  /** Callback when sync fails */
  onSyncError?: (error: Error) => void;
  /** Callback when coming back online */
  onBackOnline?: () => void;
  /** Callback when going offline */
  onGoOffline?: () => void;
  /** Default priority for queued actions */
  defaultPriority?: SyncPriorityLevel;
  /** Enable delta sync (default: true) */
  enableDeltaSync?: boolean;
}

export interface UseOfflineSyncReturn {
  /** Current online status */
  isOnline: boolean;
  /** Whether the device was previously offline */
  wasOffline: boolean;
  /** Number of pending actions */
  pendingActions: number;
  /** Whether sync is currently in progress */
  isSyncing: boolean;
  /** Last time sync was completed */
  lastSyncTime: Date | null;
  /** Current sync statistics */
  syncStats: SyncStats;
  /** All pending actions */
  actions: PendingAction[];
  /** Priority statistics */
  priorityStats: {
    critical: number;
    normal: number;
    low: number;
    total: number;
  };
  /** Queue a new action with optional priority */
  queueAction: (
    type: ActionType,
    payload: unknown,
    metadata?: Record<string, unknown>,
    options?: SyncOptions
  ) => Promise<string>;
  /** Queue with explicit priority */
  queueWithPriority: (
    type: ActionType,
    payload: unknown,
    priority: SyncPriorityLevel,
    metadata?: Record<string, unknown>
  ) => Promise<string>;
  /** Remove an action from the queue */
  removeAction: (actionId: string) => Promise<void>;
  /** Manually trigger sync */
  syncNow: () => Promise<SyncResult[]>;
  /** Retry failed actions */
  retryFailed: () => Promise<SyncResult[]>;
  /** Clear all pending actions */
  clearQueue: () => Promise<void>;
  /** Get actions by type */
  getActionsByType: (type: ActionType) => PendingAction[];
  /** Resolve a conflict */
  resolveConflict: (actionId: string, resolution: ConflictResolution) => Promise<SyncResult>;
  /** Reprioritize an action */
  reprioritize: (actionId: string, newPriority: SyncPriorityLevel) => Promise<void>;
  /** Pending conflicts count */
  pendingConflicts: number;
  /** Conflicts requiring manual resolution */
  manualResolutionQueue: Array<{
    conflictId: string;
    entityType: string;
    entityId: string;
    fields: unknown[];
    suggestedResolutions: unknown;
  }>;
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function useOfflineSync(options: UseOfflineSyncOptions = {}): UseOfflineSyncReturn {
  const {
    autoSync = true,
    syncDebounceMs = 5000, // CHANGED from 1000 (1 second) to 5000 (5 seconds) for battery optimization
    onSyncComplete,
    onSyncError,
    onBackOnline,
    onGoOffline,
    defaultPriority = 'normal',
    enableDeltaSync = true,
  } = options;

  // Track online status with callbacks
  const { isOnline, wasOffline } = useOnlineStatus({
    onOnline: () => {
      onBackOnline?.();
      if (autoSync) {
        syncDebounceRef.current = setTimeout(() => {
          syncNow();
        }, syncDebounceMs);
      }
    },
    onOffline: () => {
      onGoOffline?.();
    },
  });

  // State
  const [pendingActions, setPendingActions] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats>({
    total: 0,
    pending: 0,
    syncing: 0,
    completed: 0,
    failed: 0,
  });
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [priorityStats, setPriorityStats] = useState({
    critical: 0,
    normal: 0,
    low: 0,
    total: 0,
  });
  const [pendingConflicts, setPendingConflicts] = useState(0);
  const [manualResolutionQueue, setManualResolutionQueue] = useState<Array<{
    conflictId: string;
    entityType: string;
    entityId: string;
    fields: unknown[];
    suggestedResolutions: unknown;
  }>>([]);

  // Refs
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Update local state from sync service
  const updateState = useCallback(() => {
    const stats = offlineSync.getSyncStats();
    const pending = offlineSync.getPendingActions();
    const priority = offlineSync.getPriorityStats();
    const conflicts = offlineSync.getPendingConflicts();
    const manualQueue = offlineSync.getManualResolutionQueue();

    setSyncStats(stats);
    setPendingActions(stats.pending + stats.failed);
    setIsSyncing(offlineSync.getIsSyncing());
    setActions(pending);
    setPriorityStats(priority);
    setPendingConflicts(conflicts.length);
    setManualResolutionQueue(manualQueue);
  }, []);

  // Subscribe to sync service updates
  useEffect(() => {
    updateState();
    const unsubscribe = offlineSync.subscribe((stats) => {
      setSyncStats(stats);
      setPendingActions(stats.pending + stats.failed);
      setIsSyncing(stats.syncing > 0);
      setActions(offlineSync.getPendingActions());
    });

    return unsubscribe;
  }, [updateState]);

  // Update last sync time when sync completes
  useEffect(() => {
    if (!isSyncing && syncStats.completed > 0) {
      setLastSyncTime(new Date());
    }
  }, [isSyncing, syncStats.completed]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

  // Queue an action
  const queueAction = useCallback(
    async (
      type: ActionType,
      payload: unknown,
      metadata?: Record<string, unknown>,
      options?: SyncOptions
    ): Promise<string> => {
      const actionId = await offlineSync.queueAction(type, payload, metadata, {
        ...options,
        enableDeltaSync: options?.enableDeltaSync ?? enableDeltaSync,
        priority: options?.priority ?? defaultPriority,
      });
      updateState();
      return actionId;
    },
    [updateState, defaultPriority, enableDeltaSync]
  );

  // Queue with explicit priority
  const queueWithPriority = useCallback(
    async (
      type: ActionType,
      payload: unknown,
      priority: SyncPriorityLevel,
      metadata?: Record<string, unknown>
    ): Promise<string> => {
      const actionId = await offlineSync.queueAction(type, payload, metadata, {
        priority,
        enableDeltaSync,
      });
      updateState();
      return actionId;
    },
    [updateState, enableDeltaSync]
  );

  // Remove an action
  const removeAction = useCallback(
    async (actionId: string): Promise<void> => {
      await offlineSync.removeAction(actionId);
      updateState();
    },
    [updateState]
  );

  // Manually trigger sync
  const syncNow = useCallback(async (): Promise<SyncResult[]> => {
    if (!navigator.onLine) {
      console.warn('[useOfflineSync] Cannot sync while offline');
      return [];
    }

    setIsSyncing(true);
    try {
      const results = await offlineSync.syncPendingActions();

      const failedCount = results.filter((r) => !r.success).length;
      if (failedCount > 0) {
        console.warn(`[useOfflineSync] ${failedCount} actions failed to sync`);
      }

      setLastSyncTime(new Date());
      updateState();
      onSyncComplete?.(results);

      return results;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Sync failed');
      onSyncError?.(err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [updateState, onSyncComplete, onSyncError]);

  // Retry failed actions
  const retryFailed = useCallback(async (): Promise<SyncResult[]> => {
    const results = await offlineSync.retryFailed();
    updateState();
    return results;
  }, [updateState]);

  // Clear the queue
  const clearQueue = useCallback(async (): Promise<void> => {
    await offlineSync.clearQueue();
    updateState();
  }, [updateState]);

  // Get actions by type
  const getActionsByType = useCallback((type: ActionType): PendingAction[] => {
    return offlineSync.getActionsByType(type);
  }, []);

  // Resolve a conflict
  const resolveConflict = useCallback(
    async (actionId: string, resolution: ConflictResolution): Promise<SyncResult> => {
      const result = await offlineSync.resolveConflict(actionId, resolution);
      updateState();
      return result;
    },
    [updateState]
  );

  // Reprioritize an action
  const reprioritize = useCallback(
    async (actionId: string, newPriority: SyncPriorityLevel): Promise<void> => {
      await offlineSync.reprioritizeAction(actionId, newPriority);
      updateState();
    },
    [updateState]
  );

  return {
    isOnline,
    wasOffline,
    pendingActions,
    isSyncing,
    lastSyncTime,
    syncStats,
    actions,
    priorityStats,
    queueAction,
    queueWithPriority,
    removeAction,
    syncNow,
    retryFailed,
    clearQueue,
    getActionsByType,
    resolveConflict,
    reprioritize,
    pendingConflicts,
    manualResolutionQueue,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for managing pending bookings when offline
 */
export function useOfflineBookings() {
  const { queueAction, removeAction, getActionsByType, pendingActions, isSyncing } = useOfflineSync();

  const queueBooking = useCallback(
    (bookingData: unknown) => queueAction('booking_create', bookingData),
    [queueAction]
  );

  const cancelBooking = useCallback(
    (bookingId: string) => queueAction('booking_cancel', { id: bookingId }),
    [queueAction]
  );

  const updateBooking = useCallback(
    (bookingId: string, data: unknown) => queueAction('booking_update', { id: bookingId, ...data as object }),
    [queueAction]
  );

  return {
    pendingBookings: getActionsByType('booking_create').concat(getActionsByType('booking_cancel')).concat(getActionsByType('booking_update')),
    queueBooking,
    cancelBooking,
    updateBooking,
    removePendingBooking: removeAction,
    hasPendingBookings: pendingActions > 0,
    isSyncingBookings: isSyncing,
  };
}

/**
 * Hook for managing pending favorites when offline
 */
export function useOfflineFavorites() {
  const { queueAction, removeAction, getActionsByType, pendingActions, isSyncing } = useOfflineSync();

  const addFavorite = useCallback(
    (providerId: string, category?: string) =>
      queueAction('favorite_add', { providerId, category }),
    [queueAction]
  );

  const removeFavorite = useCallback(
    (providerId: string) => queueAction('favorite_remove', { providerId }),
    [queueAction]
  );

  return {
    pendingFavorites: getActionsByType('favorite_add').concat(getActionsByType('favorite_remove')),
    addFavorite,
    removeFavorite,
    removePendingFavorite: removeAction,
    hasPendingFavorites: pendingActions > 0,
    isSyncingFavorites: isSyncing,
  };
}

/**
 * Hook for managing pending reviews when offline
 */
export function useOfflineReviews() {
  const { queueAction, removeAction, getActionsByType, pendingActions, isSyncing } = useOfflineSync();

  const queueReview = useCallback(
    (reviewData: unknown) => queueAction('review_create', reviewData),
    [queueAction]
  );

  const updateReview = useCallback(
    (reviewId: string, data: unknown) => queueAction('review_update', { id: reviewId, ...data as object }),
    [queueAction]
  );

  return {
    pendingReviews: getActionsByType('review_create').concat(getActionsByType('review_update')),
    queueReview,
    updateReview,
    removePendingReview: removeAction,
    hasPendingReviews: pendingActions > 0,
    isSyncingReviews: isSyncing,
  };
}

export default useOfflineSync;
