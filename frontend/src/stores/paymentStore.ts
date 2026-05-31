/**
 * Payment Store
 *
 * Zustand store for payment state management with error handling,
 * loading states, and payment in-progress tracking.
 * Uses Capacitor-safe storage for cross-platform compatibility.
 */

import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Capacitor-safe Zustand storage adapter for payment store
 */
const capacitorPaymentStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Preferences.get({ key: name });
        return result.value;
      } catch {
        return null;
      }
    }
    // Browser fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(name);
    }
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: name, value });
    } else {
      // Browser fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: name });
    } else {
      // Browser fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    }
  },
};

// =============================================================================
// Types
// =============================================================================

export interface PaymentError {
  code: string;
  message: string;
  field?: string;
  timestamp: number;
}

export interface ActivePayment {
  bookingId: string;
  action: 'create' | 'confirm' | 'cancel' | 'refund';
  startedAt: number;
  idempotencyKey: string;
}

export interface PaymentStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastUpdated: number;
  error?: PaymentError;
}

export interface PaymentState {
  // Payment in-progress tracking - using Record for proper serialization
  activePayments: Record<string, ActivePayment>;

  // Payment status - using Record for proper serialization
  paymentStatuses: Record<string, PaymentStatus>;

  // Error state
  errors: PaymentError[];

  // Loading states
  isProcessing: boolean;
  processingBookingId: string | null;

  // Actions
  startPayment: (bookingId: string, action: 'create' | 'confirm' | 'cancel' | 'refund', idempotencyKey: string) => void;
  completePayment: (bookingId: string) => void;
  failPayment: (bookingId: string, error: PaymentError) => void;
  setPaymentStatus: (bookingId: string, status: 'pending' | 'processing' | 'completed' | 'failed', error?: PaymentError) => void;
  addError: (error: PaymentError) => void;
  clearError: (timestamp: number) => void;
  clearAllErrors: () => void;
  cancelPayment: (bookingId: string) => void;
  getPaymentStatus: (bookingId: string) => 'pending' | 'processing' | 'completed' | 'failed' | null;
  getActivePayment: (bookingId: string) => ActivePayment | null;
  isPaymentActive: (bookingId: string) => boolean;
  clearStalePayments: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const STALE_PAYMENT_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

// =============================================================================
// Store Implementation
// =============================================================================

export const usePaymentStore = create<PaymentState>()(
  persist(
    immer((set, get) => ({
      // Initial state - using Records instead of Maps for serialization
      activePayments: {},
      paymentStatuses: {},
      errors: [],
      isProcessing: false,
      processingBookingId: null,

      // Actions
      startPayment: (bookingId, action, idempotencyKey) => {
        set((state) => {
          // Add to active payments using Record
          state.activePayments[bookingId] = {
            bookingId,
            action,
            startedAt: Date.now(),
            idempotencyKey,
          };

          // Set processing status
          state.paymentStatuses[bookingId] = {
            status: 'processing',
            lastUpdated: Date.now(),
          };

          state.isProcessing = true;
          state.processingBookingId = bookingId;
        });
      },

      completePayment: (bookingId) => {
        set((state) => {
          // Remove from active payments using Record
          delete state.activePayments[bookingId];

          // Update status
          state.paymentStatuses[bookingId] = {
            status: 'completed',
            lastUpdated: Date.now(),
          };

          // Clear processing if this was the active payment
          if (state.processingBookingId === bookingId) {
            state.isProcessing = false;
            state.processingBookingId = null;
          }
        });
      },

      failPayment: (bookingId, error) => {
        set((state) => {
          // Remove from active payments
          delete state.activePayments[bookingId];

          // Update status with error
          state.paymentStatuses[bookingId] = {
            status: 'failed',
            lastUpdated: Date.now(),
            error,
          };

          // Add to error list
          state.errors.push(error);

          // Clear processing if this was the active payment
          if (state.processingBookingId === bookingId) {
            state.isProcessing = false;
            state.processingBookingId = null;
          }
        });
      },

      setPaymentStatus: (bookingId, status, error) => {
        set((state) => {
          state.paymentStatuses[bookingId] = {
            status,
            lastUpdated: Date.now(),
            error,
          };
        });
      },

      addError: (error) => {
        set((state) => {
          state.errors.push(error);

          // Keep only last 10 errors
          if (state.errors.length > 10) {
            state.errors = state.errors.slice(-10);
          }
        });
      },

      clearError: (timestamp) => {
        set((state) => {
          state.errors = state.errors.filter((e) => e.timestamp !== timestamp);
        });
      },

      clearAllErrors: () => {
        set((state) => {
          state.errors = [];
        });
      },

      cancelPayment: (bookingId) => {
        set((state) => {
          // Remove from active payments
          delete state.activePayments[bookingId];

          // Update status back to pending
          state.paymentStatuses[bookingId] = {
            status: 'pending',
            lastUpdated: Date.now(),
          };

          // Clear processing if this was the active payment
          if (state.processingBookingId === bookingId) {
            state.isProcessing = false;
            state.processingBookingId = null;
          }
        });
      },

      getPaymentStatus: (bookingId) => {
        const status = get().paymentStatuses[bookingId];
        return status?.status || null;
      },

      getActivePayment: (bookingId) => {
        return get().activePayments[bookingId] || null;
      },

      isPaymentActive: (bookingId) => {
        return bookingId in get().activePayments;
      },

      clearStalePayments: () => {
        const now = Date.now();
        set((state) => {
          for (const bookingId of Object.keys(state.activePayments)) {
            const payment = state.activePayments[bookingId];
            if (now - payment.startedAt > STALE_PAYMENT_THRESHOLD_MS) {
              delete state.activePayments[bookingId];

              // Update status
              state.paymentStatuses[bookingId] = {
                status: 'failed',
                lastUpdated: now,
                error: {
                  code: 'PAYMENT_TIMEOUT',
                  message: 'Payment timed out',
                  timestamp: now,
                },
              };

              // Clear processing if this was the active payment
              if (state.processingBookingId === bookingId) {
                state.isProcessing = false;
                state.processingBookingId = null;
              }
            }
          }
        });
      },
    })),
    {
      name: 'payment-storage',
      version: 1,
      storage: createJSONStorage(() => capacitorPaymentStorage),
      partialize: (state) => ({
        // Only persist non-sensitive data
        errors: state.errors.slice(-5), // Keep only last 5 errors
      }),
      onRehydrateStorage: () => (state) => {
        // Clear stale payments on rehydration
        if (state) {
          state.clearStalePayments();
        }
      },
    }
  )
);

// =============================================================================
// Selectors
// =============================================================================

export const usePaymentErrors = () => usePaymentStore((state) => state.errors);
export const useIsProcessing = () => usePaymentStore((state) => state.isProcessing);
export const useProcessingBookingId = () => usePaymentStore((state) => state.processingBookingId);
export const useActivePaymentCount = () => {
  return usePaymentStore((state) => Object.keys(state.activePayments).length);
};

export const useIsBookingPaymentActive = (bookingId: string) =>
  usePaymentStore((state) => bookingId in state.activePayments);

export const useBookingPaymentStatus = (bookingId: string) =>
  usePaymentStore((state) => state.paymentStatuses[bookingId]?.status || null);

export default usePaymentStore;
