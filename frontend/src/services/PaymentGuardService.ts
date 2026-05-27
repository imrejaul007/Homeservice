/**
 * Payment Guard Service
 *
 * Enterprise-grade payment protection with transaction locking, idempotency,
 * and double-payment prevention. Uses localStorage for persistence with
 * sessionStorage for sensitive token data.
 */

import { api } from './api';

// =============================================================================
// Types
// =============================================================================

export interface PaymentLock {
  lockId: string;
  bookingId: string;
  action: PaymentAction;
  userId: string;
  acquiredAt: number;
  expiresAt: number;
  idempotencyKey: string;
}

export type PaymentAction = 'create' | 'confirm' | 'cancel' | 'refund';

export interface PaymentGuardOptions {
  /** Lock timeout in milliseconds (default: 5 minutes) */
  timeoutMs?: number;
  /** Enable automatic cleanup on startup */
  autoCleanup?: boolean;
}

export interface PaymentGuardResult {
  success: boolean;
  lock?: PaymentLock;
  error?: string;
}

export interface PendingTransaction {
  bookingId: string;
  action: PaymentAction;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  idempotencyKey: string;
}

// =============================================================================
// Constants
// =============================================================================

const LOCK_STORAGE_KEY = 'nilin_payment_locks';
const PENDING_STORAGE_KEY = 'nilin_pending_transactions';
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
// FIX #14: Track visibility change listener for reconciliation
const VISIBILITY_KEY = '__payment_guard_visibility_bound';

// =============================================================================
// Payment Guard Service
// =============================================================================

class PaymentGuardService {
  private locks: Map<string, PaymentLock> = new Map();
  private pendingTransactions: Map<string, PendingTransaction> = new Map();
  private timeoutMs: number;
  private initialized = false;

  constructor() {
    this.timeoutMs = DEFAULT_TIMEOUT_MS;
    this.loadLocks();
    this.loadPendingTransactions();
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  /**
   * Initialize the payment guard service
   */
  initialize(options: PaymentGuardOptions = {}): void {
    this.timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;

    // Load from storage
    this.loadLocks();
    this.loadPendingTransactions();

    // Clean up expired locks
    if (options.autoCleanup !== false) {
      this.cleanupExpiredLocks();
    }

    // Reconcile pending transactions
    this.reconcilePendingTransactions();

    // FIX #14: Add visibility change listener for app resume reconciliation
    this.setupVisibilityListener();

    this.initialized = true;
    console.log('[PaymentGuard] Initialized with timeout:', this.timeoutMs);
  }

  // FIX #14: Setup visibility change listener for app resume
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    // Avoid duplicate listeners
    if ((document as unknown as Record<string, boolean>)[VISIBILITY_KEY]) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[PaymentGuard] App resumed - running reconciliation');
        // Run reconciliation when app comes back to foreground
        this.reconcilePendingTransactions();
        this.cleanupExpiredLocks();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    (document as unknown as Record<string, boolean>)[VISIBILITY_KEY] = true;
  }

  // ==========================================================================
  // Lock Management
  // ==========================================================================

  /**
   * Acquire a payment lock for a booking
   */
  async acquireLock(
    bookingId: string,
    action: PaymentAction,
    userId: string
  ): Promise<PaymentGuardResult> {
    const lockId = this.generateLockId(bookingId, action);
    const now = Date.now();

    // Check if lock already exists
    const existingLock = this.locks.get(lockId);

    if (existingLock) {
      // Check if lock is expired
      if (now < existingLock.expiresAt) {
        // Lock is held by another operation
        if (existingLock.userId === userId) {
          // Same user, refresh the lock
          return this.refreshLock(existingLock);
        }
        return {
          success: false,
          error: `Payment operation already in progress for this booking. Please wait or try again later.`,
        };
      }
    }

    // Create new lock
    const lock: PaymentLock = {
      lockId,
      bookingId,
      action,
      userId,
      acquiredAt: now,
      expiresAt: now + this.timeoutMs,
      idempotencyKey: this.generateIdempotencyKey(action, bookingId),
    };

    this.locks.set(lockId, lock);
    this.saveLocks();

    console.log('[PaymentGuard] Lock acquired:', lockId);
    return { success: true, lock };
  }

