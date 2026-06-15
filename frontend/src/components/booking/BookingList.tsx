import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Phone,
  MessageCircle,
  Star,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Filter,
  Search,
  ChevronDown,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { Booking, BookingFilters, ProviderBookingsStats } from '../../services/BookingService';
import bookingService from '../../services/BookingService';
import { cn, formatPrice } from '../../lib/utils';
import { useToastActions } from '../common/Toast';
import { socketService } from '../../services/socket';

interface BookingListProps {
  userType: 'customer' | 'provider';
  className?: string;
  /** Hide duplicate page title when parent page already renders it */
  hideHeader?: boolean;
}

const PROVIDER_STATUS_TABS: Array<{
  value: string;
  label: string;
  countKey: keyof ProviderBookingsStats;
}> = [
  { value: '', label: 'All', countKey: 'total' },
  { value: 'pending', label: 'Pending', countKey: 'pending' },
  { value: 'confirmed', label: 'Confirmed', countKey: 'confirmed' },
  { value: 'in_progress', label: 'In Progress', countKey: 'in_progress' },
  { value: 'completed', label: 'Completed', countKey: 'completed' },
  { value: 'cancelled', label: 'Cancelled', countKey: 'cancelled' },
];

const BookingList: React.FC<BookingListProps> = ({ userType, className, hideHeader }) => {
  const { user } = useAuthStore();
  const toast = useToastActions();
  const {
    customerBookings,
    providerBookings,
    customerBookingsPagination,
    providerBookingsPagination,
    providerBookingsStats,
    getCustomerBookings,
    getProviderBookings,
    acceptBooking,
    rejectBooking,
    startBooking,
    completeBooking,
    cancelBooking,
    isLoading,
    isSubmitting,
    errors
  } = useBookingStore();

  const [filters, setFilters] = useState<BookingFilters>({
    page: 1,
    limit: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });

  const [showFilters, setShowFilters] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<{ [key: string]: string | null }>({});
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const rejectModalRef = useRef<HTMLDivElement>(null);
  const rejectTextareaRef = useRef<HTMLTextAreaElement>(null);

  const bookings = userType === 'customer' ? customerBookings : providerBookings;
  const pagination = userType === 'customer' ? customerBookingsPagination : providerBookingsPagination;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const buildSearchFilters = useCallback(
    (): BookingFilters => ({
      ...filters,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    }),
    [filters, debouncedSearch],
  );

  const reloadBookings = useCallback(async () => {
    const searchFilters = buildSearchFilters();
    if (userType === 'customer') {
      await getCustomerBookings(searchFilters);
    } else {
      await getProviderBookings(searchFilters);
    }
  }, [buildSearchFilters, getCustomerBookings, getProviderBookings, userType]);

  useEffect(() => {
    void reloadBookings();
  }, [reloadBookings]);

  // Real-time refresh for provider booking list
  useEffect(() => {
    if (userType !== 'provider') return;

    const unsubscribers = [
      socketService.on('booking:new_request', () => {
        void reloadBookings();
      }),
      socketService.on('booking:status_changed', () => {
        void reloadBookings();
      }),
      socketService.on('booking:confirmed', () => {
        void reloadBookings();
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [userType, reloadBookings]);

  // Focus trap and Escape key handling for reject modal
  useEffect(() => {
    if (!rejectTargetId) return;

    // Focus the textarea when modal opens
    if (rejectTextareaRef.current) {
      rejectTextareaRef.current.focus();
    }

    // Escape key to close modal
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setRejectTargetId(null);
        setRejectReason('');
      }
    };

    // Focus trap - keep focus within modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !rejectModalRef.current) return;

      const focusableElements = rejectModalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('keydown', handleTabKey);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('keydown', handleTabKey);
    };
  }, [rejectTargetId]);

  const handleFilterChange = (key: keyof BookingFilters, value: BookingFilters[keyof BookingFilters]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // Reset to first page when filters change
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters(prev => ({
      ...prev,
      page
    }));
  };

  const getStatusIcon = (status: Booking['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'in_progress':
        return <Loader className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const formatDate = (date: string, time: string) => {
    // Extract just the date part if it's an ISO string
    const datePart = date?.includes('T') ? date.split('T')[0] : date;
    const bookingDate = new Date(`${datePart}T${time || '00:00'}`);
    if (isNaN(bookingDate.getTime())) {
      // Fallback: try parsing date alone
      const fallback = new Date(date);
      if (isNaN(fallback.getTime())) return 'Date TBD';
      return `${fallback.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${time || 'TBD'}`;
    }
    return bookingDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUnreadMessageCount = (booking: Booking): number => {
    if (!user) return 0;

    return (booking.messages || []).filter(message =>
      !message.readBy?.some(read => read.userId === user.id)
    ).length;
  };

  const canCancelBooking = (booking: Booking): boolean => {
    return bookingService.canCancelBooking(booking);
  };

  const handleBookingAction = async (bookingId: string, action: string) => {
    if (action === 'reject') {
      setRejectTargetId(bookingId);
      setRejectReason('');
      return;
    }

    setActionLoading(prev => ({ ...prev, [bookingId]: action }));

    try {
      switch (action) {
        case 'accept':
          await acceptBooking(bookingId, {
            notes: 'Booking accepted by provider',
          });
          toast.success('Booking accepted');
          break;
        case 'start':
          await startBooking(bookingId, 'Service started');
          toast.success('Service marked as in progress');
          break;
        case 'complete':
          await completeBooking(bookingId, {
            notes: 'Service completed successfully',
          });
          toast.success('Booking completed');
          break;
        case 'cancel':
          await cancelBooking(bookingId, {
            reason: 'Cancelled by customer',
            notes: 'Customer cancelled the booking',
          });
          toast.success('Booking cancelled');
          break;
      }
      await reloadBookings();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            'Failed to perform action';
      toast.error(message);
    } finally {
      setActionLoading(prev => ({ ...prev, [bookingId]: null }));
    }
  };

  const confirmReject = async () => {
    if (!rejectTargetId) return;
    const reason = rejectReason.trim() || 'Provider unavailable';
    setActionLoading(prev => ({ ...prev, [rejectTargetId]: 'reject' }));

    try {
      await rejectBooking(rejectTargetId, {
        reason,
        notes: 'Provider rejected the booking',
      });
      toast.success('Booking declined');
      setRejectTargetId(null);
      setRejectReason('');
      await reloadBookings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to decline booking';
      toast.error(message);
    } finally {
      setActionLoading(prev => ({ ...prev, [rejectTargetId]: null }));
    }
  };

  const handleStatusTab = (status: string) => {
    handleFilterChange('status', status || undefined);
  };

  const getProviderActions = (booking: Booking): string[] => {
    const actions: string[] = [];

    switch (booking.status) {
      case 'pending':
        actions.push('accept', 'reject');
        break;
      case 'confirmed':
        actions.push('start');
        break;
      case 'in_progress':
        actions.push('complete');
        break;
    }

    return actions;
  };

  const getActionButtonStyle = (action: string): string => {
    switch (action) {
      case 'accept':
        return 'bg-nilin-success hover:bg-nilin-success/90 text-white';
      case 'start':
        return 'bg-gradient-to-r from-nilin-rose to-nilin-coral hover:shadow-nilin-warm text-white';
      case 'complete':
        return 'bg-nilin-success hover:bg-nilin-success/90 text-white';
      case 'reject':
      case 'cancel':
        return 'bg-nilin-error hover:bg-nilin-error/90 text-white';
      default:
        return 'bg-nilin-warmGray hover:bg-nilin-charcoal text-white';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'accept':
        return <CheckCircle className="h-4 w-4" />;
      case 'reject':
      case 'cancel':
        return <XCircle className="h-4 w-4" />;
      case 'start':
        return <Clock className="h-4 w-4" />;
      case 'complete':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {!hideHeader && (
          <div>
            <h2 className="text-2xl font-bold text-nilin-charcoal font-serif">
              {userType === 'customer' ? 'My Bookings' : 'Service Requests'}
            </h2>
            <p className="text-nilin-warmGray">
              {userType === 'customer'
                ? 'Track and manage your service bookings'
                : 'Manage your incoming service requests'
              }
            </p>
          </div>
        )}

        {/* Search and Filter */}
        <div className={cn("flex items-center gap-3", hideHeader && "w-full justify-end")}>
          <div className="relative flex-1 sm:flex-none sm:min-w-[240px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
            <input
              type="text"
              placeholder={`Search ${userType === 'customer' ? 'bookings' : 'requests'}...`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="glass-input w-full pl-10 pr-4 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans border-glow"
            />
          </div>

          <button
            type="button"
            onClick={() => void reloadBookings()}
            disabled={isLoading}
            className="glass-btn p-2 rounded-xl transition-all"
            aria-label="Refresh bookings"
          >
            <RefreshCw className={cn("h-4 w-4 text-nilin-warmGray", isLoading && "animate-spin")} />
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className="glass-btn flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
          >
            <Filter className="h-4 w-4 text-nilin-warmGray" />
            <span className="text-nilin-charcoal">Filters</span>
            <ChevronDown className={cn("h-4 w-4 text-nilin-warmGray transition-transform", showFilters && "rotate-180")} />
          </button>
        </div>
      </div>

      {userType === 'provider' && providerBookingsStats && (
        <div className="flex flex-wrap gap-2">
          {PROVIDER_STATUS_TABS.map((tab) => {
            const count = providerBookingsStats[tab.countKey] ?? 0;
            const active = (filters.status || '') === tab.value;
            return (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => handleStatusTab(tab.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-sans transition-all border',
                  active
                    ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white border-transparent shadow-nilin-warm'
                    : 'bg-white/60 text-nilin-charcoal border-nilin-blush hover:bg-nilin-blush/40',
                )}
              >
                {tab.label}
                <span className={cn('ml-1.5 text-xs', active ? 'text-white/90' : 'text-nilin-warmGray')}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="glass glass-blur p-4 rounded-xl gradient-3d">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">Date From</label>
              <input
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => handleFilterChange('startDate', e.target.value || undefined)}
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">Date To</label>
              <input
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => handleFilterChange('endDate', e.target.value || undefined)}
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">Sort By</label>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  handleFilterChange('sortBy', sortBy);
                  handleFilterChange('sortOrder', sortOrder as 'asc' | 'desc');
                }}
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              >
                <option value="createdAt-desc">Newest First</option>
                <option value="createdAt-asc">Oldest First</option>
                <option value="scheduledDate-asc">Date (Earliest)</option>
                <option value="scheduledDate-desc">Date (Latest)</option>
                <option value="status-asc">Status (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errors.length > 0 && (
        <div className="glass p-4 rounded-xl bg-nilin-error/10 border border-nilin-error/20">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-nilin-error mr-2" />
            <div>
              <h3 className="text-sm font-medium text-nilin-error">Error loading bookings</h3>
              <div className="text-sm text-nilin-error/80 mt-1">
                {errors.map((error, index) => (
                  <p key={index}>{error.message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
        </div>
      )}

      {/* Bookings List */}
      {!isLoading && (
        <>
          {bookings.length > 0 ? (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const unreadCount = getUnreadMessageCount(booking);
                const canCancel = canCancelBooking(booking);
                const providerActions = userType === 'provider' ? getProviderActions(booking) : [];
                const currentActionLoading = actionLoading[booking._id];

                return (
                  <div
                    key={booking._id}
                    className="glass rounded-xl p-6 hover:shadow-nilin-warm transition-all card-3d gradient-3d"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {/* Booking Header */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium",
                            bookingService.getStatusColor(booking.status)
                          )}>
                            {getStatusIcon(booking.status)}
                            {bookingService.getStatusLabel(booking.status)}
                          </div>

                          <span className="text-sm text-nilin-warmGray glass px-2 py-1 rounded-full">
                            #{bookingService.formatBookingNumber(booking.bookingNumber)}
                          </span>

                          {unreadCount > 0 && (
                            <div className="flex items-center gap-1 bg-nilin-error/10 text-nilin-error px-2 py-1 rounded-full text-xs glass">
                              <MessageCircle className="h-3 w-3" />
                              {unreadCount} new
                            </div>
                          )}
                        </div>

                        {/* Service Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h3 className="font-semibold text-nilin-charcoal mb-1">
                              {booking.service?.name || 'Service'}
                            </h3>

                            {userType === 'customer' && booking.provider && (
                              <p className="text-sm text-nilin-warmGray mb-2">
                                by {booking.provider.firstName} {booking.provider.lastName}
                                {booking.provider.businessInfo?.businessName &&
                                  ` (${booking.provider.businessInfo.businessName})`
                                }
                              </p>
                            )}

                            {userType === 'provider' && (() => {
                              const first = booking.customer?.firstName || booking.customerInfo?.firstName || (booking as any).guestInfo?.name?.split(' ')[0];
                              const last = booking.customer?.lastName || booking.customerInfo?.lastName || (booking as any).guestInfo?.name?.split(' ').slice(1).join(' ');
                              const name = (first || last) ? `${first || ''} ${last || ''}`.trim() : ((booking as any).isGuestBooking ? 'Guest' : 'Customer');
                              return (
                                <p className="text-sm text-nilin-warmGray mb-2">
                                  for {name}
                                </p>
                              );
                            })()}

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                                <Calendar className="h-4 w-4 text-nilin-rose" />
                                {formatDate(booking.scheduledDate, booking.scheduledTime)}
                              </div>

                              <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                                <Clock className="h-4 w-4 text-nilin-rose" />
                                {(booking as { duration?: number; selectedDuration?: number }).duration
                                  ?? booking.estimatedDuration
                                  ?? (booking as { selectedDuration?: number }).selectedDuration
                                  ?? booking.service?.duration
                                  ?? '—'} minutes
                              </div>

                              <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                                <MapPin className="h-4 w-4 text-nilin-rose" />
                                {booking.location.type === 'online' ? 'Online/Virtual' : (
                                  booking.location.address?.street || booking.location.address?.city
                                    ? [booking.location.address.street, booking.location.address.city].filter(Boolean).join(', ')
                                    : booking.location.type === 'provider_location' ? 'Provider Location' : 'At Home'
                                )}
                              </div>

                              {(booking.customerInfo?.phone ||
                                booking.customer?.phone ||
                                (booking as { guestInfo?: { phone?: string } }).guestInfo?.phone) && (
                                <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                                  <Phone className="h-4 w-4 text-nilin-rose" />
                                  {(booking.customerInfo?.phone || '').trim() ||
                                    booking.customer?.phone ||
                                    (booking as { guestInfo?: { phone?: string } }).guestInfo?.phone}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-2xl font-bold text-nilin-charcoal mb-1">
                              {formatPrice(booking.pricing.totalAmount || booking.pricing.total || 0, booking.pricing.currency)}
                            </div>

                            {booking.pricing.addOns.length > 0 && (
                              <p className="text-sm text-nilin-warmGray mb-2">
                                Includes {booking.pricing.addOns.length} add-on(s)
                              </p>
                            )}

                            {/* Rating */}
                            {booking.status === 'completed' && (
                              <div className="mt-2">
                                {userType === 'customer' && booking.customerRating ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <span className="text-sm text-nilin-warmGray">
                                      You rated: {booking.customerRating.rating}/5
                                    </span>
                                  </div>
                                ) : userType === 'provider' && booking.providerRating ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <span className="text-sm text-nilin-warmGray">
                                      Customer rated: {booking.providerRating.rating}/5
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-sm text-nilin-warmGray">No rating yet</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Special Requests */}
                        {booking.customerInfo?.specialRequests && (
                          <div className="mb-4 p-3 neu-light rounded-xl">
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-1">Special Requests:</h4>
                            <p className="text-sm text-nilin-warmGray">{booking.customerInfo.specialRequests}</p>
                          </div>
                        )}

                        {/* Recent Messages */}
                        {(booking.messages?.length ?? 0) > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-nilin-charcoal mb-2">
                              Recent Messages ({booking.messages?.length ?? 0})
                            </h4>
                            <div className="glass p-3 rounded-xl">
                              {booking.messages?.slice(-2).map((message) => (
                                <div key={message._id} className="text-sm">
                                  <span className="font-medium text-nilin-charcoal">
                                    {message.senderType === 'customer' ? 'Customer' : 'Provider'}:
                                  </span>
                                  <span className="ml-2 text-nilin-warmGray">{message.message}</span>
                                </div>
                              ))}
                              {(booking.messages?.length ?? 0) > 2 && (
                                <p className="text-xs text-nilin-warmGray mt-1">
                                  +{(booking.messages?.length ?? 0) - 2} more messages
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="ml-6 flex flex-col gap-2">
                        <Link
                          to={`/${userType}/bookings/${booking._id}`}
                          className="btn-3d flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl hover:shadow-nilin-warm transition-all text-sm font-medium"
                        >
                          <Eye className="h-4 w-4" />
                          View Details
                        </Link>

                        {/* Provider Actions */}
                        {userType === 'provider' && providerActions.length > 0 && (
                          <div className="space-y-2">
                            {providerActions.map((action) => (
                              <button
                                key={action}
                                onClick={() => handleBookingAction(booking._id, action)}
                                disabled={currentActionLoading === action}
                                className={cn(
                                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium card-3d",
                                  getActionButtonStyle(action),
                                  currentActionLoading === action && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                {currentActionLoading === action ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                  getActionIcon(action)
                                )}
                                {action.charAt(0).toUpperCase() + action.slice(1)}
                                {action === 'complete' && ' Service'}
                              </button>
                            ))}
                          </div>
                        )}

                        {(booking.messages?.length ?? 0) > 0 && (
                          <Link
                            to={`/${userType}/bookings/${booking._id}?tab=messages`}
                            className="glass-btn flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm relative"
                          >
                            <MessageCircle className="h-4 w-4 text-nilin-warmGray" />
                            <span className="text-nilin-charcoal">Messages</span>
                            {unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-nilin-error text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </Link>
                        )}

                        {userType === 'customer' && canCancel && (
                          <button
                            onClick={() => handleBookingAction(booking._id, 'cancel')}
                            disabled={currentActionLoading === 'cancel'}
                            className="glass-btn flex items-center gap-2 px-4 py-2 border border-nilin-error/30 text-nilin-error rounded-xl transition-all text-sm"
                          >
                            {currentActionLoading === 'cancel' ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-nilin-error"></div>
                            ) : (
                              <XCircle className="h-4 w-4" />
                            )}
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="glass text-center py-12 rounded-xl gradient-3d">
              <Calendar className="h-16 w-16 text-nilin-rose/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-nilin-charcoal mb-2">
                No {userType === 'customer' ? 'bookings' : 'requests'} found
              </h3>
              <p className="text-nilin-warmGray mb-6">
                {userType === 'customer'
                  ? "You haven't made any bookings yet."
                  : "You don't have any service requests yet."
                }
              </p>
              {userType === 'customer' && (
                <Link
                  to="/services"
                  className="btn-3d inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl hover:shadow-nilin-warm transition-all"
                >
                  Browse Services
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="glass flex items-center gap-2 p-2 rounded-xl">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm",
                    pagination.page === 1
                      ? "text-nilin-lightGray cursor-not-allowed"
                      : "text-nilin-charcoal hover:bg-nilin-blush/30"
                  )}
                  aria-label="Previous page"
                >
                  Previous
                </button>

                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(pagination.page - 2, pagination.pages - 4));
                  const pageNum = startPage + i;
                  if (pageNum > pagination.pages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-sm card-3d transition-all",
                        pageNum === pagination.page
                          ? "bg-gradient-to-r from-nilin-rose to-nilin-coral text-white"
                          : "text-nilin-charcoal hover:bg-nilin-blush/30"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(Math.min(pagination.page + 1, pagination.pages))}
                  disabled={pagination.page === pagination.pages}
                  className={cn(
                    "px-3 py-2 rounded-xl text-sm",
                    pagination.page === pagination.pages
                      ? "text-nilin-lightGray cursor-not-allowed"
                      : "text-nilin-charcoal hover:bg-nilin-blush/30"
                  )}
                  aria-label="Next page"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {rejectTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="presentation">
          <div
            ref={rejectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-modal-title"
            className="glass w-full max-w-md rounded-2xl p-6 shadow-nilin-warm"
          >
            <h3 id="reject-modal-title" className="text-lg font-serif text-nilin-charcoal mb-2">Decline booking</h3>
            <p className="text-sm text-nilin-warmGray mb-4 font-sans">
              Optionally tell the customer why you cannot take this request.
            </p>
            <textarea
              ref={rejectTextareaRef}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="e.g. Fully booked at this time"
              className="glass-input w-full px-3 py-2 rounded-xl font-sans mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRejectTargetId(null);
                  setRejectReason('');
                }}
                className="px-4 py-2 rounded-xl text-nilin-charcoal hover:bg-nilin-blush/30 font-sans text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmReject()}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-nilin-error text-white text-sm font-medium hover:bg-nilin-error/90 disabled:opacity-50"
              >
                Decline request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingList;
