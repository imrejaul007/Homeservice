import { api } from './api';

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
    const response = await api.get('/customers/addresses');
    return response.data;
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
    const response = await api.post('/customers/addresses', address);
    return response.data;
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
    const response = await api.patch(`/customers/addresses/${addressId}`, updates);
    return response.data;
  }

  /**
   * Delete an address
   */
  async deleteAddress(addressId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/customers/addresses/${addressId}`);
    return response.data;
  }

  /**
   * Set address as default
   */
  async setDefaultAddress(addressId: string): Promise<{ success: boolean }> {
    const response = await api.patch(`/customers/addresses/${addressId}`, { isDefault: true });
    return response.data;
  }

  // ============================================
  // Payment Methods
  // ============================================

  /**
   * Get all payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    const response = await api.get('/customers/payment-methods');
    return response.data;
  }

  /**
   * Add a new payment method
   */
  async addPaymentMethod(paymentMethod: {
    type: 'card' | 'apple_pay' | 'google_pay';
    token: string; // Payment gateway token
    isDefault?: boolean;
  }): Promise<{ success: boolean; data: { paymentMethod: PaymentMethod } }> {
    const response = await api.post('/customers/payment-methods', paymentMethod);
    return response.data;
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(paymentMethodId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/customers/payment-methods/${paymentMethodId}`);
    return response.data;
  }

  /**
   * Set payment method as default
   */
  async setDefaultPaymentMethod(paymentMethodId: string): Promise<{ success: boolean }> {
    const response = await api.patch(`/customers/payment-methods/${paymentMethodId}`, { isDefault: true });
    return response.data;
  }
}

export const customerApi = new CustomerApiService();
export default customerApi;
