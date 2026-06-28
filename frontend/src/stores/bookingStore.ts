import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { capacitorStorageAdapter } from '../lib/storageAdapters';
import logger from '../lib/logger';
import type {
  Booking,
  BookingFilters,
  CreateBookingData,
  ProviderAvailability,
  ProviderBookingsStats,
  AvailableSlot,
  BookingAcceptData,
  BookingCompleteData,
  BookingCancelData,
  BookingMessage,
  AvailabilitySettingsUpdate
} from '../types/booking.types';

// Default timeout for optimistic update operations (30 seconds)
const OPTIMISTIC_UPDATE_TIMEOUT_MS = 30000;

// Maximum bookings to persist to prevent storage quota issues
const MAX_PERSISTED_BOOKINGS = 50;

/**
 * Parse a date from backend (MongoDB Date) or frontend (ISO string)
 * Backend returns: Date object from MongoDB or ISO string
 * Frontend expects: string (YYYY-MM-DD) or Date object
 * This utility ensures consistent date handling across the app
 */
function parseBookingDate(dateValue: string | Date | undefined | null): Date | null {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'string') {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Format a Date object to YYYY-MM-DD string for backend API
 */
function formatDateForApi(date: Date | string): string {
  if (typeof date === 'string') {
    // Already a string, check if it's already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    // Try parsing and reformatting
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return date;
  }
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return '';
}

/**
 * Creates a timeout race promise that rejects if the operation takes too long.
 * This ensures optimistic updates are rolled back even when requests hang.
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError: Error
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(timeoutError), timeoutMs)
    )
  ]);
}

export interface BookingError {
  message: string;
  code: string;
  field?: string;
}

export interface BookingState {
  // Current bookings data
  customerBookings: Booking[];
  providerBookings: Booking[];
  currentBooking: Booking | null;

  // Availability data
  providerAvailability: ProviderAvailability | null;
  availableSlots: AvailableSlot[];
  minBookingAdvanceHours: number;

  // UI state
  isLoading: boolean;
  isSubmitting: boolean;
  errors: BookingError[];

  // Pagination
  customerBookingsPagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;

  providerBookingsPagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null;

  providerBookingsStats: ProviderBookingsStats | null;

  // Actions - Customer
  createBooking: (data: CreateBookingData) => Promise<Booking>;
  getCustomerBookings: (filters?: BookingFilters) => Promise<void>;

  // Actions - Provider
  getProviderBookings: (filters?: BookingFilters) => Promise<void>;
  acceptBooking: (bookingId: string, data?: BookingAcceptData) => Promise<void>;
  rejectBooking: (bookingId: string, data: BookingCancelData) => Promise<void>;
  startBooking: (bookingId: string, notes?: string) => Promise<void>;
  markBookingPaymentCompleted: (bookingId: string, data?: { transactionId?: string; notes?: string }) => Promise<void>;
  completeBooking: (bookingId: string, data?: BookingCompleteData) => Promise<void>;

  // Actions - Shared
  getBooking: (bookingId: string) => Promise<void>;
  cancelBooking: (bookingId: string, data: BookingCancelData) => Promise<void>;
  rescheduleBooking: (bookingId: string, newDate: string, newTime: string, reason?: string) => Promise<void>;
  addBookingMessage: (bookingId: string, message: string) => Promise<void>;
  markMessagesRead: (bookingId: string) => Promise<void>;

  // Actions - Availability
  getProviderAvailability: (providerId?: string) => Promise<void>;
  updateWeeklySchedule: (weeklySchedule: ProviderAvailability['weeklySchedule']) => Promise<void>;
  updateAvailabilitySettings: (settings: AvailabilitySettingsUpdate) => Promise<void>;
  addDateOverride: (override: {
    date: string;
    isAvailable: boolean;
    reason?: string;
    timeSlots?: Array<{ start: string; end: string; isActive: boolean }>;
    notes?: string;
  }) => Promise<void>;
  removeDateOverride: (date: string) => Promise<void>;
  getAvailableSlots: (providerId: string, params: {
    date: string;
    duration: number;
    days?: number;
    serviceId?: string;
  }) => Promise<void>;
  checkSlotAvailability: (providerId: string, params: {
    date: string;
    time: string;
    duration: number;
  }) => Promise<boolean>;

  // Utility actions
  clearErrors: () => void;
  setError: (error: BookingError) => void;
  setLoading: (loading: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  clearCurrentBooking: () => void;
  clearBookings: () => void;
}

export const useBookingStore = create<BookingState>()(
  persist(
    immer((set, get) => ({
      // Initial state
      customerBookings: [],
      providerBookings: [],
      currentBooking: null,
      providerAvailability: null,
      availableSlots: [],
      minBookingAdvanceHours: 4,
      isLoading: false,
      isSubmitting: false,
      errors: [],
      customerBookingsPagination: null,
      providerBookingsPagination: null,
      providerBookingsStats: null,

      // Customer Actions
      createBooking: async (data: CreateBookingData): Promise<Booking> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.createBooking(data);
          const responseData = response.data as (Record<string, unknown> & { booking?: unknown; isDuplicate?: boolean });
          const booking = responseData?.booking as (Record<string, unknown> & { _id?: string; isDuplicate?: boolean });

          if (!booking?._id) {
            throw new Error('Invalid booking response from server');
          }

          const isDuplicate = responseData?.isDuplicate ?? false;
          if (isDuplicate) {
            (booking as { isDuplicate?: boolean }).isDuplicate = true;
          }

          const validBooking = booking as unknown as Booking;

          set((state) => {
            if (!isDuplicate) {
              state.customerBookings.unshift(validBooking);
            }
            state.currentBooking = validBooking;
            state.isSubmitting = false;
          });

          return validBooking;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to create booking';
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message,
              code: 'CREATE_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      getCustomerBookings: async (filters?: BookingFilters): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await bookingService.getCustomerBookings(filters);

          set((state) => {
            state.customerBookings = response.data.bookings;
            state.customerBookingsPagination = response.pagination || null;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to get customer bookings',
              code: 'GET_CUSTOMER_BOOKINGS_ERROR'
            }];
          });
        }
      },

      // Provider Actions
      getProviderBookings: async (filters?: BookingFilters): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await bookingService.getProviderBookings(filters);

          set((state) => {
            state.providerBookings = response.data.bookings;
            state.providerBookingsPagination = response.pagination || null;
            // Transform stats to match ProviderBookingsStats shape
            if (response.stats) {
              state.providerBookingsStats = {
                pending: response.stats.pending,
                confirmed: response.stats.confirmed,
                in_progress: response.stats.in_progress ?? 0,
                completed: response.stats.completed,
                cancelled: response.stats.cancelled,
                no_show: response.stats.no_show ?? 0,
                total: response.stats.total ?? (response.data.bookings?.length ?? 0),
              };
            } else {
              state.providerBookingsStats = null;
            }
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to get provider bookings',
              code: 'GET_PROVIDER_BOOKINGS_ERROR'
            }];
          });
        }
      },

      acceptBooking: async (bookingId: string, data?: BookingAcceptData): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        // Store previous state for rollback
        const previousProviderBookings = [...get().providerBookings];
        const previousCurrentBooking = get().currentBooking;
        const previousStats = get().providerBookingsStats;

        // Optimistic update - apply change immediately
        set((state) => {
          const index = state.providerBookings.findIndex(b => b._id === bookingId);
          if (index !== -1) {
            state.providerBookings[index] = {
              ...state.providerBookings[index],
              status: 'confirmed'
            };
          }
          if (state.currentBooking?._id === bookingId) {
            state.currentBooking = {
              ...state.currentBooking,
              status: 'confirmed'
            };
          }
          // Update stats optimistically
          if (state.providerBookingsStats) {
            state.providerBookingsStats.pending = Math.max(0, state.providerBookingsStats.pending - 1);
            state.providerBookingsStats.confirmed = (state.providerBookingsStats.confirmed || 0) + 1;
          }
        });

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          // Wrap with timeout to handle hanging requests
          const timeoutError = new Error('Accept booking request timed out');
          const response = await withTimeout(
            bookingService.acceptBooking(bookingId, data),
            OPTIMISTIC_UPDATE_TIMEOUT_MS,
            timeoutError
          );
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update with server response
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }
            state.isSubmitting = false;
          });
        } catch (error) {
          // Rollback on failure (including timeout)
          set((state) => {
            state.providerBookings = previousProviderBookings;
            state.currentBooking = previousCurrentBooking;
            state.providerBookingsStats = previousStats;
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to accept booking',
              code: 'ACCEPT_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      rejectBooking: async (bookingId: string, data: BookingCancelData): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        // Store previous state for rollback
        const previousProviderBookings = [...get().providerBookings];
        const previousCurrentBooking = get().currentBooking;
        const previousStats = get().providerBookingsStats;

        // Optimistic update - apply change immediately
        set((state) => {
          const index = state.providerBookings.findIndex(b => b._id === bookingId);
          if (index !== -1) {
            state.providerBookings[index] = {
              ...state.providerBookings[index],
              status: 'cancelled'
            };
          }
          if (state.currentBooking?._id === bookingId) {
            state.currentBooking = {
              ...state.currentBooking,
              status: 'cancelled'
            };
          }
          // Update stats optimistically
          if (state.providerBookingsStats) {
            state.providerBookingsStats.pending = Math.max(0, state.providerBookingsStats.pending - 1);
            state.providerBookingsStats.cancelled = (state.providerBookingsStats.cancelled || 0) + 1;
          }
        });

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          // Wrap with timeout to handle hanging requests
          const timeoutError = new Error('Reject booking request timed out');
          const response = await withTimeout(
            bookingService.rejectBooking(bookingId, data),
            OPTIMISTIC_UPDATE_TIMEOUT_MS,
            timeoutError
          );
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update with server response
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }
            state.isSubmitting = false;
          });
        } catch (error) {
          // Rollback on failure (including timeout)
          set((state) => {
            state.providerBookings = previousProviderBookings;
            state.currentBooking = previousCurrentBooking;
            state.providerBookingsStats = previousStats;
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to reject booking',
              code: 'REJECT_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      startBooking: async (bookingId: string, notes?: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        // Store previous state for rollback on failure
        const previousProviderBookings = [...get().providerBookings];
        const previousCurrentBooking = get().currentBooking;
        const previousStats = get().providerBookingsStats;

        // Optimistic update - apply change immediately
        set((state) => {
          const index = state.providerBookings.findIndex(b => b._id === bookingId);
          if (index !== -1) {
            state.providerBookings[index] = {
              ...state.providerBookings[index],
              status: 'in_progress'
            };
          }
          if (state.currentBooking?._id === bookingId) {
            state.currentBooking = {
              ...state.currentBooking,
              status: 'in_progress'
            };
          }
          // Update stats optimistically
          if (state.providerBookingsStats) {
            state.providerBookingsStats.confirmed = Math.max(0, (state.providerBookingsStats.confirmed || 0) - 1);
            state.providerBookingsStats.in_progress = (state.providerBookingsStats.in_progress || 0) + 1;
          }
        });

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          // Wrap with timeout to handle hanging requests
          const timeoutError = new Error('Start booking request timed out');
          const response = await withTimeout(
            bookingService.startBooking(bookingId, notes),
            OPTIMISTIC_UPDATE_TIMEOUT_MS,
            timeoutError
          );
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update with server response
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }
            state.isSubmitting = false;
          });
        } catch (error) {
          // Rollback on failure (including timeout)
          set((state) => {
            state.providerBookings = previousProviderBookings;
            state.currentBooking = previousCurrentBooking;
            state.providerBookingsStats = previousStats;
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to start booking',
              code: 'START_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      completeBooking: async (bookingId: string, data?: BookingCompleteData): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        // Store previous state for rollback on failure
        const previousProviderBookings = [...get().providerBookings];
        const previousCurrentBooking = get().currentBooking;
        const previousStats = get().providerBookingsStats;

        // Optimistic update - apply change immediately
        set((state) => {
          const index = state.providerBookings.findIndex(b => b._id === bookingId);
          if (index !== -1) {
            state.providerBookings[index] = {
              ...state.providerBookings[index],
              status: 'completed'
            };
          }
          if (state.currentBooking?._id === bookingId) {
            state.currentBooking = {
              ...state.currentBooking,
              status: 'completed'
            };
          }
          // Update stats optimistically
          if (state.providerBookingsStats) {
            state.providerBookingsStats.in_progress = Math.max(0, (state.providerBookingsStats.in_progress || 0) - 1);
            state.providerBookingsStats.completed = (state.providerBookingsStats.completed || 0) + 1;
          }
        });

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          // Wrap with timeout to handle hanging requests
          const timeoutError = new Error('Complete booking request timed out');
          const response = await withTimeout(
            bookingService.completeBooking(bookingId, data),
            OPTIMISTIC_UPDATE_TIMEOUT_MS,
            timeoutError
          );
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update with server response
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }
            state.isSubmitting = false;
          });
        } catch (error) {
          // Rollback on failure (including timeout)
          set((state) => {
            state.providerBookings = previousProviderBookings;
            state.currentBooking = previousCurrentBooking;
            state.providerBookingsStats = previousStats;
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to complete booking',
              code: 'COMPLETE_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      markBookingPaymentCompleted: async (
        bookingId: string,
        data?: { transactionId?: string; notes?: string }
      ): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.markBookingPaymentCompleted(bookingId, data);
          const updatedBooking = response.data.booking;

          set((state) => {
            const providerIndex = state.providerBookings.findIndex((b) => b._id === bookingId);
            if (providerIndex !== -1) {
              state.providerBookings[providerIndex] = updatedBooking;
            }

            const customerIndex = state.customerBookings.findIndex((b) => b._id === bookingId);
            if (customerIndex !== -1) {
              state.customerBookings[customerIndex] = updatedBooking;
            }

            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to update payment status',
              code: 'MARK_PAYMENT_COMPLETED_ERROR'
            }];
          });
          throw error;
        }
      },

      // Shared Actions
      getBooking: async (bookingId: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await bookingService.getBooking(bookingId);

          set((state) => {
            state.currentBooking = response.data.booking;
            state.isLoading = false;
            state.errors = [];
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to get booking',
              code: 'GET_BOOKING_ERROR'
            }];
          });
          // Re-throw so callers (e.g., BookingDetailPage) can react with their own error state and retry button
          throw error;
        }
      },

      cancelBooking: async (bookingId: string, data: BookingCancelData): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        // Store previous state for rollback on failure
        const previousCustomerBookings = [...get().customerBookings];
        const previousProviderBookings = [...get().providerBookings];
        const previousCurrentBooking = get().currentBooking;
        const previousStats = get().providerBookingsStats;

        // Find the original booking status before optimistic update
        const originalBooking = get().providerBookings.find(b => b._id === bookingId) ||
                               get().customerBookings.find(b => b._id === bookingId);
        const originalStatus = originalBooking?.status || 'unknown';

        // Optimistic update - apply change immediately
        set((state) => {
          // Update in customer bookings
          const customerIndex = state.customerBookings.findIndex(b => b._id === bookingId);
          if (customerIndex !== -1) {
            state.customerBookings[customerIndex] = {
              ...state.customerBookings[customerIndex],
              status: 'cancelled'
            };
          }

          // Update in provider bookings
          const providerIndex = state.providerBookings.findIndex(b => b._id === bookingId);
          if (providerIndex !== -1) {
            state.providerBookings[providerIndex] = {
              ...state.providerBookings[providerIndex],
              status: 'cancelled'
            };
          }

          // Update current booking if it matches
          if (state.currentBooking?._id === bookingId) {
            state.currentBooking = {
              ...state.currentBooking,
              status: 'cancelled'
            };
          }

          // Update stats optimistically
          if (state.providerBookingsStats) {
            const stats = state.providerBookingsStats;
            if (originalStatus === 'pending') stats.pending = Math.max(0, (stats.pending || 1) - 1);
            if (originalStatus === 'confirmed') stats.confirmed = Math.max(0, (stats.confirmed || 1) - 1);
            if (originalStatus === 'in_progress') stats.in_progress = Math.max(0, (stats.in_progress || 1) - 1);
            stats.cancelled = (stats.cancelled || 0) + 1;
          }
        });

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          // Wrap with timeout to handle hanging requests
          const timeoutError = new Error('Cancel booking request timed out');
          const response = await withTimeout(
            bookingService.cancelBooking(bookingId, data),
            OPTIMISTIC_UPDATE_TIMEOUT_MS,
            timeoutError
          );
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update with server response
            const customerIndex = state.customerBookings.findIndex(b => b._id === bookingId);
            if (customerIndex !== -1) {
              state.customerBookings[customerIndex] = updatedBooking;
            }

            const providerIndex = state.providerBookings.findIndex(b => b._id === bookingId);
            if (providerIndex !== -1) {
              state.providerBookings[providerIndex] = updatedBooking;
            }

            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          // Rollback on failure (including timeout)
          set((state) => {
            state.customerBookings = previousCustomerBookings;
            state.providerBookings = previousProviderBookings;
            state.currentBooking = previousCurrentBooking;
            state.providerBookingsStats = previousStats;
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to cancel booking',
              code: 'CANCEL_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      rescheduleBooking: async (bookingId: string, newDate: string, newTime: string, reason?: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        // Store previous state for rollback
        const previousCustomerBookings = [...get().customerBookings];
        const previousProviderBookings = [...get().providerBookings];
        const previousCurrentBooking = get().currentBooking;

        // Optimistic update - update local state immediately
        set((state) => {
          // Update in customer bookings
          const customerIndex = state.customerBookings.findIndex(b => b._id === bookingId);
          if (customerIndex !== -1) {
            state.customerBookings[customerIndex] = {
              ...state.customerBookings[customerIndex],
              scheduledDate: newDate,
              scheduledTime: newTime
            };
          }

          // Update in provider bookings
          const providerIndex = state.providerBookings.findIndex(b => b._id === bookingId);
          if (providerIndex !== -1) {
            state.providerBookings[providerIndex] = {
              ...state.providerBookings[providerIndex],
              scheduledDate: newDate,
              scheduledTime: newTime
            };
          }

          // Update current booking if it matches
          if (state.currentBooking?._id === bookingId) {
            state.currentBooking = {
              ...state.currentBooking,
              scheduledDate: newDate,
              scheduledTime: newTime
            };
          }
        });

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          // Wrap with timeout to handle hanging requests
          const timeoutError = new Error('Reschedule booking request timed out');
          const response = await withTimeout(
            bookingService.rescheduleBooking(bookingId, { scheduledDate: newDate, scheduledTime: newTime, reason }),
            OPTIMISTIC_UPDATE_TIMEOUT_MS,
            timeoutError
          );
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update with server response
            const customerIndex = state.customerBookings.findIndex(b => b._id === bookingId);
            if (customerIndex !== -1) {
              state.customerBookings[customerIndex] = updatedBooking;
            }

            const providerIndex = state.providerBookings.findIndex(b => b._id === bookingId);
            if (providerIndex !== -1) {
              state.providerBookings[providerIndex] = updatedBooking;
            }

            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          // Rollback on failure (including timeout)
          set((state) => {
            state.customerBookings = previousCustomerBookings;
            state.providerBookings = previousProviderBookings;
            state.currentBooking = previousCurrentBooking;
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to reschedule booking',
              code: 'RESCHEDULE_BOOKING_ERROR'
            }];
          });
          throw error;
        }
      },

      addBookingMessage: async (bookingId: string, message: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          const response = await bookingService.addBookingMessage(bookingId, { message });
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update in customer bookings
            const customerIndex = state.customerBookings.findIndex(b => b._id === bookingId);
            if (customerIndex !== -1) {
              state.customerBookings[customerIndex] = updatedBooking;
            }

            // Update in provider bookings
            const providerIndex = state.providerBookings.findIndex(b => b._id === bookingId);
            if (providerIndex !== -1) {
              state.providerBookings[providerIndex] = updatedBooking;
            }

            // Update current booking if it matches
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }
          });
        } catch (error) {
          set((state) => {
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to add message',
              code: 'ADD_MESSAGE_ERROR'
            }];
          });
          throw error;
        }
      },

      markMessagesRead: async (bookingId: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          const response = await bookingService.markMessagesRead(bookingId);
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update in customer bookings
            const customerIndex = state.customerBookings.findIndex(b => b._id === bookingId);
            if (customerIndex !== -1) {
              state.customerBookings[customerIndex] = updatedBooking;
            }

            // Update in provider bookings
            const providerIndex = state.providerBookings.findIndex(b => b._id === bookingId);
            if (providerIndex !== -1) {
              state.providerBookings[providerIndex] = updatedBooking;
            }

            // Update current booking if it matches
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }
          });
        } catch (error) {
          logger.error('Failed to mark messages as read', { error });
          set((state) => {
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to mark messages as read',
              code: 'MARK_MESSAGES_READ_ERROR'
            }];
          });
        }
      },

      // Availability Actions
      getProviderAvailability: async (providerId?: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await bookingService.getProviderAvailability();

          set((state) => {
            state.providerAvailability = response.data.availability;
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to get availability',
              code: 'GET_AVAILABILITY_ERROR'
            }];
          });
        }
      },

      updateWeeklySchedule: async (weeklySchedule: ProviderAvailability['weeklySchedule']): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.updateWeeklySchedule(weeklySchedule);

          set((state) => {
            state.providerAvailability = response.data.availability;
            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to update schedule',
              code: 'UPDATE_SCHEDULE_ERROR'
            }];
          });
          throw error;
        }
      },

      updateAvailabilitySettings: async (settings: AvailabilitySettingsUpdate): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.updateAvailabilitySettings(settings);

          set((state) => {
            state.providerAvailability = response.data.availability;
            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to update availability settings',
              code: 'UPDATE_SETTINGS_ERROR'
            }];
          });
          throw error;
        }
      },

      addDateOverride: async (override: {
        date: string;
        isAvailable: boolean;
        reason?: string;
        timeSlots?: Array<{ start: string; end: string; isActive: boolean }>;
        notes?: string;
      }): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.addDateOverride(override);

          set((state) => {
            state.providerAvailability = response.data.availability;
            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to add date override',
              code: 'ADD_OVERRIDE_ERROR'
            }];
          });
          throw error;
        }
      },

      removeDateOverride: async (date: string): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.removeDateOverride(date);

          set((state) => {
            state.providerAvailability = response.data.availability;
            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to remove date override',
              code: 'REMOVE_OVERRIDE_ERROR'
            }];
          });
          throw error;
        }
      },

      getAvailableSlots: async (providerId: string, params: {
        date: string;
        duration: number;
        days?: number;
        serviceId?: string;
      }): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await bookingService.getAvailableSlots(providerId, params);

          set((state) => {
            state.availableSlots = response.data.slots;
            if (typeof response.data.minBookingAdvanceHours === 'number') {
              state.minBookingAdvanceHours = response.data.minBookingAdvanceHours;
            }
            state.isLoading = false;
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to get available slots',
              code: 'GET_SLOTS_ERROR'
            }];
          });
        }
      },

      checkSlotAvailability: async (providerId: string, params: {
        date: string;
        time: string;
        duration: number;
      }): Promise<boolean> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          const response = await bookingService.checkSlotAvailability(providerId, params);
          return response.data.isAvailable;
        } catch (error) {
          set((state) => {
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to check slot availability',
              code: 'CHECK_SLOT_ERROR'
            }];
          });
          return false;
        }
      },

      // Utility actions
      clearErrors: () => {
        set((state) => {
          state.errors = [];
        });
      },

      setError: (error: BookingError) => {
        set((state) => {
          state.errors = [error];
        });
      },

      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading;
        });
      },

      setSubmitting: (submitting: boolean) => {
        set((state) => {
          state.isSubmitting = submitting;
        });
      },

      clearCurrentBooking: () => {
        set((state) => {
          state.currentBooking = null;
        });
      },

      clearBookings: () => {
        set((state) => {
          state.customerBookings = [];
          state.providerBookings = [];
          state.currentBooking = null;
          state.customerBookingsPagination = null;
          state.providerBookingsPagination = null;
          state.availableSlots = [];
        });
      },
    })),
    {
      name: 'booking-storage',
      version: 1,
      storage: createJSONStorage(() => capacitorStorageAdapter),
      partialize: (state) => ({
        // Persist booking data for better UX across sessions
        // Limit to MAX_PERSISTED_BOOKINGS to prevent storage quota issues
        customerBookings: state.customerBookings.slice(0, MAX_PERSISTED_BOOKINGS),
        providerBookings: state.providerBookings.slice(0, MAX_PERSISTED_BOOKINGS),
        currentBooking: state.currentBooking,
        customerBookingsPagination: state.customerBookingsPagination,
        providerBookingsPagination: state.providerBookingsPagination,
      }),
    }
  )
);

export { useBookingStore as default };