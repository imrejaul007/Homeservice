/**
 * usePaymentGuard Hook
 *
 * React hook for payment protection with automatic lock management,
 * interruption recovery, and loading states.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  paymentGuard,
  type PaymentLock,
  type PaymentAction,
  type PaymentGuardResult,
} from '../services/PaymentGuardService';
import {
  usePaymentStore,
  type PaymentError,
} from '../stores/paymentStore';
import { useAuthStoreUser } from '../stores/authStore';

// =============================================================================
// Types
// =============================================================================

export interface UsePaymentGuardOptions {
  /** Enable automatic initialization (default: true) */
  autoInit?: boolean;
  /** Lock timeout in milliseconds */
  timeoutMs?: number;
  /** Callback on payment success */
  onSuccess?: (bookingId: string, result: unknown) => void;
  /** Callback on payment error */
  onError?: (bookingId: string, error: PaymentError) => void;
  /** Callback on lock acquired */
  onLockAcquired?: (lock: PaymentLock) => void;
  /** Callback on lock failed */
  onLockFailed?: (bookingId: string, reason: string) => void;
}

export interface UsePaymentGuardReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  isLocked: boolean;
  currentLock: PaymentLock | null;
  currentBookingId: string | null;
  currentAction: PaymentAction | null;

  // Lock management
  acquireLock: (bookingId: string, action: PaymentAction) => Promise<PaymentGuardResult>;
  releaseLock: () => Promise<boolean>;
  refreshLock: () => Promise<boolean>;

  // Payment execution
  executePayment: <T>(
    bookingId: string,
    action: PaymentAction,
    paymentFn: () => Promise<T>
  ) => Promise<T>;

  // Utilities
  getIdempotencyKey: (bookingId: string, action: PaymentAction) => string;
  isBookingLocked: (bookingId: string) => boolean;
  getLockStats: () => { activeLocks: number; pendingTransactions: number; completedToday: number };
}

// =============================================================================
// Hook Implementation
// =============================================================================

