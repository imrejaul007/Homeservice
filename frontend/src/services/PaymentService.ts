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

export type PaymentMethodType = 'apple_pay' | 'credit_card' | 'cash' | 'wallet';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// =============================================================================
// Error Handling
// =============================================================================

/**
 * Check if an error is transient and should be retried
 */
const isTransientError = (error: unknown): boolean => {
  if (!navigator.onLine) return true;

  const axiosError = error as { response?: { status?: number }; message?: string };
  const status = axiosError?.response?.status;
  const message = axiosError?.message || '';

  // Network errors, 5xx errors, and 429 are retryable
  return (
    !status ||
    [500, 502, 503, 504, 429].includes(status) ||
    message.includes('NetworkError') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ETIMEDOUT')
  );
};

/**
 * Delay helper for retry backoff
 */
const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Execute a function with retry logic for transient failures
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  context: string = 'Payment'
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRetryable = isTransientError(error);

      if (!isRetryable || attempt === retries) {
        console.error(`[PaymentService] ${context} failed after ${attempt} attempt(s):`, error);
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = Math.pow(2, attempt - 1) * 1000;
      console.warn(`[PaymentService] ${context} failed (attempt ${attempt}/${retries}), retrying in ${backoffMs}ms...`);
      await delay(backoffMs);
    }
  }

  throw lastError;
}

interface CreatePaymentIntentParams {
  bookingId: string;
  couponCode?: string;
  // Note: Idempotency-Key is sent via HTTP header, not in the request body
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
   * Note: The backend determines payment method from the booking record, not from the request body
   * Idempotency key is sent via header, not body
   * FIX: Added retry logic for transient failures
   */
  async createPaymentIntent(
    bookingId: string,
    paymentMethod?: PaymentMethodType, // Kept for API compatibility, but not sent to backend
    couponCode?: string
  ): Promise<PaymentIntent> {
    // Generate new idempotency key for this payment attempt
    const idempotencyKey = generateIdempotencyKey(bookingId);

    // Store in sessionStorage for retry scenarios
    storeIdempotencyKey(idempotencyKey);

    // Backend gets paymentMethod from booking record, not from request body
    // Idempotency key is sent via header only, not in body
    const params = {
      bookingId,
      couponCode,
    };

    return withRetry(
      async () => {
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
      },
      3,
      'Create payment intent'
    );
  }

  /**
   * Create a payment intent with an existing idempotency key (for retries)
   * FIX: Added retry logic for transient failures
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

    // Idempotency key is sent via header only
    const params = {
      bookingId,
      couponCode,
    };

    return withRetry(
      async () => {
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
      },
      3,
      'Create payment intent (idempotent)'
    );
  }

  /**
   * Get payment status for a booking
   * FIX: Added retry logic for transient failures
   */
  async getPaymentStatus(bookingId: string): Promise<PaymentStatus> {
    return withRetry(
      async () => {
        const response: AxiosResponse<ApiResponse<PaymentStatus>> = await api.get(
          `/payments/status/${bookingId}`
        );
        return response.data.data;
      },
      2,
      'Get payment status'
    );
  }

  /**
   * Request a refund for a booking (admin/provider only)
   * FIX: Added retry logic for transient failures
   */
  async requestRefund(bookingId: string, amount?: number): Promise<RefundResult> {
    return withRetry(
      async () => {
        const response: AxiosResponse<ApiResponse<RefundResult>> = await api.post(
          `/payments/refund/${bookingId}`,
          amount ? { amount } : {}
        );
        return response.data.data;
      },
      2,
      'Request refund'
    );
  }

  /**
   * Create a setup intent for saving payment methods
   * This is used when adding a new card to the customer's saved payment methods
   * FIX: Added retry logic for transient failures
   */
  async createSetupIntent(): Promise<SetupIntent> {
    return withRetry(
      async () => {
        const response: AxiosResponse<ApiResponse<SetupIntent>> = await api.post(
          '/payments/create-setup-intent'
        );
        return response.data.data;
      },
      3,
      'Create setup intent'
    );
  }
}

export default new PaymentService();
