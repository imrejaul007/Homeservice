import { api } from './api';
import { AxiosError } from 'axios';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  const jitter = delay * 0.25 * Math.random();
  return Math.floor(delay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    if (!error.response) return true; // Network error
    if (error.response.status >= 500) return true; // Server error
    if (error.code === 'ECONNABORTED') return true; // Timeout
  }
  return false;
}

/**
 * Execute a function with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; context?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }
      const delay = getRetryDelay(attempt);
      console.warn(`[Retry] ${options.context || 'Operation'} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ============================================
// BOOKING TYPES
// ============================================
// Types imported from shared types file to ensure consistency across services
import type {
  Booking,
  BookingLocation,
  BookingCustomerInfo,
  BookingAddOn,
  BookingPricing,
  BookingStatus,
  PaymentStatus,
  CreateBookingData,
  UpdateBookingData,
  GetBookingsOptions,
  BookingFilters,
} from '../types/booking.types';

// Re-export helper functions and types from shared types
export type {
  Booking,
  BookingLocation,
  BookingCustomerInfo,
  BookingAddOn,
  BookingPricing,
  BookingStatus,
  PaymentStatus,
  CreateBookingData,
  UpdateBookingData,
  GetBookingsOptions,
  BookingFilters,
} from '../types/booking.types';

export { normalizeBooking, formatBookingStatus } from '../types/booking.types';

// ============================================
// BOOKING API SERVICE
// ============================================

export interface BookingApi {
  /**
   * Get all bookings with filtering and pagination
   */
  getBookings: (options?: GetBookingsOptions) => Promise<{
    bookings: Booking[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single booking by ID
   */
  getBooking: (bookingId: string) => Promise<{ booking: Booking }>;

  /**
   * Create a new booking
   */
  createBooking: (data: CreateBookingData) => Promise<{ booking: Booking }>;

  /**
   * Update an existing booking
   */
  updateBooking: (bookingId: string, data: UpdateBookingData) => Promise<{ booking: Booking }>;

  /**
   * Cancel a booking
   */
  cancelBooking: (bookingId: string, reason?: string) => Promise<{ booking: Booking }>;

  /**
   * Reschedule a booking
   */
  rescheduleBooking: (bookingId: string, newDate: string, newTime: string, reason?: string) => Promise<{ booking: Booking }>;

  /**
   * Accept a booking request (provider)
   */
  acceptBooking: (bookingId: string, message?: string) => Promise<{ booking: Booking }>;

  /**
   * Decline a booking request (provider)
   */
  declineBooking: (bookingId: string, reason?: string) => Promise<{ booking: Booking }>;

  /**
   * Start a booking (provider marks as in_progress)
   */
  startBooking: (bookingId: string) => Promise<{ booking: Booking }>;

  /**
   * Complete a booking
   */
  completeBooking: (bookingId: string, notes?: string) => Promise<{ booking: Booking }>;

  /**
   * Get booking tracking data (real-time)
   */
  getBookingTracking: (bookingId: string) => Promise<{
    bookingId: string;
    status: BookingStatus;
    providerLocation?: { lat: number; lng: number };
    etaMinutes?: number;
    distanceRemaining?: number;
  }>;

  /**
   * Rate a completed booking
   */
  rateBooking: (bookingId: string, rating: number, review?: string) => Promise<{ booking: Booking }>;

  /**
   * Get booking statistics
   */
  getBookingStats: (options?: { startDate?: string; endDate?: string }) => Promise<{
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    revenue: number;
  }>;

  /**
   * Get available time slots for a provider on a date
   */
  getAvailableSlots: (providerId: string, date: string, serviceId: string) => Promise<{
    slots: Array<{ time: string; available: boolean }>;
  }>;

  /**
   * Validate a coupon code
   */
  validateCoupon: (code: string, orderValue: number, serviceId?: string) => Promise<{
    valid: boolean;
    code: string;
    discountType?: 'fixed' | 'percentage';
    discountValue?: number;
    discountAmount?: number;
    message?: string;
  }>;

  /**
   * Apply a coupon to a booking
   */
  applyCoupon: (bookingId: string, code: string) => Promise<{ booking: Booking }>;

  /**
   * Remove a coupon from a booking
   */
  removeCoupon: (bookingId: string) => Promise<{ booking: Booking }>;
}

// Error class for booking API errors
export class BookingApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'BookingApiError';
  }
}

