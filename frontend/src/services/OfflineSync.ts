/**
 * OfflineSync Service
 *
 * Comprehensive offline synchronization service for NILIN Homeservice app.
 * Queues actions when offline, syncs when back online, handles conflicts.
 * Supports delta sync, priority queuing, and conflict resolution.
 * Uses Capacitor-safe storage for cross-platform compatibility.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { api } from './api';
import { offlineStorage, type QueuedRequest } from './OfflineStorage';
import { deltaSyncEngine } from './DeltaSyncEngine';
import { syncPrioritizer, PRIORITY_CONFIGS, ACTION_PRIORITIES, type SyncPriority } from './SyncPrioritizer';
import { conflictResolver, type Conflict, type ResolutionStrategy } from './ConflictResolver';

// =============================================================================
// Toast Batching System (FIX #7)
// =============================================================================
interface ToastOptions {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface BatchedError {
  actionType: ActionType;
  error: string;
  count: number;
  firstOccurrence: number;
}

class ToastBatcher {
  private pendingToasts: BatchedError[] = [];
  private batchTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_DELAY = 3000; // Wait 3 seconds to batch multiple errors
  private readonly MAX_BATCH_SIZE = 5; // Max errors to show in one toast

  addError(actionType: ActionType, error: string): void {
    const existing = this.pendingToasts.find(
      e => e.actionType === actionType && e.error === error
    );

    if (existing) {
      existing.count++;
    } else {
      this.pendingToasts.push({
        actionType,
        error,
        count: 1,
        firstOccurrence: Date.now(),
      });
    }

    // Reset batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    this.batchTimeout = setTimeout(() => {
      this.flush();
    }, this.BATCH_DELAY);
  }

  flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.pendingToasts.length === 0) return;

    const errors = this.pendingToasts.slice(0, this.MAX_BATCH_SIZE);
    this.pendingToasts = this.pendingToasts.slice(this.MAX_BATCH_SIZE);

    for (const batchedError of errors) {
      const message = batchedError.count > 1
        ? `${batchedError.count} ${batchedError.actionType} actions failed: ${batchedError.error}`
        : `${batchedError.actionType}: ${batchedError.error}`;

      window.dispatchEvent(new CustomEvent('offline-sync-failed', {
        detail: {
          message,
          type: 'error',
          duration: 5000,
        }
      }));
    }

    // If there are more errors, schedule another batch
    if (this.pendingToasts.length > 0) {
      this.batchTimeout = setTimeout(() => {
        this.flush();
      }, this.BATCH_DELAY);
    }
  }
}

const toastBatcher = new ToastBatcher();

const showToast = (options: ToastOptions): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline-sync-failed', {
      detail: {
        message: options.message,
        type: options.type || 'error',
        duration: options.duration || 5000,
      }
    }));
  }
};

// =============================================================================
// Types
// =============================================================================

export type ActionType =
  | 'booking_create'
  | 'booking_cancel'
  | 'booking_update'
  | 'favorite_add'
  | 'favorite_remove'
  | 'review_create'
  | 'review_update'
  | 'address_add'
  | 'address_update'
  | 'address_delete'
  | 'payment_initiate'
  | 'notification_dismiss';

export type SyncPriorityLevel = 'critical' | 'normal' | 'low';

export interface PendingAction {
  id: string;
  type: ActionType;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
  error?: string;
  metadata?: Record<string, unknown>;
  priority?: SyncPriorityLevel;
  deltaSync?: boolean;
  entityType?: string;
  entityId?: string;
}

export interface SyncResult {
  success: boolean;
  actionId: string;
  syncedAt?: number;
  error?: string;
  conflict?: boolean;
}

export interface SyncStats {
  total: number;
  pending: number;
  syncing: number;
  completed: number;
  failed: number;
}

export interface ConflictResolution {
  strategy: 'server_wins' | 'client_wins' | 'merge' | 'manual';
  resolvedData?: unknown;
  conflictId?: string;
}

// Delta sync result type
export interface DeltaSyncResult {
  success: boolean;
  actionId: string;
  syncedAt?: number;
  delta?: {
    entityType: string;
    entityId: string;
    changes: unknown[];
    version: number;
  };
  error?: string;
  conflict?: boolean;
}

// Sync options
export interface SyncOptions {
  enableDeltaSync?: boolean;
  priority?: SyncPriorityLevel;
  maxRetries?: number;
  forceSync?: boolean;
}

// =============================================================================
// OfflineSync Service Class
// =============================================================================

class OfflineSyncService {
  private static instance: OfflineSyncService;
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private syncListeners: Set<(stats: SyncStats) => void> = new Set();
  private onlineListeners: Set<(isOnline: boolean) => void> = new Set();
  private actionQueue: Map<string, PendingAction> = new Map();
  private syncInProgress: Set<string> = new Set();
  private maxRetries: number = 3;
  private retryDelay: number = 2000;
  // FIX #6: Add retry configuration
  private readonly MAX_RETRY_DELAY = 30000;
  private readonly RETRY_JITTER = 1000;
  private readonly STORAGE_KEY = 'nilin_offline_actions';
  // Capacitor support
  private isNative: boolean;
  private memoryCache: Map<string, string> = new Map();

  // FIX #5: Storage size limit enforcement
  private readonly MAX_QUEUE_SIZE = 100; // Maximum actions in queue
  private readonly MAX_STORAGE_SIZE_BYTES = 500 * 1024; // 500KB limit

  // FIX #6: Scheduled retry tracking
  private scheduledRetries: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Delta sync and priority queue integration
  private enableDeltaSync: boolean = true;
  private conflictListeners: Set<(conflict: Conflict) => void> = new Set();

  // Timer tracking to prevent leaks
  private pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  // Bound event handlers for proper cleanup
  private boundHandleOnline: () => void;
  private boundHandleOffline: () => void;
  private isInitialized: boolean = false;

  // FIX #7: Track failed actions for batching
  private failedActionTypes: Map<ActionType, number> = new Map();

  // FIX #6: Exponential backoff calculation with jitter
  private calculateRetryDelay(retryCount: number, baseDelay: number = this.retryDelay): number {
    const exponentialDelay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * this.RETRY_JITTER;
    return Math.min(exponentialDelay + jitter, this.MAX_RETRY_DELAY);
  }

  // FIX #5: Check if storage would exceed limit
  private checkStorageLimit(): boolean {
    try {
      const actions = Array.from(this.actionQueue.entries());
      const serialized = JSON.stringify(actions);
      const size = new Blob([serialized]).size;
      return size >= this.MAX_STORAGE_SIZE_BYTES;
    } catch {
      return false;
    }
  }

  // FIX #5: Enforce queue size limit - removes oldest low-priority completed/failed actions
  private enforceQueueSizeLimit(): void {
    // Check queue count limit
    if (this.actionQueue.size >= this.MAX_QUEUE_SIZE) {
      console.warn(`[OfflineSync] Queue size limit reached (${this.MAX_QUEUE_SIZE}), removing oldest items`);

      // Get actions sorted by timestamp, priority (low first), then status (completed/failed first)
      const actions = Array.from(this.actionQueue.values())
        .filter(a => a.status === 'completed' || a.status === 'failed' || a.priority === 'low')
        .sort((a, b) => {
          // Completed/failed first
          const statusOrder = { completed: 0, failed: 1, pending: 2, syncing: 3 };
          const statusDiff = statusOrder[a.status] - statusOrder[b.status];
          if (statusDiff !== 0) return statusDiff;

          // Low priority first
          const priorityOrder = { low: 0, normal: 1, critical: 2 };
          const priorityDiff = priorityOrder[a.priority || 'normal'] - priorityOrder[b.priority || 'normal'];
          if (priorityDiff !== 0) return priorityDiff;

          // Oldest first
          return a.timestamp - b.timestamp;
        });

      // Remove oldest actions until under limit
      const toRemove = actions.slice(0, Math.min(10, actions.length)); // Remove at least 10 or all overflow
      for (const action of toRemove) {
        this.actionQueue.delete(action.id);
        // Also cancel any scheduled retry
        const timer = this.scheduledRetries.get(action.id);
        if (timer) {
          clearTimeout(timer);
          this.scheduledRetries.delete(action.id);
        }
      }

      console.log(`[OfflineSync] Removed ${toRemove.length} items from queue`);
    }

    // Check storage size limit
    if (this.checkStorageLimit()) {
      console.warn('[OfflineSync] Storage size limit reached, removing completed actions');
      const completed = Array.from(this.actionQueue.entries())
        .filter(([_, a]) => a.status === 'completed')
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      for (const [id, _] of completed) {
        this.actionQueue.delete(id);
        if (this.actionQueue.size < this.MAX_QUEUE_SIZE * 0.8 && !this.checkStorageLimit()) {
          break;
        }
      }
    }
  }

  private constructor() {
    // Create bound handlers for proper cleanup
    this.boundHandleOnline = () => this.handleOnline();
    this.boundHandleOffline = () => this.handleOffline();
    // Initialize Capacitor flag
    this.isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  }

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService();
    }
    return OfflineSyncService.instance;
  }

  /**
   * Initialize listeners - call this explicitly or use lazy init
   */
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    window.addEventListener('online', this.boundHandleOnline);
    window.addEventListener('offline', this.boundHandleOffline);

    // Also check periodically when we're supposedly online
    if (typeof navigator !== 'undefined') {
      this.isOnline = navigator.onLine;
    }

    this.isInitialized = true;
    this.loadQueueFromStorage();

    // Listen for app crash recovery events
    window.addEventListener('app-crash-recovery', this.handleCrashRecovery as EventListener);

    // Subscribe to conflict resolver for automatic handling
    this.setupConflictSubscription();

    console.log('[OfflineSync] Initialized with delta sync and priority queue support');
  }

  /**
   * Setup conflict subscription with conflict resolver
   */
  private setupConflictSubscription(): void {
    conflictResolver.subscribe((conflict) => {
      console.log('[OfflineSync] New conflict detected:', conflict.id);
      this.notifyConflictListeners(conflict);

      // Auto-resolve if possible
      if (!conflict.requiresManualResolution) {
        const result = conflictResolver.autoResolve(conflict);
        if (result.success) {
          console.log('[OfflineSync] Auto-resolved conflict:', conflict.id);
        }
      }
    });
  }

  /**
   * Enable or disable delta sync
   */
  setDeltaSyncEnabled(enabled: boolean): void {
    this.enableDeltaSync = enabled;
    console.log(`[OfflineSync] Delta sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if delta sync is enabled
   */
  isDeltaSyncEnabled(): boolean {
    return this.enableDeltaSync;
  }

  // ==========================================================================
  // Event Listeners Setup
  // ==========================================================================

  private handleOnline(): void {
    console.log('[OfflineSync] Back online');
    this.isOnline = true;
    this.notifyOnlineChange(true);
    this.notifyListeners();

    // FIX #6: Cancel all scheduled retries - syncPendingActions will handle immediate sync
    // This prevents duplicate syncs when coming back online
    this.scheduledRetries.forEach((timerId) => clearTimeout(timerId));
    this.scheduledRetries.clear();

    // Auto-sync when coming back online
    this.syncPendingActions();
  }

  private handleOffline(): void {
    console.log('[OfflineSync] Gone offline');
    this.isOnline = false;
    this.notifyOnlineChange(false);
    this.notifyListeners();
  }

  private handleCrashRecovery = (event: CustomEvent): void => {
    console.log('[OfflineSync] Crash recovery event received', event.detail);
    // Trigger sync on crash recovery
    this.syncPendingActions();
  };

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Add an action to the pending queue
   */
  async queueAction(
    type: ActionType,
    payload: unknown,
    metadata?: Record<string, unknown>,
    options?: SyncOptions
  ): Promise<string> {
    const actionId = this.generateActionId();

    // Determine priority - use provided, action-based, or default
    const priority: SyncPriorityLevel = options?.priority ||
      ACTION_PRIORITIES[type] ||
      'normal';

    // Determine max retries based on priority
    const priorityConfig = PRIORITY_CONFIGS[priority];
    const maxRetries = options?.maxRetries ?? priorityConfig.maxRetries;

    // Extract entity info from payload if available
    const payloadObj = payload as Record<string, unknown>;
    const entityType = payloadObj?._entityType as string;
    const entityId = payloadObj?.id as string;

    const action: PendingAction = {
      id: actionId,
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      status: 'pending',
      metadata,
      priority,
      deltaSync: options?.enableDeltaSync ?? this.enableDeltaSync,
      entityType,
      entityId,
    };

    this.actionQueue.set(actionId, action);

    // FIX #5: Enforce queue size limit before saving
    this.enforceQueueSizeLimit();
    await this.saveQueueToStorage();

    // Also queue in OfflineStorage for compatibility
    await offlineStorage.queueRequest({
      endpoint: this.getEndpointForAction(type, payload as Record<string, string>),
      method: this.getMethodForAction(type),
      payload,
      maxRetries,
    });

    // Add to priority queue if priority sync is enabled
    syncPrioritizer.enqueue({
      type,
      payload,
      priority,
      metadata,
      dependencies: action.metadata?.dependencies as string[],
      maxRetries,
    });

    // Track delta changes if delta sync is enabled and entity info is available
    if (this.enableDeltaSync && entityType && entityId) {
      deltaSyncEngine.trackChanges(entityType, entityId, payloadObj);
    }

    this.notifyListeners();

    // If we're online, try to sync immediately
    if (this.isOnline) {
      this.syncAction(actionId);
    }

    return actionId;
  }

  /**
   * Remove an action from the queue
   */
  async removeAction(actionId: string): Promise<void> {
    this.actionQueue.delete(actionId);
    await this.saveQueueToStorage();
    this.notifyListeners();
  }

  /**
   * Get all pending actions
   */
  getPendingActions(): PendingAction[] {
    return Array.from(this.actionQueue.values())
      .filter((a) => a.status === 'pending' || a.status === 'failed')
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get actions by type
   */
  getActionsByType(type: ActionType): PendingAction[] {
    return this.getPendingActions().filter((a) => a.type === type);
  }

  /**
   * Get sync statistics
   */
  getSyncStats(): SyncStats {
    const actions = Array.from(this.actionQueue.values());
    return {
      total: actions.length,
      pending: actions.filter((a) => a.status === 'pending').length,
      syncing: actions.filter((a) => a.status === 'syncing').length,
      completed: actions.filter((a) => a.status === 'completed').length,
      failed: actions.filter((a) => a.status === 'failed').length,
    };
  }

  /**
   * Get queue size (convenience method)
   */
  getQueueSize(): number {
    return this.getPendingActions().length;
  }

  // ==========================================================================
  // Storage Persistence (Capacitor-safe)
  // ==========================================================================

  private async saveQueueToStorage(): Promise<void> {
    try {
      const actions = Array.from(this.actionQueue.entries());
      const serialized = JSON.stringify(actions);

      // Always update memory cache
      this.memoryCache.set(this.STORAGE_KEY, serialized);

      if (this.isNative) {
        await Preferences.set({ key: this.STORAGE_KEY, value: serialized });
      } else {
        // Web fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(this.STORAGE_KEY, serialized);
        }
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to save queue to storage:', error);
    }
  }

  private async loadQueueFromStorage(): Promise<void> {
    try {
      let stored: string | null = null;

      // Check memory cache first
      if (this.memoryCache.has(this.STORAGE_KEY)) {
        stored = this.memoryCache.get(this.STORAGE_KEY) ?? null;
      } else if (this.isNative) {
        const result = await Preferences.get({ key: this.STORAGE_KEY });
        stored = result.value;
      } else {
        // Web fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          stored = localStorage.getItem(this.STORAGE_KEY);
        }
      }

      if (stored) {
        const actions: [string, PendingAction][] = JSON.parse(stored);
        this.actionQueue = new Map(actions);
        this.memoryCache.set(this.STORAGE_KEY, stored);

        // Filter out old completed actions
        for (const [id, action] of this.actionQueue.entries()) {
          if (action.status === 'completed') {
            // Keep completed actions for 1 hour, then clean up
            const hourAgo = Date.now() - 60 * 60 * 1000;
            if (action.timestamp < hourAgo) {
              this.actionQueue.delete(id);
            }
          }
        }
      }
    } catch (error) {
      console.error('[OfflineSync] Failed to load queue from storage:', error);
      this.actionQueue = new Map();
    }
  }

  // ==========================================================================
  // Sync Operations
  // ==========================================================================

  /**
   * Sync all pending actions
   * FIX #6: Cancel scheduled retries for actions being synced immediately
   */
  async syncPendingActions(): Promise<SyncResult[]> {
    if (this.isSyncing || !this.isOnline) {
      return [];
    }

    this.isSyncing = true;
    const results: SyncResult[] = [];
    const pending = this.getPendingActions();

    console.log(`[OfflineSync] Syncing ${pending.length} pending actions`);

    // Cancel scheduled retries for all pending actions - we'll sync them now
    for (const action of pending) {
      this.cancelScheduledRetry(action.id);
    }

    for (const action of pending) {
      const result = await this.syncAction(action.id);
      results.push(result);
    }

    this.isSyncing = false;
    this.notifyListeners();

    return results;
  }

  /**
   * Sync a single action
   */
  async syncAction(actionId: string): Promise<SyncResult> {
    const action = this.actionQueue.get(actionId);
    if (!action) {
      return {
        success: false,
        actionId,
        error: 'Action not found in queue',
      };
    }

    if (!this.isOnline) {
      return {
        success: false,
        actionId,
        error: 'Device is offline',
      };
    }

    // Mark as syncing
    action.status = 'syncing';
    this.actionQueue.set(actionId, action);
    this.notifyListeners();

    try {
      let result: SyncResult;

      // Use delta sync if enabled and entity info is available
      if (action.deltaSync && action.entityType && action.entityId) {
        result = await this.executeDeltaSyncAction(action);
      } else {
        result = await this.executeAction(action);
      }

      if (result.success) {
        action.status = 'completed';
        console.log(`[OfflineSync] Action ${actionId} synced successfully`);

        // Clear delta changes for this entity after successful sync
        if (action.deltaSync && action.entityType && action.entityId) {
          deltaSyncEngine.clearChanges(action.entityType, action.entityId);
        }

        // Remove from queue after a short delay to show completion state
        const cleanupDelay = 2000;
        const timerId = setTimeout(() => {
          // Clear from tracking set
          this.pendingTimers.delete(timerId);
          if (this.actionQueue.get(actionId)?.status === 'completed') {
            this.actionQueue.delete(actionId);
            this.saveQueueToStorage();
          }
        }, cleanupDelay);
        this.pendingTimers.add(timerId);
      } else if (result.conflict) {
        // Handle conflict
        await this.handleConflict(action, result);
      } else {
        action.retryCount++;
        if (action.retryCount >= action.maxRetries) {
          action.status = 'failed';
          action.error = result.error;
          console.error(`[OfflineSync] Action ${actionId} failed after ${action.maxRetries} retries`);

          // FIX #7: Batch error notifications instead of showing individual toasts
          toastBatcher.addError(action.type, result.error || 'Unknown error');
        } else {
          // FIX #6: Calculate delay and SCHEDULE the retry with setTimeout
          const delay = this.calculateRetryDelay(action.retryCount);
          action.status = 'pending';
          this.actionQueue.set(actionId, action);
          await this.saveQueueToStorage();

          // Cancel any existing scheduled retry for this action
          const existingTimer = this.scheduledRetries.get(actionId);
          if (existingTimer) {
            clearTimeout(existingTimer);
          }

          // Schedule the retry
          console.warn(`[OfflineSync] Action ${actionId} failed, scheduled retry in ${Math.round(delay)}ms (${action.retryCount}/${action.maxRetries})`);
          const timerId = setTimeout(async () => {
            this.scheduledRetries.delete(actionId);
            this.pendingTimers.delete(timerId);

            // Only retry if still pending and online
            if (this.actionQueue.get(actionId)?.status === 'pending' && this.isOnline) {
              await this.syncAction(actionId);
            }
          }, delay);

          this.scheduledRetries.set(actionId, timerId);
          this.pendingTimers.add(timerId);

          // Don't update listeners here - let the timer handle it
          return result;
        }
      }

      this.actionQueue.set(actionId, action);
      await this.saveQueueToStorage();
      this.notifyListeners();

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      action.status = 'failed';
      action.error = errorMessage;
      this.actionQueue.set(actionId, action);
      await this.saveQueueToStorage();
      this.notifyListeners();

      // FIX #7: Batch error notifications instead of showing individual toasts
      toastBatcher.addError(action.type, errorMessage);

      return {
        success: false,
        actionId,
        error: errorMessage,
      };
    }
  }

  /**
   * Execute action with delta sync
   */
  private async executeDeltaSyncAction(action: PendingAction): Promise<SyncResult> {
    if (!action.entityType || !action.entityId) {
      return this.executeAction(action);
    }

    try {
      // Get delta for this entity
      const delta = deltaSyncEngine.getSyncDelta(action.entityType, action.entityId);

      if (!delta) {
        // No delta changes, use regular sync
        return this.executeAction(action);
      }

      // Execute with delta payload
      const endpoint = this.getEndpointForAction(action.type, action.payload as Record<string, string>);
      const method = this.getMethodForAction(action.type);
      const payload = {
        ...(action.payload as Record<string, unknown>),
        _delta: delta,
      };

      let response;

      switch (method) {
        case 'POST':
          response = await api.post(endpoint, payload);
          break;
        case 'PUT':
        case 'PATCH':
          response = await api.patch(endpoint, payload);
          break;
        case 'DELETE':
          response = await api.delete(endpoint, { data: payload });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      // Apply server response with conflict detection
      if (response.data?.data) {
        const conflict = conflictResolver.detectConflict(
          action.entityType,
          action.entityId,
          action.payload as Record<string, unknown>,
          response.data.data
        );

        if (conflict) {
          return {
            success: false,
            actionId: action.id,
            error: 'Conflict detected',
            conflict: true,
          };
        }

        // Apply successful delta sync
        deltaSyncEngine.applyDelta(action.entityType, action.entityId, response.data.data);
      }

      return {
        success: response.data?.success !== false,
        actionId: action.id,
        syncedAt: Date.now(),
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };

      if (axiosError.response?.status === 409) {
        return {
          success: false,
          actionId: action.id,
          error: 'Conflict: Server data has changed',
          conflict: true,
        };
      }

      throw error;
    }
  }

  /**
   * Handle conflict between local and server data
   * FIX #7: Properly handle requiresManualResolution
   */
  private async handleConflict(action: PendingAction, result: SyncResult): Promise<void> {
    if (!action.entityType || !action.entityId) {
      // No entity info - treat as regular failure
      action.status = 'failed';
      action.error = result.error || 'Conflict without entity info';
      this.actionQueue.set(action.id, action);
      await this.saveQueueToStorage();
      return;
    }

    // Detect and register conflict with conflict resolver
    const serverState = result as unknown as Record<string, unknown>;
    const conflict = conflictResolver.detectConflict(
      action.entityType,
      action.entityId,
      action.payload as Record<string, unknown>,
      serverState
    );

    if (conflict) {
      console.log(`[OfflineSync] Conflict registered: ${conflict.id}, requiresManualResolution: ${conflict.requiresManualResolution}`);

      if (conflict.requiresManualResolution) {
        // Queue for manual resolution - mark as 'pending' with special error, NOT 'failed'
        // This prevents automatic retries while waiting for user action
        conflictResolver.queueForManualResolution(conflict);
        action.status = 'pending'; // Keep pending, not failed
        action.error = 'Manual conflict resolution required. Please resolve in the conflicts panel.';
        action.retryCount = action.maxRetries - 1; // Prevent further retries
        this.actionQueue.set(action.id, action);
        await this.saveQueueToStorage();

        // Notify listeners so UI can show conflict panel
        this.notifyListeners();

        // Don't batch this - it's a specific user-facing message
        showToast({
          message: `Conflict detected for ${action.entityType}. Please resolve manually.`,
          type: 'warning',
          duration: 8000,
        });
      } else {
        // Try auto-resolution
        const resolution = conflictResolver.autoResolve(conflict);
        if (resolution.success && resolution.mergedData) {
          // Cancel any existing scheduled retry
          this.cancelScheduledRetry(action.id);

          // Retry with resolved data
          action.payload = resolution.mergedData;
          action.status = 'pending';
          this.actionQueue.set(action.id, action);
          await this.saveQueueToStorage();

          // Schedule retry with calculated delay
          const delay = this.calculateRetryDelay(0);
          const timerId = setTimeout(async () => {
            this.scheduledRetries.delete(action.id);
            this.pendingTimers.delete(timerId);
            if (this.isOnline) {
              await this.syncAction(action.id);
            }
          }, delay);
          this.scheduledRetries.set(action.id, timerId);
          this.pendingTimers.add(timerId);
        } else {
          // Auto-resolution failed - treat as manual resolution needed
          action.status = 'failed';
          action.error = 'Conflict auto-resolution failed';
          toastBatcher.addError(action.type, 'Conflict auto-resolution failed');
        }
      }
    } else {
      // No conflict detected but result indicated conflict - mark as failed
      action.status = 'failed';
      action.error = result.error || 'Unknown conflict';
      this.actionQueue.set(action.id, action);
      await this.saveQueueToStorage();
    }
  }

  /**
   * Execute a single action against the API
   */
  private async executeAction(action: PendingAction): Promise<SyncResult> {
    const endpoint = this.getEndpointForAction(action.type, action.payload as Record<string, string>);
    const method = this.getMethodForAction(action.type);
    const payload = action.payload as Record<string, unknown>;

    try {
      let response;

      switch (method) {
        case 'POST':
          response = await api.post(endpoint, payload);
          break;
        case 'PUT':
        case 'PATCH':
          response = await api.put(endpoint, payload);
          break;
        case 'DELETE':
          response = await api.delete(endpoint, { data: payload });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      return {
        success: response.data?.success !== false,
        actionId: action.id,
        syncedAt: Date.now(),
        conflict: response.status === 409,
      };
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number }; message?: string };
      let errorMessage = 'Unknown error';

      if (axiosError.response?.status === 409) {
        // Conflict - server data has changed
        return {
          success: false,
          actionId: action.id,
          error: 'Conflict: Server data has changed',
          conflict: true,
        };
      }

      if (axiosError.response?.status === 401) {
        errorMessage = 'Authentication required';
      } else if (axiosError.response?.status === 404) {
        errorMessage = 'Resource not found';
      } else if (axiosError.response?.status === 400) {
        errorMessage = 'Invalid request data';
      } else if (!navigator.onLine) {
        errorMessage = 'Network unavailable';
      } else {
        errorMessage = axiosError.message || 'Request failed';
      }

      return {
        success: false,
        actionId: action.id,
        error: errorMessage,
      };
    }
  }

  // ==========================================================================
  // Conflict Resolution
  // ==========================================================================

  /**
   * Handle a conflict between local and server data
   */
  async resolveConflict(
    actionId: string,
    resolution: ConflictResolution
  ): Promise<SyncResult> {
    const action = this.actionQueue.get(actionId);
    if (!action) {
      return {
        success: false,
        actionId,
        error: 'Action not found',
      };
    }

    switch (resolution.strategy) {
      case 'server_wins':
        // Just remove the action, server data is authoritative
        await this.removeAction(actionId);
        return { success: true, actionId };

      case 'client_wins':
        // Force sync with client data
        action.payload = resolution.resolvedData || action.payload;
        return this.syncAction(actionId);

      case 'merge':
        // Merge and retry
        action.payload = resolution.resolvedData || action.payload;
        return this.syncAction(actionId);

      case 'manual':
        // Mark as failed, user will resolve manually
        action.status = 'failed';
        action.error = 'Manual conflict resolution required';
        this.actionQueue.set(actionId, action);
        await this.saveQueueToStorage();
        return {
          success: false,
          actionId,
          error: 'Manual resolution required',
        };
    }
  }

  /**
   * Resolve conflict using conflict resolver
   */
  async resolveConflictWithResolver(
    conflictId: string,
    resolution: 'server_wins' | 'client_wins' | 'merge' | Record<string, unknown>
  ): Promise<SyncResult> {
    const result = conflictResolver.resolveManually(conflictId, resolution);

    if (result.success) {
      // Find and update the related action
      for (const [actionId, action] of this.actionQueue.entries()) {
        if (action.entityType && action.entityId) {
          const conflict = conflictResolver.getConflict(action.entityType, action.entityId);
          if (conflict?.id === conflictId) {
            action.status = 'pending';
            action.payload = result.mergedData;
            this.actionQueue.set(actionId, action);
            await this.saveQueueToStorage();
            return this.syncAction(actionId);
          }
        }
      }
    }

    return {
      success: result.success,
      actionId: '',
      error: result.success ? undefined : 'Failed to resolve conflict',
    };
  }

  // ==========================================================================
  // Priority Queue Integration
  // ==========================================================================

  /**
   * Reprioritize an action
   */
  async reprioritizeAction(actionId: string, newPriority: SyncPriorityLevel): Promise<void> {
    const action = this.actionQueue.get(actionId);
    if (action) {
      action.priority = newPriority;
      action.maxRetries = PRIORITY_CONFIGS[newPriority].maxRetries;
      this.actionQueue.set(actionId, action);
      syncPrioritizer.reprioritize(actionId, newPriority);
      await this.saveQueueToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Get priority stats
   */
  getPriorityStats(): {
    critical: number;
    normal: number;
    low: number;
    total: number;
  } {
    const actions = Array.from(this.actionQueue.values()).filter(a => a.status !== 'completed');
    return {
      critical: actions.filter(a => a.priority === 'critical').length,
      normal: actions.filter(a => a.priority === 'normal').length,
      low: actions.filter(a => a.priority === 'low').length,
      total: actions.length,
    };
  }

  // ==========================================================================
  // Conflict Listeners
  // ==========================================================================

  /**
   * Subscribe to new conflicts
   */
  subscribeToConflicts(callback: (conflict: Conflict) => void): () => void {
    this.conflictListeners.add(callback);
    return () => this.conflictListeners.delete(callback);
  }

  private notifyConflictListeners(conflict: Conflict): void {
    this.conflictListeners.forEach(callback => {
      try {
        callback(conflict);
      } catch (error) {
        console.error('[OfflineSync] Conflict listener error:', error);
      }
    });
  }

  /**
   * Get pending conflicts
   */
  getPendingConflicts(): Conflict[] {
    return conflictResolver.getUnresolvedConflicts();
  }

  /**
   * Get conflicts pending manual resolution
   */
  getManualResolutionQueue(): Array<{
    conflictId: string;
    entityType: string;
    entityId: string;
    fields: unknown[];
    suggestedResolutions: unknown;
  }> {
    return conflictResolver.getManualResolutionQueue().map(req => ({
      conflictId: req.conflictId,
      entityType: req.entityType,
      entityId: req.entityId,
      fields: req.fields,
      suggestedResolutions: req.suggestedResolutions,
    }));
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private getEndpointForAction(type: ActionType, payload?: Record<string, string>): string {
    const endpoints: Record<ActionType, string> = {
      booking_create: '/bookings',
      booking_cancel: '/bookings/:id/cancel',
      booking_update: '/bookings/:id',
      favorite_add: '/favorites/:providerId',
      favorite_remove: '/favorites/:providerId',
      review_create: '/reviews',
      review_update: '/reviews/:id',
      address_add: '/addresses',
      address_update: '/addresses/:id',
      address_delete: '/addresses/:id',
      payment_initiate: '/payments/initiate',
      notification_dismiss: '/notifications/:id/dismiss',
    };

    let endpoint = endpoints[type] || '/unknown';

    // Replace path parameters from payload
    // FIX: Use the passed payload directly instead of generating new actionId
    if (payload) {
      if (payload.id) {
        endpoint = endpoint.replace(':id', payload.id);
      }
      if (payload.providerId) {
        endpoint = endpoint.replace(':providerId', payload.providerId);
      }
    }

    return endpoint;
  }

  private getMethodForAction(type: ActionType): string {
    const methods: Record<ActionType, string> = {
      booking_create: 'POST',
      booking_cancel: 'POST',
      booking_update: 'PATCH',
      favorite_add: 'POST',
      favorite_remove: 'DELETE',
      review_create: 'POST',
      review_update: 'PATCH',
      address_add: 'POST',
      address_update: 'PATCH',
      address_delete: 'DELETE',
      payment_initiate: 'POST',
      notification_dismiss: 'POST',
    };
    return methods[type] || 'POST';
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ==========================================================================
  // Event System
  // ==========================================================================

  /**
   * Subscribe to sync statistics changes
   */
  subscribe(callback: (stats: SyncStats) => void): () => void {
    this.syncListeners.add(callback);
    return () => this.syncListeners.delete(callback);
  }

  /**
   * Subscribe to online status changes
   */
  subscribeToOnlineStatus(callback: (isOnline: boolean) => void): () => void {
    this.onlineListeners.add(callback);
    return () => this.onlineListeners.delete(callback);
  }

  private notifyListeners(): void {
    const stats = this.getSyncStats();
    this.syncListeners.forEach((callback) => callback(stats));
  }

  private notifyOnlineChange(isOnline: boolean): void {
    this.onlineListeners.forEach((callback) => callback(isOnline));
  }

  // ==========================================================================
  // Cleanup & Destruction
  // ==========================================================================

  /**
   * Destroy the service - MUST be called on app cleanup
   * Removes all event listeners to prevent memory leaks
   */

  destroy(): void {
    console.log('[OfflineSync] Destroying service');

    // FIX #6: Clear scheduled retry timers
    this.scheduledRetries.forEach((timerId) => clearTimeout(timerId));
    this.scheduledRetries.clear();

    // Clear all pending timers to prevent leaks
    this.pendingTimers.forEach((timerId) => clearTimeout(timerId));
    this.pendingTimers.clear();

    // FIX #7: Flush any pending toast batch
    toastBatcher.flush();

    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundHandleOnline);
      window.removeEventListener('offline', this.boundHandleOffline);
      window.removeEventListener('app-crash-recovery', this.handleCrashRecovery as EventListener);
    }

    // Clear all listeners
    this.syncListeners.clear();
    this.onlineListeners.clear();
    this.conflictListeners.clear();

    // Clear maps
    this.actionQueue.clear();
    this.syncInProgress.clear();

    // FIX #7: Clear failed action tracking
    this.failedActionTypes.clear();

    this.isInitialized = false;
    console.log('[OfflineSync] Service destroyed');
  }

  // ==========================================================================
  // Public Accessors
  // ==========================================================================

  getIsOnline(): boolean {
    return this.isOnline;
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }

  /**
   * Clear all pending actions
   */
  async clearQueue(): Promise<void> {
    // Cancel all scheduled retries
    this.scheduledRetries.forEach((timerId) => clearTimeout(timerId));
    this.scheduledRetries.clear();

    this.actionQueue.clear();
    await this.saveQueueToStorage();
    await offlineStorage.clearRequestQueue();
    this.notifyListeners();
  }

  /**
   * Retry all failed actions
   */
  async retryFailed(): Promise<SyncResult[]> {
    const failed = Array.from(this.actionQueue.values()).filter(
      (a) => a.status === 'failed'
    );

    for (const action of failed) {
      action.status = 'pending';
      action.retryCount = 0;
      action.error = undefined;
      this.actionQueue.set(action.id, action);

      // Schedule retry with backoff
      const delay = this.calculateRetryDelay(0);
      const timerId = setTimeout(async () => {
        this.scheduledRetries.delete(action.id);
        this.pendingTimers.delete(timerId);
        if (this.isOnline) {
          await this.syncAction(action.id);
        }
      }, delay);
      this.scheduledRetries.set(action.id, timerId);
      this.pendingTimers.add(timerId);
    }

    await this.saveQueueToStorage();
    this.notifyListeners();

    // Don't call syncPendingActions here - timers will handle retries
    return [];
  }

  // FIX #7: Flush any pending batched toasts immediately
  flushErrorToasts(): void {
    toastBatcher.flush();
  }

  // FIX #7: Get count of failed actions for badge display
  getFailedActionCount(): number {
    return Array.from(this.actionQueue.values()).filter(
      (a) => a.status === 'failed'
    ).length;
  }

  // FIX #7: Get actions that need manual resolution
  getNeedsManualResolution(): PendingAction[] {
    return Array.from(this.actionQueue.values()).filter(
      (a) => a.status === 'pending' && a.error?.includes('Manual conflict resolution required')
    );
  }

  // FIX #6: Cancel scheduled retry for an action
  cancelScheduledRetry(actionId: string): void {
    const timer = this.scheduledRetries.get(actionId);
    if (timer) {
      clearTimeout(timer);
      this.scheduledRetries.delete(actionId);
      this.pendingTimers.delete(timer);
    }
  }
}

// =============================================================================
// Booking Conflict Resolution
// =============================================================================

interface BookingConflictData {
  bookingId: string;
  providerId: string;
  requestedTime: string;
  localData: Record<string, unknown>;
  serverData?: Record<string, unknown>;
  conflictType: 'time_slot_changed' | 'provider_unavailable' | 'price_changed' | 'service_unavailable';
}

interface BookingConflictResult {
  resolved: boolean;
  action: 'retry_with_new_time' | 'retry_with_original' | 'cancel_booking' | 'pending_manual';
  resolvedData?: Record<string, unknown>;
  message?: string;
}

/**
 * Handle booking-specific conflicts with business logic
 * Provides intelligent resolution strategies for booking conflicts
 */
async function handleBookingConflict(
  action: PendingAction,
  conflictData: BookingConflictData
): Promise<BookingConflictResult> {
  const payload = action.payload as Record<string, unknown>;

  switch (conflictData.conflictType) {
    case 'time_slot_changed':
      // Server changed the time slot - offer alternatives
      if (conflictData.serverData?.availableSlots) {
        return {
          resolved: false,
          action: 'pending_manual',
          message: `Time slot changed by provider. Available slots: ${JSON.stringify(conflictData.serverData.availableSlots)}`,
        };
      }
      // Auto-retry with server's suggested time if available
      if (conflictData.serverData?.suggestedTime) {
        return {
          resolved: true,
          action: 'retry_with_new_time',
          resolvedData: { ...payload, scheduledTime: conflictData.serverData.suggestedTime },
          message: 'Retrying with provider-suggested time slot',
        };
      }
      return {
        resolved: false,
        action: 'pending_manual',
        message: 'Time slot unavailable. Please choose a new time.',
      };

    case 'provider_unavailable':
      // Provider no longer available for this time
      return {
        resolved: false,
        action: 'cancel_booking',
        message: 'Provider is no longer available for this time slot.',
      };

    case 'price_changed':
      // Price changed - inform user but allow retry with new price
      const newPrice = conflictData.serverData?.price;
      if (newPrice !== undefined) {
        return {
          resolved: true,
          action: 'retry_with_new_time',
          resolvedData: { ...payload, price: newPrice, priceAcknowledged: true },
          message: `Price updated to $${newPrice}. Retry automatically?`,
        };
      }
      return {
        resolved: false,
        action: 'pending_manual',
        message: 'Price has changed. Please review and confirm.',
      };

    case 'service_unavailable':
      // Service no longer offered at this time
      return {
        resolved: false,
        action: 'cancel_booking',
        message: 'This service is no longer available at the requested time.',
      };

    default:
      return {
        resolved: false,
        action: 'pending_manual',
        message: 'A conflict occurred. Please resolve manually.',
      };
  }
}

// Extend the class prototype with booking conflict handler
declare module './OfflineSync' {
  interface OfflineSyncService {
    handleBookingConflictAction(action: PendingAction): Promise<BookingConflictResult>;
  }
}



// =============================================================================
// Extended Cleanup Methods
// =============================================================================

/**
 * Extended clearQueue that also clears all storage and resets state
 * Used specifically for logout to ensure no stale data persists
 */


/**
 * Get storage usage statistics for monitoring
 */


// =============================================================================
// Singleton Export
// =============================================================================

export const offlineSync = OfflineSyncService.getInstance();

export default offlineSync;
