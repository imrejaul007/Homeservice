import authService from './AuthService';

// ==========================================
// BOOKING TYPES & INTERFACES
// ==========================================

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

export interface BookingCustomerInfo {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  specialRequests?: string;
  accessInstructions?: string;
}

export interface BookingAddOn {
  name: string;
  price: number;
  description?: string;
}

export interface CreateBookingData {
  serviceId: string;
  providerId: string;
  scheduledDate: string; // YYYY-MM-DD format
  scheduledTime: string; // HH:MM format
  location?: BookingLocation;
  customerInfo?: BookingCustomerInfo;
  addOns?: BookingAddOn[];
  notes?: string;

  // New booking flow fields
  locationType?: 'at_home' | 'hotel';
  selectedDuration?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';
  paymentMethod?: 'apple_pay' | 'credit_card' | 'cash';
}

export interface Booking {
  _id: string;
  bookingNumber: string;
  customerId: string;
  providerId: string;
  serviceId: string;

  // Scheduling
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number;
  actualDuration?: number;

  // Status
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  statusHistory: Array<{
    status: string;
    timestamp: string;
    updatedBy: string;
    notes?: string;
  }>;

  // Status timestamps
  confirmedAt?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;

  // Address field for backward compatibility
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  // Location & Details
  location: BookingLocation;
  customerInfo: BookingCustomerInfo;

  // Pricing
  pricing: {
    basePrice: number;
    addOns: BookingAddOn[];
    subtotal: number;
    taxes: number;
    total: number;
    totalAmount: number; // Add missing totalAmount property
    currency: string;
  };

  // Service Info (populated)
  service?: {
    _id: string;
    name: string;
    description: string;
    category: string;
    subcategory?: string;
    duration: number;
    price: {
      amount: number;
      currency: string;
      type: string;
    };
  };

