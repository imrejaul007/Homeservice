/**
 * UpcomingBookings Component
 * Shows the next upcoming bookings with quick actions
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Star,
  ChevronRight,
  X,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  Video,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { toast } from 'react-hot-toast';
import type { Booking, BookingStatus } from '../../types/booking.types';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';

// =============================================================================
// Types
// =============================================================================

interface UpcomingBookingsProps {
  limit?: number;
  showViewAll?: boolean;
}

// =============================================================================
// Status Configuration
// =============================================================================

const STATUS_CONFIG: Record<
  BookingStatus,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: CheckCircle2,
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50 border-purple-200',
    icon: Loader2,
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 border-emerald-200',
    icon: CheckCircle2,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'text-red-700',
    bgColor: 'bg-red-50 border-red-200',
    icon: XCircle,
  },
  no_show: {
    label: 'No Show',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: User,
  },
  refunded: {
    label: 'Refunded',
    color: 'text-gray-700',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: RefreshCw,
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

const formatBookingDate = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  } catch {
    return dateStr;
  }
};

const canCancelBooking = (booking: Booking): boolean => {
  const cancelableStatuses: BookingStatus[] = ['pending', 'confirmed'];
  if (!cancelableStatuses.includes(booking.status)) return false;

  try {
    const bookingDate = parseISO(booking.scheduledDate);
    const now = new Date();
    const hoursUntilBooking =
      (bookingDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursUntilBooking >= 24;
  } catch {
    return false;
  }
};

const getTimeUntilBooking = (dateStr: string, timeStr: string): string => {
  try {
    const now = new Date();
    const [hours, minutes] = timeStr.split(':').map(Number);
    const bookingDate = parseISO(dateStr);
    bookingDate.setHours(hours, minutes, 0, 0);

    const diffMs = bookingDate.getTime() - now.getTime();
    if (diffMs < 0) return 'Started';

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${mins}m`;
  } catch {
    return '';
  }
};

// =============================================================================
// Component
// =============================================================================

const UpcomingBookings: React.FC<UpcomingBookingsProps> = ({
  limit = 3,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    customerBookings,
    isLoading,
    errors,
    getCustomerBookings,
    cancelBooking,
  } = useBookingStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<Record<string, string>>({});

  const fetchBookings = useCallback(async () => {
    try {
      await getCustomerBookings({
        limit: 10,
        sortBy: 'scheduledDate',
        sortOrder: 'asc',
      });
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    }
  }, []); // Filters are static, no need to depend on getCustomerBookings (Zustand stable reference)

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBookings();
    setIsRefreshing(false);
  };

  const handleViewDetails = (booking: Booking) => {
    navigate(`/customer/bookings/${booking._id}`);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!cancelReason[bookingId]?.trim()) return;

    try {
      setCancellingId(bookingId);
      await cancelBooking(bookingId, { reason: cancelReason[bookingId] });
      setShowCancelModal(null);
      setCancelReason(prev => {
        const next = { ...prev };
        delete next[bookingId];
        return next;
      });
      toast.success('Booking cancelled successfully');
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      toast.error('Failed to cancel booking. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleViewAll = () => {
    navigate('/customer/bookings');
  };

  // Filter and sort upcoming bookings (non-cancelled, future dates)
  const upcomingBookings = customerBookings
    .filter((booking) => {
      const isActive = !['cancelled', 'completed', 'refunded'].includes(booking.status);
      const bookingDate = new Date(booking.scheduledDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return isActive && bookingDate >= today;
    })
    .slice(0, limit);

  if (isLoading && customerBookings.length === 0) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header Skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded-lg w-40 mb-1.5" />
              <div className="h-4 bg-gray-100 rounded w-52" />
            </div>
          </div>

          {/* Booking Cards Skeleton */}
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                  </div>
                  <div className="h-6 bg-gray-100 rounded-full w-20" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (upcomingBookings.length === 0) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-serif font-light text-nilin-charcoal">
                Upcoming Bookings
              </h2>
              <p className="text-xs text-nilin-warmGray">
                Your scheduled appointments
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Refresh bookings"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>

          {/* Empty State */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl p-8 text-center border border-gray-200">
            <Calendar className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              No Upcoming Bookings
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto mb-5">
              You don't have any scheduled appointments. Book a service to get started!
            </p>
            <button
              onClick={() => navigate('/search')}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-nilin-rose hover:bg-nilin-coral text-white rounded-xl text-sm font-medium transition-all shadow-nilin-warm hover:shadow-nilin-lg"
            >
              Book a Service
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6" aria-labelledby="upcoming-heading">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              id="upcoming-heading"
              className="text-lg font-serif font-light text-nilin-charcoal"
            >
              Upcoming Bookings
            </h2>
            <p className="text-xs text-nilin-warmGray">
              {upcomingBookings.length} scheduled{' '}
              {upcomingBookings.length === 1 ? 'appointment' : 'appointments'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showViewAll && (
              <button
                onClick={handleViewAll}
                className="hidden sm:flex items-center gap-1 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
              >
                View all
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Refresh bookings"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Booking Cards */}
        <div className="space-y-3">
          {upcomingBookings.map((booking, index) => {
            const statusConfig = STATUS_CONFIG[booking.status] ?? { label: booking.status, color: 'text-gray-700', bgColor: 'bg-gray-50', icon: AlertCircle };
            const StatusIcon = statusConfig.icon;
            const canCancel = canCancelBooking(booking);
            const timeUntil = getTimeUntilBooking(
              booking.scheduledDate,
              booking.scheduledTime
            );

            return (
              <article
                key={booking._id}
                className="group relative bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-gray-200 transition-all duration-200"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Provider Avatar */}
                    <div className="flex-shrink-0">
                      {booking.provider?.avatar ? (
                        <img
                          src={booking.provider.avatar}
                          alt={booking.provider.businessInfo?.businessName || `${booking.provider.firstName} ${booking.provider.lastName}`}
                          className="w-12 h-12 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-nilin-blush to-nilin-coral flex items-center justify-center">
                          <User className="w-6 h-6 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {/* Service Name */}
                          <h3 className="font-sans font-medium text-nilin-charcoal text-sm line-clamp-1 group-hover:text-nilin-rose transition-colors">
                            {booking.service?.name || 'Service'}
                          </h3>

                          {/* Provider Name */}
                          {booking.provider && (
                            <p className="text-xs text-nilin-warmGray mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {booking.provider.businessInfo?.businessName ||
                                `${booking.provider.firstName} ${booking.provider.lastName}`}
                            </p>
                          )}

                          {/* Date & Time */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatBookingDate(booking.scheduledDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {booking.scheduledTime}
                            </span>
                            {booking.locationType === 'at_home' && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                At Home
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="flex-shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${statusConfig.bgColor} ${statusConfig.color}`}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                      </div>

                      {/* Time Until Booking (for next booking only) */}
                      {index === 0 && timeUntil && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="px-3 py-1.5 bg-nilin-rose/10 rounded-full">
                            <span className="text-xs font-medium text-nilin-rose">
                              {timeUntil} until appointment
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => handleViewDetails(booking)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-nilin-primary/10 text-nilin-primary rounded-lg text-xs font-medium hover:bg-nilin-primary hover:text-white transition-all"
                        >
                          View Details
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {canCancel && (
                          <button
                            onClick={() => setShowCancelModal(booking._id)}
                            className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium transition-colors"
                          >
                            Cancel
                          </button>
                        )}

                        {booking.status === 'confirmed' && (
                          <>
                            <button
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              aria-label="Call provider"
                            >
                              <Phone className="w-4 h-4" />
                            </button>
                            <button
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              aria-label="Message provider"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cancel Modal */}
                {showCancelModal === booking._id && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-10">
                    <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-xl">
                      <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
                        Cancel Booking
                      </h3>
                      <p className="text-sm text-gray-500 mb-4">
                        Are you sure you want to cancel this booking? This action cannot be undone.
                      </p>
                      <textarea
                        value={cancelReason[booking._id] || ''}
                        onChange={(e) => setCancelReason(prev => ({ ...prev, [booking._id]: e.target.value }))}
                        placeholder="Reason for cancellation (optional)"
                        className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-nilin-rose/20 focus:border-nilin-rose"
                        rows={3}
                      />
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={() => {
                            setShowCancelModal(null);
                            setCancelReason(prev => {
                              const next = { ...prev };
                              delete next[booking._id];
                              return next;
                            });
                          }}
                          className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Keep Booking
                        </button>
                        <button
                          onClick={() => handleCancelBooking(booking._id)}
                          disabled={cancellingId === booking._id}
                          className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          {cancellingId === booking._id ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            'Cancel Booking'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Mobile View All */}
        {showViewAll && upcomingBookings.length > 0 && (
          <div className="mt-4 text-center sm:hidden">
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              View all bookings
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default UpcomingBookings;
