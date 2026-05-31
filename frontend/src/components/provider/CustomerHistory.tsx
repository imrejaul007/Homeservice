/**
 * CustomerHistory - Customer booking history view
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  User,
  Calendar,
  Clock,
  DollarSign,
  Star,
  ChevronRight,
  ChevronDown,
  Search,
  Filter,
  Phone,
  MessageSquare,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface BookingHistoryItem {
  /** Unique booking ID */
  id: string;
  /** Service name */
  serviceName: string;
  /** Service category */
  category: string;
  /** Booking date */
  bookingDate: string;
  /** Scheduled time */
  scheduledTime: string;
  /** Duration in minutes */
  duration: number;
  /** Price */
  price: number;
  /** Currency */
  currency?: string;
  /** Status */
  status: BookingStatus;
  /** Customer rating (if completed) */
  customerRating?: number;
  /** Provider response */
  providerResponse?: string;
  /** Notes */
  notes?: string;
}

export interface CustomerHistoryData {
  /** Customer ID */
  id: string;
  /** Customer name */
  name: string;
  /** Customer avatar */
  avatar?: string;
  /** Customer email */
  email?: string;
  /** Customer phone */
  phone?: string;
  /** Member since */
  memberSince: string;
  /** Total bookings */
  totalBookings: number;
  /** Total spent */
  totalSpent: number;
  /** Average rating given */
  averageRating: number;
  /** Repeat customer indicator */
  isRepeatCustomer: boolean;
  /** Last booking date */
  lastBookingDate: string;
  /** Preferred services */
  preferredServices: string[];
}

export interface CustomerHistoryProps {
  /** Customer data */
  customer: CustomerHistoryData;
  /** Booking history */
  bookings: BookingHistoryItem[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when viewing booking details */
  onBookingClick?: (bookingId: string) => void;
  /** Callback when contacting customer */
  onContactCustomer?: (method: 'phone' | 'email') => void;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const statusConfig: Record<BookingStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: AlertCircle },
  confirmed: { label: 'Confirmed', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: CheckCircle },
  in_progress: { label: 'In Progress', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Clock },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle },
};

// =============================================================================
// Customer Profile Card
// =============================================================================

interface CustomerProfileCardProps {
  customer: CustomerHistoryData;
  onContact?: (method: 'phone' | 'email') => void;
}

