/**
 * OngoingBookings Component
 * Shows active bookings that are currently in progress with tracking info
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  User,
  Clock,
  RefreshCw,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Navigation,
  ExternalLink,
  MessageSquare,
  Phone,
  Play,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Booking } from '../../types/booking.types';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import { useSocketEvent } from '../../hooks/useSocket';

// =============================================================================
// Types
// =============================================================================

interface OngoingBookingsProps {
  limit?: number;
  showViewAll?: boolean;
}

interface ProgressInfo {
  percent: number;
  label: string;
  estimatedTimeRemaining: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const calculateProgress = (booking: Booking): ProgressInfo => {
  const now = new Date();
  const startedAt = booking.startedAt ? new Date(booking.startedAt) : null;
  const scheduledDuration = booking.estimatedDuration || booking.service?.duration || 60;

  if (!startedAt) {
    return {
      percent: 50,
      label: 'Started',
      estimatedTimeRemaining: `${scheduledDuration} min remaining`,
    };
  }

  const elapsedMs = now.getTime() - startedAt.getTime();
  const elapsedMinutes = elapsedMs / (1000 * 60);
  const totalMinutes = scheduledDuration;

  const percent = Math.min(100, Math.round((elapsedMinutes / totalMinutes) * 100));
  const remainingMinutes = Math.max(0, totalMinutes - elapsedMinutes);

  let label = 'In Progress';
  let estimatedTimeRemaining = '';

  if (percent >= 90) {
    label = 'Finishing Up';
  } else if (percent >= 50) {
    label = 'In Progress';
  }

  if (remainingMinutes > 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const mins = Math.round(remainingMinutes % 60);
    estimatedTimeRemaining = `${hours}h ${mins}m remaining`;
  } else if (remainingMinutes > 0) {
    estimatedTimeRemaining = `${Math.round(remainingMinutes)} min remaining`;
  } else {
    estimatedTimeRemaining = 'Completing shortly';
  }

  return { percent, label, estimatedTimeRemaining };
};

const getLocationText = (booking: Booking): string => {
  if (booking.locationType === 'at_home') {
    return 'At your location';
  } else if (booking.locationType === 'at_hotel') {
    return booking.address?.street || 'Hotel location';
  } else if (booking.location?.address) {
    const addr = booking.location.address;
    return addr.street || `${addr.city || ''} ${addr.state || ''}`.trim() || 'Provider location';
  }
  return 'Location TBD';
};

// =============================================================================
// Component
// =============================================================================

const OngoingBookings: React.FC<OngoingBookingsProps> = ({
  limit = 3,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    customerBookings,
    isLoading,
    errors: storeErrors,
    getCustomerBookings,
  } = useBookingStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progressKey, setProgressKey] = useState(0); // Force re-render for progress updates
  const prevProgressRef = useRef<Map<string, number>>(new Map());
  const isMounted = useRef(true);

  const fetchBookings = useCallback(async () => {
    try {
      await getCustomerBookings({
        limit: 20,
        sortBy: 'scheduledDate',
        sortOrder: 'asc',
      });
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      toast.error('Failed to load bookings. Please try again.');
    }
  }, [getCustomerBookings]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Socket listener for real-time booking status updates
  const ongoingBookingIds = customerBookings
    .filter((booking) => booking.status === 'in_progress')
    .map((booking) => booking._id);

  useSocketEvent('booking:status_changed', (data) => {
    // Refresh if this event is for a booking in our list
    if (data.bookingId && ongoingBookingIds.includes(data.bookingId)) {
      fetchBookings();
      setProgressKey(prev => prev + 1);
    }
  });

  // Fallback polling every 60 seconds (socket handles most real-time updates)
  useEffect(() => {
    const interval = setInterval(() => {
      // Guard against unmount during async fetch
      if (!isMounted.current) return;
      fetchBookings();
      // Force re-render to update progress bars
      setProgressKey(prev => prev + 1);
    }, 60000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [fetchBookings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBookings();
    setProgressKey(prev => prev + 1);
    setIsRefreshing(false);
  };

  const handleViewDetails = (booking: Booking) => {
    navigate(`/customer/bookings/${booking._id}`);
  };

  const handleTrackBooking = (booking: Booking) => {
    navigate(`/customer/bookings/${booking._id}/track`);
  };

  const handleViewAll = () => {
    navigate('/customer/bookings?status=in_progress');
  };

  // Filter for in-progress bookings only
  const ongoingBookings = customerBookings
    .filter((booking) => booking.status === 'in_progress')
    .slice(0, limit);

  if (isLoading && customerBookings.length === 0) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header Skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded-lg w-36 mb-1.5" />
              <div className="h-4 bg-gray-100 rounded w-48" />
            </div>
          </div>

          {/* Booking Cards Skeleton */}
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-3 bg-gray-100 rounded w-3/4" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-2 bg-gray-100 rounded-full w-full mt-2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (storeErrors.length > 0 && customerBookings.length === 0) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-serif font-light text-nilin-charcoal">
                Ongoing Bookings
              </h2>
              <p className="text-xs text-nilin-warmGray">
                Active service appointments
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

          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-red-700 mb-1">
              Unable to load bookings
            </h3>
            <p className="text-sm text-red-600/80 mb-4">
              Please check your connection and try again
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              Try Again
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6" aria-labelledby="ongoing-heading">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="ongoing-heading"
                className="text-lg font-serif font-light text-nilin-charcoal"
              >
                Ongoing Bookings
              </h2>
              {ongoingBookings.length > 0 && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                  {ongoingBookings.length} active
                </span>
              )}
            </div>
            <p className="text-xs text-nilin-warmGray">
              {ongoingBookings.length > 0
                ? 'Services currently being delivered'
                : 'No active services right now'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {showViewAll && ongoingBookings.length > 0 && (
              <button
                onClick={handleViewAll}
                className="hidden sm:flex items-center gap-1 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
              >
                View all
                <ExternalLink className="w-3.5 h-3.5" />
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

        {/* Empty State */}
        {ongoingBookings.length === 0 && !isLoading && (
          <div className="bg-gradient-to-br from-purple-50/50 to-white rounded-2xl p-8 text-center border border-purple-100/50">
            <div className="w-16 h-16 rounded-2xl bg-purple-100 mx-auto mb-4 flex items-center justify-center">
              <Play className="w-8 h-8 text-purple-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              No Ongoing Bookings
            </h3>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              You don't have any services in progress. Your active bookings will appear here when a provider starts working.
            </p>
          </div>
        )}

        {/* Booking Cards */}
        {ongoingBookings.length > 0 && (
          <div className="space-y-4">
            {ongoingBookings.map((booking, index) => {
              const progress = calculateProgress(booking);
              const locationText = getLocationText(booking);
              const providerName = booking.provider
                ? booking.provider.businessInfo?.businessName ||
                  `${booking.provider.firstName} ${booking.provider.lastName}`
                : 'Provider';
              const serviceName = booking.service?.name || 'Service';

              return (
                <article
                  key={booking._id}
                  className="relative bg-white rounded-2xl border border-purple-100 overflow-hidden hover:shadow-lg hover:border-purple-200 transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                    {/* Progress indicator stripe */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gray-100">
                      <div
                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-1000"
                        style={{ width: `${progress.percent}%` }}
                      />
                    </div>

                    <div className="p-5 pt-4">
                      <div className="flex items-start gap-4">
                        {/* Provider Avatar */}
                        <div className="flex-shrink-0">
                          {booking.provider?.avatar ? (
                            <img
                              src={booking.provider.avatar}
                              alt={providerName}
                              className="w-14 h-14 rounded-xl object-cover ring-2 ring-purple-100"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center ring-2 ring-purple-100">
                              <User className="w-7 h-7 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Header Row */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {/* Service Name */}
                              <h3 className="font-semibold text-nilin-charcoal text-base line-clamp-1">
                                {serviceName}
                              </h3>

                              {/* Provider Name */}
                              <p className="text-sm text-nilin-warmGray mt-0.5 flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5" />
                                {providerName}
                              </p>

                              {/* Location */}
                              <div className="flex items-center gap-1.5 mt-1.5 text-sm text-gray-500">
                                <MapPin className="w-3.5 h-3.5" />
                                <span className="truncate">{locationText}</span>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <div className="flex-shrink-0 text-right">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {progress.label}
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                              <span>Progress</span>
                              <span className="font-medium text-purple-600">{progress.percent}%</span>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-400 via-purple-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                                style={{ width: `${progress.percent}%` }}
                              />
                            </div>
                          </div>

                          {/* Time Info */}
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-1.5 text-sm text-gray-500">
                              <Clock className="w-4 h-4" />
                              <span>{progress.estimatedTimeRemaining}</span>
                            </div>

                            {/* ETA if available */}
                            {booking.etaMinutes && booking.etaMinutes > 0 && (
                              <div className="flex items-center gap-1.5 text-sm text-purple-600">
                                <Navigation className="w-4 h-4" />
                                <span>ETA {booking.etaMinutes} min</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 mt-4">
                            <button
                              onClick={() => handleTrackBooking(booking)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-all hover:shadow-md"
                            >
                              <Navigation className="w-4 h-4" />
                              Track
                            </button>
                            <button
                              onClick={() => handleViewDetails(booking)}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-nilin-charcoal rounded-xl text-sm font-medium transition-colors"
                            >
                              View Details
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {/* Quick Contact */}
                            <button
                              className="p-2.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                              aria-label="Call provider"
                              title="Call provider"
                            >
                              <Phone className="w-5 h-5" />
                            </button>
                            <button
                              className="p-2.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                              aria-label="Message provider"
                              title="Message provider"
                            >
                              <MessageSquare className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Booking Number Footer */}
                    <div className="px-5 py-2.5 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                      <span>Booking #{booking.bookingNumber?.slice(-8).toUpperCase() || 'N/A'}</span>
                      <span>{new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {booking.scheduledTime}</span>
                    </div>
                  </article>
              );
            })}
          </div>
        )}

        {/* Mobile View All */}
        {showViewAll && ongoingBookings.length > 0 && (
          <div className="mt-4 text-center sm:hidden">
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              View all ongoing bookings
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default OngoingBookings;
