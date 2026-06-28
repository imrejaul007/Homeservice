import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Shield,
  X,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { customerApi, type PaymentMethod, CustomerApiError } from '../../services/customerApi';
import paymentService from '../../services/PaymentService';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const getApiErrorMessage = (err: unknown, fallback: string): string => {
  if (err instanceof CustomerApiError) return err.message;
  const axiosErr = err as { response?: { data?: { message?: string } } };
  return axiosErr.response?.data?.message || fallback;
};

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#2D2D2D',
      fontFamily: '"Inter", sans-serif',
      '::placeholder': { color: '#9CA3AF' },
      padding: '10px 0',
    },
    invalid: { color: '#E53E3E' },
  },
};

interface AddCardFormProps {
  isDefault: boolean;
  onToggleDefault: () => void;
  onSuccess: () => void;
  onCancel: () => void;
}

function AddCardForm({ isDefault, onToggleDefault, onSuccess, onCancel }: AddCardFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSaving(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setIsSaving(false);
      return;
    }

    try {
      const { clientSecret } = await paymentService.createSetupIntent();
      const { error: stripeError, setupIntent } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (stripeError) {
        setError(stripeError.message || 'Card error');
        setIsSaving(false);
        return;
      }

      const paymentMethodId =
        typeof setupIntent?.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent?.payment_method?.id;

      if (!paymentMethodId) {
        setError('Failed to save card — no payment method returned');
        setIsSaving(false);
        return;
      }

      await customerApi.addPaymentMethod({
        type: 'card',
        token: paymentMethodId,
        isDefault,
      });
      onSuccess();
    } catch (err) {
      const message = err instanceof CustomerApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : 'Failed to save card';
      setError(message);
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="p-4 border-2 border-nilin-border rounded-xl bg-white focus-within:border-nilin-coral transition-colors">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>

      {error && (
        <p className="text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleDefault}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
            isDefault ? 'bg-nilin-coral border-nilin-coral' : 'border-nilin-border hover:border-nilin-coral'
          }`}
        >
          {isDefault && <Check className="w-4 h-4 text-white" />}
        </button>
        <span className="text-sm text-nilin-charcoal">Set as default payment method</span>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving || !stripe}
          className="btn-nilin flex-1 disabled:opacity-60"
        >
          {isSaving ? 'Saving...' : 'Save Card'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const PaymentMethodsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/payment-methods' } });
      return;
    }
    fetchPaymentMethods();
  }, [isAuthenticated]);

  const fetchPaymentMethods = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await customerApi.getPaymentMethods();
      setPaymentMethods(response.data.paymentMethods);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load payment methods'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCardSaved = () => {
    setShowForm(false);
    setIsDefault(false);
    fetchPaymentMethods();
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      await customerApi.deletePaymentMethod(paymentMethodId);
      fetchPaymentMethods();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to remove payment method'));
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      await customerApi.setDefaultPaymentMethod(paymentMethodId);
      fetchPaymentMethods();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to set default'));
    }
  };

  const getPaymentIcon = () => <CreditCard className="w-6 h-6" />;

  const getBrandIcon = (brand?: string) => {
    if (!brand) return null;
    const lowerBrand = brand.toLowerCase();
    if (lowerBrand.includes('visa')) {
      return <span className="text-blue-600 font-bold text-lg">VISA</span>;
    }
    if (lowerBrand.includes('master')) {
      return <span className="text-orange-500 font-bold text-sm">MC</span>;
    }
    return <CreditCard className="w-5 h-5 text-nilin-warmGray" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">Payment Methods</h1>
                <p className="text-nilin-warmGray">Manage your payment options</p>
              </div>
            </div>
            <button
              onClick={() => { setIsDefault(false); setShowForm(true); }}
              className="btn-nilin flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Method
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Add Payment Method Form */}
          {showForm && (
            <div className="glass-nilin rounded-nilin-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-serif text-xl text-nilin-charcoal">Add Card</h3>
                  <p className="text-sm text-nilin-warmGray mt-0.5">Enter your card details securely via Stripe</p>
                </div>
                <button
                  onClick={() => { setShowForm(false); setIsDefault(false); }}
                  className="p-2 rounded-full hover:bg-nilin-muted transition-colors"
                >
                  <X className="w-5 h-5 text-nilin-warmGray" />
                </button>
              </div>

              <Elements stripe={stripePromise}>
                <AddCardForm
                  isDefault={isDefault}
                  onToggleDefault={() => setIsDefault(d => !d)}
                  onSuccess={handleCardSaved}
                  onCancel={() => { setShowForm(false); setIsDefault(false); }}
                />
              </Elements>
            </div>
          )}

          {/* Payment Methods List */}
          {paymentMethods.length === 0 && !showForm ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No payment methods</h3>
              <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                Add a payment method for faster checkout. We support cards, Apple Pay, and Google Pay.
              </p>
              <button onClick={() => setShowForm(true)} className="btn-nilin">
                Add Payment Method
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentMethods.map((method) => (
                <div
                  key={method._id}
                  className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-nilin bg-nilin-muted flex items-center justify-center flex-shrink-0">
                      <div className="text-nilin-coral">{getPaymentIcon()}</div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-nilin-charcoal capitalize">
                          {method.type.replace('_', ' ')}
                        </span>
                        {method.isDefault && (
                          <span className="badge-nilin-primary text-xs">Default</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {method.brand && (
                          <span className="text-sm text-nilin-warmGray">
                            {method.brand}
                          </span>
                        )}
                        {method.last4 && (
                          <span className="text-sm text-nilin-warmGray font-mono">
                            •••• {method.last4}
                          </span>
                        )}
                        {method.expiryMonth && method.expiryYear && (
                          <span className="text-sm text-nilin-warmGray">
                            Expires {method.expiryMonth}/{method.expiryYear}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!method.isDefault && (
                        <button
                          onClick={() => handleSetDefault(method._id)}
                          className="px-3 py-2 rounded-lg text-sm text-nilin-coral hover:bg-nilin-coral/10 transition-colors"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(method._id)}
                        className="p-2 rounded-lg hover:bg-red-50 transition-colors text-nilin-warmGray hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Security Note */}
          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-nilin flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-800">
              <strong>256-bit encrypted.</strong> Your card details are processed directly by Stripe and never touch our servers. We only store the last 4 digits and card brand.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PaymentMethodsPage;
