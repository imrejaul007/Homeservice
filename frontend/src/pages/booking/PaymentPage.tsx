
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, CreditCard, Lock, AlertCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { StripePaymentWrapper, CouponCodeInput, PriceBreakdown, DuplicateChargeWarning } from '../../components/payment';
import PaymentService from '../../services/PaymentService';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import { bookingApi, type Booking } from '../../services/bookingApi';
import type { PaymentMethodType } from '../../services/PaymentService';
import { cn } from '../../lib/utils';

interface AppliedCoupon {
  code: string;
  discountAmount: number;
}

const PaymentPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('credit_card');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(true);
  const [isUpdatingPricing, setIsUpdatingPricing] = useState(false);

  // Calculate pricing with coupon applied
  const calculatePricing = useCallback(() => {
    const pricing = booking?.pricing;
    if (!pricing) {
      return { subtotal: 0, discount: 0, tax: 0, total: 0 };
    }

    const basePrice = pricing.basePrice || 0;
    const addOnsTotal = pricing.addOns?.reduce((sum, addOn) => sum + addOn.price, 0) || 0;
    const subtotal = basePrice + addOnsTotal;
    const discount = appliedCoupon?.discountAmount || 0;
    const taxableAmount = Math.max(0, subtotal - discount);
    const taxRate = 0.05; // 5% VAT
    const tax = Math.round(taxableAmount * taxRate * 100) / 100;
    const total = Math.round((taxableAmount + tax) * 100) / 100;

    return { subtotal, discount, tax, total };
  }, [booking, appliedCoupon]);

  const pricing = calculatePricing();

  const handleCouponApply = async (code: string) => {
    if (!bookingId) {
      return { valid: false, code, message: 'Booking ID is missing' };
    }

    setIsUpdatingPricing(true);
    try {
      // FIX: Skip separate validation - applyCoupon endpoint validates internally
      // This reduces from 2 API calls to 1
      const updatedBooking = await bookingApi.applyCoupon(bookingId, code);

      if (updatedBooking) {
        setBooking(updatedBooking.booking);

        // Extract discount from booking pricing
        const discounts = updatedBooking.booking?.pricing?.discounts || [];
        const couponDiscount = discounts.find((d: any) => d.code === code.toUpperCase());

        setAppliedCoupon({
          code: code.toUpperCase(),
          discountAmount: couponDiscount?.amount || 0,
        });

        return {
          valid: true,
          code,
          discountAmount: couponDiscount?.amount || 0,
          message: `Coupon applied! You save AED ${couponDiscount?.amount || 0}`,
        };
      }

      return { valid: false, code, message: 'Failed to apply coupon' };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply coupon';
      return { valid: false, code, message: errorMessage };
    } finally {
      setIsUpdatingPricing(false);
    }
  };

  const handleCouponRemove = async () => {
    if (!bookingId) return;

    setIsUpdatingPricing(true);
    try {
      await bookingApi.removeCoupon(bookingId);
      setAppliedCoupon(null);
      await fetchBookingDetails();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove coupon';
      setError(errorMessage);
      throw err; // Re-throw so CouponCodeInput shows the error
    } finally {
      setIsUpdatingPricing(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (bookingId) {
      fetchBookingDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // P0 FIX: Use authService instead of raw fetch to avoid parsing sessionStorage directly
  const fetchBookingDetails = async () => {
    if (!bookingId) return;

    try {
      setLoading(true);
      setError(null);

      // P0 FIX: Use authService which properly manages token storage
      // instead of raw fetch with manual sessionStorage parsing
      const response = await authService.get<{ success: boolean; data: Booking }>(
        `/bookings/${bookingId}`
      );

      if (response.success && response.data) {
        setBooking(response.data);
      } else {
        setError('Booking not found');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load booking';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    setPaymentComplete(true);

    // Refresh booking to show updated payment status
    await fetchBookingDetails();
  };

  const handlePaymentError = (errorMessage: string) => {
    // Set the error state for display
    setError(errorMessage);

    // Log payment failure for analytics/monitoring
    if (bookingId) {
      console.warn('Payment failed', { bookingId, error: errorMessage });
    }
  };

  const handleBack = () => {
    if (bookingId) {
      navigate(`/customer/bookings/${bookingId}`);
    } else {
      navigate('/customer/bookings');
    }
  };

  const formatAmount = (amount: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-rose/30 border-t-nilin-rose rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading payment details...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Payment</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-nilin-rose text-white rounded-xl font-medium hover:bg-nilin-coral transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // If already paid
  if (booking?.paymentStatus === 'completed' || paymentComplete) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md bg-white rounded-2xl p-8 shadow-lg">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 font-serif">Payment Successful</h2>
            <p className="text-gray-600 mb-6">
              Your booking #{booking?.bookingNumber} has been confirmed.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => navigate(`/customer/bookings/${bookingId}`)}
                className="w-full px-6 py-3 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium hover:shadow-nilin-warm transition-all"
              >
                View Booking Details
              </button>
              <button
                onClick={() => navigate('/customer/bookings')}
                className="w-full px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                View All Bookings
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Payment form
  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="flex-1 py-8">
        <div className="max-w-lg mx-auto px-4">
          {/* Back Button */}
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-nilin-rose mb-6 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to booking</span>
          </button>

          {/* Payment Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-nilin-rose/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-nilin-rose" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 font-serif mb-2">Complete Your Payment</h1>
            <p className="text-gray-600">Booking #{booking?.bookingNumber}</p>
          </div>

          {/* Booking Summary */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Booking Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Service</span>
                <span className="font-medium">{booking?.service?.name || 'Service'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Date</span>
                <span className="font-medium">
                  {booking?.scheduledDate
                    ? new Date(booking.scheduledDate).toLocaleDateString('en-AE', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Time</span>
                <span className="font-medium">{booking?.scheduledTime || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Price Breakdown */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
            <h3 className="font-semibold text-gray-900 mb-4">Price Details</h3>
            <PriceBreakdown
              subtotal={pricing.subtotal}
              discount={pricing.discount}
              tax={pricing.tax}
              total={pricing.total}
              currency={booking?.pricing?.currency || 'AED'}
              couponCode={appliedCoupon?.code}
            />

            {/* Coupon Code Input */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <CouponCodeInput
                onApply={handleCouponApply}
                onRemove={handleCouponRemove}
                appliedCoupon={appliedCoupon}
                disabled={isUpdatingPricing}
                currency={booking?.pricing?.currency || 'AED'}
              />
            </div>

            {isUpdatingPricing && (
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-nilin-rose rounded-full animate-spin" />
                <span>Updating pricing...</span>
              </div>
            )}
          </div>

          {/* Duplicate Charge Warning */}
          {showDuplicateWarning && (
            <DuplicateChargeWarning
              className="mb-6"
              onDismiss={() => setShowDuplicateWarning(false)}
            />
          )}

          {/* Payment Form */}
          {bookingId && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              {/* Payment Method Selection */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('credit_card')}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      selectedPaymentMethod === 'credit_card'
                        ? "border-nilin-rose bg-nilin-blush/30"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <CreditCard className={cn(
                      "w-5 h-5",
                      selectedPaymentMethod === 'credit_card' ? "text-nilin-rose" : "text-gray-500"
                    )} />
                    <span className="text-sm font-medium">Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('apple_pay')}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      selectedPaymentMethod === 'apple_pay'
                        ? "border-nilin-rose bg-nilin-blush/30"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <svg className={cn(
                      "w-5 h-5",
                      selectedPaymentMethod === 'apple_pay' ? "text-nilin-rose" : "text-gray-500"
                    )} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    <span className="text-sm font-medium">Apple Pay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod('cash')}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                      selectedPaymentMethod === 'cash'
                        ? "border-nilin-rose bg-nilin-blush/30"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <svg className={cn(
                      "w-5 h-5",
                      selectedPaymentMethod === 'cash' ? "text-nilin-rose" : "text-gray-500"
                    )} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="6" width="20" height="12" rx="2"/>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M6 12h.01M18 12h.01"/>
                    </svg>
                    <span className="text-sm font-medium">Cash</span>
                  </button>
                </div>
              </div>

              <StripePaymentWrapper
                bookingId={bookingId}
                amount={pricing.total}
                currency={booking?.pricing?.currency || 'AED'}
                paymentMethod={selectedPaymentMethod}
                couponCode={appliedCoupon?.code}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={handleBack}
              />
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-700 font-medium">Payment Failed</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-sm text-red-500 hover:text-red-700 underline mt-2"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default PaymentPage;
