/**
 * SyncPrioritizer
 *
 * Priority-based synchronization queue for NILIN mobile app.
 * Manages sync actions based on priority levels to ensure critical operations
 * are synced first.
 *
 * Package: com.nilin.app
 * NILIN brand color: #E8B4A8
 */

// =============================================================================
// Types
// =============================================================================

export type SyncPriority = 'critical' | 'normal' | 'low';
export type SyncStatus = 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'retrying';

export interface SyncAction {
  id: string;
  type: string;
  payload: unknown;
  priority: SyncPriority;
  status: SyncStatus;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}

export interface PriorityConfig {
  priority: SyncPriority;
  maxRetries: number;
  retryDelayMs: number;
  description: string;
}

export interface QueuedAction {
  action: SyncAction;
  addedAt: number;
  attempts: number;
}

// Priority configurations
export const PRIORITY_CONFIGS: Record<SyncPriority, PriorityConfig> = {
  critical: {
    priority: 'critical',
    maxRetries: 5,
    retryDelayMs: 1000,
    description: 'Booking payments, authentication actions - highest priority',
  },
  normal: {
    priority: 'normal',
    maxRetries: 3,
    retryDelayMs: 2000,
    description: 'Bookings, reviews, favorites - standard priority',
  },
  low: {
    priority: 'low',
    maxRetries: 1,
    retryDelayMs: 5000,
    description: 'Analytics, optional sync - lowest priority',
  },
};

// Priority weights for queue ordering
export const PRIORITY_WEIGHTS: Record<SyncPriority, number> = {
  critical: 100,
  normal: 50,
  low: 10,
};

// Action type priority mappings
export const ACTION_PRIORITIES: Record<string, SyncPriority> = {
  // Critical actions
  payment_initiate: 'critical',
  payment_confirm: 'critical',
  auth_login: 'critical',
  auth_logout: 'critical',
  auth_refresh: 'critical',
  booking_payment: 'critical',
  booking_confirm: 'critical',

  // Normal actions
  booking_create: 'normal',
  booking_cancel: 'normal',
  booking_update: 'normal',
  booking_reschedule: 'normal',
  review_create: 'normal',
  review_update: 'normal',
  review_delete: 'normal',
  favorite_add: 'normal',
  favorite_remove: 'normal',
  address_add: 'normal',
  address_update: 'normal',
  address_delete: 'normal',
  profile_update: 'normal',
  notification_dismiss: 'normal',

  // Low priority actions
  analytics_event: 'low',
  analytics_screen_view: 'low',
  analytics_user_property: 'low',
  preference_update: 'low',
  cache_refresh: 'low',
  optional_sync: 'low',
};

// =============================================================================
// SyncPrioritizer Class
// =============================================================================

