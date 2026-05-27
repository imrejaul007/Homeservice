import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { CreditCard, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import PaymentService from '../../services/PaymentService';

// Initialize Stripe with publishable key
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder'
);

interface StripePaymentFormProps {
  bookingId: string;
  clientSecret: string;
  amount: number;
  currency?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}

const stripeElementsOptions = {
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#e85d75',
      colorBackground: '#ffffff',
      colorText: '#1a1a2e',
      colorDanger: '#ef4444',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': {
        border: '2px solid #e5e7eb',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
      },
      '.Input:focus': {
        border: '2px solid #e85d75',
        boxShadow: '0 0 0 4px rgba(232,93,117,0.1)',
      },
      '.Label': {
        fontWeight: '500',
        marginBottom: '8px',
      },
    },
  },
};

const PaymentForm: React.FC<StripePaymentFormProps> = ({
  bookingId,
  clientSecret,
  amount,
  currency = 'AED',
  onSuccess,
  onError,
  onCancel,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [is3DSRequired, setIs3DSRequired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setIs3DSRequired(false);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/booking/${bookingId}/payment-complete`,
        },
        redirect: 'if_required',
      });

      if (error) {
        // Handle 3DS cancellation
        if ((error.type as string) === 'unexpected_state') {
          // 3DS was cancelled or the payment intent is in an unexpected state
          const message = 'Verification was cancelled. Please try again.';
          setErrorMessage(message);
          onError(message);
        } else {
          const message = error.message || 'An unexpected error occurred.';
          setErrorMessage(message);
          onError(message);
        }
      } else if (paymentIntent) {
        switch (paymentIntent.status as any) {
          case 'succeeded':
            // Payment successful
            setIsComplete(true);
            onSuccess(paymentIntent.id);
            break;

          case 'requires_action':
          case 'requires_source_action':
            // 3D Secure or other authentication required
            // When using redirect: 'if_required', Stripe handles the redirect automatically
            // If we reach here, the redirect didn't happen - show appropriate UI
            setIs3DSRequired(true);
            setErrorMessage('Additional verification required. Please complete the verification in the popup window.');
            break;

          case 'processing':
            // Payment is processing - wait for webhook
            setErrorMessage('Payment is being processed. Please wait...');
            break;

          case 'requires_payment_method':
            // Card was declined or requires a new payment method
            const declineMessage = getDeclineMessage(paymentIntent.last_payment_error?.decline_code);
            setErrorMessage(declineMessage);
            onError(declineMessage);
            break;

          default:
            setErrorMessage('Payment status: ' + paymentIntent.status);
            onError('Unexpected payment status');
        }
      }
    } catch (err: any) {
      const message = err.message || 'Failed to process payment.';
      setErrorMessage(message);
      onError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Map Stripe decline codes to user-friendly messages
   */
  const getDeclineMessage = (declineCode?: string): string => {
    const declineMessages: Record<string, string> = {
      'card_declined': 'Your card was declined. Please try a different card or contact your bank.',
      'insufficient_funds': 'Your card has insufficient funds. Please try a different payment method.',
      'expired_card': 'Your card has expired. Please use a different card.',
      'incorrect_cvc': 'The security code (CVC) is incorrect. Please check and try again.',
      'processing_error': 'A processing error occurred. Please try again in a moment.',
      'lost_card': 'Your card was declined. Please contact your bank.',
      'stolen_card': 'Your card was declined. Please contact your bank.',
      'generic_decline': 'Your card was declined. Please try a different card.',
    };

    return declineMessages[declineCode || ''] || 'Your card was declined. Please try a different payment method.';
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (isComplete) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Payment Successful</h3>
        <p className="text-gray-600">Your payment has been processed successfully.</p>
      </div>
    );
  }

  // 3D Secure authentication required state
  if (is3DSRequired) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Verification Required</h3>
          <p className="text-gray-600 mb-4">Please complete the security verification in the popup window.</p>
          <p className="text-sm text-gray-500">If you don't see a popup, please check your browser's popup blocker settings.</p>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-800">Verification pending</p>
              <p className="text-sm text-blue-600">{errorMessage}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              setIs3DSRequired(false);
              setErrorMessage(null);
            }}
            disabled={isProcessing}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!stripe || isProcessing}
            className={cn(
              "flex-1 px-6 py-3 rounded-xl font-medium text-white transition-all",
              "bg-gradient-to-r from-nilin-rose to-nilin-coral",
              "hover:shadow-nilin-warm active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center justify-center gap-2"
            )}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Complete Verification
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Lock className="w-4 h-4" />
          <span>Secured by Stripe. Your payment info is encrypted.</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Payment Element */}
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Payment failed</p>
            <p className="text-sm text-red-600">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Amount Display */}
      <div className="flex items-center justify-between p-4 bg-nilin-blush/30 rounded-xl">
        <span className="text-gray-700 font-medium">Total Amount</span>
        <span className="text-2xl font-bold text-nilin-rose">
          {formatAmount(amount, currency)}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!stripe || isProcessing}
          className={cn(
            "flex-1 px-6 py-3 rounded-xl font-medium text-white transition-all",
            "bg-gradient-to-r from-nilin-rose to-nilin-coral",
            "hover:shadow-nilin-warm active:scale-[0.98]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Pay {formatAmount(amount, currency)}
            </>
          )}
        </button>
      </div>

      {/* Security Notice */}
      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <Lock className="w-4 h-4" />
        <span>Secured by Stripe. Your payment info is encrypted.</span>
      </div>
    </form>
  );
};

/**
 * Wrapper component that handles payment intent creation and provides Stripe Elements
 */
export const StripePaymentWrapper: React.FC<{
  bookingId: string;
  amount: number;
  currency?: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  onCancel?: () => void;
}> = ({ bookingId, amount, currency, onSuccess, onError, onCancel }) => {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await PaymentService.createPaymentIntent(bookingId);
        setClientSecret(result.clientSecret);
      } catch (err: any) {
        const message = err.message || 'Failed to initialize payment.';
        setError(message);
        onError(message);
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [bookingId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-nilin-rose/30 border-t-nilin-rose rounded-full animate-spin mb-4" />
        <p className="text-gray-600">Initializing secure payment...</p>
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Payment</h3>
        <p className="text-gray-600 mb-4">{error || 'Please try again later.'}</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-2 border-2 border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        ...stripeElementsOptions,
      }}
    >
      <PaymentForm
        bookingId={bookingId}
        clientSecret={clientSecret}
        amount={amount}
        currency={currency}
        onSuccess={onSuccess}
        onError={onError}
        onCancel={onCancel}
      />
    </Elements>
  );
};

export default StripePaymentWrapper;
