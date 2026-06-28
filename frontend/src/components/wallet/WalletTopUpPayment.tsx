import React, { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, Shield } from 'lucide-react';

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

if (!STRIPE_KEY && import.meta.env.DEV) {
  console.warn('[WalletTopUpPayment] VITE_STRIPE_PUBLISHABLE_KEY is not set in .env.local');
}

const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY) : null;

interface WalletTopUpPaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

function WalletTopUpPaymentForm({ amount, onSuccess, onError }: WalletTopUpPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [elementsReady, setElementsReady] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/customer/wallet`,
        },
        redirect: 'if_required',
      });

      if (error) {
        onError(error.message || 'Payment failed. Please try again.');
      } else if (paymentIntent?.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      } else if (paymentIntent?.status === 'requires_action') {
        // 3D Secure redirect handled by Stripe – wallet will update via webhook
        onError('Additional authentication required. Please complete the verification.');
      } else {
        onError(`Unexpected payment status: ${paymentIntent?.status ?? 'unknown'}. Please contact support.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setIsProcessing(false);
    }
  }, [stripe, elements, onSuccess, onError]);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!elementsReady && (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-nilin-coral" />
          <span className="text-sm text-nilin-warmGray">Loading payment form…</span>
        </div>
      )}

      <div className={elementsReady ? '' : 'invisible h-0 overflow-hidden'}>
        <PaymentElement
          onReady={() => setElementsReady(true)}
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {elementsReady && (
        <>
          <div className="flex items-center gap-2 text-xs text-nilin-warmGray">
            <Shield className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Your payment is encrypted and secured by Stripe</span>
          </div>

          <button
            type="submit"
            disabled={!stripe || isProcessing || !elementsReady}
            aria-disabled={!stripe || isProcessing || !elementsReady}
            className="w-full py-3.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-nilin-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing payment…
              </>
            ) : (
              `Pay AED ${amount.toLocaleString()}`
            )}
          </button>
        </>
      )}
    </form>
  );
}

interface WalletTopUpPaymentProps {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export function WalletTopUpPayment({ clientSecret, amount, onSuccess, onError }: WalletTopUpPaymentProps) {
  if (!stripePromise) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-nilin-error font-medium">Payment service is not configured.</p>
        <p className="text-xs text-nilin-warmGray mt-1">Please contact support.</p>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#E8705A',
            borderRadius: '12px',
            fontFamily: 'inherit',
          },
        },
      }}
    >
      <WalletTopUpPaymentForm
        clientSecret={clientSecret}
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}

export default WalletTopUpPayment;