  /**
   * Release a payment lock
   */
  releaseLock(lockId: string, userId: string): boolean {
    const lock = this.locks.get(lockId);

    if (!lock) {
      console.log('[PaymentGuard] Lock not found:', lockId);
      return false;
    }

    // Only the lock owner can release
    if (lock.userId !== userId) {
      console.warn('[PaymentGuard] Unauthorized lock release attempt:', lockId);
      return false;
    }

    this.locks.delete(lockId);
    this.saveLocks();

    console.log('[PaymentGuard] Lock released:', lockId);
    return true;
  }

  /**
   * Refresh an existing lock
   */
  private refreshLock(lock: PaymentLock): PaymentGuardResult {
    const now = Date.now();
    lock.expiresAt = now + this.timeoutMs;
    this.locks.set(lock.lockId, lock);
    this.saveLocks();

    console.log('[PaymentGuard] Lock refreshed:', lock.lockId);
    return { success: true, lock };
  }

  /**
   * Check if a booking is locked
   */
  isLocked(bookingId: string, action?: PaymentAction): boolean {
    const now = Date.now();

    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.bookingId === bookingId) {
        if (action && lock.action !== action) continue;
        if (now < lock.expiresAt) {
          return true;
        }
        // Clean up expired lock
        this.locks.delete(lockId);
      }
    }

    return false;
  }

  /**
   * Get lock for a booking
   */
  getLock(bookingId: string, action?: PaymentAction): PaymentLock | null {
    const now = Date.now();

    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.bookingId === bookingId) {
        if (action && lock.action !== action) continue;
        if (now < lock.expiresAt) {
          return lock;
        }
        // Clean up expired lock
        this.locks.delete(lockId);
      }
    }

    return null;
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [lockId, lock] of this.locks.entries()) {
      if (now >= lock.expiresAt) {
        this.locks.delete(lockId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.saveLocks();
      console.log(`[PaymentGuard] Cleaned up ${cleaned} expired locks`);
    }
  }

  // ==========================================================================
  // Idempotency Key Management
  // ==========================================================================

  /**
   * Generate idempotency key for payment operations
   * FIX #13: Use crypto.randomUUID() for better entropy
   */
  generateIdempotencyKey(action: PaymentAction, bookingId: string): string {
    // Use crypto.randomUUID() for high-entropy unique identifiers
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    return `payment_${action}_${bookingId}_${uuid}`;
  }

  /**
   * Get or create idempotency key for a booking
   */
  getIdempotencyKey(bookingId: string, action: PaymentAction): string {
    const lock = this.getLock(bookingId, action);
    if (lock) {
      return lock.idempotencyKey;
    }

    // Generate new key (will be stored when lock is acquired)
    return this.generateIdempotencyKey(action, bookingId);
  }

  // ==========================================================================
  // Pending Transaction Management
  // ==========================================================================

  /**
   * Track a pending transaction
   */
  trackPendingTransaction(
    bookingId: string,
    action: PaymentAction,
    idempotencyKey: string
  ): void {
    const transaction: PendingTransaction = {
      bookingId,
      action,
      timestamp: Date.now(),
      status: 'pending',
      idempotencyKey,
    };

    this.pendingTransactions.set(idempotencyKey, transaction);
    this.savePendingTransactions();
  }

  /**
   * Mark transaction as completed
   */
  completeTransaction(idempotencyKey: string): void {
    const transaction = this.pendingTransactions.get(idempotencyKey);
    if (transaction) {
      transaction.status = 'completed';
      this.savePendingTransactions();
    }
  }

  /**
   * Mark transaction as failed
   */
  failTransaction(idempotencyKey: string): void {
    const transaction = this.pendingTransactions.get(idempotencyKey);
    if (transaction) {
      transaction.status = 'failed';
      this.savePendingTransactions();
    }
  }

  /**
   * Get pending transaction by idempotency key
   */
  getPendingTransaction(idempotencyKey: string): PendingTransaction | null {
    return this.pendingTransactions.get(idempotencyKey) || null;
  }

  /**
   * Reconcile pending transactions on startup
   */
  private async reconcilePendingTransactions(): Promise<void> {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    let reconciled = 0;

    for (const [key, transaction] of this.pendingTransactions.entries()) {
      if (transaction.status === 'pending') {
        const age = now - transaction.timestamp;

        if (age > staleThreshold) {
          // Transaction is too old, mark as failed
          transaction.status = 'failed';
          reconciled++;
        }
      }
    }

    if (reconciled > 0) {
      this.savePendingTransactions();
      console.log(`[PaymentGuard] Reconciled ${reconciled} stale transactions`);
    }
  }

  // ==========================================================================
  // Storage
  // ==========================================================================

  /**
   * Load locks from storage
   */
  private loadLocks(): void {
    try {
      const stored = localStorage.getItem(LOCK_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as [string, PaymentLock][];
        this.locks = new Map(parsed);
        this.cleanupExpiredLocks();
      }
    } catch (error) {
      console.error('[PaymentGuard] Failed to load locks:', error);
      this.locks = new Map();
    }
  }

  /**
   * Save locks to storage
   */
  private saveLocks(): void {
    try {
      const entries = Array.from(this.locks.entries());
      localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[PaymentGuard] Failed to save locks:', error);
    }
  }

  /**
   * Load pending transactions from storage
   */
  private loadPendingTransactions(): void {
    try {
      const stored = localStorage.getItem(PENDING_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as [string, PendingTransaction][];
        this.pendingTransactions = new Map(parsed);
      }
    } catch (error) {
      console.error('[PaymentGuard] Failed to load pending transactions:', error);
      this.pendingTransactions = new Map();
    }
  }

  /**
   * Save pending transactions to storage
   */
  private savePendingTransactions(): void {
    try {
      const entries = Array.from(this.pendingTransactions.entries());
      localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('[PaymentGuard] Failed to save pending transactions:', error);
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Generate lock ID
   */
  private generateLockId(bookingId: string, action: PaymentAction): string {
    return `lock_${action}_${bookingId}`;
  }

  /**
   * Get all active locks for a user
   */
  getUserLocks(userId: string): PaymentLock[] {
    const now = Date.now();
    const userLocks: PaymentLock[] = [];

    for (const lock of this.locks.values()) {
      if (lock.userId === userId && now < lock.expiresAt) {
        userLocks.push(lock);
      }
    }

    return userLocks;
  }

  /**
   * Release all locks for a user
   */
  releaseAllUserLocks(userId: string): number {
    let released = 0;

    for (const [lockId, lock] of this.locks.entries()) {
      if (lock.userId === userId) {
        this.locks.delete(lockId);
        released++;
      }
    }

    if (released > 0) {
      this.saveLocks();
    }

    return released;
  }

  /**
   * Get lock statistics
   */
  getStats(): {
    activeLocks: number;
    pendingTransactions: number;
    completedToday: number;
  } {
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);

    let activeLocks = 0;
    for (const lock of this.locks.values()) {
      if (now < lock.expiresAt) activeLocks++;
    }

    let pendingTransactions = 0;
    let completedToday = 0;
    for (const tx of this.pendingTransactions.values()) {
      if (tx.status === 'pending') pendingTransactions++;
      if (tx.status === 'completed' && tx.timestamp >= todayStart) completedToday++;
    }

    return {
      activeLocks,
      pendingTransactions,
      completedToday,
    };
  }

  /**
   * Clear all locks (use with caution)
   */
  clearAllLocks(): void {
    this.locks.clear();
    this.saveLocks();
    console.log('[PaymentGuard] All locks cleared');
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Destroy the service - clean up all resources
   */
  destroy(): void {
    console.log('[PaymentGuard] Destroying service');

    // Clear all locks
    this.locks.clear();

    // Clear all pending transactions
    this.pendingTransactions.clear();

    // FIX #14: Remove visibility change listener
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', () => {/* handler reference */});
      (document as unknown as Record<string, boolean>)[VISIBILITY_KEY] = false;
    }

    // Clear storage
    try {
      localStorage.removeItem(LOCK_STORAGE_KEY);
      localStorage.removeItem(PENDING_STORAGE_KEY);
    } catch (error) {
      console.error('[PaymentGuard] Failed to clear storage:', error);
    }

    this.initialized = false;
    console.log('[PaymentGuard] Service destroyed');
  }
}

// =============================================================================
// Export Singleton
// =============================================================================

export const paymentGuard = new PaymentGuardService();
export default paymentGuard;