class SyncPrioritizerService {
  private static instance: SyncPrioritizerService;
  private queue: Map<string, SyncAction> = new Map();
  private listeners: Set<(queue: SyncAction[]) => void> = new Set();
  private readonly STORAGE_KEY = 'nilin_sync_queue';
  private isProcessing: boolean = false;
  private processingPromise: Promise<void> | null = null;

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): SyncPrioritizerService {
    if (!SyncPrioritizerService.instance) {
      SyncPrioritizerService.instance = new SyncPrioritizerService();
    }
    return SyncPrioritizerService.instance;
  }

  // ==========================================================================
  // Queue Management
  // ==========================================================================

  /**
   * Add an action to the queue with priority
   */
  enqueue(
    action: Omit<SyncAction, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>
  ): SyncAction {
    const priorityConfig = PRIORITY_CONFIGS[action.priority];
    const fullAction: SyncAction = {
      ...action,
      id: this.generateActionId(),
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      retryCount: 0,
      maxRetries: action.maxRetries || priorityConfig.maxRetries,
    };

    this.queue.set(fullAction.id, fullAction);
    this.saveToStorage();
    this.notifyListeners();

    console.log(`[SyncPrioritizer] Enqueued ${action.type} with ${action.priority} priority`, {
      actionId: fullAction.id,
      queueSize: this.queue.size,
    });

    return fullAction;
  }

  /**
   * Add action with automatic priority based on type
   */
  enqueueWithAutoPriority(
    type: string,
    payload: unknown,
    metadata?: Record<string, unknown>
  ): SyncAction {
    const priority = ACTION_PRIORITIES[type] || 'normal';
    return this.enqueue({
      type,
      payload,
      priority,
      metadata,
      maxRetries: 3,
    } as SyncAction);
  }

  /**
   * Get next action to process based on priority
   */
  getNext(): SyncAction | null {
    const sorted = this.getSortedQueue();

    for (const action of sorted) {
      // Skip completed or in-progress actions
      if (action.status === 'completed' || action.status === 'in_progress') {
        continue;
      }

      // Check dependencies
      if (action.dependencies && action.dependencies.length > 0) {
        const dependenciesMet = action.dependencies.every(depId => {
          const dep = this.queue.get(depId);
          return dep && dep.status === 'completed';
        });

        if (!dependenciesMet) {
          continue;
        }
      }

      // Check retry eligibility
      if (action.status === 'retrying' && action.retryCount >= action.maxRetries) {
        continue;
      }

      return action;
    }

    return null;
  }

  /**
   * Get all actions sorted by priority
   */
  getSortedQueue(): SyncAction[] {
    return Array.from(this.queue.values())
      .filter(a => a.status !== 'completed')
      .sort((a, b) => {
        // First by priority weight
        const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
        if (priorityDiff !== 0) return priorityDiff;

        // Then by creation time (older first)
        return a.createdAt - b.createdAt;
      });
  }

  /**
   * Get actions by priority
   */
  getByPriority(priority: SyncPriority): SyncAction[] {
    return Array.from(this.queue.values())
      .filter(a => a.priority === priority && a.status !== 'completed');
  }

  /**
   * Get actions by status
   */
  getByStatus(status: SyncStatus): SyncAction[] {
    return Array.from(this.queue.values()).filter(a => a.status === status);
  }

  /**
   * Get action by ID
   */
  getAction(actionId: string): SyncAction | undefined {
    return this.queue.get(actionId);
  }

  /**
   * Update action status
   */
  updateStatus(actionId: string, status: SyncStatus, error?: string): void {
    const action = this.queue.get(actionId);
    if (action) {
      action.status = status;
      action.updatedAt = Date.now();

      if (error) {
        action.lastError = error;
      }

      if (status === 'retrying') {
        action.retryCount++;
      }

      this.queue.set(actionId, action);
      this.saveToStorage();
      this.notifyListeners();
    }
  }

  /**
   * Mark action as completed
   */
  markCompleted(actionId: string): void {
    this.updateStatus(actionId, 'completed');
    console.log(`[SyncPrioritizer] Action ${actionId} completed`);
  }

  /**
   * Mark action as failed
   */
  markFailed(actionId: string, error: string): void {
    const action = this.queue.get(actionId);
    if (action && action.retryCount < action.maxRetries) {
      this.updateStatus(actionId, 'retrying', error);
    } else {
      this.updateStatus(actionId, 'failed', error);
    }
  }

  /**
   * Remove action from queue
   */
  remove(actionId: string): void {
    this.queue.delete(actionId);
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Clear all completed actions
   */
  clearCompleted(): void {
    for (const [id, action] of this.queue.entries()) {
      if (action.status === 'completed') {
        this.queue.delete(id);
      }
    }
    this.saveToStorage();
    this.notifyListeners();
  }

  /**
   * Clear all actions
   */
  clearAll(): void {
    this.queue.clear();
    this.saveToStorage();
    this.notifyListeners();
  }

  // ==========================================================================
  // Priority Management
  // ==========================================================================

  /**
   * Change priority of an action
   */
  reprioritize(actionId: string, newPriority: SyncPriority): void {
    const action = this.queue.get(actionId);
    if (action) {
      const oldPriority = action.priority;
      action.priority = newPriority;
      action.updatedAt = Date.now();

      // Update max retries based on new priority
      action.maxRetries = PRIORITY_CONFIGS[newPriority].maxRetries;

      this.queue.set(actionId, action);
      this.saveToStorage();
      this.notifyListeners();

      console.log(`[SyncPrioritizer] Reprioritized ${actionId} from ${oldPriority} to ${newPriority}`);
    }
  }

  /**
   * Upgrade critical actions (e.g., when user initiates payment)
   */
  upgradeToCritical(actionId: string): void {
    this.reprioritize(actionId, 'critical');
  }

  /**
   * Downgrade stalled actions to lower priority
   */
  downgradeStalledActions(maxAgeMs: number = 60000): void {
    const cutoff = Date.now() - maxAgeMs;

    for (const [id, action] of this.queue.entries()) {
      if (action.status === 'retrying' && action.updatedAt < cutoff) {
        // Downgrade priority but keep retrying
        const newPriority = action.priority === 'critical' ? 'normal' : 'low';
        if (newPriority !== action.priority) {
          action.priority = newPriority;
          action.updatedAt = Date.now();
          this.queue.set(id, action);
        }
      }
    }

    this.saveToStorage();
    this.notifyListeners();
  }

  // ==========================================================================
  // Queue Statistics
  // ==========================================================================

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    byPriority: Record<SyncPriority, number>;
    byStatus: Record<SyncStatus, number>;
    oldestPending: number | null;
    criticalCount: number;
    estimatedSyncTime: number; // ms
  } {
    const actions = Array.from(this.queue.values());
    const pending = actions.filter(a => a.status !== 'completed');

    const byPriority: Record<SyncPriority, number> = { critical: 0, normal: 0, low: 0 };
    const byStatus: Record<SyncStatus, number> = {
      pending: 0,
      queued: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
    };

    let oldestPending: number | null = null;

    for (const action of pending) {
      byPriority[action.priority]++;
      byStatus[action.status]++;

      if (action.status === 'queued' || action.status === 'retrying') {
        if (oldestPending === null || action.createdAt < oldestPending) {
          oldestPending = action.createdAt;
        }
      }
    }

    // Estimate sync time based on priority
    const criticalTime = byPriority.critical * PRIORITY_CONFIGS.critical.retryDelayMs;
    const normalTime = byPriority.normal * PRIORITY_CONFIGS.normal.retryDelayMs;
    const lowTime = byPriority.low * PRIORITY_CONFIGS.low.retryDelayMs;
    const estimatedSyncTime = criticalTime + normalTime + lowTime;

    return {
      total: this.queue.size,
      byPriority,
      byStatus,
      oldestPending,
      criticalCount: byPriority.critical,
      estimatedSyncTime,
    };
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return Array.from(this.queue.values()).filter(a => a.status !== 'completed').length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.getQueueSize() === 0;
  }

  // ==========================================================================
  // Batch Operations
  // ==========================================================================

  /**
   * Get batch of actions for processing
   */
  getBatch(batchSize: number = 5): SyncAction[] {
    const batch: SyncAction[] = [];
    const sorted = this.getSortedQueue();

    for (const action of sorted) {
      if (batch.length >= batchSize) break;

      // Don't include more than 2 critical actions in a batch
      // to prevent blocking other priorities
      const criticalCount = batch.filter(a => a.priority === 'critical').length;
      if (action.priority === 'critical' && criticalCount >= 2) {
        continue;
      }

      batch.push(action);
    }

    return batch;
  }

  /**
   * Add multiple actions at once
   */
  enqueueBatch(
    actions: Array<Omit<SyncAction, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>>
  ): SyncAction[] {
    return actions.map(action => this.enqueue(action));
  }

  // ==========================================================================
  // Subscription
  // ==========================================================================

  /**
   * Subscribe to queue changes
   */
  subscribe(callback: (queue: SyncAction[]) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const queue = Array.from(this.queue.values());
    this.listeners.forEach(cb => {
      try {
        cb(queue);
      } catch (error) {
        console.error('[SyncPrioritizer] Listener error:', error);
      }
    });
  }

  // ==========================================================================
  // Persistence
  // ==========================================================================

  private async saveToStorage(): Promise<void> {
    try {
      const data = Array.from(this.queue.entries());
      // Don't persist in_progress or completed actions
      const filtered = data.filter(([_, action]) =>
        action.status !== 'completed' && action.status !== 'in_progress'
      );
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('[SyncPrioritizer] Failed to save queue:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data: [string, SyncAction][] = JSON.parse(stored);
        this.queue = new Map(data);

        // Reset in-progress and pending actions
        for (const [id, action] of this.queue.entries()) {
          if (action.status === 'in_progress') {
            action.status = 'queued';
            action.updatedAt = Date.now();
          }
        }
      }
    } catch (error) {
      console.error('[SyncPrioritizer] Failed to load queue:', error);
      this.queue = new Map();
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private generateActionId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get priority for action type
   */
  getPriorityForActionType(type: string): SyncPriority {
    return ACTION_PRIORITIES[type] || 'normal';
  }

  /**
   * Validate action type is known
   */
  isKnownActionType(type: string): boolean {
    return type in ACTION_PRIORITIES;
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const syncPrioritizer = SyncPrioritizerService.getInstance();

export default syncPrioritizer;
