import { api } from './api';
import { AxiosError } from 'axios';
import paymentService from './PaymentService';

// Error class for customer API errors
export class CustomerApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'CustomerApiError';
  }
}

export interface Address {
  _id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethod {
  _id: string;
  type: 'card' | 'apple_pay' | 'google_pay' | 'cash';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: string;
}

interface AddressesResponse {
  success: boolean;
  data: {
    addresses: Address[];
    total: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  };
}

interface PaymentMethodsResponse {
  success: boolean;
  data: {
    paymentMethods: PaymentMethod[];
    total: number;
  };
}

export interface CustomerStatsResponse {
  overview: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    completionRate: number;
    averageRating?: number;
    totalHours?: number;
  };
  spending: {
    totalSpent: number;
    averageOrderValue: number;
  };
  activity: {
    last30Days: number;
    last7Days: number;
  };
  topCategories: Array<{ category: string; count: number }>;
  recentBookings: Array<{
    id: string;
    status: string;
    service: string;
    provider: string;
    date: string;
    amount: number;
  }>;
}

export interface CustomerAnalyticsResponse {
  period: string;
  monthly: Array<{ year: number; month: number; bookings: number; spent: number }>;
  dayOfWeek: Array<{ day: number; bookings: number }>;
  timeOfDay: Array<{ _id: string; count: number }>;
}

function normalizePaymentMethod(raw: Record<string, unknown>): PaymentMethod {
  const id = String(raw._id ?? raw.id ?? '');
  return {
    _id: id,
    type: (raw.type as PaymentMethod['type']) || 'card',
    last4: raw.last4 as string | undefined,
    brand: raw.brand as string | undefined,
    expiryMonth: (raw.expiryMonth ?? raw.expMonth) as number | undefined,
    expiryYear: (raw.expiryYear ?? raw.expYear) as number | undefined,
    isDefault: Boolean(raw.isDefault),
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
  };
}

class CustomerApiService {
  // ============================================
  // Addresses
  // ============================================

  async getAddresses(): Promise<AddressesResponse> {
    try {
      const response = await api.get('/customers/addresses');
      const data = response.data.data;
      const pagination = data.pagination;
      const total = pagination?.total ?? data.total ?? data.addresses?.length ?? 0;
      return {
        success: true,
        data: {
          addresses: data.addresses ?? [],
          total,
          pagination,
        },
      };
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch addresses';
      console.error('[customerApi] getAddresses error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'GET_ADDRESSES_FAILED');
    }
  }

  async addAddress(address: {
    label: string;
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    coordinates?: { lat: number; lng: number };
    isDefault?: boolean;
  }): Promise<{ success: boolean; data: { address: Address } }> {
    try {
      const response = await api.post('/customers/addresses', address);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to add address';
      console.error('[customerApi] addAddress error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'ADD_ADDRESS_FAILED');
    }
  }

  async updateAddress(
    addressId: string,
    updates: Partial<{
      label: string;
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
      coordinates: { lat: number; lng: number };
      isDefault: boolean;
    }>
  ): Promise<{ success: boolean; data: { address: Address } }> {
    try {
      const response = await api.patch(`/customers/addresses/${addressId}`, updates);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to update address';
      console.error('[customerApi] updateAddress error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'UPDATE_ADDRESS_FAILED');
    }
  }

  async deleteAddress(addressId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/customers/addresses/${addressId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to delete address';
      console.error('[customerApi] deleteAddress error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'DELETE_ADDRESS_FAILED');
    }
  }

  async setDefaultAddress(addressId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.patch(`/customers/addresses/${addressId}`, { isDefault: true });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to set default address';
      console.error('[customerApi] setDefaultAddress error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'SET_DEFAULT_ADDRESS_FAILED');
    }
  }

  // ============================================
  // Payment Methods (Stripe via /payments/methods)
  // ============================================

  /** @deprecated Use /payments/methods — kept as alias for getPaymentMethods */
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    try {
      const response = await api.get('/payments/methods');
      const rawMethods = response.data.data?.paymentMethods ?? [];
      const paymentMethods = rawMethods.map((m: Record<string, unknown>) => normalizePaymentMethod(m));
      return {
        success: true,
        data: {
          paymentMethods,
          total: paymentMethods.length,
        },
      };
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch payment methods';
      console.error('[customerApi] getPaymentMethods error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'GET_PAYMENT_METHODS_FAILED');
    }
  }

  async addPaymentMethod(paymentMethod: {
    type: 'card' | 'apple_pay' | 'google_pay';
    token: string;
    isDefault?: boolean;
  }): Promise<{ success: boolean; data: { paymentMethod: PaymentMethod } }> {
    try {
      const response = await api.post('/payments/methods', paymentMethod);
      const raw = response.data.data?.paymentMethod ?? response.data.data;
      return {
        success: true,
        data: {
          paymentMethod: normalizePaymentMethod(
            raw && typeof raw === 'object' ? raw : { _id: response.data.data?.methodId }
          ),
        },
      };
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to add payment method';
      console.error('[customerApi] addPaymentMethod error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'ADD_PAYMENT_METHOD_FAILED');
    }
  }

  async deletePaymentMethod(paymentMethodId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/payments/methods/${paymentMethodId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to delete payment method';
      console.error('[customerApi] deletePaymentMethod error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'DELETE_PAYMENT_METHOD_FAILED');
    }
  }

  async setDefaultPaymentMethod(paymentMethodId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.patch(`/payments/methods/${paymentMethodId}`, { isDefault: true });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to set default payment method';
      console.error('[customerApi] setDefaultPaymentMethod error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'SET_DEFAULT_PAYMENT_METHOD_FAILED');
    }
  }

  // ============================================
  // Customer Analytics
  // ============================================

  async getCustomerStats(): Promise<CustomerStatsResponse> {
    try {
      const response = await api.get('/customers/stats');
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch customer stats';
      throw new CustomerApiError(message, err.response?.status, 'GET_CUSTOMER_STATS_FAILED');
    }
  }

  async createPaymentMethodSetupIntent() {
    return paymentService.createSetupIntent();
  }

  async getCustomerAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<CustomerAnalyticsResponse> {
    try {
      const response = await api.get('/customers/analytics', { params: { period } });
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch customer analytics';
      throw new CustomerApiError(message, err.response?.status, 'GET_CUSTOMER_ANALYTICS_FAILED');
    }
  }
}

export const customerApi = new CustomerApiService();
export default customerApi;
