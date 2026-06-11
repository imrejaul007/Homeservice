import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Package,
  Clock,
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Phone,
  MessageCircle,
  Star,
  ChevronRight,
  Share2,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import ExperienceSubmissionForm from '../../components/experience/ExperienceSubmissionForm';
import CancellationModal from '../../components/booking/CancellationModal';
import RescheduleModal from '../../components/booking/RescheduleModal';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { experienceApi } from '../../services/experienceApi';
import { socketService, type BookingEvent } from '../../services/socket';
import { BookingChat } from '../../components/chat';

interface PricingInfo {
  basePrice?: number;
  addOns?: Array<{ name: string; price: number }>;
  discounts?: Array<{ type: string; code?: string; amount: number; description: string }>;
  subtotal?: number;
  tax?: number;
  totalAmount: number;
  currency: string;
  couponDiscount?: number;
}

interface LocationInfo {
  type: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  notes?: string;
}

interface TrackingData {
  bookingNumber: string;
  status: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    reason?: string;
  }>;
  service?: {
    name: string;
    category: string;
    subcategory?: string;
    image?: string;
  };
  provider?: { _id?: string; name: string; phone?: string };
  customerId?: string;
  providerId?: string;
  location?: LocationInfo;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  pricing: PricingInfo;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  isGuestBooking: boolean;
  createdAt: string;
  _id?: string;
  guestEmail?: string;
}

const statusLabels: Record<string, string> = {
  pending: 'Pending Confirmation',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  no_show: 'No Show',
};

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  in_progress: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  completed: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  cancelled: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  no_show: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

