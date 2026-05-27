import { api } from './api';
import type { AxiosResponse } from 'axios';

export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
}

export interface PaymentStatus {
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  transactionId?: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  amount?: number;
  message: string;
}

export interface SetupIntent {
  clientSecret: string;
  setupIntentId: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

class PaymentService {
  /**
   * Create a payment intent for a booking
   */
  async createPaymentIntent(bookingId: string): Promise<PaymentIntent> {
    const response: AxiosResponse<ApiResponse<PaymentIntent>> = await api.post(
      '/payments/create-intent',
      { bookingId }
    );
    return response.data.data;
  }

  /**
   * Get payment status for a booking
   */
  async getPaymentStatus(bookingId: string): Promise<PaymentStatus> {
    const response: AxiosResponse<ApiResponse<PaymentStatus>> = await api.get(
      `/payments/status/${bookingId}`
    );
    return response.data.data;
  }

  /**
   * Request a refund for a booking (admin/provider only)
   */
  async requestRefund(bookingId: string, amount?: number): Promise<RefundResult> {
    const response: AxiosResponse<ApiResponse<RefundResult>> = await api.post(
      `/payments/refund/${bookingId}`,
      amount ? { amount } : {}
    );
    return response.data.data;
  }

  /**
   * Create a setup intent for saving payment methods
   * This is used when adding a new card to the customer's saved payment methods
   */
  async createSetupIntent(): Promise<SetupIntent> {
    const response: AxiosResponse<ApiResponse<SetupIntent>> = await api.post(
      '/payments/create-setup-intent'
    );
    return response.data.data;
  }
}

export default new PaymentService();
