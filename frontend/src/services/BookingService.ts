import authService from './AuthService';

// ==========================================
// BOOKING TYPES & INTERFACES
// ==========================================
// Types imported from shared types file to ensure consistency across services
import type {
  Booking,
  BookingLocation,
  BookingCustomerInfo,
  BookingAddOn,
  CreateBookingData,
  CreateGuestBookingData,
  GuestInfo,
  BookingMessage,
  BookingAcceptData,
  BookingCompleteData,
  BookingCancelData,
  BookingFilters,
  BookingResponse,
  BookingTrackingData,
  ProviderAvailability,
  AvailabilitySettingsUpdate,
  AvailableSlot,
  BlockTimePeriodData,
  ProviderBookingsStats,
  RescheduleBookingData,
  BookingStatus,
  PaymentStatus,
  BookingPricing,
  UpdateBookingData,
  GetBookingsOptions,
} from '../types/booking.types';

// Re-export types for external use
export type {
  Booking,
  BookingLocation,
  BookingCustomerInfo,
  BookingAddOn,
  CreateBookingData,
  CreateGuestBookingData,
  GuestInfo,
  BookingMessage,
  BookingAcceptData,
  BookingCompleteData,
  BookingCancelData,
  BookingFilters,
  BookingResponse,
  BookingTrackingData,
  ProviderAvailability,
  AvailabilitySettingsUpdate,
  AvailableSlot,
  BlockTimePeriodData,
  ProviderBookingsStats,
  RescheduleBookingData,
  BookingStatus,
  PaymentStatus,
  BookingPricing,
  UpdateBookingData,
  GetBookingsOptions,
};

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
      console.log('[BookingService] POST /bookings', {
        serviceId: data.serviceId,
        providerId: data.providerId || '(auto-assign)',
        scheduledDate: data.scheduledDate,
        scheduledTime: data.scheduledTime,
        couponCode: data.couponCode, // DEBUG: Check if coupon is being sent
        hasMetadata: Boolean(data.metadata?.idempotencyKey),
      });
      const response = await authService.post<any>('/bookings', data);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
        if (response.data.isDuplicate) {
          response.data.booking.isDuplicate = true;
        }
      }
      return response as BookingResponse<{ booking: Booking; isDuplicate?: boolean }>;
    } catch (error) {
      console.error('[BookingService] createBooking failed', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create booking');
    }
  }

  /**
   * Create a guest booking (no authentication required)
   */
  async createGuestBooking(data: CreateGuestBookingData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.post<any>('/bookings/guest', data);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to create guest booking');
    }
  }

  /**
   * Get booking details by ID
   */
  async getBooking(bookingId: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.get<any>(`/bookings/${bookingId}`);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get booking');
    }
  }

  /**
   * Track a booking by booking number (public endpoint, no auth required)
   */
  async trackBooking(bookingNumber: string): Promise<BookingResponse<{ booking: BookingTrackingData }>> {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${baseUrl}/bookings/track/${encodeURIComponent(bookingNumber)}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to track booking: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to track booking');
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
            // Map frontend filter names to backend API names
            const backendKey = this.mapFilterKeyToBackend(key);
            params.append(backendKey, String(value));
          }
        });
      }

      const url = `/bookings/customer${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<any>(url);

      // Transform backend response to match frontend expectations
      return this.transformBookingResponse(response);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get customer bookings');
    }
  }

  /**
   * Map frontend filter keys to backend API parameter names
   * Note: startDate/endDate are now aligned with backend, no mapping needed
   */
  private mapFilterKeyToBackend(key: string): string {
    // startDate and endDate are now aligned with backend API
    // Only sort-related keys need passthrough mapping
    const keyMap: Record<string, string> = {
      sortBy: 'sortBy',
      sortOrder: 'sortOrder',
      search: 'search',
    };
    return keyMap[key] || key;
  }

  /**
   * Transform a single booking from backend format to frontend format
   * Handles field name mismatches, type conversions, and missing fields
   */
  private transformBooking(booking: any): Booking {
    if (!booking) return booking;

    // Helper to convert Date or string to ISO string
    const toIsoString = (value: any): string | undefined => {
      if (!value) return undefined;
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string') return value;
      return String(value);
    };

    // Helper to convert ObjectId or string to string
    const toStringId = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'object' && value._bsontype === 'ObjectId') return value.toString();
      if (typeof value === 'object' && value.$oid) return value.$oid;
      return String(value);
    };

    // Helper to transform coordinates from GeoJSON { type: 'Point', coordinates: [lng, lat] }
    // to frontend format { lat, lng }
    const transformCoordinates = (coords: any): { lat: number; lng: number } | undefined => {
      if (!coords) return undefined;
      // Already in frontend format { lat, lng }
      if (typeof coords.lat === 'number' && typeof coords.lng === 'number') {
        return { lat: coords.lat, lng: coords.lng };
      }
      // GeoJSON format { type: 'Point', coordinates: [lng, lat] }
      if (coords.type === 'Point' && Array.isArray(coords.coordinates)) {
        return { lng: coords.coordinates[0], lat: coords.coordinates[1] };
      }
      return undefined;
    };

    // Extract payment status from nested structure (payment.status) or use flat field
    const paymentStatus = booking.payment?.status || booking.paymentStatus || 'pending';

    // Build address from location.address for backward compatibility
    const addressFromLocation = booking.location?.address;

    // Transform the booking object
    const transformed: Booking = {
      _id: toStringId(booking._id),
      bookingNumber: booking.bookingNumber || '',

      // Issue #4: Convert ObjectIds to strings
      customerId: toStringId(booking.customerId),
      providerId: toStringId(booking.providerId),
      serviceId: toStringId(booking.serviceId),

      // Issue #1: Map backend 'duration' to frontend 'estimatedDuration'
      // Issue #2: Convert scheduledDate from Date to string (ISO)
      scheduledDate: toIsoString(booking.scheduledDate) || booking.scheduledDate,
      scheduledTime: booking.scheduledTime || '',
      estimatedDuration: booking.duration || booking.estimatedDuration || 0,
      actualDuration: booking.actualDuration,

      // Status
      status: booking.status || 'pending',
      statusHistory: (booking.statusHistory || []).map((h: any) => ({
        status: h.status,
        timestamp: toIsoString(h.timestamp) || h.timestamp,
        updatedBy: toStringId(h.updatedBy),
        notes: h.notes,
      })),

      // Status timestamps - Issue #2: Handle Date conversion
      confirmedAt: toIsoString(booking.confirmedAt),
      startedAt: toIsoString(
        booking.startedAt
          || booking.providerResponse?.arrivalTime
          || booking.statusHistory?.find((h: { status?: string }) => h.status === 'in_progress')?.timestamp
      ),
      completedAt: toIsoString(booking.completedAt),
      cancelledAt: toIsoString(booking.cancelledAt),
      cancellationReason: booking.cancellationReason,

      // Issue #6: Build address field for backward compatibility from location.address
      address: booking.address || (addressFromLocation ? {
        street: addressFromLocation.street,
        city: addressFromLocation.city,
        state: addressFromLocation.state,
        zipCode: addressFromLocation.zipCode,
        country: addressFromLocation.country,
      } : undefined),

      // Location & Details - transform coordinates from GeoJSON format if needed
      location: booking.location ? {
        ...booking.location,
        address: booking.location.address ? {
          ...booking.location.address,
          coordinates: transformCoordinates(booking.location.address.coordinates),
        } : undefined,
      } : {},
      customerInfo: booking.customerInfo || {},

      // Pricing - Normalize legacy fields and ensure consistency
      // Legacy 'taxes' -> primary 'tax', Legacy 'total' -> primary 'totalAmount'
      pricing: {
        basePrice: booking.pricing?.basePrice ?? 0,
        addOns: booking.pricing?.addOns,
        discounts: booking.pricing?.discounts,
        subtotal: booking.pricing?.subtotal ?? 0,
        tax: booking.pricing?.tax ?? booking.pricing?.taxes ?? 0,
        taxes: booking.pricing?.tax ?? booking.pricing?.taxes ?? 0, // @deprecated Use 'tax' instead
        totalAmount: booking.pricing?.totalAmount ?? booking.pricing?.total ?? 0,
        total: booking.pricing?.totalAmount ?? booking.pricing?.total ?? 0, // @deprecated Use 'totalAmount' instead
        currency: booking.pricing?.currency ?? 'AED',
        couponDiscount: booking.pricing?.couponDiscount ?? 0,
      },

      // Service Info (populated via virtual or serviceId populate)
      service: (() => {
        const raw = booking.service
          || (typeof booking.serviceId === 'object' && booking.serviceId?.name ? booking.serviceId : null)
          || (booking.metadata?.packageName
            ? {
                _id: booking.serviceId,
                name: booking.metadata.packageName,
                category: booking.metadata.packageCategory || 'Package',
              }
            : null);
        if (!raw) return undefined;
        return {
          _id: toStringId(raw._id),
          name: raw.name,
          description: raw.description,
          category: raw.category,
          subcategory: raw.subcategory,
          duration: raw.duration,
          images: raw.images,
          price: raw.price,
        };
      })(),

      // Provider Info (populated)
      provider: (() => {
        const raw = booking.provider
          || (typeof booking.providerId === 'object' && booking.providerId?.firstName ? booking.providerId : null);
        if (!raw) return undefined;
        return {
          _id: toStringId(raw._id),
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email,
          phone: raw.phone,
          avatar: raw.avatar,
          rating: raw.rating ?? raw.reviewsData?.averageRating,
          businessInfo: raw.businessInfo,
        };
      })(),

      // Customer Info (populated)
      customer: booking.customer ? {
        _id: toStringId(booking.customer._id),
        firstName: booking.customer.firstName,
        lastName: booking.customer.lastName,
        email: booking.customer.email,
        phone: booking.customer.phone,
        avatar: booking.customer.avatar,
      } : undefined,

      // Communication - handle both frontend format (senderId/senderType) and backend format (from)
      messages: (booking.messages || []).map((m: any) => ({
        _id: toStringId(m._id),
        // Handle backend 'from' field (ObjectId) or frontend 'senderId'
        senderId: m.from ? toStringId(m.from) : toStringId(m.senderId),
        // Handle backend populated 'from' with senderType or direct senderType
        senderType: m.from?.senderType || m.senderType,
        message: m.message,
        timestamp: toIsoString(m.timestamp) || m.timestamp,
        readBy: (m.readBy || []).map((r: any) => ({
          userId: toStringId(r.userId),
          readAt: toIsoString(r.readAt) || r.readAt,
        })),
      })),

      // Issue #5: Extract paymentStatus from payment.status or use flat field
      paymentStatus: paymentStatus,
      paymentMethod: booking.paymentMethod || booking.payment?.method,

      // New booking flow fields
      locationType: booking.locationType,
      selectedDuration: booking.selectedDuration,
      professionalPreference: booking.professionalPreference,
      duration: booking.duration,
      isGuestBooking: booking.isGuestBooking,
      guestInfo: booking.guestInfo,

      // Reviews & Ratings - Issue #3: Handle Date conversion
      customerRating: booking.customerRating ? {
        rating: booking.customerRating.rating,
        review: booking.customerRating.review,
        ratedAt: toIsoString(booking.customerRating.ratedAt) || booking.customerRating.ratedAt,
      } : undefined,
      providerRating: booking.providerRating ? {
        rating: booking.providerRating.rating,
        review: booking.providerRating.review,
        ratedAt: toIsoString(booking.providerRating.ratedAt) || booking.providerRating.ratedAt,
      } : undefined,

      // Provider Response - Handle Date conversion and missing timestamps
      providerResponse: booking.providerResponse ? {
        status: booking.providerResponse.status,
        message: booking.providerResponse.message,
        estimatedArrival: toIsoString(booking.providerResponse.estimatedArrival),
        notes: booking.providerResponse.notes,
        respondedAt: toIsoString(booking.providerResponse.respondedAt),
        acceptedAt: toIsoString(booking.providerResponse.acceptedAt),
        rejectedAt: toIsoString(booking.providerResponse.rejectedAt),
        completedAt: toIsoString(booking.providerResponse.completedAt),
        arrivalTime: toIsoString(booking.providerResponse.arrivalTime),
      } : undefined,

      // ETA in minutes from provider estimated arrival when available
      etaMinutes: (() => {
        if (typeof booking.etaMinutes === 'number') return booking.etaMinutes;
        const etaSource = booking.providerResponse?.estimatedArrival;
        if (!etaSource) return undefined;
        const etaDate = new Date(etaSource);
        if (Number.isNaN(etaDate.getTime())) return undefined;
        return Math.max(0, Math.round((etaDate.getTime() - Date.now()) / (1000 * 60)));
      })(),

      // Issue #3: Convert createdAt/updatedAt from Date to string (ISO)
      createdAt: toIsoString(booking.createdAt) || booking.createdAt,
      updatedAt: toIsoString(booking.updatedAt) || booking.updatedAt,
    };

    return transformed;
  }

  /**
   * Transform backend response to frontend format
   * Backend returns: { success, data: { bookings: [], pagination: { hasMore, nextCursor, limit } } }
   * Frontend expects: { success, data: { bookings: [] }, pagination: { page, pages, total, limit } }
   */
  private transformBookingResponse(response: any): BookingResponse<{ bookings: Booking[] }> & {
    stats?: ProviderBookingsStats;
  } {
    const { success, data, message } = response;
    // Apply field transformations to each booking
    const rawBookings = data?.bookings || [];
    const bookings = rawBookings.map((b: any) => this.transformBooking(b));
    const pagination = data?.pagination;
    const stats = data?.stats as ProviderBookingsStats | undefined;

    let transformedPagination: BookingResponse<{ bookings: Booking[] }>['pagination'] = null;

    if (pagination) {
      if (typeof pagination.page === 'number' && typeof pagination.total === 'number') {
        transformedPagination = {
          page: pagination.page,
          limit: pagination.limit || 20,
          total: pagination.total,
          pages: pagination.pages || 1,
          hasMore: pagination.hasMore,
        };
      } else {
        transformedPagination = {
          page: 1,
          limit: pagination.limit || 20,
          total: pagination.hasMore
            ? (pagination.limit || 20) * 2
            : bookings.length,
          pages: pagination.hasMore ? 2 : 1,
          hasMore: pagination.hasMore,
          nextCursor: pagination.nextCursor,
        };
      }
    }

    return {
      success: success ?? true,
      data: { bookings },
      pagination: transformedPagination,
      stats,
      message,
    };
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
            // Map frontend filter names to backend API names
            const backendKey = this.mapFilterKeyToBackend(key);
            params.append(backendKey, String(value));
          }
        });
      }

      const url = `/bookings/provider${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<any>(url);

      // Transform backend response to match frontend expectations
      return this.transformBookingResponse(response);
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
      const response = await authService.patch<any>(`/bookings/${bookingId}/accept`, data || {});
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to accept booking');
    }
  }

  /**
   * Provider rejects a booking
   * Backend uses PATCH /bookings/:id/reject
   */
  async rejectBooking(bookingId: string, data: BookingCancelData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/reject`, data);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to reject booking');
    }
  }

  /**
   * Decline a booking (alias for rejectBooking)
   * Used by CalendarView.tsx and other components
   */
  async declineBooking(bookingId: string, reason?: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/reject`, { reason });
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to decline booking');
    }
  }

  /**
   * Start a booking (provider marks as in-progress)
   */
  async startBooking(bookingId: string, notes?: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/start`, { notes });
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to start booking');
    }
  }

  /**
   * Complete a booking (provider marks as completed)
   */
  async completeBooking(bookingId: string, data?: BookingCompleteData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/complete`, data || {});
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to complete booking');
    }
  }

  /**
   * Cancel a booking (customer or provider)
   */
  async cancelBooking(bookingId: string, data: BookingCancelData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/cancel`, data);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to cancel booking');
    }
  }

  /**
   * Reschedule a booking to a new date/time
   */
  async rescheduleBooking(bookingId: string, data: RescheduleBookingData): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/reschedule`, data);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to reschedule booking');
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
      const response = await authService.post<any>(`/bookings/${bookingId}/messages`, data);
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to add message');
    }
  }

  /**
   * Mark booking messages as read
   */
  async markMessagesRead(bookingId: string): Promise<BookingResponse<{ booking: Booking }>> {
    try {
      const response = await authService.patch<any>(`/bookings/${bookingId}/messages/read`, {});
      // Transform the booking if it exists
      if (response?.data?.booking) {
        response.data.booking = this.transformBooking(response.data.booking);
      }
      return response as BookingResponse<{ booking: Booking }>;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to mark messages as read');
    }
  }

  // ==========================================
  // AVAILABILITY MANAGEMENT
  // ==========================================

  /**
   * Get provider availability schedule
   * Note: Uses /availability endpoint (for current provider) or public endpoints for slot checking
   */
  async getProviderAvailability(): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      // Backend uses /availability for provider's own availability
      const response = await authService.get<BookingResponse<{ availability: ProviderAvailability }>>('/availability');
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
   * FIX: Issue #5 - Support both overrideId (preferred) and date (legacy fallback)
   */
  async removeDateOverride(overrideIdOrDate: string): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      // Check if this looks like a MongoDB ObjectId (24 hex chars) or a date string
      const isObjectId = /^[0-9a-fA-F]{24}$/.test(overrideIdOrDate);

      if (isObjectId) {
        // Use overrideId query parameter (preferred method)
        const response = await authService.delete<BookingResponse<{ availability: ProviderAvailability }>>(
          `/availability/override?overrideId=${overrideIdOrDate}`
        );
        return response;
      } else {
        // Legacy fallback: use date parameter
        const response = await authService.delete<BookingResponse<{ availability: ProviderAvailability }>>(
          `/availability/override?date=${overrideIdOrDate}`
        );
        return response;
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to remove date override');
    }
  }

  /**
   * Block a time period (provider marks unavailable for a date range)
   */
  async blockTimePeriod(data: BlockTimePeriodData): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const response = await authService.post<BookingResponse<{ availability: ProviderAvailability }>>(
        '/availability/block',
        data
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to block time period');
    }
  }

  /**
   * Update availability settings (buffer time, max advance booking, auto-accept, etc.)
   */
  async updateAvailabilitySettings(settings: AvailabilitySettingsUpdate): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const response = await authService.patch<BookingResponse<{ availability: ProviderAvailability }>>(
        '/availability/settings',
        settings
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update availability settings');
    }
  }

  /**
   * Remove a blocked time period
   */
  async removeBlockedPeriod(blockId: string): Promise<BookingResponse<{ availability: ProviderAvailability }>> {
    try {
      const response = await authService.delete<BookingResponse<{ availability: ProviderAvailability }>>(
        `/availability/block/${blockId}`
      );
      return response;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to remove blocked period');
    }
  }

  /**
   * Get available time slots for a provider
   * FIX: Issue #2 - Support serviceId parameter for per-service availability
   */
  async getAvailableSlots(
    providerId: string,
    params: {
      date: string;
      duration: number;
      days?: number;
      serviceId?: string; // Optional service ID for per-service availability
    }
  ): Promise<BookingResponse<{ slots: AvailableSlot[]; minBookingAdvanceHours?: number }>> {
    try {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });

      const response = await authService.get<BookingResponse<{
        slots: string[];
        minBookingAdvanceHours?: number;
      }>>(
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
          slots: transformedSlots,
          minBookingAdvanceHours: response.data.minBookingAdvanceHours,
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

  /**
   * Get blocked periods from provider availability
   * Filters dateOverrides where isAvailable is false
   */
  async getAvailabilityBlocking(): Promise<BookingResponse<{ blockedPeriods: Array<{ date: string; reason?: string }> }>> {
    try {
      const response = await this.getProviderAvailability();
      const availability = response.data?.availability;

      if (!availability) {
        return {
          success: true,
          data: { blockedPeriods: [] },
        };
      }

      // Filter dateOverrides to get only blocked periods (where isAvailable is false)
      const blockedPeriods = (availability.dateOverrides || [])
        .filter((override: { isAvailable: boolean; date: string; reason?: string }) => override.isAvailable === false)
        .map((override: { date: string; reason?: string }) => ({
          date: override.date,
          reason: override.reason,
        }));

      return {
        success: true,
        data: { blockedPeriods },
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to get blocked periods');
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
    const colors: Record<Booking['status'], string> = {
      pending: 'text-yellow-600 bg-yellow-100',
      confirmed: 'text-blue-600 bg-blue-100',
      in_progress: 'text-purple-600 bg-purple-100',
      completed: 'text-green-600 bg-green-100',
      cancelled: 'text-red-600 bg-red-100',
      no_show: 'text-orange-600 bg-orange-100',
      refunded: 'text-teal-600 bg-teal-100',
      rejected: 'text-red-600 bg-red-100',
    };
    return colors[status] || 'text-gray-600 bg-gray-100';
  }

  /**
   * Get booking status label
   */
  getStatusLabel(status: Booking['status']): string {
    const labels: Record<Booking['status'], string> = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
      no_show: 'No Show',
      refunded: 'Refunded',
      rejected: 'Rejected',
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
   * Check if booking can be rescheduled
   */
  canRescheduleBooking(booking: Booking): boolean {
    const now = new Date();
    const bookingDateTime = new Date(`${booking.scheduledDate}T${booking.scheduledTime}`);
    const hoursUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Can reschedule if status allows and it's more than 24 hours before booking
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