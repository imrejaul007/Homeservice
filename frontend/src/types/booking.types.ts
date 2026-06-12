/**
 * Shared Booking Types
 * Consolidated types used by both BookingService.ts and bookingApi.ts
 */

// ==========================================
// COORDINATE UTILITY TYPES & FUNCTIONS
// ==========================================

/**
 * Frontend coordinate format: { lat, lng }
 */
export interface FrontendCoordinates {
  lat: number;
  lng: number;
}

/**
 * Backend GeoJSON coordinate format: { type: 'Point', coordinates: [lng, lat] }
 */
export interface BackendGeoJSONCoordinates {
  type: 'Point';
  coordinates: [number, number]; // [lng, lat] format
}

/**
 * Normalize coordinates to backend GeoJSON format
 * Converts frontend { lat, lng } to backend { type: 'Point', coordinates: [lng, lat] }
 */
export function normalizeCoordinatesToBackend(coords?: FrontendCoordinates | BackendGeoJSONCoordinates | null): BackendGeoJSONCoordinates | undefined {
  if (!coords) return undefined;

  // Already in GeoJSON format
  if ('type' in coords && coords.type === 'Point' && Array.isArray(coords.coordinates)) {
    return coords as BackendGeoJSONCoordinates;
  }

  // Frontend format { lat, lng }
  if ('lat' in coords && 'lng' in coords && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
    return {
      type: 'Point',
      coordinates: [coords.lng, coords.lat] as [number, number]
    };
  }

  return undefined;
}

// ==========================================
// BOOKING STATUS TYPES
// ==========================================

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'refunded'
  | 'rejected';

export type PaymentStatus = 'pending' | 'completed' | 'refunded' | 'failed' | 'processed';

// ==========================================
// BOOKING LOCATION TYPE
// ==========================================

export interface BookingLocation {
  type?: 'customer_address' | 'provider_location' | 'online' | 'hotel';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    coordinates?: {
      lat: number;
      lng: number;
    } | {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat] format
    };
  };
  notes?: string;
}

// ==========================================
// BOOKING CUSTOMER INFO TYPE
// ==========================================

export interface BookingCustomerInfo {
  name?: string;  // Full name used by BookingForm
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  specialRequests?: string;
  accessInstructions?: string;
}

// ==========================================
// BOOKING ADD-ON TYPE
// ==========================================

export interface BookingAddOn {
  id?: string;
  name: string;
  price: number;
  description?: string;
}

// ==========================================
// BOOKING PRICING TYPE
// ==========================================

export interface BookingPricing {
  basePrice: number;
  addOns?: BookingAddOn[];
  discounts?: Array<{ code: string; amount: number; type: 'fixed' | 'percentage'; description?: string }>;
  couponDiscount?: number;
  subtotal: number;
  tax: number;      // Primary field used by backend
  taxes?: number;   // Legacy field - some code uses this
  totalAmount: number;
  total?: number;   // Legacy alias for totalAmount
  currency: string;
}

// ==========================================
// BOOKING TYPE (Main interface - unified from both services)
// ==========================================

export interface Booking {
  /** Set when the server returned an existing booking for the same idempotency key */
  isDuplicate?: boolean;
  _id: string;
  id?: string;  // Alternative ID field - normalize with _id

  // Booking identifiers
  bookingNumber: string;
  customerId?: string;  // Optional for guest bookings
  providerId?: string;  // Optional for certain booking types
  serviceId: string;

  // Scheduling
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration: number;
  actualDuration?: number;

  // Status
  status: BookingStatus;
  statusHistory?: Array<{
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

  // Address field for backward compatibility (separate from location)
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };

  // Location & Details
  location: BookingLocation;
  customerInfo?: BookingCustomerInfo;

  // Pricing
  pricing: BookingPricing;

  // Communication
  messages?: Array<{
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
  paymentStatus: PaymentStatus;
  paymentMethod?: string;

  // Service Info (populated)
  service?: {
    _id: string;
    name: string;
    description?: string;
    category?: string;
    subcategory?: string;
    duration?: number;
    images?: string[];
    price?: { amount: number; currency: string };
  };

  // Provider Info (populated)
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

  // Customer Info (populated)
  customer?: {
    _id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };

  // New booking flow fields
  locationType?: 'at_home' | 'at_provider' | 'at_hotel';
  selectedDuration?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';
  experiencePreference?: 'no_preference' | 'specific' | 'any_experience';
  duration?: number;
  isGuestBooking?: boolean;
  guestInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };

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
    acceptedAt?: string;
    rejectedAt?: string;
    completedAt?: string;
    arrivalTime?: string;
  };

  // Real-time tracking (bookingApi.ts specific)
  etaMinutes?: number;
  distanceRemaining?: number;
  providerLocation?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
  };

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// CREATE BOOKING DATA TYPE
// ==========================================

