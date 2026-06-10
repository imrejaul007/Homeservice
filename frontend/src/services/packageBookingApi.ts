/**
 * Package Booking API Service
 * Provides frontend API calls for package booking functionality
 */
import { api } from './api';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PackageBookingInput {
  scheduledDate: string;
  scheduledTime: string;
  location: {
    type: 'at_home' | 'at_provider' | 'at_hotel';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    notes?: string;
  };
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests?: string;
    accessInstructions?: string;
  };
  addOns: Array<{ id: string; name: string; price: number; quantity: number }>;
  selectedDuration?: number;
  professionalPreference: 'male' | 'female' | 'no_preference';
  paymentMethod: string;
  couponCode?: string;
  metadata: {
    bookingSource: string;
    deviceType?: string;
    sessionId?: string;
    idempotencyKey: string;
  };
}

export interface PackageBookingResponse {
  success: boolean;
  bookingId: string;
  bookingNumber: string;
  totalAmount: number;
  serviceBookings: Array<{
    serviceId: string;
    serviceName: string;
    bookingId: string;
    status: string;
  }>;
  scheduledDate: string;
  scheduledTime: string;
}

export interface PackageBookingDetails {
  bookingId: string;
  bookingNumber: string;
  packageId: string;
  packageName: string;
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  location: {
    type: 'at_home' | 'at_provider' | 'at_hotel';
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    notes?: string;
  };
  customerInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests?: string;
    accessInstructions?: string;
  };
  addOns: Array<{ id: string; name: string; price: number; quantity: number }>;
  selectedDuration?: number;
  professionalPreference: 'male' | 'female' | 'no_preference';
  paymentMethod: string;
  couponCode?: string;
  pricing: {
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
  };
  serviceBookings: Array<{
    serviceId: string;
    serviceName: string;
    bookingId: string;
    status: string;
    providerName?: string;
  }>;
  metadata: {
    bookingSource: string;
    deviceType?: string;
    sessionId?: string;
    idempotencyKey: string;
    createdAt: string;
    updatedAt: string;
  };
}

// ============================================
// ERROR CLASS
// ============================================

export class PackageBookingApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'PackageBookingApiError';
  }
}

// ============================================
// API SERVICE
// ============================================

export interface PackageBookingApi {
  bookPackage: (
    packageId: string,
    bookingData: PackageBookingInput
  ) => Promise<PackageBookingResponse>;
  getPackageBooking: (bookingId: string) => Promise<PackageBookingDetails>;
}

export const packageBookingApi: PackageBookingApi = {
  /**
   * Book a service package
   * Creates a new package booking with all included services
   */
  bookPackage: async (packageId: string, bookingData: PackageBookingInput): Promise<PackageBookingResponse> => {
    try {
      const response = await api.post(`/packages/${packageId}/book`, bookingData);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to book package';
      const statusCode = err.response?.status;
      console.error('[packageBookingApi] bookPackage error:', message, statusCode);
      throw new PackageBookingApiError(message, statusCode, 'BOOK_PACKAGE_FAILED');
    }
  },

  /**
   * Get package booking details by booking ID
   * Retrieves full details of a package booking including all service bookings
   */
  getPackageBooking: async (bookingId: string): Promise<PackageBookingDetails> => {
    try {
      const response = await api.get(`/packages/bookings/${bookingId}`);
      return response.data.data;
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to fetch package booking';
      const statusCode = err.response?.status;
      console.error('[packageBookingApi] getPackageBooking error:', message, statusCode);
      throw new PackageBookingApiError(message, statusCode, 'GET_PACKAGE_BOOKING_FAILED');
    }
  },
};

export default packageBookingApi;