const TrackBookingPage: React.FC = () => {
  const { bookingNumber: urlBookingNumber } = useParams<{ bookingNumber: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();

  const [bookingNumber, setBookingNumber] = useState(urlBookingNumber || '');
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [hasExperience, setHasExperience] = useState(false);
  const [checkingExperience, setCheckingExperience] = useState(false);

  // Cancellation and reschedule modal state
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Socket connection state
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Socket cleanup ref
  const socketCleanupRef = useCallback(() => {}, []);

  useEffect(() => {
    if (urlBookingNumber) {
      fetchTracking(urlBookingNumber);
    }
  }, [urlBookingNumber]);

  // Setup Socket.IO connection for real-time updates
  useEffect(() => {
    if (!tracking?._id || !isAuthenticated) return;

    let unsubscribeStatusChange: (() => void) | undefined;
    let unsubscribeConfirmed: (() => void) | undefined;
    let unsubscribeCancelled: (() => void) | undefined;
    let unsubscribeRescheduled: (() => void) | undefined;
    let unsubscribeCompleted: (() => void) | undefined;

    const setupSocketListeners = async () => {
      try {
        // Connect to socket if not already connected
        if (!socketService.isConnected()) {
          await socketService.connect();
        }
        setIsConnected(true);

        // Join the booking room to receive updates
        socketService.joinBookingRoom(tracking._id!);

        // Listen for booking status changes
        unsubscribeStatusChange = socketService.onBookingStatusChanged((event: BookingEvent) => {
          if (event.bookingId === tracking._id) {
            handleStatusUpdate(event);
          }
        });

        // Listen for specific status events
        unsubscribeConfirmed = socketService.on('booking:confirmed', (event: BookingEvent) => {
          if (event.bookingId === tracking._id) {
            handleStatusUpdate(event);
            toast.success('Your booking has been confirmed!');
          }
        });

        unsubscribeCancelled = socketService.on('booking:cancelled', (event: BookingEvent) => {
          if (event.bookingId === tracking._id) {
            handleStatusUpdate(event);
            toast.error('Your booking has been cancelled.');
          }
        });

        unsubscribeRescheduled = socketService.on('booking:rescheduled', (event: BookingEvent) => {
          if (event.bookingId === tracking._id) {
            handleStatusUpdate(event);
            toast.success('Your booking has been rescheduled.');
            // Refresh tracking data
            fetchTracking(tracking.bookingNumber);
          }
        });

        unsubscribeCompleted = socketService.on('booking:completed', (event: BookingEvent) => {
          if (event.bookingId === tracking._id) {
            handleStatusUpdate(event);
            toast.success('Your booking has been completed!');
          }
        });
      } catch (error) {
        console.error('Failed to setup socket listeners:', error);
      }
    };

    setupSocketListeners();

    // Cleanup function
    return () => {
      if (tracking._id) {
        socketService.leaveBookingRoom(tracking._id);
      }
      unsubscribeStatusChange?.();
      unsubscribeConfirmed?.();
      unsubscribeCancelled?.();
      unsubscribeRescheduled?.();
      unsubscribeCompleted?.();
    };
  }, [tracking?._id, isAuthenticated]);

  // Handle real-time status updates
  const handleStatusUpdate = (event: BookingEvent) => {
    setLastUpdate(new Date());
    setTracking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: event.status,
        statusHistory: [
          {
            status: event.status,
            timestamp: new Date(event.timestamp).toISOString(),
          },
          ...prev.statusHistory,
        ],
      };
    });
  };

  // Check if user has submitted experience for completed booking
  useEffect(() => {
    if (tracking?.status === 'completed' && tracking?._id && isAuthenticated) {
      checkExperienceSubmission();
    }
  }, [tracking?.status, tracking?._id, isAuthenticated]);

  const checkExperienceSubmission = async () => {
    if (!tracking?._id) return;
    setCheckingExperience(true);
    try {
      const response = await experienceApi.checkExperienceExists(tracking._id);
      setHasExperience(response.data?.exists || false);
    } catch {
      setHasExperience(false);
    } finally {
      setCheckingExperience(false);
    }
  };

  const fetchTracking = async (number: string) => {
    try {
      setLoading(true);
      setError(null);
      setTracking(null);

      const response = await api.get(`/bookings/track/${number}`);
      if (response.data.success) {
        setTracking(response.data.data);
      } else {
        setError(response.data.message || 'Booking not found');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle cancellation
  const handleCancelBooking = async (reason: string) => {
    if (!tracking?._id) return;

    setCancelling(true);
    try {
      const response = await api.patch(`/bookings/${tracking._id}/cancel`, { reason });

      if (response.data.success) {
        toast.success('Booking cancelled successfully');
        setShowCancellationModal(false);
        // Refresh to get updated status
        await fetchTracking(tracking.bookingNumber);
      } else {
        toast.error(response.data.message || 'Failed to cancel booking');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  // Handle reschedule
  const handleRescheduleBooking = async (newDate: string, newTime: string, reason: string) => {
    if (!tracking?._id) return;

    setRescheduling(true);
    try {
      const response = await api.patch(`/bookings/${tracking._id}/reschedule`, {
        scheduledDate: newDate,
        scheduledTime: newTime,
        reason,
      });

      if (response.data.success) {
        toast.success('Booking rescheduled successfully');
        setShowRescheduleModal(false);
        // Refresh to get updated status and new time
        await fetchTracking(tracking.bookingNumber);
      } else {
        toast.error(response.data.message || 'Failed to reschedule booking');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reschedule booking');
    } finally {
      setRescheduling(false);
    }
  };

  // Check if booking can be cancelled/rescheduled
  const canCancel = ['pending', 'confirmed'].includes(tracking?.status || '');
  const canReschedule = ['pending', 'confirmed'].includes(tracking?.status || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bookingNumber.trim()) {
      await fetchTracking(bookingNumber.trim());
      toast.success('Booking found');
      navigate(`/track/${bookingNumber.trim()}`);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatAddress = (location?: LocationInfo) => {
    if (!location?.address) return null;
    const { street, city, state, zipCode } = location.address;
    return `${street}, ${city}, ${state} ${zipCode}`;
  };

  const getStatusIcon = (status: string, isCurrent: boolean) => {
    const colors = statusColors[status] || statusColors.pending;
    if (status === 'completed' || status === 'confirmed') {
      return (
        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${isCurrent ? 'bg-green-500' : 'bg-green-200'}`}>
          {isCurrent && <CheckCircle className="w-2 h-2 text-white" />}
        </div>
      );
    }
    if (status === 'cancelled' || status === 'rejected') {
      return (
        <div className={`w-3 h-3 rounded-full flex items-center justify-center ${isCurrent ? 'bg-red-500' : 'bg-red-200'}`}>
          {isCurrent && <AlertCircle className="w-2 h-2 text-white" />}
        </div>
      );
    }
    return <div className={`w-3 h-3 rounded-full ${isCurrent ? 'bg-nilin-coral' : 'bg-gray-200'}`} />;
  };

  const statusColorsClass = statusColors[tracking?.status || 'pending'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-cream via-nilin-blush to-nilin-peach">
      <NavigationHeader />

      <div className="pt-20 pb-12 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumb />
          </div>

          {/* Back Link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-nilin-warmGray hover:text-nilin-charcoal mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-nilin-coral/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-nilin-coral" />
            </div>
            <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Track Your Booking</h1>
            <p className="text-nilin-warmGray">Enter your booking number to check the status</p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
                <input
                  type="text"
                  value={bookingNumber}
                  onChange={(e) => setBookingNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. RZ-20260212-A1B2"
                  className="w-full pl-12 pr-4 py-3.5 bg-white border border-nilin-border rounded-nilin text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral"
                />
              </div>
              <button
                type="submit"
                disabled={!bookingNumber.trim() || loading}
                className="px-6 py-3.5 bg-nilin-coral text-white rounded-nilin font-semibold hover:bg-nilin-rose transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover-lift"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track'}
              </button>
            </div>
          </form>

          {/* Error State */}
          {error && (
            <div className="bg-white border border-red-200 rounded-nilin-lg p-6 text-center mb-8 shadow-nilin">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
              <p className="text-red-700 font-medium">{error}</p>
              <p className="text-red-500 text-sm mt-1">Please check the booking number and try again.</p>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <Loader2 className="w-10 h-10 text-nilin-coral animate-spin mx-auto mb-4" />
              <p className="text-nilin-warmGray">Looking up your booking...</p>
            </div>
          )}

          {/* Tracking Results */}
          {tracking && !loading && (
            <div className="bg-white rounded-nilin-lg shadow-nilin overflow-hidden">
              {/* Status Banner */}
              <div className="bg-nilin-cream px-6 py-4 border-b border-nilin-border flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm text-nilin-warmGray">Booking Number</p>
                  <p className="text-lg font-bold text-nilin-charcoal font-mono">{tracking.bookingNumber}</p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${statusColorsClass.bg} ${statusColorsClass.text} border ${statusColorsClass.border}`}>
                  {statusLabels[tracking.status] || tracking.status}
                </span>
              </div>

              {/* Service Info */}
              {tracking.service && (
                <div className="p-6 border-b border-nilin-border">
                  <div className="flex gap-4">
                    {tracking.service.image && (
                      <img
                        src={tracking.service.image}
                        alt={tracking.service.name}
                        className="w-20 h-20 rounded-nilin object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <h3 className="font-semibold text-nilin-charcoal text-lg">{tracking.service.name}</h3>
                      <p className="text-nilin-warmGray text-sm">{tracking.service.category}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Booking Details */}
              <div className="p-6 space-y-4 border-b border-nilin-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <p className="text-xs text-nilin-warmGray">Date</p>
                      <p className="font-medium">
                        {new Date(tracking.scheduledDate).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <p className="text-xs text-nilin-warmGray">Time</p>
                      <p className="font-medium">{tracking.scheduledTime}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <p className="text-xs text-nilin-warmGray">Provider</p>
                      <p className="font-medium">{tracking.provider?.name || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <p className="text-xs text-nilin-warmGray">Duration</p>
                      <p className="font-medium">{formatDuration(tracking.duration)}</p>
                    </div>
                  </div>
                </div>

                {/* Location */}
                {tracking.location && (
                  <div className="flex items-start gap-3 text-nilin-charcoal pt-4 border-t border-nilin-border">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <p className="text-xs text-nilin-warmGray">Location</p>
                      <p className="font-medium">{formatAddress(tracking.location)}</p>
                      {tracking.location.notes && (
                        <p className="text-sm text-nilin-warmGray mt-1">{tracking.location.notes}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing */}
              {tracking.pricing && (
                <div className="p-6 border-b border-nilin-border">
                  <h4 className="font-semibold text-nilin-charcoal mb-4">Pricing Details</h4>
                  <div className="space-y-2">
                    {tracking.pricing.basePrice != null && (
                      <div className="flex justify-between text-nilin-warmGray">
                        <span>Service Fee</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.basePrice.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.addOns?.map((addon, idx) => (
                      <div key={idx} className="flex justify-between text-nilin-warmGray">
                        <span>{addon.name}</span>
                        <span>+{tracking.pricing.currency} {addon.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {tracking.pricing.discounts?.map((discount, idx) => (
                      <div key={idx} className="flex justify-between text-green-600">
                        <span>
                          {discount.description || 'Discount'}
                          {discount.code && <span className="text-xs ml-1">({discount.code})</span>}
                        </span>
                        <span>-{tracking.pricing.currency} {discount.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {tracking.pricing.couponDiscount && tracking.pricing.couponDiscount > 0 && !tracking.pricing.discounts?.some(d => d.code) && (
                      <div className="flex justify-between text-green-600">
                        <span>Coupon Discount</span>
                        <span>-{tracking.pricing.currency} {tracking.pricing.couponDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.subtotal != null && (
                      <div className="flex justify-between text-nilin-warmGray pt-2 border-t border-nilin-border">
                        <span>Subtotal</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.tax != null && (
                      <div className="flex justify-between text-nilin-warmGray">
                        <span>Tax (VAT)</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-nilin-charcoal text-lg pt-2 border-t border-nilin-border">
                      <span>Total</span>
                      <span>{tracking.pricing.currency} {tracking.pricing.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Offer Details Section */}
              {(tracking.pricing.couponDiscount || (tracking.pricing.discounts && tracking.pricing.discounts.length > 0)) && (
                <div className="p-6 border-b border-nilin-border">
                  <h4 className="font-semibold text-nilin-charcoal mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    Offer Applied
                  </h4>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    {tracking.pricing.discounts?.map((discount, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-green-800">
                            {discount.description || 'Special Offer'}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            {discount.code && <span className="font-mono">Code: {discount.code}</span>}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            -{tracking.pricing.currency} {discount.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {!tracking.pricing.discounts?.length && tracking.pricing.couponDiscount && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-green-800">Promo Code Discount</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">
                            -{tracking.pricing.currency} {tracking.pricing.couponDiscount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Price Comparison with Strikethrough */}
                    {tracking.pricing.basePrice != null && tracking.pricing.couponDiscount > 0 && (
                      <div className="mt-4 pt-4 border-t border-green-200">
                        <div className="text-center">
                          <p className="text-sm text-green-700 mb-1">You Save</p>
                          <p className="text-3xl font-bold text-green-600">
                            -{tracking.pricing.currency} {tracking.pricing.couponDiscount?.toFixed(2) || tracking.pricing.discounts?.[0]?.amount.toFixed(2)}
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-lg text-green-700 line-through">
                              {tracking.pricing.currency} {tracking.pricing.basePrice.toFixed(2)}
                            </span>
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span className="text-xl font-bold text-green-800">
                              {tracking.pricing.currency} {tracking.pricing.totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Timeline */}
              {tracking.statusHistory && tracking.statusHistory.length > 0 && (
                <div className="p-6">
                  <h4 className="font-semibold text-nilin-charcoal mb-4">Status Timeline</h4>
                  <div className="space-y-0">
                    {tracking.statusHistory.map((entry, index) => {
                      const isCurrent = index === 0;
                      return (
                        <div key={index} className="flex gap-4 relative">
                          <div className="flex flex-col items-center">
                            {getStatusIcon(entry.status, isCurrent)}
                            {index < tracking.statusHistory.length - 1 && (
                              <div className="w-0.5 flex-1 bg-nilin-border mt-1" />
                            )}
                          </div>
                          <div className={`pb-6 ${index === tracking.statusHistory.length - 1 ? 'pb-0' : ''}`}>
                            <p className={`font-medium ${isCurrent ? 'text-nilin-charcoal' : 'text-nilin-warmGray'}`}>
                              {statusLabels[entry.status] || entry.status}
                            </p>
                            <p className="text-sm text-nilin-warmGray">
                              {new Date(entry.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {entry.reason && (
                              <p className="text-sm text-nilin-warmGray mt-1">{entry.reason}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Booking Chat */}
              {isAuthenticated &&
                tracking._id &&
                tracking.providerId &&
                (user?._id || user?.id || tracking.customerId) &&
                !['cancelled', 'rejected'].includes(tracking.status) && (
                <div className="p-6 border-b border-nilin-border">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h4 className="font-semibold text-nilin-charcoal flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-nilin-coral" />
                      Message {tracking.provider?.name || 'your provider'}
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/customer/messages', {
                          state: {
                            bookingId: tracking._id,
                            providerId: tracking.providerId,
                          },
                        })
                      }
                      className="text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
                    >
                      Open in Messages
                    </button>
                  </div>
                  <BookingChat
                    bookingId={tracking._id}
                    customerId={(user?._id || user?.id || tracking.customerId)!}
                    customerName={
                      `${user?.firstName || tracking.customerInfo?.firstName || ''} ${user?.lastName || tracking.customerInfo?.lastName || ''}`.trim() || 'Customer'
                    }
                    customerAvatar={user?.avatar}
                    providerId={tracking.providerId}
                    providerName={tracking.provider?.name || 'Provider'}
                    currentUserId={(user?._id || user?.id)!}
                    currentUserRole="customer"
                    bookingStatus={tracking.status}
                    serviceName={tracking.service?.name}
                    scheduledDate={`${tracking.scheduledDate}T${tracking.scheduledTime || '00:00'}`}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-6 bg-nilin-cream border-t border-nilin-border">
                {/* Real-time update indicator */}
                {isConnected && lastUpdate && (
                  <div className="flex items-center gap-2 text-xs text-green-600 mb-4">
                    <RefreshCw className="w-3 h-3" />
                    <span>Live updates active</span>
                  </div>
                )}

                {/* Cancel and Reschedule Buttons */}
                {canCancel && isAuthenticated && (
                  <div className="flex flex-wrap gap-3 mb-4">
                    {canReschedule && (
                      <button
                        onClick={() => setShowRescheduleModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-nilin-border text-nilin-charcoal rounded-nilin font-medium hover:bg-nilin-blush/30 transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Reschedule
                      </button>
                    )}
                    <button
                      onClick={() => setShowCancellationModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-nilin font-medium hover:bg-red-100 transition-colors"
                    >
                      <AlertCircle className="w-4 h-4" />
                      Cancel Booking
                    </button>
                  </div>
                )}

                {/* Completed - Share Experience */}
                {tracking.status === 'completed' && isAuthenticated && !checkingExperience && (
                  <div className="mb-4">
                    {hasExperience ? (
                      <div className="flex items-center gap-2 text-green-600 bg-green-50 rounded-nilin p-4">
                        <Star className="w-5 h-5 fill-current" />
                        <span className="font-medium">Experience Shared</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowExperienceForm(true)}
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-nilin font-semibold hover:bg-nilin-rose transition-colors"
                      >
                        <Share2 className="w-5 h-5" />
                        Share Your Experience
                      </button>
                    )}
                  </div>
                )}

                {/* View Full Details for logged-in users */}
                {isAuthenticated && tracking._id && (
                  <Link
                    to={`/customer/bookings/${tracking._id}`}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-nilin-charcoal text-white rounded-nilin font-semibold hover:bg-nilin-warmGray transition-colors"
                  >
                    View Full Details
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                )}

                {/* Login prompt for guests */}
                {!isAuthenticated && (
                  <div className="space-y-3">
                    <p className="text-center text-nilin-warmGray text-sm">
                      Sign in with the same email used for this booking to see it in My Bookings
                    </p>
                    <Link
                      to="/login"
                      state={{
                        returnTo: '/customer/bookings',
                        email: tracking.guestEmail || tracking.customerInfo?.email,
                        message:
                          'Use the email from your booking confirmation to link this booking to your account.',
                      }}
                      className="block w-full text-center px-6 py-3 bg-nilin-charcoal text-white rounded-nilin font-semibold hover:bg-nilin-warmGray transition-colors"
                    >
                      Sign In
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 text-center">
            <p className="text-nilin-warmGray text-sm mb-2">Need help with your booking?</p>
            <Link
              to="/contact"
              className="text-nilin-coral hover:underline text-sm font-medium"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </div>

      <Footer />

      {/* Experience Submission Modal */}
      {showExperienceForm && tracking?._id && (
        <ExperienceSubmissionForm
          isOpen={showExperienceForm}
          onClose={() => setShowExperienceForm(false)}
          bookingId={tracking._id}
          onSuccess={() => {
            setShowExperienceForm(false);
            setHasExperience(true);
          }}
        />
      )}

      {/* Cancellation Modal */}
      {showCancellationModal && tracking && (
        <CancellationModal
          isOpen={showCancellationModal}
          onClose={() => setShowCancellationModal(false)}
          booking={tracking}
          onConfirm={handleCancelBooking}
          isLoading={cancelling}
        />
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && tracking && (
        <RescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          booking={tracking}
          onConfirm={handleRescheduleBooking}
          isLoading={rescheduling}
        />
      )}
    </div>
  );
};

export default TrackBookingPage;
