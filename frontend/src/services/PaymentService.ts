import { api } from './api';
import type { AxiosResponse } from 'axios';

export interface PaymentIntent {
  clientSecret: string;
  paymentIntentId: string;
}

export interface PaymentStatus {
  status: 'pending' | 'completed' | 'refunded' | 'failed';
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

export type PaymentMethodType = 'apple_pay' | 'credit_card' | 'cash';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface CreatePaymentIntentParams {
  bookingId: string;
  paymentMethod?: PaymentMethodType;
  couponCode?: string;
  idempotencyKey?: string;
}

const IDEMPOTENCY_KEY_PREFIX = 'payment_intent';

/**
 * Generate an idempotency key for payment requests
 * Format: pi_${bookingId}_${timestamp}_${random}
 */
const generateIdempotencyKey = (bookingId: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  return `${IDEMPOTENCY_KEY_PREFIX}_${bookingId}_${timestamp}_${random}`;
};

/**
 * Store idempotency key in sessionStorage for retry scenarios
 */
const storeIdempotencyKey = (key: string): void => {
  try {
    sessionStorage.setItem('last_idempotency_key', key);
  } catch {
    // sessionStorage may be unavailable
  }
};

/**
 * Get the last stored idempotency key from sessionStorage
 */
const getStoredIdempotencyKey = (): string | null => {
  try {
    return sessionStorage.getItem('last_idempotency_key');
  } catch {
    return null;
  }
};

class PaymentService {
  /**
   * Create a payment intent for a booking
   */
  async createPaymentIntent(
    bookingId: string,
    paymentMethod?: PaymentMethodType,
    couponCode?: string
  ): Promise<PaymentIntent> {
    // Generate new idempotency key for this payment attempt
    const idempotencyKey = generateIdempotencyKey(bookingId);

    // Store in sessionStorage for retry scenarios
    storeIdempotencyKey(idempotencyKey);

    const params: CreatePaymentIntentParams = {
      bookingId,
      paymentMethod,
      couponCode,
      idempotencyKey,
    };

    const response: AxiosResponse<ApiResponse<PaymentIntent>> = await api.post(
      '/payments/create-intent',
      params,
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return response.data.data;
  }

  /**
   * Create a payment intent with an existing idempotency key (for retries)
   */
  async createPaymentIntentWithIdempotency(
    bookingId: string,
    paymentMethod?: PaymentMethodType,
    couponCode?: string
  ): Promise<PaymentIntent> {
    // Try to get existing key from sessionStorage for retry
    let idempotencyKey = getStoredIdempotencyKey();

    // If no existing key, generate a new one
    if (!idempotencyKey) {
      idempotencyKey = generateIdempotencyKey(bookingId);
    }

    const params: CreatePaymentIntentParams = {
      bookingId,
      paymentMethod,
      couponCode,
      idempotencyKey,
    };

    const response: AxiosResponse<ApiResponse<PaymentIntent>> = await api.post(
      '/payments/create-intent',
      params,
      {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
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
