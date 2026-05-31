import React, { useEffect, useState } from 'react';
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
  RefreshCw
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import Timeline from '../../components/customer/Timeline';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { TimelineEvent } from '../../components/customer/Timeline';
import { toast } from 'react-hot-toast';

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
    isLoading
  } = useBookingStore();
  const [error, setError] = useState<BookingError | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

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
    try {
      await cancelBooking(currentBooking._id, { reason: 'Customer requested cancellation' });
      toast.success('Booking cancelled successfully');
      navigate('/customer/bookings');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel booking';
      toast.error(errorMessage);
    }
  };

  // Convert booking status to timeline events
  const getTimelineEvents = (): TimelineEvent[] => {
    if (!currentBooking) return [];

    const events: TimelineEvent[] = [
      {
        id: '1',
        title: 'Booking Created',
        description: 'Your booking request has been submitted',
        timestamp: new Date(currentBooking.createdAt).toLocaleString(),
        status: 'completed'
      }
    ];

    if (currentBooking.status === 'confirmed' || currentBooking.status === 'in_progress' || currentBooking.status === 'completed') {
      events.push({
        id: '2',
        title: 'Booking Confirmed',
        description: 'Provider has confirmed your booking',
        timestamp: currentBooking.confirmedAt ? new Date(currentBooking.confirmedAt).toLocaleString() : undefined,
        status: 'completed'
      });
    }

    if (currentBooking.status === 'in_progress' || currentBooking.status === 'completed') {
      events.push({
        id: '3',
        title: 'Service Started',
        description: 'Provider has started the service',
        timestamp: currentBooking.startedAt ? new Date(currentBooking.startedAt).toLocaleString() : undefined,
        status: currentBooking.status === 'in_progress' ? 'current' : 'completed'
      });
    }

    if (currentBooking.status === 'completed') {
      events.push({
        id: '4',
        title: 'Service Completed',
        description: 'Service has been completed successfully',
        timestamp: currentBooking.completedAt ? new Date(currentBooking.completedAt).toLocaleString() : undefined,
        status: 'completed'
      });
    } else if (currentBooking.status !== 'cancelled') {
      events.push({
        id: '4',
        title: 'Service Completion',
        description: 'Waiting for service completion',
        status: 'pending'
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
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-nilin-charcoal">
                  <User className="h-5 w-5 text-nilin-rose" />
                  <div>
                    <div className="text-sm text-nilin-warmGray">Provider</div>
                    <div className="font-medium">
                      {currentBooking.provider?.firstName} {currentBooking.provider?.lastName}
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
                  <div className="text-2xl font-bold text-nilin-coral">{currentBooking.pricing.currency || 'AED'} {currentBooking.pricing.totalAmount}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-nilin-border p-6 mb-6">
            <h2 className="text-xl font-bold text-nilin-charcoal mb-6">Booking Timeline</h2>
            <Timeline events={getTimelineEvents()} />
          </div>

          {/* Actions */}
          {(currentBooking.status === 'pending' || currentBooking.status === 'confirmed') && (
            <div className="bg-white rounded-xl border border-nilin-border p-6">
              <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Actions</h3>
              <div className="flex gap-3">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Cancel Booking</h3>
            <p className="text-nilin-warmGray mb-6">Are you sure you want to cancel this booking?</p>
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

export default BookingDetailPage;