const CustomerProfileCard: React.FC<CustomerProfileCardProps> = ({
  customer,
  onContact,
}) => {
  const formatCurrency = (amount: number, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 rounded-xl p-6 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            {customer.avatar ? (
              <img
                src={customer.avatar}
                alt={customer.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-nilin-coral" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-semibold text-nilin-charcoal">
                {customer.name}
              </h3>
              {customer.isRepeatCustomer && (
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                  Repeat Customer
                </span>
              )}
            </div>
            <p className="text-sm text-nilin-warmGray">
              Member since {formatDate(customer.memberSince)}
            </p>
          </div>
        </div>

        {/* Contact Buttons */}
        {onContact && (
          <div className="flex items-center gap-2">
            {customer.phone && (
              <button
                onClick={() => onContact('phone')}
                className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors"
                title="Call customer"
              >
                <Phone className="w-5 h-5" />
              </button>
            )}
            {customer.email && (
              <button
                onClick={() => onContact('email')}
                className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-white rounded-lg transition-colors"
                title="Email customer"
              >
                <MessageSquare className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-nilin-charcoal">
            {customer.totalBookings}
          </p>
          <p className="text-xs text-nilin-warmGray">Total Bookings</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(customer.totalSpent, 'AED')}
          </p>
          <p className="text-xs text-nilin-warmGray">Total Spent</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <p className="text-2xl font-bold text-nilin-charcoal">
              {customer.averageRating.toFixed(1)}
            </p>
          </div>
          <p className="text-xs text-nilin-warmGray">Avg Rating</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-sm text-nilin-charcoal font-medium">
            {formatDate(customer.lastBookingDate)}
          </p>
          <p className="text-xs text-nilin-warmGray">Last Booking</p>
        </div>
      </div>

      {/* Preferred Services */}
      {customer.preferredServices.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-nilin-warmGray mb-2">Preferred Services:</p>
          <div className="flex flex-wrap gap-2">
            {customer.preferredServices.map((service) => (
              <span
                key={service}
                className="px-3 py-1 bg-white rounded-full text-sm text-nilin-charcoal"
              >
                {service}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Booking History Item Component
// =============================================================================

interface BookingItemProps {
  booking: BookingHistoryItem;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}

const BookingItem: React.FC<BookingItemProps> = ({
  booking,
  isExpanded,
  onToggle,
  onClick,
}) => {
  const status = statusConfig[booking.status];
  const StatusIcon = status.icon;

  const formatCurrency = (amount: number, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white rounded-xl border border-nilin-border overflow-hidden">
      {/* Main Row */}
      <div
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-nilin-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              status.bgColor
            )}
          >
            <StatusIcon className={cn('w-5 h-5', status.color)} />
          </div>
          <div>
            <h4 className="font-medium text-nilin-charcoal">{booking.serviceName}</h4>
            <div className="flex items-center gap-3 text-sm text-nilin-warmGray">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(booking.bookingDate)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(booking.scheduledTime)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold text-nilin-charcoal">
              {formatCurrency(booking.price, booking.currency)}
            </p>
            {booking.customerRating && (
              <div className="flex items-center justify-end gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'w-3 h-3',
                      i < booking.customerRating!
                        ? 'text-yellow-400 fill-yellow-400'
                        : 'text-gray-300'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
          <ChevronDown
            className={cn(
              'w-5 h-5 text-nilin-lightGray transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t border-nilin-border bg-nilin-muted/20">
          <div className="pt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">Category</p>
              <p className="text-sm text-nilin-charcoal">{booking.category}</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">Duration</p>
              <p className="text-sm text-nilin-charcoal">{booking.duration} minutes</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">Status</p>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  status.bgColor,
                  status.color
                )}
              >
                <StatusIcon className="w-3 h-3" />
                {status.label}
              </span>
            </div>
            {booking.customerRating && (
              <div>
                <p className="text-xs text-nilin-warmGray mb-1">Customer Rating</p>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'w-4 h-4',
                        i < booking.customerRating!
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300'
                      )}
                    />
                  ))}
                  <span className="text-sm text-nilin-charcoal ml-1">
                    {booking.customerRating}/5
                  </span>
                </div>
              </div>
            )}
          </div>

          {booking.notes && (
            <div className="mt-4">
              <p className="text-xs text-nilin-warmGray mb-1">Notes</p>
              <p className="text-sm text-nilin-charcoal bg-white p-3 rounded-lg">
                {booking.notes}
              </p>
            </div>
          )}

          {booking.providerResponse && (
            <div className="mt-4">
              <p className="text-xs text-nilin-warmGray mb-1">Your Response</p>
              <p className="text-sm text-nilin-charcoal bg-white p-3 rounded-lg">
                {booking.providerResponse}
              </p>
            </div>
          )}

          {onClick && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick();
              }}
              className="mt-4 flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              <span>View Full Details</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const CustomerHistory: React.FC<CustomerHistoryProps> = ({
  customer,
  bookings,
  isLoading = false,
  onBookingClick,
  onContactCustomer,
  currency = 'AED',
  className,
}) => {
  const [expandedBooking, setExpandedBooking] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings
      .filter((booking) => {
        if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            booking.serviceName.toLowerCase().includes(query) ||
            booking.category.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
  }, [bookings, statusFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-40 bg-nilin-muted rounded-xl mb-6" />
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <User className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Customer History
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {bookings.length} booking{bookings.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Customer Profile */}
      <CustomerProfileCard
        customer={customer}
        onContact={onContactCustomer}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as BookingStatus | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          {(Object.keys(statusConfig) as BookingStatus[]).map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Bookings List */}
      {filteredBookings.length > 0 ? (
        <div className="space-y-3">
          {filteredBookings.map((booking) => (
            <BookingItem
              key={booking.id}
              booking={booking}
              isExpanded={expandedBooking === booking.id}
              onToggle={() =>
                setExpandedBooking(
                  expandedBooking === booking.id ? null : booking.id
                )
              }
              onClick={onBookingClick ? () => onBookingClick(booking.id) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No bookings found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Try adjusting your filters
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default CustomerHistory;
