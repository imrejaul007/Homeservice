import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, User, Phone, Eye, Edit, X, Sparkles, Clock, Star } from 'lucide-react';
import { Booking } from '../../services/BookingService';
import { PriceDisplay } from '../common/PriceDisplay';

// Status change announcer for screen readers
const StatusAnnouncer: React.FC<{ status: string; bookingNumber: string }> = ({ status, bookingNumber }) => (
  <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
    Booking {bookingNumber} status changed to {status.replace('_', ' ')}
  </div>
);

// Adapter interface for component-specific display fields
interface BookingCardBooking extends Omit<Booking, 'service' | 'provider' | 'customer' | 'location' | 'pricing'> {
  service: {
    _id: string;
    name?: string;
    title?: string;
    category?: string;
  };
  provider: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    phone?: string;
  };
  customer?: {
    _id: string;
    firstName?: string;
    lastName?: string;
    name?: string;
  };
  totalPrice?: number;
  pricing?: {
    totalAmount?: number;
    total?: number;
    currency?: string;
  };
  location?: {
    address?: string | { street?: string; city?: string; state?: string; zipCode?: string; country?: string };
  };
  isGuestBooking?: boolean;
  guestInfo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

// Helper to get provider display name
const getProviderDisplayName = (provider: BookingCardBooking['provider']): string => {
  if (provider.name) return provider.name;
  if (provider.firstName || provider.lastName) {
    return [provider.firstName, provider.lastName].filter(Boolean).join(' ');
  }
  return 'Unknown Provider';
};

// Helper to get service display name
const getServiceDisplayName = (service: BookingCardBooking['service']): string => {
  return service.name || service.title || 'Unknown Service';
};

// Helper to get location address string with truncation for display
const getLocationAddress = (location: BookingCardBooking['location']): string | undefined => {
  if (!location?.address) return undefined;
  if (typeof location.address === 'string') return location.address;
  const addr = location.address;
  const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
  return parts.join(', ') || undefined;
};

// Helper to safely get scheduled time with fallback
const getScheduledTime = (time: string | undefined): string => {
  if (!time) return 'Time not set';
  return time;
};

// Helper to truncate long text with ellipsis for display
const truncateText = (text: string | undefined, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
};

// Helper to get customer/guest display info
const getCustomerDisplayInfo = (booking: BookingCardBooking): { name: string; isGuest: boolean } => {
  if (booking.isGuestBooking && booking.guestInfo?.name) {
    return { name: booking.guestInfo.name, isGuest: true };
  }
  if (booking.customer) {
    if (booking.customer.name) {
      return { name: booking.customer.name, isGuest: false };
    }
    const name = [booking.customer.firstName, booking.customer.lastName].filter(Boolean).join(' ');
    return { name: name || 'Unknown Customer', isGuest: false };
  }
  return { name: 'Unknown Customer', isGuest: false };
};

// Helper to get total price
const getTotalPrice = (booking: BookingCardBooking): number => {
  if (booking.totalPrice !== undefined) return booking.totalPrice;
  return booking.pricing?.totalAmount ?? booking.pricing?.total ?? 0;
};

const getBookingCurrency = (booking: BookingCardBooking): string =>
  booking.pricing?.currency || 'AED';

// Payment status configuration with NILIN brand colors
const paymentStatusConfig = {
  pending: {
    bg: 'bg-nilin-blush',
    text: 'text-nilin-warmGray',
    label: 'Payment Pending',
  },
  processing: {
    bg: 'bg-nilin-coral/20',
    text: 'text-nilin-charcoal',
    label: 'Processing',
  },
  completed: {
    bg: 'bg-nilin-success/20',
    text: 'text-nilin-success',
    label: 'Paid',
  },
  failed: {
    bg: 'bg-nilin-error/20',
    text: 'text-nilin-error',
    label: 'Payment Failed',
  },
  refunded: {
    bg: 'bg-nilin-blush',
    text: 'text-nilin-warmGray',
    label: 'Refunded',
  },
};

// Helper to get payment status
const getPaymentStatus = (booking: BookingCardBooking) => {
  const status = booking.paymentStatus || 'pending';
  return paymentStatusConfig[status as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
};

// Helper to format date safely with validation
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return 'Date not set';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-AE', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
};

