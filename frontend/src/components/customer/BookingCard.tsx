import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, User, Phone, MoreVertical, Eye, Edit, X } from 'lucide-react';
import { Booking } from '../../services/BookingService';

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

// Helper to get location address string
const getLocationAddress = (location: BookingCardBooking['location']): string | undefined => {
  if (!location?.address) return undefined;
  if (typeof location.address === 'string') return location.address;
  const addr = location.address;
  const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean);
  return parts.join(', ') || undefined;
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

interface BookingCardProps {
  booking: BookingCardBooking;
  showActions?: boolean;
  onView?: (bookingId: string) => void;
  onReschedule?: (bookingId: string) => void;
  onCancel?: (bookingId: string) => void;
  isCancelling?: boolean;
}

const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  showActions = true,
  onView,
  onReschedule,
  onCancel,
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

  // Status configuration
  const statusConfig = {
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-200',
      label: 'Pending',
    },
    confirmed: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      border: 'border-blue-200',
      label: 'Confirmed',
    },
    in_progress: {
      bg: 'bg-purple-100',
      text: 'text-purple-800',
      border: 'border-purple-200',
      label: 'In Progress',
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-200',
      label: 'Completed',
    },
    cancelled: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      border: 'border-red-200',
      label: 'Cancelled',
    },
  };

  const status = statusConfig[booking.status];

  return (
    <div
      onClick={handleView}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleView(); } }}
      role="button"
      tabIndex={0}
      aria-label={`View booking ${booking._id}`}
      className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer group"
    >
      {/* Header with Status */}
      <div className="p-4 border-b border-gray-100 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
              {getServiceDisplayName(booking.service)}
            </h3>
            {booking.service.category && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {booking.service.category}
              </span>
            )}
            {booking.isGuestBooking && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                Guest
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">Booking ID: #{booking._id.slice(-8)}</p>
        </div>
        <span className={`${status.bg} ${status.text} ${status.border} border px-3 py-1 rounded-full text-xs font-semibold`}>
          {status.label}
        </span>
      </div>

      {/* Booking Details Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Date & Time */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gradient-nilin-primary rounded-lg">
            <Calendar className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Date & Time</p>
            <p className="text-sm font-medium text-gray-900">
              {new Date(booking.scheduledDate).toLocaleDateString()}
            </p>
            <p className="text-sm text-gray-600">{booking.scheduledTime}</p>
          </div>
        </div>

        {/* Provider */}
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gradient-nilin-secondary rounded-lg">
            <User className="h-5 w-5 text-gray-700" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Provider</p>
            <p className="text-sm font-medium text-gray-900">{getProviderDisplayName(booking.provider)}</p>
            {booking.provider.phone && (
              <p className="text-sm text-gray-600 flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {booking.provider.phone}
              </p>
            )}
          </div>
        </div>

        {/* Location */}
        {getLocationAddress(booking.location) && (
          <div className="flex items-start gap-3 sm:col-span-2">
            <div className="p-2 bg-gradient-nilin-tertiary rounded-lg">
              <MapPin className="h-5 w-5 text-gray-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Location</p>
              <p className="text-sm text-gray-900">{getLocationAddress(booking.location)}</p>
            </div>
          </div>
        )}

        {/* Guest Info - Show when guest booking */}
        {booking.isGuestBooking && booking.guestInfo && (
          <div className="flex items-start gap-3 sm:col-span-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <User className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Guest Info</p>
              {booking.guestInfo.name && (
                <p className="text-sm font-medium text-gray-900">{booking.guestInfo.name}</p>
              )}
              {booking.guestInfo.phone && (
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {booking.guestInfo.phone}
                </p>
              )}
              {booking.guestInfo.email && (
                <p className="text-sm text-gray-600">{booking.guestInfo.email}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer with Price and Actions */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Total Price</p>
          <p className="text-xl font-bold text-gray-900">AED {getTotalPrice(booking)}</p>
        </div>

        {showActions && booking.status !== 'cancelled' && booking.status !== 'completed' && (
          <div className="flex gap-2">
            <button
              onClick={handleView}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-1"
            >
              <Eye className="h-4 w-4" />
              View
            </button>
            {booking.status === 'pending' && onReschedule && (
              <button
                onClick={handleReschedule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-1"
              >
                <Edit className="h-4 w-4" />
                Reschedule
              </button>
            )}
            {onCancel && (booking.status === 'pending' || booking.status === 'confirmed') && (
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
  );
};

export default BookingCard;