export interface CreateBookingData {
  serviceId: string;
  /** Omit when platform auto-assigns a provider */
  providerId?: string;
  scheduledDate: string; // YYYY-MM-DD format
  scheduledTime: string; // HH:MM format
  location: BookingLocation;
  customerInfo?: BookingCustomerInfo;
  addOns?: BookingAddOn[];
  notes?: string;

  // New booking flow fields
  locationType?: 'at_home' | 'at_provider' | 'at_hotel';
  selectedDuration?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';
  experiencePreference?: 'no_preference' | 'specific' | 'any_experience';
  paymentMethod?: 'apple_pay' | 'credit_card' | 'cash' | 'card' | 'wallet';

  // Coupon/Promo
  couponCode?: string;

  // Metadata for tracking and idempotency
  metadata: {
    idempotencyKey: string;
    bookingSource?: string;
    deviceType?: string;
    sessionId?: string;
    variantDuration?: number;
    variantPrice?: number;
    selectedVariantIndex?: number;
  };
}

// ==========================================
// CREATE GUEST BOOKING DATA TYPE
// ==========================================

export interface GuestInfo {
  name: string;
  email: string;
  phone: string;
}

export interface CreateGuestBookingData {
  serviceId: string;
  providerId: string;
  scheduledDate: string; // YYYY-MM-DD format
  scheduledTime: string; // HH:MM format
  location?: BookingLocation;
  guestInfo: GuestInfo;
  addOns?: BookingAddOn[];
  notes?: string;

  // New booking flow fields
  locationType?: 'at_home' | 'at_provider' | 'at_hotel';
  selectedDuration?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';
  experiencePreference?: 'no_preference' | 'specific' | 'any_experience';
  paymentMethod?: 'apple_pay' | 'credit_card' | 'cash' | 'card' | 'wallet';
}

// ==========================================
// UPDATE BOOKING DATA TYPE
// ==========================================

export interface UpdateBookingData {
  scheduledDate?: string;
  scheduledTime?: string;
  location?: BookingLocation;
  customerInfo?: BookingCustomerInfo;
  notes?: string;
}

// ==========================================
// BOOKING FILTERS TYPE
// ==========================================

export interface BookingFilters {
  status?: BookingStatus | BookingStatus[] | 'active';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
  providerId?: string;
  customerId?: string;
  serviceId?: string;
  minPrice?: number;
  maxPrice?: number;
}

// ==========================================
// GET BOOKINGS OPTIONS TYPE
// ==========================================

export interface GetBookingsOptions {
  page?: number;
  limit?: number;
  status?: BookingStatus;
  startDate?: string;
  endDate?: string;
  providerId?: string;
  customerId?: string;
  serviceId?: string;
  search?: string;
  sortBy?: 'scheduledDate' | 'createdAt' | 'total';
  sortOrder?: 'asc' | 'desc';
  reviewable?: boolean;
}

// ==========================================
// BOOKING RESPONSE TYPES
// ==========================================

export interface BookingResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore?: boolean;
    nextCursor?: string;
  };
  stats?: {
    pending: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    in_progress?: number;
    no_show?: number;
    total?: number;
  };
}

// ==========================================
// PROVIDER BOOKINGS STATS TYPE
// ==========================================

export interface ProviderBookingsStats {
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
  total: number;
}

// ==========================================
// BOOKING TRACKING DATA TYPE
// ==========================================

export interface BookingTrackingData {
  bookingId?: string;
  bookingNumber: string;
  status: BookingStatus;
  serviceName?: string;
  providerName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  location?: {
    address?: string;
  };
  pricing?: {
    totalAmount?: number;
    currency?: string;
  };
  providerLocation?: { lat: number; lng: number };
  etaMinutes?: number;
  distanceRemaining?: number;
}

// ==========================================
// AVAILABILITY TYPES
// ==========================================

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
  minNoticeTime?: number;
}

export interface AvailabilitySettingsUpdate {
  bufferTime?: number;
  maxAdvanceBookingDays?: number;
  autoAcceptBookings?: boolean;
  minNoticeTime?: number;
  timezone?: string;
}

export interface AvailableSlot {
  date: string;
  time: string;
  duration: number;
  isAvailable: boolean;
  conflictingBookings?: string[];
}

export interface BlockTimePeriodData {
  startDate: string; // YYYY-MM-DD format
  endDate: string; // YYYY-MM-DD format
  reason?: string;
}

// ==========================================
// BOOKING ACTION DATA TYPES
// ==========================================

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

export interface RescheduleBookingData {
  scheduledDate: string; // YYYY-MM-DD format
  scheduledTime: string; // HH:MM format
  reason?: string;
}

// ==========================================
// HELPER FUNCTION - Normalize booking (handles _id vs id)
// ==========================================

export function normalizeBooking(booking: Booking): Booking {
  return {
    ...booking,
    _id: booking._id || booking.id,
  };
}

// ==========================================
// HELPER FUNCTION - Format booking status
// ==========================================

export function formatBookingStatus(status: BookingStatus): string {
  const statusLabels: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
    refunded: 'Refunded',
    rejected: 'Rejected',
  };
  return statusLabels[status] || status;
}