interface BookingCardProps {
  booking: BookingCardBooking;
  showActions?: boolean;
  onView?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  onShareExperience?: (bookingId: string) => void;
  isCancelling?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  showActions = true,
  onView,
  onReschedule,
  onCancel,
  onShareExperience,
  isCancelling = false
}) => {
  const navigate = useNavigate();

  const handleView = () => {
    if (onView) {
      onView(booking._id);
    } else {
      navigate(`/customer/bookings/${booking._id}`);
    }
  };

  const handleReschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReschedule) {
      onReschedule(booking._id);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCancel) {
      onCancel(booking._id);
    }
  };

  const handleShareExperience = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShareExperience?.(booking._id);
  };

  const hasSubmittedExperience = Boolean(booking.hasExperience || booking.customerReview);

  // Status configuration with NILIN brand colors
  const statusConfig = {
    pending: {
      bg: 'bg-nilin-blush',
      text: 'text-nilin-warmGray',
      border: 'border-nilin-border',
      label: 'Pending',
    },
    confirmed: {
      bg: 'bg-nilin-coral/20',
      text: 'text-nilin-charcoal',
      border: 'border-nilin-coral/30',
      label: 'Confirmed',
    },
    in_progress: {
      bg: 'bg-nilin-peach',
      text: 'text-nilin-charcoal',
      border: 'border-nilin-peach',
      label: 'In Progress',
    },
    completed: {
      bg: 'bg-nilin-success/20',
      text: 'text-nilin-success',
      border: 'border-nilin-success/30',
      label: 'Completed',
    },
    cancelled: {
      bg: 'bg-nilin-error/20',
      text: 'text-nilin-error',
      border: 'border-nilin-error/30',
      label: 'Cancelled',
    },
    no_show: {
      bg: 'bg-nilin-warning/20',
      text: 'text-nilin-warning',
      border: 'border-nilin-warning/30',
      label: 'No Show',
    },
    refunded: {
      bg: 'bg-nilin-blush',
      text: 'text-nilin-warmGray',
      border: 'border-nilin-border',
      label: 'Refunded',
    },
    rejected: {
      bg: 'bg-nilin-error/20',
      text: 'text-nilin-error',
      border: 'border-nilin-error/30',
      label: 'Rejected',
    },
  };

  // Fallback for unknown status values
  const status = statusConfig[booking.status] || {
    bg: 'bg-nilin-muted',
    text: 'text-nilin-warmGray',
    border: 'border-nilin-border',
    label: booking.status || 'Unknown',
  };

  // Build comprehensive aria-label for the card
  const bookingNumber = booking.bookingNumber || booking._id?.slice(-8) || '';
  const serviceName = getServiceDisplayName(booking.service);
  const providerName = getProviderDisplayName(booking.provider);
  const totalPrice = getTotalPrice(booking);
  const currency = getBookingCurrency(booking);
  const cardAriaLabel = `Booking ${bookingNumber}: ${serviceName} with ${providerName}. Status: ${status.label}. Total: ${currency} ${totalPrice}. ${booking.scheduledDate ? formatDate(booking.scheduledDate) : ''}`;

  // Announce status changes for screen readers
  const announcerRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef(booking.status);

  useEffect(() => {
    if (prevStatusRef.current !== booking.status && announcerRef.current) {
      announcerRef.current.textContent = `Booking ${bookingNumber} status changed to ${status.label}`;
    }
    prevStatusRef.current = booking.status;
  }, [booking.status, bookingNumber, status.label]);

  return (
    <article
      aria-label={cardAriaLabel}
      onClick={handleView}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(); } }}
      tabIndex={0}
      className="group relative bg-white rounded-2xl border border-nilin-border shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.12),0_8px_16px_rgba(0,0,0,0.08)] hover:-translate-y-2 hover:scale-[1.01] hover:border-nilin-coral/40 active:scale-[0.99] transition-all duration-300 ease-out overflow-hidden cursor-pointer focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
    >
      {/* Screen reader status announcer */}
      <div ref={announcerRef} role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
      {/* Premium accent gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-nilin-coral/5 via-transparent to-nilin-rose/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header with Status */}
      <div className="relative p-5 border-b border-nilin-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Service name with premium gradient text on hover */}
              <h3 className="font-semibold text-nilin-charcoal group-hover:text-nilin-coral transition-colors duration-300 truncate text-base md:text-lg">
                {getServiceDisplayName(booking.service)}
              </h3>
              {booking.service.category && (
                <span className="text-xs bg-nilin-blush/80 text-nilin-rose px-2.5 py-1 rounded-nilin shrink-0 font-medium border border-nilin-rose/10 truncate max-w-[120px]" title={booking.service.category}>
                  {booking.service.category}
                </span>
              )}
              {booking.isGuestBooking && (
                <span className="text-xs bg-nilin-muted text-nilin-warmGray px-2.5 py-1 rounded-nilin shrink-0 font-medium border border-nilin-border">
                  Guest
                </span>
              )}
            </div>
            <p className="text-sm text-nilin-lightGray">Booking: <span className="font-medium text-nilin-warmGray">{booking.bookingNumber || (booking._id ? `#${booking._id.slice(-8)}` : '#')}</span></p>
          </div>
          {/* Premium status badge with enhanced styling */}
          <span
            role="status"
            className={`${status.bg} ${status.text} ${status.border} border px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 shadow-sm flex items-center gap-1.5 transition-all duration-200`}
            aria-label={`Booking status: ${status.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.text.replace('text-', 'bg-')}`} aria-hidden="true" />
            <span>{status.label}</span>
          </span>
        </div>
      </div>

      {/* Booking Details Grid */}
      <div className="relative p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Date & Time */}
        <div className="flex items-start gap-3 group/detail">
          <div className="p-2.5 bg-gradient-to-br from-nilin-blush to-nilin-peach/50 rounded-xl shrink-0 shadow-sm border border-nilin-rose/10" aria-hidden="true">
            <Calendar className="h-5 w-5 text-nilin-rose" />
          </div>
          <div>
            <p className="text-xs text-nilin-lightGray mb-1 font-medium uppercase tracking-wide">Date & Time</p>
            <p className="text-sm font-semibold text-nilin-charcoal">
              {formatDate(booking.scheduledDate)}
            </p>
            {booking.scheduledTime && (
              <p className="text-sm text-nilin-warmGray flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 text-nilin-coral" />
                {getScheduledTime(booking.scheduledTime)}
              </p>
            )}
          </div>
        </div>

        {/* Provider */}
        <div className="flex items-start gap-3 group/detail">
          <div className="p-2.5 bg-gradient-to-br from-nilin-blush to-nilin-peach/50 rounded-xl shrink-0 shadow-sm border border-nilin-rose/10" aria-hidden="true">
            <User className="h-5 w-5 text-nilin-rose" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-nilin-lightGray mb-1 font-medium uppercase tracking-wide">Provider</p>
            <p className="text-sm font-semibold text-nilin-charcoal truncate">{getProviderDisplayName(booking.provider)}</p>
            {booking.provider.phone && (
              <a
                href={`tel:${booking.provider.phone}`}
                aria-label={`Call ${booking.provider.phone}`}
                className="text-sm text-nilin-warmGray flex items-center gap-1 hover:text-nilin-coral transition-colors min-w-0 break-all"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {booking.provider.phone}
              </a>
            )}
          </div>
        </div>

        {/* Location */}
        {getLocationAddress(booking.location) && (
          <div className="flex items-start gap-3 sm:col-span-2 group/detail">
            <div className="p-2.5 bg-gradient-to-br from-nilin-blush to-nilin-peach/50 rounded-xl shrink-0 shadow-sm border border-nilin-rose/10" aria-hidden="true">
              <MapPin className="h-5 w-5 text-nilin-rose" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-nilin-lightGray mb-1 font-medium uppercase tracking-wide">Location</p>
              <p className="text-sm text-nilin-charcoal truncate" title={getLocationAddress(booking.location)}>
                {getLocationAddress(booking.location)}
              </p>
            </div>
          </div>
        )}

        {/* Guest Info - Show when guest booking */}
        {booking.isGuestBooking && booking.guestInfo && (
          <div className="flex items-start gap-3 sm:col-span-2 group/detail">
            <div className="p-2.5 bg-gradient-to-br from-nilin-blush to-nilin-peach/50 rounded-xl shrink-0 shadow-sm border border-nilin-rose/10" aria-hidden="true">
              <User className="h-5 w-5 text-nilin-rose" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-nilin-lightGray mb-1 font-medium uppercase tracking-wide">Guest Info</p>
              {booking.guestInfo.name && (
                <p className="text-sm font-semibold text-nilin-charcoal truncate" title={booking.guestInfo.name}>{booking.guestInfo.name}</p>
              )}
              {booking.guestInfo.phone && (
                <a href={`tel:${booking.guestInfo.phone}`} aria-label={`Call ${booking.guestInfo.phone}`} className="text-sm text-nilin-warmGray flex items-center gap-1 hover:text-nilin-coral transition-colors">
                  <Phone className="h-4 w-4 shrink-0" />
                  {booking.guestInfo.phone}
                </a>
              )}
              {booking.guestInfo.email && (
                <a href={`mailto:${booking.guestInfo.email}`} aria-label={`Email ${booking.guestInfo.email}`} className="text-sm text-nilin-warmGray hover:text-nilin-coral transition-colors truncate block" title={booking.guestInfo.email}>
                  {booking.guestInfo.email}
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Price and Actions */}
      <div className="relative p-5 bg-gradient-to-r from-nilin-muted/50 via-nilin-cream/30 to-nilin-muted/50 border-t border-nilin-border/60">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Price Section */}
          <div className="flex flex-col">
            <p className="text-xs text-nilin-lightGray mb-1 font-medium uppercase tracking-wide">Total Price</p>
            <PriceDisplay
              price={getTotalPrice(booking)}
              originalCurrency={getBookingCurrency(booking)}
              size="md"
              className="text-2xl font-semibold"
            />
          </div>

          {/* Payment Status Badge */}
          <span
            role="status"
            className={`${getPaymentStatus(booking).bg} ${getPaymentStatus(booking).text} px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-sm`}
            aria-label={`Payment status: ${getPaymentStatus(booking).label}`}
          >
            {getPaymentStatus(booking).label}
          </span>

          {/* Action Buttons */}
          {showActions && booking.status === 'completed' && (
            <div className="flex gap-2">
              <button
                onClick={handleView}
                aria-label={`View booking ${booking.bookingNumber || booking._id?.slice(-8) || ''} details`}
                className="min-h-[44px] px-4 py-2.5 bg-white border border-nilin-border text-nilin-charcoal rounded-nilin hover:border-nilin-coral/50 hover:bg-nilin-coral/5 transition-all text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 shadow-sm"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              {hasSubmittedExperience ? (
                <div className="min-h-[44px] px-4 py-2.5 bg-nilin-success/15 text-nilin-success rounded-nilin text-sm font-medium flex items-center justify-center gap-2">
                  <Star className="h-4 w-4" />
                  Experience Shared
                </div>
              ) : onShareExperience ? (
                <button
                  onClick={handleShareExperience}
                  aria-label={`Share experience for booking ${booking.bookingNumber || ''}`}
                  className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-nilin hover:shadow-nilin-warm transition-all text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Share Experience
                </button>
              ) : null}
            </div>
          )}

          {showActions && booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <div className="flex gap-2">
              <button
                onClick={handleView}
                aria-label={`View booking ${booking.bookingNumber || booking._id?.slice(-8) || ''} details`}
                className="min-h-[44px] px-4 py-2.5 bg-white border border-nilin-border text-nilin-charcoal rounded-nilin hover:border-nilin-coral/50 hover:bg-nilin-coral/5 transition-all text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 shadow-sm"
              >
                <Eye className="h-4 w-4" />
                View
              </button>
              {booking.status === 'pending' && onReschedule && (
                <button
                  onClick={handleReschedule}
                  aria-label={`Reschedule booking ${booking.bookingNumber || ''}`}
                  className="min-h-[44px] px-4 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-nilin hover:shadow-nilin-warm transition-all text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  <Edit className="h-4 w-4" />
                  Reschedule
                </button>
              )}
              {onCancel && (booking.status === 'pending' || booking.status === 'confirmed') && (
                <button
                  onClick={handleCancel}
                  disabled={isCancelling}
                  aria-label={`Cancel booking ${booking.bookingNumber || ''}`}
                  className="min-h-[44px] px-4 py-2.5 bg-nilin-error text-white rounded-nilin hover:bg-nilin-error/90 transition-all text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 shadow-sm"
                >
                  {isCancelling ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4" />
                      Cancel
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default BookingCard;
