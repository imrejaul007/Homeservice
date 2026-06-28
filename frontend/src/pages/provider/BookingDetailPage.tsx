import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  Star,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  MessageCircle,
  DollarSign,
  Home,
  Briefcase,
  CreditCard,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { Skeleton } from '../../components/common/SkeletonLoader';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import { useToastActions } from '../../components/common/Toast';
import { BookingChat } from '../../components/chat';
import { showErrorToast, showSuccessToast, showWarningToast } from '../../lib/errorHandler';

interface BookingDetailPageProps {
  isProvider?: boolean;
}

const ProviderBookingDetailPage: React.FC<BookingDetailPageProps> = ({ isProvider = true }) => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const toast = useToastActions();
  const { user } = useAuthStore();
  const {
    currentBooking,
    getBooking,
    acceptBooking,
    rejectBooking,
    markBookingPaymentCompleted,
    completeBooking,
    startBooking,
    cancelBooking,
    isLoading,
    errors
  } = useBookingStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const previousBookingRef = useRef<typeof currentBooking>(null);

  const fetchBooking = useCallback(async () => {
    if (!bookingId) return;
    setFetchError(null);
    try {
      await getBooking(bookingId);
    } catch (err) {
      const error = err as { message?: string; response?: { status?: number } };
      const isNetworkError = !navigator.onLine || error.response?.status === 0;
      if (isNetworkError) {
        setFetchError('Connection error. Please check your internet connection.');
      } else if (error.response?.status === 404) {
        setFetchError('Booking not found. It may have been deleted.');
      } else {
        setFetchError(error.message || 'Failed to load booking details.');
      }
    }
  }, [bookingId, getBooking]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  if (!user) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-nilin-warmGray">Please log in to view booking details.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const handleAcceptBooking = async () => {
    if (!currentBooking) return;
    setActionLoading('accept');
    try {
      await acceptBooking(currentBooking._id);
      showSuccessToast('Booking accepted', 'The customer has been notified');
      await getBooking(currentBooking._id);
    } catch (error) {
      showErrorToast(error, 'Failed to accept booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectBooking = async () => {
    if (!currentBooking) return;
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleConfirmReject = async () => {
    if (!currentBooking) return;
    const reason = rejectReason.trim() || 'Provider unavailable';
    setShowRejectModal(false);
    setActionLoading('reject');
    setRejectReason('');
    try {
      await rejectBooking(currentBooking._id, { reason });
      showWarningToast('Booking rejected', 'The customer has been notified');
      await getBooking(currentBooking._id);
    } catch (error) {
      showErrorToast(error, 'Failed to reject booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartBooking = async () => {
    if (!currentBooking) return;
    setActionLoading('start');
    try {
      await startBooking(currentBooking._id);
      toast('Service started', {
        icon: 'ℹ️',
        description: 'The service is now in progress',
      });
      await getBooking(currentBooking._id);
    } catch (error) {
      showErrorToast(error, 'Failed to start service');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteBooking = async () => {
    if (!currentBooking) return;
    setActionLoading('complete');
    try {
      await completeBooking(currentBooking._id);
      showSuccessToast('Service completed', 'Thank you for your service');
      await getBooking(currentBooking._id);
    } catch (error) {
      showErrorToast(error, 'Failed to complete booking');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkPaymentCompleted = async () => {
    if (!currentBooking) return;
    setActionLoading('payment');
    try {
      await markBookingPaymentCompleted(currentBooking._id, {
        notes: 'Payment received by provider',
      });
      showSuccessToast('Payment marked as completed', 'You can now complete this booking');
      await getBooking(currentBooking._id);
    } catch (error) {
      showErrorToast(error, 'Failed to mark payment as completed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelBooking = async () => {
    if (!currentBooking) return;
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!currentBooking) return;
    const reason = cancelReason.trim() || 'Provider cancelled';
    setShowCancelModal(false);
    setActionLoading('cancel');
    setCancelReason('');
    try {
      await cancelBooking(currentBooking._id, { reason });
      showWarningToast('Booking cancelled');
      await getBooking(currentBooking._id);
    } catch (error) {
      showErrorToast(error, 'Failed to cancel booking');
    } finally {
      setActionLoading(null);
    }
  };

  // Convert booking status to timeline events
  const getTimelineEvents = () => {
    if (!currentBooking) return [];

    const events: Array<{
      id: string;
      title: string;
      description: string;
      timestamp?: string;
      status: 'completed' | 'current' | 'cancelled';
    }> = [
      {
        id: '1',
        title: 'Booking Created',
        description: 'Customer submitted booking request',
        timestamp: new Date(currentBooking.createdAt).toLocaleString(),
        status: 'completed'
      }
    ];

    if (currentBooking.status === 'confirmed' || currentBooking.status === 'in_progress' || currentBooking.status === 'completed') {
      events.push({
        id: '2',
        title: 'Booking Confirmed',
        description: 'You confirmed the booking',
        timestamp: currentBooking.confirmedAt ? new Date(currentBooking.confirmedAt).toLocaleString() : undefined,
        status: 'completed'
      });
    }

    if (currentBooking.status === 'in_progress' || currentBooking.status === 'completed') {
      events.push({
        id: '3',
        title: 'Service Started',
        description: 'Service is now in progress',
        timestamp: currentBooking.startedAt ? new Date(currentBooking.startedAt).toLocaleString() : undefined,
        status: currentBooking.status === 'in_progress' ? 'current' : 'completed'
      });
    }

    if (currentBooking.status === 'completed') {
      events.push({
        id: '4',
        title: 'Service Completed',
        description: 'Service has been completed',
        timestamp: currentBooking.completedAt ? new Date(currentBooking.completedAt).toLocaleString() : undefined,
        status: 'completed'
      });
    }

    if (currentBooking.status === 'cancelled') {
      events.push({
        id: 'cancelled',
        title: 'Booking Cancelled',
        description: currentBooking.cancellationReason || 'Booking was cancelled',
        timestamp: currentBooking.cancelledAt ? new Date(currentBooking.cancelledAt).toLocaleString() : undefined,
        status: 'cancelled'
      });
    }

    return events;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="flex-1">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header skeleton */}
            <div className="glass-nilin rounded-nilin-lg p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </div>
            </div>

            {/* Details skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="glass-nilin rounded-nilin-lg p-6">
                <Skeleton className="h-5 w-32 mb-4" />
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Skeleton className="w-4 h-4" />
                    <Skeleton className="h-4 w-44" />
                  </div>
                </div>
              </div>
              <div className="glass-nilin rounded-nilin-lg p-6">
                <Skeleton className="h-5 w-32 mb-4" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>

            {/* Actions skeleton */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <div className="flex gap-3">
                <Skeleton className="h-11 w-32 rounded-nilin" />
                <Skeleton className="h-11 w-28 rounded-nilin" />
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">Unable to Load Booking</h2>
            <p className="text-nilin-warmGray mb-6">{fetchError}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={fetchBooking}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-nilin-coral text-white font-semibold rounded-xl hover:bg-nilin-rose transition-colors shadow-nilin"
              >
                <RefreshCw className="h-5 w-5" />
                Try Again
              </button>
              <button
                onClick={() => navigate('/provider/bookings')}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-nilin-muted text-nilin-charcoal font-semibold rounded-xl hover:bg-nilin-blush transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                View All Bookings
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Fallback: if store has errors but local fetchError was not set (e.g., upstream
  // caller invoked getBooking without awaiting, or error was swallowed), surface the
  // error UI so the page never appears to hang.
  const storeErrorMessage =
    !fetchError && !isLoading && !currentBooking && errors && errors.length > 0
      ? errors[0]?.message || 'Failed to load booking details.'
      : null;
  if (storeErrorMessage) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">Unable to Load Booking</h2>
            <p className="text-nilin-warmGray mb-6">{storeErrorMessage}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={fetchBooking}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-nilin-coral text-white font-semibold rounded-xl hover:bg-nilin-rose transition-colors shadow-nilin"
              >
                <RefreshCw className="h-5 w-5" />
                Try Again
              </button>
              <button
                onClick={() => navigate('/provider/bookings')}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-nilin-muted text-nilin-charcoal font-semibold rounded-xl hover:bg-nilin-blush transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                View All Bookings
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!currentBooking && !fetchError) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-nilin-warmGray mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">Booking Not Found</h2>
            <p className="text-nilin-warmGray mb-6">We couldn't find the booking you're looking for.</p>
            <button
              onClick={() => navigate('/provider/bookings')}
              className="btn-nilin"
            >
              View All Bookings
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const statusConfig = {
    pending: {
      label: 'Pending',
      color: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: Clock
    },
    confirmed: {
      label: 'Confirmed',
      color: 'bg-nilin-coral/20 text-nilin-coral border-nilin-coral/30',
      icon: CheckCircle
    },
    in_progress: {
      label: 'In Progress',
      color: 'bg-nilin-gold/20 text-nilin-gold border-nilin-gold/30',
      icon: Briefcase
    },
    completed: {
      label: 'Completed',
      color: 'bg-green-100 text-green-800 border-green-200',
      icon: CheckCircle
    },
    cancelled: {
      label: 'Cancelled',
      color: 'bg-red-100 text-red-800 border-red-200',
      icon: XCircle
    }
  };

  const status = currentBooking.status as keyof typeof statusConfig;
  const StatusIcon = statusConfig[status].icon;

  const customerId = currentBooking.customerId || currentBooking.customer?._id || '';
  const providerId = user._id || user.id || currentBooking.providerId || currentBooking.provider?._id || '';
  const customerName = `${currentBooking.customer?.firstName || currentBooking.customerInfo?.firstName || ''} ${currentBooking.customer?.lastName || currentBooking.customerInfo?.lastName || ''}`.trim() || 'Customer';
  const providerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Provider';
  const canMessageCustomer = Boolean(customerId && providerId && currentBooking._id);
  const showBookingChat = canMessageCustomer && !['cancelled', 'rejected'].includes(currentBooking.status);

  const handleMessageCustomer = () => {
    if (!canMessageCustomer) return;
    navigate('/provider/messages', {
      state: {
        bookingId: currentBooking._id,
        customerId,
        providerId,
      },
    });
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Screen reader status announcer */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {actionLoading ? 'Processing request...' : ''}
        Booking status: {statusConfig[status].label}
      </div>

      {/* Breadcrumb Navigation */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb
          items={[
            { label: 'Dashboard', href: '/provider/dashboard' },
            { label: 'Bookings', href: '/provider/bookings' },
            { label: `Booking #${currentBooking.bookingNumber}`, href: '#' }
          ]}
        />
      </div>

      <main id="main-content" className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="bg-white rounded-xl border border-nilin-border p-6 mb-6 shadow-nilin">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-nilin-charcoal mb-1">
                  {currentBooking.service?.name || 'Service Booking'}
                </h1>
                <p className="text-nilin-warmGray">Booking #{currentBooking.bookingNumber}</p>
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${statusConfig[status].color}`}>
                <StatusIcon className="h-4 w-4" />
                <span className="font-semibold text-sm">{statusConfig[status].label}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Service Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-nilin-charcoal flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-nilin-coral" />
                  Service Details
                </h3>
                <div className="space-y-3 bg-nilin-blush/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <Calendar className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <div className="text-sm text-nilin-warmGray">Date</div>
                      <div className="font-medium">{new Date(currentBooking.scheduledDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <Clock className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <div className="text-sm text-nilin-warmGray">Time</div>
                      <div className="font-medium">{currentBooking.scheduledTime}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <DollarSign className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <div className="text-sm text-nilin-warmGray">Earnings</div>
                      <div className="font-bold text-green-600 text-lg">
                        {currentBooking.pricing?.currency || 'AED'} {currentBooking.pricing?.totalAmount || currentBooking.pricing?.basePrice || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Customer Info */}
              <div className="space-y-4">
                <h3 className="font-semibold text-nilin-charcoal flex items-center gap-2">
                  <User className="h-5 w-5 text-nilin-coral" />
                  Customer Information
                </h3>
                <div className="space-y-3 bg-nilin-blush/30 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <User className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <div className="text-sm text-nilin-warmGray">Name</div>
                      <div className="font-medium">
                        {currentBooking.customer?.firstName} {currentBooking.customer?.lastName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <Phone className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <div className="text-sm text-nilin-warmGray">Phone</div>
                      <div className="font-medium">{currentBooking.customerInfo?.phone}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <Mail className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <div className="text-sm text-nilin-warmGray">Email</div>
                      <div className="font-medium">{currentBooking.customer?.email}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="mt-6 pt-6 border-t border-nilin-border">
              <h3 className="font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
                <Home className="h-5 w-5 text-nilin-coral" />
                Service Location
              </h3>
              <div className="bg-nilin-blush/30 rounded-lg p-4">
                <div className="flex items-start gap-3 text-nilin-charcoal">
                  <MapPin className="h-5 w-5 text-nilin-rose mt-0.5" />
                  <div>
                    <div className="font-medium">
                      {currentBooking.address?.street}
                    </div>
                    <div className="text-sm text-nilin-warmGray">
                      {currentBooking.address?.city}, {currentBooking.address?.state} {currentBooking.address?.zipCode}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Booking Chat */}
          {showBookingChat && (
            <div className="bg-white rounded-xl border border-nilin-border p-6 mb-6 shadow-nilin">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-bold text-nilin-charcoal flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-nilin-coral" />
                  Messages
                </h2>
                <button
                  type="button"
                  onClick={handleMessageCustomer}
                  className="text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
                >
                  Open in Messages
                </button>
              </div>
              <BookingChat
                bookingId={currentBooking._id}
                customerId={customerId}
                customerName={customerName}
                customerAvatar={currentBooking.customer?.avatar}
                providerId={providerId}
                providerName={providerName}
                providerAvatar={user.avatar}
                currentUserId={providerId}
                currentUserRole="provider"
                bookingStatus={currentBooking.status}
                serviceName={currentBooking.service?.name}
                scheduledDate={`${currentBooking.scheduledDate}T${currentBooking.scheduledTime || '00:00'}`}
              />
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-nilin-border p-6 mb-6 shadow-nilin">
            <h2 className="text-xl font-bold text-nilin-charcoal mb-6">Booking Timeline</h2>
            <div className="relative">
              {getTimelineEvents().map((event, index) => (
                <div key={event.id} className="flex gap-4 mb-6 last:mb-0">
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      event.status === 'completed' ? 'bg-green-100 text-green-600' :
                      event.status === 'current' ? 'bg-nilin-coral text-white' :
                      event.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-nilin-muted text-nilin-warmGray'
                    }`}>
                      {event.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : event.status === 'cancelled' ? (
                        <XCircle className="h-5 w-5" />
                      ) : event.status === 'current' ? (
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                      ) : (
                        <div className="w-2 h-2 bg-current rounded-full" />
                      )}
                    </div>
                    {index < getTimelineEvents().length - 1 && (
                      <div className="w-0.5 h-full bg-nilin-border mt-2" />
                    )}
                  </div>
                  {/* Timeline content */}
                  <div className="flex-1 pb-6">
                    <h4 className={`font-semibold ${
                      event.status === 'completed' ? 'text-nilin-charcoal' :
                      event.status === 'cancelled' ? 'text-red-600' :
                      event.status === 'current' ? 'text-nilin-coral' :
                      'text-nilin-warmGray'
                    }`}>
                      {event.title}
                    </h4>
                    <p className="text-sm text-nilin-warmGray mt-1">{event.description}</p>
                    {event.timestamp && (
                      <p className="text-xs text-nilin-lightGray mt-1">{event.timestamp}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-white rounded-xl border border-nilin-border p-6 shadow-nilin">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {currentBooking.status === 'pending' && (
                <>
                  <button
                    onClick={handleAcceptBooking}
                    disabled={actionLoading === 'accept'}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-nilin font-semibold transition-colors shadow-nilin disabled:opacity-50"
                  >
                    <CheckCircle className="h-5 w-5" />
                    {actionLoading === 'accept' ? 'Accepting...' : 'Accept Booking'}
                  </button>
                  <button
                    onClick={handleRejectBooking}
                    disabled={actionLoading === 'reject'}
                    className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-6 py-3 rounded-nilin font-semibold transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-5 w-5" />
                    {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
                  </button>
                </>
              )}

              {currentBooking.status === 'confirmed' && (
                <>
                  <button
                    onClick={handleStartBooking}
                    disabled={actionLoading === 'start'}
                    className="flex items-center gap-2 bg-gradient-to-r from-nilin-rose to-nilin-coral hover:opacity-90 text-white px-6 py-3 rounded-nilin font-semibold transition-all shadow-nilin disabled:opacity-50"
                  >
                    <Briefcase className="h-5 w-5" />
                    {actionLoading === 'start' ? 'Starting...' : 'Start Service'}
                  </button>
                  <button
                    onClick={handleCancelBooking}
                    disabled={actionLoading === 'cancel'}
                    className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 px-6 py-3 rounded-nilin font-semibold transition-colors disabled:opacity-50"
                  >
                    <XCircle className="h-5 w-5" />
                    {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel'}
                  </button>
                </>
              )}

              {currentBooking.status === 'in_progress' && (
                <>
                  {currentBooking.paymentStatus !== 'completed' ? (
                    <button
                      onClick={handleMarkPaymentCompleted}
                      disabled={actionLoading === 'payment'}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-nilin font-semibold transition-colors shadow-nilin disabled:opacity-50"
                    >
                      <CreditCard className="h-5 w-5" />
                      {actionLoading === 'payment' ? 'Updating Payment...' : 'Mark Payment Received'}
                    </button>
                  ) : (
                    <button
                      onClick={handleCompleteBooking}
                      disabled={actionLoading === 'complete'}
                      className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-nilin font-semibold transition-colors shadow-nilin disabled:opacity-50"
                    >
                      <CheckCircle className="h-5 w-5" />
                      {actionLoading === 'complete' ? 'Completing...' : 'Complete Service'}
                    </button>
                  )}
                </>
              )}

              {currentBooking.status === 'completed' && (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-6 py-3 rounded-nilin font-semibold">
                  <Star className="h-5 w-5" />
                  Booking Completed - Payment Processing
                </div>
              )}

              {canMessageCustomer && (
                <button
                  type="button"
                  onClick={handleMessageCustomer}
                  className="flex items-center gap-2 bg-nilin-blush/60 hover:bg-nilin-blush text-nilin-charcoal px-6 py-3 rounded-nilin font-semibold transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  Message Customer
                </button>
              )}

              <button
                onClick={() => navigate('/provider/bookings')}
                className="flex items-center gap-2 bg-nilin-muted hover:bg-nilin-blush/50 text-nilin-charcoal px-6 py-3 rounded-nilin font-semibold transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                Back to Bookings
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* Reject Booking Confirmation Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Reject Booking</h3>
            <p className="text-nilin-warmGray mb-4">Are you sure you want to reject this booking? The customer will be notified.</p>
            <div className="mb-6">
              <label htmlFor="reject-reason" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Reason for rejection (optional)
              </label>
              <textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., Provider unavailable, Scheduling conflict..."
                rows={3}
                className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent resize-none text-nilin-charcoal placeholder:text-nilin-warmGray"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-nilin-warmGray hover:bg-nilin-muted rounded-lg transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Reject Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Cancel Booking</h3>
            <p className="text-nilin-warmGray mb-4">Are you sure you want to cancel this booking? The customer will be notified.</p>
            <div className="mb-6">
              <label htmlFor="cancel-reason" className="block text-sm font-medium text-nilin-charcoal mb-2">
                Reason for cancellation (optional)
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Provider cancelled, Customer requested..."
                rows={3}
                className="w-full px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent resize-none text-nilin-charcoal placeholder:text-nilin-warmGray"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-nilin-warmGray hover:bg-nilin-muted rounded-lg transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleConfirmCancel}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderBookingDetailPage;
