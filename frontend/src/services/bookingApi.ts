import { api } from './api';

// ============================================
// BOOKING TYPES
// ============================================

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';

export interface BookingLocation {
  type?: 'customer_address' | 'provider_location' | 'online';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  notes?: string;
}

export interface BookingPricing {
  basePrice: number;
  addOns?: Array<{ name: string; price: number; description?: string }>;
  subtotal: number;
  tax: number; // FIX: Backend uses 'tax' not 'taxes'
  totalAmount: number;
  total?: number; // Optional - some legacy code may use this
  currency: string;
}

export interface Booking {
  _id: string;
  id?: string;
  bookingNumber: string;
  customerId: string;
  providerId: string;
  serviceId: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number;
  actualDuration?: number;
  status: BookingStatus;
  location: BookingLocation;
  pricing: BookingPricing;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  service?: {
    _id: string;
    name: string;
    description?: string;
    category?: string;
    duration?: number;
    price?: { amount: number; currency: string };
  };
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
    rating?: number;
    businessInfo?: { businessName?: string; businessType?: string };
  };
  customer?: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    specialRequests?: string;
    accessInstructions?: string;
  };
  providerResponse?: {
    status: 'pending' | 'accepted' | 'rejected';
    message?: string;
    estimatedArrival?: string;
    notes?: string;
    respondedAt?: string;
  };
  customerRating?: {
    rating: number;
    review?: string;
    ratedAt: string;
  };
  providerRating?: {
    rating: number;
    review?: string;
    ratedAt: string;
  };
  etaMinutes?: number;
  distanceRemaining?: number;
  providerLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  };
  confirmedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingData {
  serviceId: string;
  providerId: string;
  scheduledDate: string;
  scheduledTime: string;
  location?: BookingLocation;
  customerInfo?: Booking['customerInfo'];
  addOns?: Array<{ name: string; price: number; description?: string }>;
  notes?: string;
  locationType?: 'at_home' | 'hotel';
  selectedDuration?: number;
  genderPreference?: 'male' | 'female' | 'no_preference';
  paymentMethod?: 'apple_pay' | 'credit_card' | 'cash';
  couponCode?: string;
}

export interface UpdateBookingData {
  scheduledDate?: string;
  scheduledTime?: string;
  location?: BookingLocation;
  customerInfo?: Booking['customerInfo'];
  notes?: string;
}

export interface GetBookingsOptions {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  dateFrom?: string;
  dateTo?: string;
  providerId?: string;
  customerId?: string;
  serviceId?: string;
  search?: string;
  sortBy?: 'scheduledDate' | 'createdAt' | 'total';
  sortOrder?: 'asc' | 'desc';
}

export interface BookingFilters {
  status?: BookingStatus | BookingStatus[];
  dateFrom?: string;
  dateTo?: string;
  providerId?: string;
  customerId?: string;
  serviceId?: string;
  minPrice?: number;
  maxPrice?: number;
}

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
    try {
      const response = await api.get('/bookings', { params: options });
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch bookings';
      const statusCode = err.response?.status;
      console.error('[bookingApi] getBookings error:', message, statusCode);
      throw new BookingApiError(message, statusCode, 'GET_BOOKINGS_FAILED');
    }
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
      const response = await api.post(`/bookings/${bookingId}/reschedule`, {
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
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize booking data (handles _id vs id inconsistencies)
 */
export function normalizeBooking(booking: Booking): Booking {
  return {
    ...booking,
    _id: booking._id || booking.id,
  };
}

/**
 * Format booking status for display
 */
export function formatBookingStatus(status: BookingStatus): string {
  const statusLabels: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
  };
  return statusLabels[status] || status;
}

/**
 * Check if booking can be cancelled
 */
export function canCancelBooking(booking: Booking): boolean {
  const cancellableStatuses: BookingStatus[] = ['pending', 'confirmed'];
  if (!cancellableStatuses.includes(booking.status)) return false;

  // Check if booking is more than 24 hours away
  const bookingDate = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
  const now = new Date();
  const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  return hoursUntilBooking > 0;
}

/**
 * Check if booking can be rescheduled
 */
export function canRescheduleBooking(booking: Booking): boolean {
  const reschedulableStatuses: BookingStatus[] = ['pending', 'confirmed'];
  if (!reschedulableStatuses.includes(booking.status)) return false;

  const bookingDate = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
  const now = new Date();
  const hoursUntilBooking = (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  return hoursUntilBooking > 0;
}

export default bookingApi;
