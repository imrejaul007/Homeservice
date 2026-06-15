// ============================================
// Booking DTOs - Data Transfer Objects
// ============================================

export interface LocationDTO {
  type: 'customer_address' | 'provider_location' | 'hotel';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  notes?: string;
}

export interface CustomerInfoDTO {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  specialRequests?: string;
  accessInstructions?: string;
}

export interface AddOnDTO {
  id?: string;
  name: string;
  price: number;
  description?: string;
}

export type BookingAttributionSourceDTO =
  | 'organic'
  | 'search'
  | 'profile'
  | 'ad'
  | 'direct'
  | 'repeat';

export interface BookingMetadataDTO {
  bookingSource?: BookingAttributionSourceDTO | 'recommendation';
  adCampaignId?: string;
  referrer?: string;
  deviceType?: string;
  sessionId?: string;
  idempotencyKey?: string;
  /** Subcategory variant duration (minutes) — validated with variantPrice server-side */
  variantDuration?: number;
  /** Subcategory variant price — must match variantDuration; capped vs base service price */
  variantPrice?: number;
  selectedVariantIndex?: number;
}

// ============================================
// Booking Input DTOs
// ============================================

export interface BookingInputDTO {
  serviceId: string;
  /** Required unless platform auto-assignment is enabled */
  providerId?: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  location: LocationDTO;
  customerInfo?: CustomerInfoDTO;
  addOns?: AddOnDTO[];
  specialRequests?: string;
  metadata?: BookingMetadataDTO;
  // New booking flow fields
  locationType?: 'at_home' | 'at_provider' | 'at_hotel';
  selectedDuration?: number;
  professionalPreference?: 'male' | 'female' | 'no_preference';
  paymentMethod?: string;
  // Coupon/Promo
  couponCode?: string;
  /** Set from req.tenantId at controller layer */
  tenantId?: string;
}

export interface GuestInfoDTO {
  name: string;
  email: string;
  phone: string;
}

export interface GuestBookingInputDTO extends Omit<BookingInputDTO, 'customerInfo'> {
  guestInfo: GuestInfoDTO;
}

// ============================================
// Booking Filters DTOs
// ============================================

export interface BookingFiltersDTO {
  status?: string;
  page?: number;
  limit?: number;
  startDate?: string | Date;
  endDate?: string | Date;
  cursor?: string;
  // Sorting
  sortBy?: 'createdAt' | 'scheduledDate' | 'status' | 'totalAmount' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  // Search
  search?: string;
  // Category filter - filter by service category
  category?: string;
  /** Completed bookings without a customer review */
  reviewable?: boolean;
  /** Filter by service location city/emirate */
  city?: string;
}

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface CursorPaginationDTO {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

// ============================================
// Booking Response DTOs
// ============================================

export interface PricingDTO {
  basePrice: number;
  addOns: AddOnDTO[];
  discounts: any[];
  subtotal: number;
  tax: number;
  totalAmount: number;
  currency: string;
}

export interface BookingResponse {
  _id?: any;
  id?: any;
  bookingNumber?: string;
  customerId?: any;
  providerId?: any;
  serviceId?: any;
  scheduledDate?: any;
  scheduledTime?: string;
  duration?: number;
  status?: string;
  locationType?: string;
  pricing?: any;
  customerInfo?: any;
  isGuestBooking?: boolean;
  guestInfo?: any;
  createdAt?: any;
}

export interface BookingDetailResponse extends BookingResponse {
  service?: any;
  provider?: any;
  customer?: any;
  cancellationPolicy?: any;
  statusHistory?: any[];
}

export interface PublicBookingTrackingDTO {
  bookingNumber: string;
  status: string;
  statusHistory: Array<{
    status: string;
    timestamp: Date;
    reason?: string;
  }>;
  service?: {
    name: string;
    category: string;
    subcategory?: string;
    image?: string;
  };
  provider?: {
    name: string;
  };
  location?: {
    type: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    notes?: string;
  };
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  pricing: {
    basePrice?: number;
    addOns?: Array<{ name: string; price: number }>;
    discounts?: Array<{ type: string; code?: string; amount: number; description?: string }>;
    subtotal?: number;
    tax?: number;
    totalAmount: number;
    currency: string;
  };
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  isGuestBooking: boolean;
  createdAt: Date;
}

// ============================================
// Booking Action DTOs
// ============================================

export interface AcceptBookingDTO {
  notes?: string;
  estimatedArrival?: string;
}

export interface RejectBookingDTO {
  reason?: string;
}

export interface CancelBookingDTO {
  reason?: string;
}

export interface StartBookingDTO {
  notes?: string;
}

export interface CompleteBookingDTO {
  notes?: string;
  actualDuration?: number;
}

export interface AddMessageDTO {
  message: string;
}

// ============================================
// Booking Result DTOs
// ============================================

export interface BookingResult {
  booking: BookingResponse;
  message?: string;
  isDuplicate?: boolean;
}

export interface CancellationResult {
  booking: BookingResponse;
  refundAmount: number;
  refundProcessingTime: string;
  refundId?: string; // Added by atomic cancellation fix
}

/**
 * Cancellation request data
 * For registered users: requires customerId match
 * For guest users: requires email match or valid cancellationToken
 */
export interface CancellationDataDTO {
  reason?: string;
  // For guest booking cancellation
  cancellationToken?: string;
  email?: string;
}

export interface GuestBookingResult {
  booking: {
    bookingNumber: string;
    status: string;
    scheduledDate: Date;
    scheduledTime: string;
    duration: number;
    pricing: PricingDTO;
    guestInfo: {
      name: string;
      email: string;
    };
  };
  trackingUrl: string;
}

export interface ProviderBookingsStatsDTO {
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  no_show: number;
  total: number;
}

export interface PaginatedBookingsResult {
  bookings: BookingResponse[];
  pagination: CursorPaginationDTO & Partial<PaginationDTO>;
  stats?: ProviderBookingsStatsDTO;
}
