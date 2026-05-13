import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Smartphone,
  Apple,
  CircleDollarSign,
  X,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { customerApi, type PaymentMethod } from '../../services/customerApi';

const PaymentMethodsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    type: 'card' as 'card' | 'apple_pay' | 'google_pay',
    token: '',
    isDefault: false,
  });

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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payment methods');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      // In a real app, you would collect the payment token from Stripe/other provider
      await customerApi.addPaymentMethod({
        type: formData.type,
        token: formData.token || 'mock_token_' + Date.now(),
        isDefault: formData.isDefault,
      });
      setShowForm(false);
      resetForm();
      fetchPaymentMethods();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add payment method');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (paymentMethodId: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;

    try {
      await customerApi.deletePaymentMethod(paymentMethodId);
      fetchPaymentMethods();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove payment method');
    }
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    try {
      await customerApi.setDefaultPaymentMethod(paymentMethodId);
      fetchPaymentMethods();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set default');
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'card',
      token: '',
      isDefault: false,
    });
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case 'apple_pay':
        return <Apple className="w-6 h-6" />;
      case 'google_pay':
        return <CircleDollarSign className="w-6 h-6" />;
      default:
        return <CreditCard className="w-6 h-6" />;
    }
  };

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
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
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
                <h3 className="font-serif text-xl text-nilin-charcoal">Add Payment Method</h3>
                <button
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="p-2 rounded-full hover:bg-nilin-muted transition-colors"
                >
                  <X className="w-5 h-5 text-nilin-warmGray" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Payment Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-3">
                    Payment Type
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'card' })}
                      className={`p-4 rounded-nilin border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.type === 'card'
                          ? 'border-nilin-coral bg-nilin-coral/5'
                          : 'border-nilin-border hover:border-nilin-coral/50'
                      }`}
                    >
                      <CreditCard className={`w-6 h-6 ${formData.type === 'card' ? 'text-nilin-coral' : 'text-nilin-warmGray'}`} />
                      <span className={`text-sm font-medium ${formData.type === 'card' ? 'text-nilin-coral' : 'text-nilin-warmGray'}`}>
                        Card
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'apple_pay' })}
                      className={`p-4 rounded-nilin border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.type === 'apple_pay'
                          ? 'border-nilin-coral bg-nilin-coral/5'
                          : 'border-nilin-border hover:border-nilin-coral/50'
                      }`}
                    >
                      <Apple className={`w-6 h-6 ${formData.type === 'apple_pay' ? 'text-nilin-coral' : 'text-nilin-warmGray'}`} />
                      <span className={`text-sm font-medium ${formData.type === 'apple_pay' ? 'text-nilin-coral' : 'text-nilin-warmGray'}`}>
                        Apple Pay
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, type: 'google_pay' })}
                      className={`p-4 rounded-nilin border-2 transition-all flex flex-col items-center gap-2 ${
                        formData.type === 'google_pay'
                          ? 'border-nilin-coral bg-nilin-coral/5'
                          : 'border-nilin-border hover:border-nilin-coral/50'
                      }`}
                    >
                      <CircleDollarSign className={`w-6 h-6 ${formData.type === 'google_pay' ? 'text-nilin-coral' : 'text-nilin-warmGray'}`} />
                      <span className={`text-sm font-medium ${formData.type === 'google_pay' ? 'text-nilin-coral' : 'text-nilin-warmGray'}`}>
                        Google Pay
                      </span>
                    </button>
                  </div>
                </div>

                {/* Demo notice */}
                <div className="bg-amber-50 border border-amber-200 rounded-nilin p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Demo Mode:</strong> Payment methods are simulated. In production, this would connect to Stripe or another payment provider.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
                    className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      formData.isDefault
                        ? 'bg-nilin-coral border-nilin-coral'
                        : 'border-nilin-border hover:border-nilin-coral'
                    }`}
                  >
                    {formData.isDefault && <Check className="w-4 h-4 text-white" />}
                  </button>
                  <span className="text-sm text-nilin-charcoal">Set as default payment method</span>
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="submit" disabled={isSaving} className="btn-nilin flex-1">
                    {isSaving ? 'Adding...' : 'Add Payment Method'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
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
                      <div className="text-nilin-coral">{getPaymentIcon(method.type)}</div>
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
          <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-nilin">
            <p className="text-sm text-green-800">
              <strong>Secure:</strong> Your payment information is encrypted and stored securely. We never store your full card number.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PaymentMethodsPage;
