import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Star,
  MessageCircle,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Edit,
  Navigation
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import Timeline from '../../components/customer/Timeline';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import { socketService } from '../../services/socket';
// Issue #7 fix: Import useBookingAdminUpdates for real-time admin update notifications
import { useBookingAdminUpdates } from '../../hooks/useSocket';
import { formatBookingPrice } from '../../utils/formatting';
import { buildBookingTimeline } from '../../utils/timeline';

interface BookingError {
  message: string;
  code?: string;
}

const BookingDetailPage: React.FC = () => {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentBooking,
    getBooking,
    cancelBooking,
    rescheduleBooking,
    isLoading,
    isSubmitting
  } = useBookingStore();
  const [error, setError] = useState<BookingError | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [modalRef, setModalRef] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (bookingId) {
      setError(null);
      getBooking(bookingId).catch((err: unknown) => {
        const errorObj = err as Error;
        setError({
          message: errorObj?.message || 'Failed to load booking details',
          code: (err as { code?: string })?.code
        });
      });
    }
  }, [bookingId]);

  // Socket subscription for real-time booking status updates
  useEffect(() => {
    if (!bookingId) return;

    const handleStatusChange = (data: { bookingId: string; status: string }) => {
      if (data.bookingId === bookingId) {
        // Refresh booking data when status changes
        getBooking(bookingId).catch((err: unknown) => {
          console.error('Failed to refresh booking after status change:', err);
        });
        toast.success(`Booking status updated to: ${data.status.replace('_', ' ')}`);
      }
    };

    // Subscribe to generic status change event
    const unsubscribeGeneric = socketService.onBookingStatusChanged(handleStatusChange);

    // Subscribe to specific booking events to ensure all status changes are captured
    const unsubscribeConfirmed = socketService.on('booking:confirmed', handleStatusChange);
    const unsubscribeCancelled = socketService.on('booking:cancelled', handleStatusChange);
    const unsubscribeCompleted = socketService.on('booking:completed', handleStatusChange);

    return () => {
      unsubscribeGeneric();
      unsubscribeConfirmed();
      unsubscribeCancelled();
      unsubscribeCompleted();
    };
  }, [bookingId, getBooking]);

  // Issue #7 fix: Subscribe to admin booking updates for real-time notifications
  const { bookingUpdated } = useBookingAdminUpdates();

  useEffect(() => {
    if (bookingUpdated && bookingUpdated.bookingId === bookingId) {
      // Refresh booking data when admin updates
      getBooking(bookingId).catch((err: unknown) => {
        console.error('Failed to refresh booking after admin update:', err);
      });
      toast.success(`Admin updated booking: ${bookingUpdated.status.replace('_', ' ')}`);
    }
  }, [bookingUpdated, bookingId, getBooking]);

  // Focus trap for cancel modal accessibility
  useEffect(() => {
    if (showCancelModal && modalRef) {
      const focusableElements = modalRef.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      firstElement?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
        if (e.key === 'Escape') {
          setShowCancelModal(false);
        }
      };

      modalRef.addEventListener('keydown', handleKeyDown);
      return () => modalRef.removeEventListener('keydown', handleKeyDown);
    }
  }, [showCancelModal, modalRef]);

  if (!user) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-nilin-warmGray">Please log in to view booking details.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const handleCancelClick = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!currentBooking) return;
    setShowCancelModal(false);
    setIsCancelling(true);
    try {
      await cancelBooking(currentBooking._id, { reason: 'Customer requested cancellation' });
      toast.success('Booking cancelled successfully');
      navigate('/customer/bookings');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel booking';
      toast.error(errorMessage);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRescheduleClick = () => {
    if (!currentBooking) return;
    // Navigate to reschedule page with booking details pre-filled
    navigate(`/customer/bookings/${currentBooking._id}/reschedule`, {
      state: {
        booking: currentBooking
      }
    });
  };

  // Build timeline events using unified utility
  const timelineEvents = useMemo(() => {
    if (!currentBooking) return [];
    return buildBookingTimeline(currentBooking);
  }, [currentBooking]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">Unable to Load Booking</h2>
            <p className="text-nilin-warmGray mb-6">{error.message}</p>
            <button
              onClick={() => {
                setError(null);
                if (bookingId) getBooking(bookingId);
              }}
              className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-lg hover:shadow-lg transition-shadow inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!currentBooking) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">Booking Not Found</h2>
            <p className="text-nilin-warmGray mb-6">We couldn't find the booking you're looking for.</p>
            <button
              onClick={() => navigate('/customer/bookings')}
              className="px-6 py-3 bg-nilin-coral text-white font-semibold rounded-lg hover:shadow-lg transition-shadow"
            >
              View All Bookings
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-orange-100 text-orange-800'
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      {/* Breadcrumb Navigation */}
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Header */}
          <div className="bg-white rounded-xl border border-nilin-border p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-nilin-charcoal mb-2">
                  {currentBooking.service?.name || 'Service Booking'}
                </h1>
                <p className="text-nilin-warmGray">Booking #{currentBooking.bookingNumber}</p>
              </div>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${statusColors[currentBooking.status]}`}>
                {currentBooking.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-nilin-charcoal">
                  <Calendar className="h-5 w-5 text-nilin-rose" />
                  <div>
                    <div className="text-sm text-nilin-warmGray">Date</div>
                    <div className="font-medium">{new Date(currentBooking.scheduledDate).toLocaleDateString()}</div>
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
                  <MapPin className="h-5 w-5 text-nilin-rose" />
                  <div>
                    <div className="text-sm text-nilin-warmGray">Location</div>
                    <div className="font-medium">
                      {currentBooking.address?.street}, {currentBooking.address?.city}
                    </div>
                  </div>
                  {currentBooking.status === 'in_progress' && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${currentBooking.address?.street}, ${currentBooking.address?.city}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-nilin-coral text-white text-sm font-medium rounded-lg hover:bg-nilin-rose transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Track
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-nilin-charcoal">
                  <User className="h-5 w-5 text-nilin-rose" />
                  <div>
                    <div className="text-sm text-nilin-warmGray">Provider</div>
                    <div className="font-medium">
                      {currentBooking.provider?.firstName && currentBooking.provider?.lastName
                        ? `${currentBooking.provider.firstName} ${currentBooking.provider.lastName}`
                        : currentBooking.provider?.firstName || currentBooking.provider?.lastName || 'Provider to be assigned'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-nilin-charcoal">
                  <Phone className="h-5 w-5 text-nilin-rose" />
                  <div>
                    <div className="text-sm text-nilin-warmGray">Contact</div>
                    <div className="font-medium">{currentBooking.customerInfo?.phone}</div>
                  </div>
                </div>
                <div className="p-4 bg-nilin-blush/30 rounded-lg">
                  <div className="text-sm text-nilin-warmGray mb-1">Total Amount</div>
                  <div className="text-2xl font-bold text-nilin-coral">{formatBookingPrice(currentBooking.pricing.totalAmount, currentBooking.pricing.currency || 'AED')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-nilin-border p-6 mb-6">
            <h2 className="text-xl font-bold text-nilin-charcoal mb-6">Booking Timeline</h2>
            <Timeline events={timelineEvents} />
          </div>

          {/* Actions */}
          {(currentBooking.status === 'pending' || currentBooking.status === 'confirmed') && (
            <div className="bg-white rounded-xl border border-nilin-border p-6">
              <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                {currentBooking.status === 'pending' || currentBooking.status === 'confirmed' ? (
                  <button
                    onClick={handleRescheduleClick}
                    className="px-6 py-3 bg-blue-100 text-blue-700 font-semibold rounded-lg hover:bg-blue-200 transition-colors inline-flex items-center gap-2"
                  >
                    <Edit className="h-4 w-4" />
                    Reschedule Booking
                  </button>
                ) : null}
                <button
                  onClick={handleCancelClick}
                  className="px-6 py-3 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200 transition-colors"
                >
                  Cancel Booking
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {/* Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCancelModal(false);
          }}
        >
          <div
            ref={setModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          >
            <h3 id="cancel-modal-title" className="text-lg font-semibold text-nilin-charcoal mb-4">Cancel Booking</h3>
            <p className="text-nilin-warmGray mb-6">Are you sure you want to cancel this booking?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="min-h-11 px-4 py-2 text-nilin-warmGray hover:bg-nilin-muted rounded-lg transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling}
                className="min-h-11 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {isCancelling ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Cancelling...
                  </>
                ) : (
                  'Cancel Booking'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingDetailPage;
