
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, CreditCard, Lock, AlertCircle } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { StripePaymentWrapper } from '../../components/payment';
import PaymentService from '../../services/PaymentService';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import type { Booking } from '../../services/BookingService';

const PaymentPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);

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
  if ((booking as any)?.payment?.status === 'paid' || paymentComplete) {
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
                <span className="font-medium">{(booking as any)?.serviceId?.name || 'Service'}</span>
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
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-xl text-nilin-rose">
                  {formatAmount(booking?.pricing?.totalAmount || 0, booking?.pricing?.currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Form */}
          {bookingId && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <StripePaymentWrapper
                bookingId={bookingId}
                amount={booking?.pricing?.totalAmount || 0}
                currency={booking?.pricing?.currency || 'AED'}
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
