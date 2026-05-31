import { api } from './api';
import { AxiosError } from 'axios';

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
  };
}

interface PaymentMethodsResponse {
  success: boolean;
  data: {
    paymentMethods: PaymentMethod[];
    total: number;
  };
}

class CustomerApiService {
  // ============================================
  // Addresses
  // ============================================

  /**
   * Get all addresses for the current user
   */
  async getAddresses(): Promise<AddressesResponse> {
    try {
      const response = await api.get('/customers/addresses');
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch addresses';
      console.error('[customerApi] getAddresses error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'GET_ADDRESSES_FAILED');
    }
  }

  /**
   * Add a new address
   */
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

  /**
   * Update an existing address
   */
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

  /**
   * Delete an address
   */
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

  /**
   * Set address as default
   */
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
  // Payment Methods
  // ============================================

  /**
   * Get all payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    try {
      const response = await api.get('/customers/payment-methods');
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch payment methods';
      console.error('[customerApi] getPaymentMethods error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'GET_PAYMENT_METHODS_FAILED');
    }
  }

  /**
   * Add a new payment method
   */
  async addPaymentMethod(paymentMethod: {
    type: 'card' | 'apple_pay' | 'google_pay';
    token: string; // Payment gateway token
    isDefault?: boolean;
  }): Promise<{ success: boolean; data: { paymentMethod: PaymentMethod } }> {
    try {
      const response = await api.post('/customers/payment-methods', paymentMethod);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to add payment method';
      console.error('[customerApi] addPaymentMethod error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'ADD_PAYMENT_METHOD_FAILED');
    }
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/customers/payment-methods/${paymentMethodId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to delete payment method';
      console.error('[customerApi] deletePaymentMethod error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'DELETE_PAYMENT_METHOD_FAILED');
    }
  }

  /**
   * Set payment method as default
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<{ success: boolean }> {
    try {
      const response = await api.patch(`/customers/payment-methods/${paymentMethodId}`, { isDefault: true });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to set default payment method';
      console.error('[customerApi] setDefaultPaymentMethod error:', message, err.response?.status);
      throw new CustomerApiError(message, err.response?.status, 'SET_DEFAULT_PAYMENT_METHOD_FAILED');
    }
  }
}

export const customerApi = new CustomerApiService();
export default customerApi;
