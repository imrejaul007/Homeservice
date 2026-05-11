import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  Booking,
  BookingFilters,
  CreateBookingData,
  ProviderAvailability,
  AvailableSlot,
  BookingAcceptData,
  BookingCompleteData,
  BookingCancelData,
  BookingMessage
} from '../services/BookingService';

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

  // Actions - Customer
  createBooking: (data: CreateBookingData) => Promise<Booking>;
  getCustomerBookings: (filters?: BookingFilters) => Promise<void>;

  // Actions - Provider
  getProviderBookings: (filters?: BookingFilters) => Promise<void>;
  acceptBooking: (bookingId: string, data?: BookingAcceptData) => Promise<void>;
  rejectBooking: (bookingId: string, data: BookingCancelData) => Promise<void>;
  startBooking: (bookingId: string, notes?: string) => Promise<void>;
  completeBooking: (bookingId: string, data?: BookingCompleteData) => Promise<void>;

  // Actions - Shared
  getBooking: (bookingId: string) => Promise<void>;
  cancelBooking: (bookingId: string, data: BookingCancelData) => Promise<void>;
  addBookingMessage: (bookingId: string, message: string) => Promise<void>;
  markMessagesRead: (bookingId: string) => Promise<void>;

  // Actions - Availability
  getProviderAvailability: (providerId?: string) => Promise<void>;
  updateWeeklySchedule: (weeklySchedule: ProviderAvailability['weeklySchedule']) => Promise<void>;
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
      isLoading: false,
      isSubmitting: false,
      errors: [],
      customerBookingsPagination: null,
      providerBookingsPagination: null,

      // Customer Actions
      createBooking: async (data: CreateBookingData): Promise<Booking> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.createBooking(data);
          const booking = response.data.booking;

          set((state) => {
            state.customerBookings.unshift(booking);
            state.currentBooking = booking;
            state.isSubmitting = false;
          });

          return booking;
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to create booking',
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

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.acceptBooking(bookingId, data);
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update in provider bookings
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }

            // Update current booking if it matches
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
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

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.rejectBooking(bookingId, data);
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update in provider bookings
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }

            // Update current booking if it matches
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
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

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.startBooking(bookingId, notes);
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update in provider bookings
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }

            // Update current booking if it matches
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
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

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.completeBooking(bookingId, data);
          const updatedBooking = response.data.booking;

          set((state) => {
            // Update in provider bookings
            const index = state.providerBookings.findIndex(b => b._id === bookingId);
            if (index !== -1) {
              state.providerBookings[index] = updatedBooking;
            }

            // Update current booking if it matches
            if (state.currentBooking?._id === bookingId) {
              state.currentBooking = updatedBooking;
            }

            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to complete booking',
              code: 'COMPLETE_BOOKING_ERROR'
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
          });
        } catch (error) {
          set((state) => {
            state.isLoading = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to get booking',
              code: 'GET_BOOKING_ERROR'
            }];
          });
        }
      },

      cancelBooking: async (bookingId: string, data: BookingCancelData): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isSubmitting = true;
            state.errors = [];
          });

          const response = await bookingService.cancelBooking(bookingId, data);
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

            state.isSubmitting = false;
          });
        } catch (error) {
          set((state) => {
            state.isSubmitting = false;
            state.errors = [{
              message: error instanceof Error ? error.message : 'Failed to cancel booking',
              code: 'CANCEL_BOOKING_ERROR'
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
          console.error('Failed to mark messages as read:', error);
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

          const response = await bookingService.getProviderAvailability(providerId);

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

      addDateOverride: async (override): Promise<void> => {
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

      getAvailableSlots: async (providerId: string, params): Promise<void> => {
        const bookingService = (await import('../services/BookingService')).default;

        try {
          set((state) => {
            state.isLoading = true;
            state.errors = [];
          });

          const response = await bookingService.getAvailableSlots(providerId, params);

          set((state) => {
            state.availableSlots = response.data.slots;
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

      checkSlotAvailability: async (providerId: string, params): Promise<boolean> => {
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist essential booking data, not loading states
        currentBooking: state.currentBooking,
      }),
    }
  )
);

export { useBookingStore as default };