  // Provider Info (populated)
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
    businessInfo?: {
      businessName: string;
      businessType: string;
    };
  };

  // Customer Info (populated)
  customer?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    avatar?: string;
  };

  // Communication
  messages: Array<{
    _id: string;
    senderId: string;
    senderType: 'customer' | 'provider';
    message: string;
    timestamp: string;
    readBy: Array<{
      userId: string;
      readAt: string;
    }>;
  }>;

  // Payment
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'failed';
  paymentMethod?: string;

  // New booking flow fields
  locationType?: 'at_home' | 'hotel';
  selectedDuration?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';

  // Reviews & Ratings
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

  // Provider Response
  providerResponse?: {
    status: 'pending' | 'accepted' | 'rejected';
    message?: string;
    estimatedArrival?: string;
    notes?: string;
    respondedAt?: string;
    completedAt?: string;
    arrivalTime?: string;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface BookingMessage {
  message: string;
}

export interface BookingAcceptData {
  notes?: string;
  estimatedArrival?: string; // ISO string
}

export interface BookingCompleteData {
  notes?: string;
  actualDuration?: number; // in minutes
}

export interface BookingCancelData {
  reason: string;
  notes?: string;
}

export interface ProviderAvailability {
  _id: string;
  providerId: string;
  weeklySchedule: {
    [key: string]: {
      isAvailable: boolean;
      timeSlots: Array<{
        start: string;
        end: string;
        isActive: boolean;
      }>;
    };
  };
  dateOverrides: Array<{
    date: string;
    isAvailable: boolean;
    reason?: string;
    timeSlots?: Array<{
      start: string;
      end: string;
      isActive: boolean;
    }>;
    notes?: string;
  }>;
  timezone: string;
  bufferTime: number;
  autoAcceptBookings: boolean;
  maxAdvanceBookingDays: number;
}

export interface AvailableSlot {
  date: string;
  time: string;
  duration: number;
  isAvailable: boolean;
  conflictingBookings?: string[];
}

export interface BookingFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  providerId?: string;
  serviceId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BookingResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * Booking Service - Complete booking lifecycle management
 * Handles booking creation, management, availability checking, and communication
 */
class BookingService {

  // ==========================================
  // BOOKING CRUD OPERATIONS
  // ==========================================

  /**
   * Create a new booking
   */
  async createBooking(data: CreateBookingData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.post<BookingResponse<{ booking: Booking }>>('/bookings', data);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create booking');
    }
  }

  /**
   * Get booking details by ID
   */
  async getBooking(bookingId: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.get<BookingResponse<{ booking: Booking }>>(`/bookings/${bookingId}`);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get booking');
    }
  }

  /**
   * Get customer bookings with filters
   */
  async getCustomerBookings(filters?: BookingFilters): Promise<BookingResponse<{ bookings: Booking[] }>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/bookings/customer${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<BookingResponse<{ bookings: Booking[] }>>(url);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get customer bookings');
    }
  }

  /**
   * Get provider bookings with filters
   */
  async getProviderBookings(filters?: BookingFilters): Promise<BookingResponse<{ bookings: Booking[] }>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/bookings/provider${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<BookingResponse<{ bookings: Booking[] }>>(url);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get provider bookings');
    }
  }

  // ==========================================
  // BOOKING STATUS MANAGEMENT
  // ==========================================

  /**
   * Provider accepts a booking
   */
  async acceptBooking(bookingId: string, data?: BookingAcceptData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/accept`,
        data || {}
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to accept booking');
    }
  }

  /**
   * Provider rejects a booking
   */
  async rejectBooking(bookingId: string, data: BookingCancelData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/reject`,
        data
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to reject booking');
    }
  }

  /**
   * Start a booking (provider marks as in-progress)
   */
  async startBooking(bookingId: string, notes?: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/start`,
        { notes }
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to start booking');
    }
  }

  /**
   * Complete a booking (provider marks as completed)
   */
  async completeBooking(bookingId: string, data?: BookingCompleteData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/complete`,
        data || {}
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to complete booking');
    }
  }

  /**
   * Cancel a booking (customer or provider)
   */
  async cancelBooking(bookingId: string, data: BookingCancelData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/cancel`,
        data
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to cancel booking');
    }
  }

  // ==========================================
  // BOOKING COMMUNICATION
  // ==========================================

  /**
   * Add a message to a booking
   */
  async addBookingMessage(bookingId: string, data: BookingMessage): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.post<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/messages`,
        data
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to add message');
    }
  }

  /**
   * Mark booking messages as read
   */
  async markMessagesRead(bookingId: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<BookingResponse<{ booking: Booking }>>(
        `/bookings/${bookingId}/messages/read`,
        {}
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to mark messages as read');
    }
  }

  // ==========================================
  // AVAILABILITY MANAGEMENT
  // ==========================================

  /**
   * Get provider availability schedule
   */
  async getProviderAvailability(providerId?: string): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const url = providerId ? `/availability/provider/${providerId}` : '/availability';
      const response = await authService.get<BookingResponse<{ availability: ProviderAvailability }>>(url);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get availability');
    }
  }

  /**
   * Update provider weekly schedule
   */
  async updateWeeklySchedule(weeklySchedule: ProviderAvailability['weeklySchedule']): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const response = await authService.put<BookingResponse<{ availability: ProviderAvailability }>>(
        '/availability/schedule',
        { weeklySchedule }
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update schedule');
    }
  }

  /**
   * Add date override to availability
   */
  async addDateOverride(override: {
    date: string;
    isAvailable: boolean;
    reason?: string;
    timeSlots?: Array<{ start: string; end: string; isActive: boolean }>;
    notes?: string;
  }): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const response = await authService.post<BookingResponse<{ availability: ProviderAvailability }>>(
        '/availability/override',
        override
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to add date override');
    }
  }

  /**
   * Remove date override
   */
  async removeDateOverride(date: string): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const response = await authService.delete<BookingResponse<{ availability: ProviderAvailability }>>(
        `/availability/override/${date}`
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to remove date override');
    }
  }

  /**
   * Get available time slots for a provider
   */
  async getAvailableSlots(
    providerId: string,
    params: {
      date: string;
      duration: number;
      days?: number;
    }
  ): Promise<BookingResponse<{ slots: AvailableSlot[] }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      const response = await authService.get<BookingResponse<{ slots: string[] }>>(
        `/availability/provider/${providerId}/slots?${searchParams.toString()}`
      );

      // Transform backend response (array of time strings) to AvailableSlot objects
      const transformedSlots: AvailableSlot[] = response.data.slots.map((timeString: string) => ({
        date: params.date,
        time: timeString,
        duration: params.duration,
        isAvailable: true
      }));

      return {
        ...response,
        data: {
          slots: transformedSlots
        }
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get available slots');
    }
  }

  /**
   * Check if a specific time slot is available
   */
  async checkSlotAvailability(
    providerId: string,
    params: {
      date: string;
      time: string;
      duration: number;
    }
  ): Promise<BookingResponse<{ isAvailable: boolean; conflictingBookings?: string[] }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });

      const response = await authService.get<BookingResponse<{ isAvailable: boolean; conflictingBookings?: string[] }>>(
        `/availability/provider/${providerId}/check?${searchParams.toString()}`
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to check slot availability');
    }
  }

  // ==========================================
  // ANALYTICS & REPORTING
  // ==========================================

  /**
   * Get booking analytics for provider
   */
  async getBookingAnalytics(params?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<BookingResponse<any>> {
    try {
      const searchParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value) searchParams.append(key, String(value));
        });
      }

      const url = `/bookings/analytics${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await authService.get<BookingResponse<any>>(url);
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get booking analytics');
    }
  }

  /**
   * Get availability analytics for provider
   */
  async getAvailabilityAnalytics(): Promise<BookingResponse<any>> {
    try {
      const response = await authService.get<BookingResponse<any>>('/availability/analytics');
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get availability analytics');
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  /**
   * Format booking number for display
   */
  formatBookingNumber(bookingNumber: string): string {
    return bookingNumber.toUpperCase();
  }

  /**
   * Get booking status color
   */
  getStatusColor(status: Booking['status']): string {
    const colors = {
      pending: 'text-yellow-600 bg-yellow-100',
      confirmed: 'text-blue-600 bg-blue-100',
      in_progress: 'text-purple-600 bg-purple-100',
      completed: 'text-green-600 bg-green-100',
      cancelled: 'text-red-600 bg-red-100',
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  }

  /**
   * Get booking status label
   */
  getStatusLabel(status: Booking['status']): string {
    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return labels[status] || status;
  }

  /**
   * Calculate total booking price including add-ons
   */
  calculateTotalPrice(basePrice: number, addOns: BookingAddOn[], taxRate: number = 0): number {
    const addOnTotal = addOns.reduce((sum, addon) => sum + addon.price, 0);
    const subtotal = basePrice + addOnTotal;
    const taxes = subtotal * taxRate;
    return subtotal + taxes;
  }

  /**
   * Format booking date for display
   */
  formatBookingDate(date: string, time: string): string {
    const bookingDate = new Date(`${date}T${time}`);
    return bookingDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Check if booking can be cancelled
   */
  canCancelBooking(booking: Booking): boolean {
    const now = new Date();
    const bookingDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Can cancel if status allows and it's more than 24 hours before booking
    return ['pending', 'confirmed'].includes(booking.status) && hoursUntilBooking > 24;
  }

  /**
   * Check if booking can be modified
   */
  canModifyBooking(booking: Booking): boolean {
    const now = new Date();
    const bookingDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Can modify if status allows and it's more than 48 hours before booking
    return ['pending', 'confirmed'].includes(booking.status) && hoursUntilBooking > 48;
  }
}

// Export singleton instance
export const bookingService = new BookingService();
export default bookingService;