export const bookingApi: BookingApi = {
  /**
   * Get all bookings with filtering and pagination
   */
  getBookings: async (options = {}) => {
    return withRetry(
      async () => {
        const response = await api.get('/bookings/customer', { params: options });
        return response.data.data;
      },
      { context: 'getBookings' }
    ).catch((error: unknown) => {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch bookings';
      const statusCode = err.response?.status;
      throw new BookingApiError(message, statusCode, 'GET_BOOKINGS_FAILED');
    });
  },

  /**
   * Get a single booking by ID
   */
  getBooking: async (bookingId: string) => {
    try {
      const response = await api.get(`/bookings/${bookingId}`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] getBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'GET_BOOKING_FAILED');
    }
  },

  /**
   * Create a new booking
   */
  createBooking: async (data: CreateBookingData) => {
    try {
      const response = await api.post('/bookings', data);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to create booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] createBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'CREATE_BOOKING_FAILED');
    }
  },

  /**
   * Update an existing booking
   */
  updateBooking: async (bookingId: string, data: UpdateBookingData) => {
    try {
      const response = await api.patch(`/bookings/${bookingId}`, data);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to update booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] updateBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'UPDATE_BOOKING_FAILED');
    }
  },

  /**
   * Cancel a booking
   */
  cancelBooking: async (bookingId: string, reason?: string) => {
    try {
      // FIX: Backend expects PATCH not POST for cancel
      const response = await api.patch(`/bookings/${bookingId}/cancel`, { reason });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to cancel booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] cancelBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'CANCEL_BOOKING_FAILED');
    }
  },

  /**
   * Reschedule a booking
   */
  rescheduleBooking: async (bookingId: string, newDate: string, newTime: string, reason?: string) => {
    try {
      // FIX: Backend expects PATCH method, not POST
      const response = await api.patch(`/bookings/${bookingId}/reschedule`, {
        scheduledDate: newDate,
        scheduledTime: newTime,
        reason,
      });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to reschedule booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] rescheduleBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'RESCHEDULE_BOOKING_FAILED');
    }
  },

  /**
   * Accept a booking request (provider)
   */
  acceptBooking: async (bookingId: string, message?: string) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/accept`, { message });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to accept booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] acceptBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'ACCEPT_BOOKING_FAILED');
    }
  },

  /**
   * Decline a booking request (provider)
   */
  declineBooking: async (bookingId: string, reason?: string) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/decline`, { reason });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to decline booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] declineBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'DECLINE_BOOKING_FAILED');
    }
  },

  /**
   * Start a booking (provider marks as in_progress)
   */
  startBooking: async (bookingId: string) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/start`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to start booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] startBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'START_BOOKING_FAILED');
    }
  },

  /**
   * Complete a booking
   */
  completeBooking: async (bookingId: string, notes?: string) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/complete`, { notes });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to complete booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] completeBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'COMPLETE_BOOKING_FAILED');
    }
  },

  /**
   * Get booking tracking data (real-time)
   */
  getBookingTracking: async (bookingId: string) => {
    try {
      const response = await api.get(`/bookings/${bookingId}/tracking`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch booking tracking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] getBookingTracking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'GET_TRACKING_FAILED');
    }
  },

  /**
   * Rate a completed booking
   */
  rateBooking: async (bookingId: string, rating: number, review?: string) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/rate`, { rating, review });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to rate booking';
      const statusCode = err.response?.status;
      console.error('[bookingApi] rateBooking error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'RATE_BOOKING_FAILED');
    }
  },

  /**
   * Get booking statistics
   */
  getBookingStats: async (options = {}) => {
    try {
      const response = await api.get('/bookings/stats', { params: options });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch booking stats';
      const statusCode = err.response?.status;
      console.error('[bookingApi] getBookingStats error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'GET_STATS_FAILED');
    }
  },

  /**
   * Get available time slots for a provider on a date
   */
  getAvailableSlots: async (providerId: string, date: string, serviceId: string) => {
    try {
      const response = await api.get('/bookings/available-slots', {
        params: { providerId, date, serviceId },
      });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch available slots';
      const statusCode = err.response?.status;
      console.error('[bookingApi] getAvailableSlots error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'GET_SLOTS_FAILED');
    }
  },

  /**
   * Validate a coupon code
   */
  validateCoupon: async (code: string, orderValue: number, serviceId?: string) => {
    try {
      const response = await api.post('/coupons/validate', { code, orderValue, serviceId });
      const data = response.data.data;
      // Map backend response (discount) to frontend expected (discountAmount)
      return {
        ...data,
        discountAmount: data.discountAmount ?? data.discount,
        code: data.couponCode || code,
      };
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to validate coupon';
      const statusCode = err.response?.status;

      // Return a structured error response for invalid coupons
      if (statusCode === 400 || statusCode === 404) {
        return {
          valid: false,
          code,
          message: message || 'Invalid coupon code',
        };
      }

      console.error('[bookingApi] validateCoupon error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'VALIDATE_COUPON_FAILED');
    }
  },

  /**
   * Apply a coupon to a booking
   */
  applyCoupon: async (bookingId: string, code: string) => {
    try {
      const response = await api.post(`/bookings/${bookingId}/coupon`, { code });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to apply coupon';
      const statusCode = err.response?.status;
      console.error('[bookingApi] applyCoupon error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'APPLY_COUPON_FAILED');
    }
  },

  /**
   * Remove a coupon from a booking
   */
  removeCoupon: async (bookingId: string) => {
    try {
      const response = await api.delete(`/bookings/${bookingId}/coupon`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to remove coupon';
      const statusCode = err.response?.status;
      console.error('[bookingApi] removeCoupon error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'REMOVE_COUPON_FAILED');
    }
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

// Note: canCancelBooking and canRescheduleBooking are now consolidated in BookingService.ts
// to maintain a single source of truth with the 24-hour cancellation rule

export default bookingApi;