export function usePaymentGuard(
  options: UsePaymentGuardOptions = {}
): UsePaymentGuardReturn {
  const {
    autoInit = true,
    timeoutMs,
    onSuccess,
    onError,
    onLockAcquired,
    onLockFailed,
  } = options;

  // Auth
  const userId = useAuthStoreUser().id;

  // Store actions
  const startPayment = usePaymentStore((state) => state.startPayment);
  const completePayment = usePaymentStore((state) => state.completePayment);
  const failPayment = usePaymentStore((state) => state.failPayment);
  const isPaymentActive = usePaymentStore((state) => state.isPaymentActive);
  const getActivePayment = usePaymentStore((state) => state.getActivePayment);

  // State
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLock, setCurrentLock] = useState<PaymentLock | null>(null);

  // Ref for tracking current operation
  const currentOperationRef = useRef<{
    bookingId: string | null;
    action: PaymentAction | null;
  }>({ bookingId: null, action: null });

  // ==========================================================================
  // Initialization
  // ==========================================================================

  useEffect(() => {
    if (autoInit && !isInitialized) {
      paymentGuard.initialize({ timeoutMs });
      setIsInitialized(true);
    }
  }, [autoInit, isInitialized, timeoutMs]);

  // ==========================================================================
  // Lock Management
  // ==========================================================================

  /**
   * Acquire a payment lock
   */
  const acquireLock = useCallback(
    async (bookingId: string, action: PaymentAction): Promise<PaymentGuardResult> => {
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }

      // Check if already locked
      if (isPaymentActive(bookingId)) {
        const active = getActivePayment(bookingId);
        if (active) {
          return {
            success: false,
            error: 'Payment operation already in progress',
            lock: paymentGuard.getLock(bookingId, action) || undefined,
          };
        }
      }

      setIsLoading(true);
      try {
        const result = await paymentGuard.acquireLock(bookingId, action, userId);

        if (result.success && result.lock) {
          setCurrentLock(result.lock);
          currentOperationRef.current = { bookingId, action };
          startPayment(bookingId, action, result.lock.idempotencyKey);
          onLockAcquired?.(result.lock);
        } else {
          onLockFailed?.(bookingId, result.error || 'Failed to acquire lock');
        }

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [userId, isPaymentActive, getActivePayment, startPayment, onLockAcquired, onLockFailed]
  );

  /**
   * Release the current lock
   */
  const releaseLock = useCallback(async (): Promise<boolean> => {
    if (!currentLock || !userId) {
      return false;
    }

    setIsLoading(true);
    try {
      const released = paymentGuard.releaseLock(currentLock.lockId, userId);

      if (released) {
        setCurrentLock(null);
        currentOperationRef.current = { bookingId: null, action: null };
      }

      return released;
    } finally {
      setIsLoading(false);
    }
  }, [currentLock, userId]);

  /**
   * Refresh the current lock
   */
  const refreshLock = useCallback(async (): Promise<boolean> => {
    if (!currentLock) {
      return false;
    }

    const lock = paymentGuard.getLock(currentLock.bookingId, currentLock.action);
    if (lock) {
      setCurrentLock(lock);
      return true;
    }

    return false;
  }, [currentLock]);

  // ==========================================================================
  // Payment Execution
  // ==========================================================================

  /**
   * Execute a payment operation with lock protection
   */
  const executePayment = useCallback(
    async <T>(
      bookingId: string,
      action: PaymentAction,
      paymentFn: () => Promise<T>
    ): Promise<T> => {
      // Acquire lock first
      const lockResult = await acquireLock(bookingId, action);

      if (!lockResult.success || !lockResult.lock) {
        const error: PaymentError = {
          code: 'LOCK_FAILED',
          message: lockResult.error || 'Failed to acquire payment lock',
          timestamp: Date.now(),
        };
        failPayment(bookingId, error);
        onError?.(bookingId, error);
        throw new Error(error.message);
      }

      try {
        // Execute the payment
        const result = await paymentFn();

        // Complete the payment
        completePayment(bookingId);
        paymentGuard.completeTransaction(lockResult.lock.idempotencyKey);

        onSuccess?.(bookingId, result);
        return result;
      } catch (error) {
        const paymentError: PaymentError = {
          code: 'PAYMENT_FAILED',
          message: error instanceof Error ? error.message : 'Payment failed',
          timestamp: Date.now(),
        };

        failPayment(bookingId, paymentError);
        paymentGuard.failTransaction(lockResult.lock.idempotencyKey);

        onError?.(bookingId, paymentError);
        throw error;
      } finally {
        // Release the lock after a short delay to allow for UI updates
        setTimeout(async () => {
          await releaseLock();
        }, 100);
      }
    },
    [acquireLock, completePayment, failPayment, releaseLock, onSuccess, onError]
  );

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get idempotency key for a booking/action
   */
  const getIdempotencyKey = useCallback(
    (bookingId: string, action: PaymentAction): string => {
      return paymentGuard.getIdempotencyKey(bookingId, action);
    },
    []
  );

  /**
   * Check if a booking is currently locked
   */
  const isBookingLocked = useCallback((bookingId: string): boolean => {
    return paymentGuard.isLocked(bookingId);
  }, []);

  /**
   * Get lock statistics
   */
  const getLockStats = useCallback(() => {
    return paymentGuard.getStats();
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    // State
    isInitialized,
    isLoading,
    isLocked: !!currentLock,
    currentLock,
    currentBookingId: currentOperationRef.current.bookingId,
    currentAction: currentOperationRef.current.action,

    // Lock management
    acquireLock,
    releaseLock,
    refreshLock,

    // Payment execution
    executePayment,

    // Utilities
    getIdempotencyKey,
    isBookingLocked,
    getLockStats,
  };
}

// =============================================================================
// Specialized Hooks
// =============================================================================

/**
 * Hook for booking payment protection
 */
export function useBookingPayment(bookingId: string) {
  const {
    isLoading,
    isLocked,
    acquireLock,
    releaseLock,
    executePayment,
    isBookingLocked,
  } = usePaymentGuard();

  const isBookingPaymentLocked = isBookingLocked(bookingId);

  const pay = useCallback(
    async <T>(action: PaymentAction, paymentFn: () => Promise<T>): Promise<T> => {
      return executePayment(bookingId, action, paymentFn);
    },
    [bookingId, executePayment]
  );

  return {
    isLoading,
    isLocked: isBookingPaymentLocked,
    pay,
    acquireLock: () => acquireLock(bookingId, 'create'),
    releaseLock,
  };
}

/**
 * Hook for payment lock status
 */
export function usePaymentLockStatus(bookingId: string) {
  const { isBookingLocked, getLockStats } = usePaymentGuard();

  const lock = paymentGuard.getLock(bookingId);

  return {
    isLocked: isBookingLocked(bookingId),
    lock,
    stats: getLockStats(),
  };
}

/**
 * Hook for managing all user payment locks
 */
export function useUserPaymentLocks() {
  const userId = useAuthStoreUser().id;

  const getUserLocks = useCallback((): PaymentLock[] => {
    if (!userId) return [];
    return paymentGuard.getUserLocks(userId);
  }, [userId]);

  const releaseAllLocks = useCallback((): number => {
    if (!userId) return 0;
    return paymentGuard.releaseAllUserLocks(userId);
  }, [userId]);

  return {
    locks: getUserLocks(),
    lockCount: getUserLocks().length,
    releaseAllLocks,
  };
}

export default usePaymentGuard;
