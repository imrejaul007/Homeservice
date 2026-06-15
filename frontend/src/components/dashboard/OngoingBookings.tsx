/**
 * OngoingBookings — Active & today's bookings hub
 * Seed Design System - Apothecary meets modern clinical aesthetic
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  User,
  Clock,
  RefreshCw,
  AlertCircle,
  Loader2,
  Navigation,
  ExternalLink,
  MessageSquare,
  Phone,
  Calendar,
  ArrowRight,
  Star,
  HelpCircle,
  Sparkles,
  Timer,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import type { Booking, PaymentStatus } from '../../types/booking.types';
import type { BookingEvent } from '../../services/socket';
import bookingService from '../../services/BookingService';
import { useSocketEvent } from '../../hooks/useSocket';
import { PriceDisplay } from '../common/PriceDisplay';
import { CATEGORY_IMAGES } from '../../constants/images';

// =============================================================================
// Types
// =============================================================================

interface OngoingBookingsProps {
  limit?: number;
  showViewAll?: boolean;
}

type BookingCardKind = 'in_progress' | 'waiting' | 'upcoming';

interface CategorizedBooking {
  booking: Booking;
  kind: BookingCardKind;
}

interface ProgressInfo {
  percent: number;
  label: string;
  estimatedTimeRemaining: string;
}

// =============================================================================
// Constants & helpers
// =============================================================================

const SERVICE_CATEGORY_IMAGES: Record<string, string> = {
  bridal: CATEGORY_IMAGES.makeup.card,
  makeup: CATEGORY_IMAGES.makeup.card,
  hair: CATEGORY_IMAGES.hair.card,
  spa: CATEGORY_IMAGES['massage-body'].card,
  nails: CATEGORY_IMAGES.nails.card,
  skincare: CATEGORY_IMAGES['skin-aesthetics'].card,
  'skin & aesthetics': CATEGORY_IMAGES['skin-aesthetics'].card,
  'massage & body': CATEGORY_IMAGES['massage-body'].card,
};

const DEFAULT_SERVICE_IMAGE = CATEGORY_IMAGES.hair.card;

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: 'Payment pending',
  completed: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
  processed: 'Paid',
};

const PAYMENT_BADGE_CONFIG: Record<PaymentStatus, { bgClass: string; textClass: string }> = {
  pending: { bgClass: 'bg-[#eeeee9]', textClass: 'text-[#1c3a13]' },
  completed: { bgClass: 'bg-[#d3fa99]/30', textClass: 'text-[#1c3a13]' },
  processed: { bgClass: 'bg-[#d3fa99]/30', textClass: 'text-[#1c3a13]' },
  failed: { bgClass: 'bg-[#eeeee9]', textClass: 'text-[#1c3a13]' },
  refunded: { bgClass: 'bg-[#eeeee9]', textClass: 'text-[#1c3a13]' },
};

// Seed Design - Status badges using Forest Canopy and Lime Sprout
const KIND_CONFIG: Record<BookingCardKind, { badge: string; badgeClass: string; section?: string }> = {
  in_progress: {
    badge: 'In progress',
    badgeClass: 'bg-[#d3fa99]/30 text-[#1c3a13]',
    section: 'Happening now',
  },
  waiting: {
    badge: 'Waiting to start',
    badgeClass: 'bg-[#eeeee9] text-[#1c3a13]',
    section: 'Waiting for provider',
  },
  upcoming: {
    badge: 'Upcoming today',
    badgeClass: 'bg-[#d3fa99]/30 text-[#1c3a13]',
    section: 'Upcoming today',
  },
};

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

const getScheduledDateTime = (booking: Booking): Date => {
  const date = new Date(booking.scheduledDate);
  if (booking.scheduledTime) {
    const [hours, minutes] = booking.scheduledTime.split(':').map(Number);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  }
  return date;
};

const categorizeBooking = (booking: Booking, now: Date): BookingCardKind | null => {
  if (booking.status === 'in_progress') return 'in_progress';

  if (booking.status !== 'confirmed' && booking.status !== 'pending') return null;

  const scheduledAt = getScheduledDateTime(booking);
  if (!isSameDay(scheduledAt, now)) return null;

  if (booking.status === 'confirmed' && scheduledAt.getTime() < now.getTime()) {
    return 'waiting';
  }

  return 'upcoming';
};

const sortByUrgency = (a: CategorizedBooking, b: CategorizedBooking): number => {
  const order: Record<BookingCardKind, number> = { waiting: 0, in_progress: 1, upcoming: 2 };
  const kindDiff = order[a.kind] - order[b.kind];
  if (kindDiff !== 0) return kindDiff;
  return getScheduledDateTime(a.booking).getTime() - getScheduledDateTime(b.booking).getTime();
};

const getStartedAt = (booking: Booking): Date | null => {
  const raw =
    booking.startedAt
    || booking.providerResponse?.arrivalTime
    || booking.statusHistory?.find((entry) => entry.status === 'in_progress')?.timestamp;

  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const calculateProgress = (booking: Booking): ProgressInfo => {
  const now = new Date();
  const startedAt = getStartedAt(booking);
  const scheduledDuration = booking.estimatedDuration || booking.service?.duration || booking.duration || 60;

  if (!startedAt) {
    return {
      percent: 10,
      label: 'Starting',
      estimatedTimeRemaining: `~${scheduledDuration} min service`,
    };
  }

  const elapsedMinutes = (now.getTime() - startedAt.getTime()) / (1000 * 60);
  // Guard against negative elapsed time (future startedAt)
  const safeElapsedMinutes = Math.max(0, elapsedMinutes);
  const percent = Math.min(100, Math.max(5, Math.round((safeElapsedMinutes / scheduledDuration) * 100)));
  const remainingMinutes = Math.max(0, scheduledDuration - safeElapsedMinutes);

  let label = 'In progress';
  if (percent >= 90) label = 'Finishing up';

  let estimatedTimeRemaining = 'Completing shortly';
  if (remainingMinutes > 60) {
    const hours = Math.floor(remainingMinutes / 60);
    const mins = Math.round(remainingMinutes % 60);
    estimatedTimeRemaining = `${hours}h ${mins}m remaining`;
  } else if (remainingMinutes > 0) {
    estimatedTimeRemaining = `${Math.round(remainingMinutes)} min remaining`;
  }

  return { percent, label, estimatedTimeRemaining };
};

const getLocationText = (booking: Booking): string => {
  if (booking.locationType === 'at_home') {
    const addr = booking.location?.address || booking.address;
    if (addr?.street) return addr.street;
    if (addr?.city) return `${addr.city}${addr.state ? `, ${addr.state}` : ''}`;
    return 'At your location';
  }
  if (booking.locationType === 'at_hotel') {
    return booking.address?.street || booking.location?.address?.street || 'Hotel location';
  }
  if (booking.locationType === 'at_provider') return 'At provider location';
  if (booking.location?.address) {
    const addr = booking.location.address;
    return addr.street || `${addr.city || ''} ${addr.state || ''}`.trim() || 'Service location';
  }
  return 'Location TBD';
};

const getProviderName = (booking: Booking): string => {
  if (booking.provider?.businessInfo?.businessName) {
    return booking.provider.businessInfo.businessName;
  }
  if (booking.provider?.firstName || booking.provider?.lastName) {
    return `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim();
  }
  return 'Provider';
};

const getServiceImage = (booking: Booking): string => {
  const image = booking.service?.images?.[0];
  if (image) return image;
  const category = booking.service?.category?.toLowerCase() || '';
  return SERVICE_CATEGORY_IMAGES[category] || DEFAULT_SERVICE_IMAGE;
};

const getBookingTotal = (booking: Booking): { amount: number; currency: string } => ({
  amount: booking.pricing?.totalAmount || booking.pricing?.total || 0,
  currency: booking.pricing?.currency || 'AED',
});

const formatScheduledTime = (booking: Booking): string => {
  const date = new Date(booking.scheduledDate);
  const datePart = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${datePart} at ${booking.scheduledTime || 'TBD'}`;
};

// =============================================================================
// Component
// =============================================================================

const OngoingBookings: React.FC<OngoingBookingsProps> = ({
  limit = 3,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const [allBookings, setAllBookings] = useState<CategorizedBooking[]>([]);
  const [totalActiveCount, setTotalActiveCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const isMountedRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);

  const displayedBookings = useMemo(
    () => allBookings.slice(0, limit),
    [allBookings, limit],
  );

  const overflowCount = Math.max(0, totalActiveCount - displayedBookings.length);

  const fetchBookings = useCallback(async (silent = false) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setIsLoading(true);

    try {
      setError(null);
      const fetchLimit = Math.max(limit, 15);

      const [inProgressRes, confirmedRes, pendingRes] = await Promise.all([
        bookingService.getCustomerBookings({
          status: 'in_progress',
          limit: fetchLimit,
          sortBy: 'scheduledDate',
          sortOrder: 'asc',
        }),
        bookingService.getCustomerBookings({
          status: 'confirmed',
          limit: fetchLimit,
          sortBy: 'scheduledDate',
          sortOrder: 'asc',
        }),
        bookingService.getCustomerBookings({
          status: 'pending',
          limit: fetchLimit,
          sortBy: 'scheduledDate',
          sortOrder: 'asc',
        }),
      ]);

      if (controller.signal.aborted || !isMountedRef.current) return;

      const now = new Date();
      const seen = new Set<string>();
      const categorized: CategorizedBooking[] = [];

      const addBooking = (booking: Booking) => {
        if (seen.has(booking._id)) return;
        const kind = categorizeBooking(booking, now);
        if (!kind) return;
        seen.add(booking._id);
        categorized.push({ booking, kind });
      };

      inProgressRes.data.bookings.forEach(addBooking);
      confirmedRes.data.bookings.forEach(addBooking);
      pendingRes.data.bookings.forEach(addBooking);

      categorized.sort(sortByUrgency);
      setAllBookings(categorized);
      setTotalActiveCount(categorized.length);
    } catch (err) {
      if (controller.signal.aborted || !isMountedRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load bookings';
      setError(message);
      if (!silent) toast.error('Failed to load your active bookings');
    } finally {
      if (!controller.signal.aborted && isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [limit]);

  useEffect(() => {
    isMountedRef.current = true;
    fetchBookings();
    return () => {
      isMountedRef.current = false;
      abortRef.current?.abort();
    };
  }, [fetchBookings]);

  const handleRealtimeUpdate = useCallback(() => {
    fetchBookings(true);
    setProgressKey((prev) => prev + 1);
  }, [fetchBookings]);

  const handleBookingCompleted = useCallback((data: BookingEvent) => {
    handleRealtimeUpdate();
    const shortId = data.bookingNumber?.slice(-8).toUpperCase() || '';
    toast(
      (t) => (
        <div className="flex flex-col gap-2 max-w-xs">
          <p className="font-medium text-[#1c3a13]">Service completed!</p>
          <p className="text-[14px] text-[#6b6b6b]">
            {shortId ? `Booking #${shortId} is done.` : 'Your booking is complete.'} Share how it went.
          </p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                toast.dismiss(t.id);
                navigate('/customer/reviews');
              }}
              className="px-3 py-1.5 rounded-[9999px] bg-[#1c3a13] text-[#fcfcf7] text-[13px] font-medium"
            >
              Leave review
            </button>
            <button
              type="button"
              onClick={() => toast.dismiss(t.id)}
              className="px-3 py-1.5 rounded-[9999px] border border-[#1c3a13]/10 text-[14px] text-[#6b6b6b]"
            >
              Later
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  }, [handleRealtimeUpdate, navigate]);

  useSocketEvent('booking:status_changed', handleRealtimeUpdate);
  useSocketEvent('booking:started', handleRealtimeUpdate);
  useSocketEvent('booking:completed', handleBookingCompleted);
  useSocketEvent('booking:cancelled', handleRealtimeUpdate);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgressKey((prev) => prev + 1);
    }, 30000);

    const pollInterval = setInterval(() => {
      if (isMountedRef.current) fetchBookings(true);
    }, 60000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(pollInterval);
    };
  }, [fetchBookings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchBookings(true);
    setProgressKey((prev) => prev + 1);
  };

  const handleViewDetails = (booking: Booking) => {
    navigate(`/customer/bookings/${booking._id}`);
  };

  const handleTrackBooking = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    if (booking.bookingNumber) {
      navigate(`/track/${booking.bookingNumber}`);
      return;
    }
    navigate(`/customer/bookings/${booking._id}`);
  };

  const handleCallProvider = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    const phone = booking.provider?.phone;
    if (!phone) {
      toast.error('Provider phone number is not available');
      return;
    }
    window.location.href = `tel:${phone.replace(/\s/g, '')}`;
  };

  const handleMessageProvider = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    navigate('/customer/messages', {
      state: {
        providerId: booking.providerId || booking.provider?._id,
        bookingId: booking._id,
      },
    });
  };

  const handleReportIssue = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    navigate('/customer/support', {
      state: {
        tab: 'new-ticket',
        bookingId: booking._id,
        bookingNumber: booking.bookingNumber,
        serviceName: booking.service?.name,
      },
    });
  };

  const handleViewAll = () => {
    navigate('/customer/bookings');
  };

  const handleBookService = () => {
    navigate('/search');
  };

  const renderBookingCard = (item: CategorizedBooking, index: number) => {
    const { booking, kind } = item;
    const config = KIND_CONFIG[kind];
    const progress = kind === 'in_progress' ? calculateProgress(booking) : null;
    const locationText = getLocationText(booking);
    const providerName = getProviderName(booking);
    const serviceName = booking.service?.name || 'Service';
    const serviceImage = getServiceImage(booking);
    const { amount, currency } = getBookingTotal(booking);
    const paymentLabel = PAYMENT_LABELS[booking.paymentStatus] || booking.paymentStatus;
    const providerRating = booking.provider?.rating;

    return (
      <article
        key={booking._id}
        role="button"
        tabIndex={0}
        onClick={() => handleViewDetails(booking)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleViewDetails(booking);
          }
        }}
        className="relative bg-[#fcfcf7] rounded-2xl border border-[#1c3a13]/10 overflow-hidden hover:border-[#1c3a13]/30 hover:shadow-lg hover:shadow-[#1c3a13]/5 hover:scale-[1.01] transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1c3a13]/30"
        style={{ animationDelay: `${index * 80}ms` }}
      >
        {progress && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#d3fa99]/30">
            <div
              className="h-full bg-[#1c3a13] transition-all duration-1000"
              style={{ width: `${progress.percent}%` }}
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Estimated service progress ${progress.percent}%`}
            />
          </div>
        )}

        <div className="p-5 pt-4">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 relative">
              <img
                src={serviceImage}
                alt={serviceName}
                className="w-16 h-16 rounded-xl object-cover border border-[#1c3a13]/10"
              />
              {booking.provider?.avatar && (
                <img
                  src={booking.provider.avatar}
                  alt={providerName}
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg object-cover ring-2 ring-[#fcfcf7]"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-medium text-[#1c3a13] text-base line-clamp-1">{serviceName}</h3>
                  <p className="text-[14px] text-[#6b6b6b] mt-0.5 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{providerName}</span>
                    {providerRating != null && providerRating > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[#1c3a13] ml-1 flex-shrink-0">
                        <Star className="w-3 h-3 fill-[#d3fa99] text-[#1c3a13]" />
                        {providerRating.toFixed(1)}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-[14px] text-[#6b6b6b]">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{locationText}</span>
                  </div>
                </div>

                <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium ${config.badgeClass}`}>
                  {kind === 'in_progress' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {kind === 'waiting' && <Timer className="w-3.5 h-3.5" />}
                  {kind === 'upcoming' && <Calendar className="w-3.5 h-3.5" />}
                  {config.badge}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[14px]">
                <div className="flex items-center gap-1.5 text-[#6b6b6b]">
                  <Clock className="w-4 h-4" />
                  <span>{formatScheduledTime(booking)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <PriceDisplay price={amount} originalCurrency={currency} size="sm" className="text-[#1c3a13]" />
                  {(() => {
                    const config = PAYMENT_BADGE_CONFIG[booking.paymentStatus];
                    return (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${config?.bgClass} ${config?.textClass || 'text-[#1c3a13]'}`}>
                        {paymentLabel}
                      </span>
                    );
                  })()}
                </div>
              </div>

              {kind === 'waiting' && (
                <p className="mt-3 text-[14px] text-[#1c3a13] bg-[#eeeee9] rounded-xl px-3 py-2">
                  Your scheduled time has passed. The provider hasn&apos;t started yet — you can message or call them below.
                </p>
              )}

              {progress && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-[#6b6b6b] mb-1.5">
                    <span>Estimated progress</span>
                    <span className="font-medium text-[#1c3a13]">{progress.percent}%</span>
                  </div>
                  <div className="h-2.5 bg-[#eeeee9] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#1c3a13] to-[#4a6b35] rounded-full transition-all duration-1000 ease-out shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#6b6b6b] mt-1.5">{progress.estimatedTimeRemaining}</p>
                </div>
              )}

              {kind === 'upcoming' && (
                <p className="mt-3 text-[14px] text-[#6b6b6b]">
                  Scheduled for later today. We&apos;ll notify you when your provider is on the way.
                </p>
              )}

              <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                {(kind === 'in_progress' || kind === 'waiting') && (
                  <button
                    type="button"
                    onClick={(e) => handleTrackBooking(e, booking)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1c3a13] hover:bg-[#1c3a13]/90 hover:scale-105 active:scale-95 text-[#fcfcf7] rounded-[9999px] text-[13px] font-medium transition-all"
                  >
                    <Navigation className="w-4 h-4" />
                    Track
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => handleMessageProvider(e, booking)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#eeeee9] hover:bg-[#eeeee9]/80 hover:scale-105 active:scale-95 text-[#1c3a13] rounded-[9999px] text-[13px] font-medium transition-all"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message
                </button>
                <button
                  type="button"
                  onClick={(e) => handleCallProvider(e, booking)}
                  className="p-2.5 text-[#6b6b6b] hover:text-[#1c3a13] hover:bg-[#eeeee9] rounded-full transition-colors"
                  aria-label={`Call ${providerName}`}
                  title={`Call ${providerName}`}
                >
                  <Phone className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleReportIssue(e, booking)}
                  className="p-2.5 text-[#6b6b6b] hover:text-[#1c3a13] hover:bg-[#eeeee9] rounded-full transition-colors"
                  aria-label="Report an issue"
                  title="Get support"
                >
                  <HelpCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 py-2.5 bg-[#eeeee9]/50 border-t border-[#1c3a13]/5 text-[11px] text-[#6b6b6b] flex items-center justify-between">
          <span>Booking #{booking.bookingNumber?.slice(-8).toUpperCase() || 'N/A'}</span>
          <span className="inline-flex items-center gap-1 text-[#1c3a13] font-medium">
            View details
            <ExternalLink className="w-3 h-3" />
          </span>
        </div>
      </article>
    );
  };

  if (isLoading && allBookings.length === 0) {
    return (
      <section className="py-8 px-4" aria-busy={true} aria-label="Loading active bookings">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6 animate-pulse">
            <div>
              <div className="h-7 bg-[#eeeee9] rounded-lg w-52 mb-2" />
              <div className="h-4 bg-[#eeeee9] rounded w-64" />
            </div>
          </div>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-[#fcfcf7] rounded-2xl border border-[#1c3a13]/10 p-5 animate-pulse">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#d3fa99]/20 to-[#d3fa99]/10" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 bg-[#eeeee9] rounded w-1/2" />
                    <div className="h-3 bg-[#eeeee9]/80 rounded w-3/4" />
                    <div className="h-2 bg-[#eeeee9] rounded-full w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error && allBookings.length === 0) {
    return (
      <section className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-[#eeeee9] border border-[#1c3a13]/20 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-[#1c3a13] mx-auto mb-3" />
            <h3 className="text-base font-medium text-[#1c3a13] mb-1">Unable to load your bookings</h3>
            <p className="text-[14px] text-[#6b6b6b] mb-4">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1c3a13] hover:bg-[#1c3a13]/90 text-[#fcfcf7] rounded-[9999px] text-[13px] font-medium transition-colors"
            >
              Try Again
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  const sectionGroups = displayedBookings.reduce<Array<{ kind: BookingCardKind; items: CategorizedBooking[] }>>(
    (groups, item) => {
      const last = groups[groups.length - 1];
      if (last?.kind === item.kind) {
        last.items.push(item);
      } else {
        groups.push({ kind: item.kind, items: [item] });
      }
      return groups;
    },
    [],
  );

  return (
    <section className="py-8 px-4" aria-labelledby="active-bookings-heading">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-6 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-[#1c3a13]" />
              <h2 id="active-bookings-heading" className="text-2xl md:text-3xl font-normal text-[#1c3a13] tracking-[-0.01em]">
                Active &amp; Today&apos;s Bookings
              </h2>
              {totalActiveCount > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 bg-[#d3fa99]/30 text-[#1c3a13] text-[11px] font-medium rounded-full">
                  <span className="w-1.5 h-1.5 bg-[#d3fa99] rounded-full shadow-[0_0_8px_#d3fa99] animate-pulse" />
                  {totalActiveCount} active
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#6b6b6b]">
              {totalActiveCount > 0
                ? 'In progress, waiting, and scheduled for today'
                : 'Nothing scheduled for today — book when you\'re ready'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showViewAll && totalActiveCount > 0 && (
              <button
                type="button"
                onClick={handleViewAll}
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[9999px] text-[13px] font-medium text-[#fcfcf7] bg-[#1c3a13] hover:bg-[#1c3a13]/90 hover:scale-105 active:scale-95 transition-all"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-full border border-[#1c3a13]/10 text-[#6b6b6b] hover:text-[#1c3a13] hover:bg-[#eeeee9] transition-colors disabled:opacity-50"
              aria-label="Refresh bookings"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {totalActiveCount === 0 && (
          <div className="bg-[#fcfcf7] rounded-2xl p-8 md:p-10 text-center border border-[#1c3a13]/10">
            <div className="w-16 h-16 rounded-2xl bg-[#d3fa99]/30 mx-auto mb-4 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-[#1c3a13]" />
            </div>
            <h3 className="text-lg font-light text-[#1c3a13] mb-2">No active bookings today</h3>
            <p className="text-[14px] text-[#6b6b6b] max-w-md mx-auto mb-6">
              Services in progress and today&apos;s appointments appear here. Book something or check your full schedule.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleViewAll}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[9999px] border border-[#1c3a13]/10 text-[#1c3a13] text-[13px] font-medium hover:bg-[#eeeee9] hover:scale-105 active:scale-95 transition-all"
              >
                <Calendar className="w-4 h-4 text-[#1c3a13]" />
                View all bookings
              </button>
              <button
                type="button"
                onClick={handleBookService}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[9999px] bg-[#1c3a13] text-[#fcfcf7] text-[13px] font-medium hover:bg-[#1c3a13]/90 hover:scale-105 active:scale-95 transition-all"
              >
                Book a service
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {displayedBookings.length > 0 && (
          <div className="space-y-6" key={progressKey}>
            {sectionGroups.map((group) => (
              <div key={group.kind}>
                {sectionGroups.length > 1 && KIND_CONFIG[group.kind].section && (
                  <h3 className="text-[11px] font-semibold text-[#6b6b6b]/80 mb-3">
                    {KIND_CONFIG[group.kind].section}
                  </h3>
                )}
                <div className="space-y-4">
                  {group.items.map((item, index) => renderBookingCard(item, index))}
                </div>
              </div>
            ))}

            {overflowCount > 0 && (
              <button
                type="button"
                onClick={handleViewAll}
                className="w-full py-3 rounded-xl border border-dashed border-[#1c3a13]/20 text-[#1c3a13] text-[13px] font-medium hover:bg-[#eeeee9] transition-colors"
              >
                +{overflowCount} more active booking{overflowCount !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}

        {showViewAll && totalActiveCount > 0 && (
          <div className="mt-6 text-center sm:hidden">
            <button
              type="button"
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1c3a13] text-[#fcfcf7] rounded-[9999px] text-[13px] font-medium transition-colors"
            >
              View all bookings
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default OngoingBookings;
