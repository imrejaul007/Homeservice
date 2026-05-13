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

export interface BookingMetadataDTO {
  bookingSource?: string;
  deviceType?: string;
  sessionId?: string;
}

// ============================================
// Booking Input DTOs
// ============================================

export interface BookingInputDTO {
  serviceId: string;
  providerId: string;
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
  professionalPreference?: 'no_preference' | 'specific' | 'any_experience';
  paymentMethod?: string;
  // Coupon/Promo
  couponCode?: string;
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
}

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  pages: number;
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
    discounts?: Array<{ type: string; amount: number; description: string }>;
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
}

export interface CancellationResult {
  booking: BookingResponse;
  refundAmount: number;
  refundProcessingTime: string;
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

export interface PaginatedBookingsResult {
  bookings: BookingResponse[];
  pagination: PaginationDTO;
}
