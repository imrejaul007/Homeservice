import React, { useState, useEffect } from 'react';
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
  Eye
} from 'lucide-react';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import type { Booking, BookingFilters } from '../../services/BookingService';
import bookingService from '../../services/BookingService';
import { cn, formatPrice } from '../../lib/utils';

interface BookingListProps {
  userType: 'customer' | 'provider';
  className?: string;
}

const BookingList: React.FC<BookingListProps> = ({ userType, className }) => {
  const { user } = useAuthStore();
  const {
    customerBookings,
    providerBookings,
    customerBookingsPagination,
    providerBookingsPagination,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<{ [key: string]: string | null }>({});

  const bookings = userType === 'customer' ? customerBookings : providerBookings;
  const pagination = userType === 'customer' ? customerBookingsPagination : providerBookingsPagination;

  // Load bookings on component mount and when filters change
  useEffect(() => {
    const loadBookings = async () => {
      const searchFilters = {
        ...filters,
        ...(searchTerm && { search: searchTerm })
      };

      if (userType === 'customer') {
        await getCustomerBookings(searchFilters);
      } else {
        await getProviderBookings(searchFilters);
      }
    };

    loadBookings();
  }, [filters, searchTerm, userType, getCustomerBookings, getProviderBookings]);

  const handleFilterChange = (key: keyof BookingFilters, value: any) => {
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

    return booking.messages.filter(message =>
      !message.readBy.some(read => read.userId === user.id)
    ).length;
  };

  const canCancelBooking = (booking: Booking): boolean => {
    return bookingService.canCancelBooking(booking);
  };

  const handleBookingAction = async (bookingId: string, action: string) => {
    setActionLoading(prev => ({ ...prev, [bookingId]: action }));
    
    try {
      switch (action) {
        case 'accept':
          await acceptBooking(bookingId, {
            notes: 'Booking accepted by provider'
          });
          break;
        case 'reject':
          await rejectBooking(bookingId, {
            reason: 'Provider unavailable',
            notes: 'Provider rejected the booking'
          });
          break;
        case 'start':
          await startBooking(bookingId, 'Service started');
          break;
        case 'complete':
          await completeBooking(bookingId, {
            notes: 'Service completed successfully'
          });
          break;
        case 'cancel':
          await cancelBooking(bookingId, {
            reason: 'Cancelled by customer',
            notes: 'Customer cancelled the booking'
          });
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} booking:`, error);
    } finally {
      setActionLoading(prev => ({ ...prev, [bookingId]: null }));
    }
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
        return 'bg-green-500 hover:bg-green-600 text-white';
      case 'start':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'complete':
        return 'bg-purple-500 hover:bg-purple-600 text-white';
      case 'reject':
      case 'cancel':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-gray-500 hover:bg-gray-600 text-white';
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
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {userType === 'customer' ? 'My Bookings' : 'Service Requests'}
          </h2>
          <p className="text-gray-600">
            {userType === 'customer'
              ? 'Track and manage your service bookings'
              : 'Manage your incoming service requests'
            }
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${userType === 'customer' ? 'bookings' : 'requests'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
            <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status || ''}
                onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
              <input
                type="date"
                value={filters.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
              <input
                type="date"
                value={filters.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={`${filters.sortBy}-${filters.sortOrder}`}
                onChange={(e) => {
                  const [sortBy, sortOrder] = e.target.value.split('-');
                  handleFilterChange('sortBy', sortBy);
                  handleFilterChange('sortOrder', sortOrder as 'asc' | 'desc');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error loading bookings</h3>
              <div className="text-sm text-red-700 mt-1">
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
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

                          <span className="text-sm text-gray-500">
                            #{bookingService.formatBookingNumber(booking.bookingNumber)}
                          </span>

                          {unreadCount > 0 && (
                            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs">
                              <MessageCircle className="h-3 w-3" />
                              {unreadCount} new
                            </div>
                          )}
                        </div>

                        {/* Service Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <div>
                            <h3 className="font-semibold text-gray-900 mb-1">
                              {booking.service?.name || 'Service'}
                            </h3>

                            {userType === 'customer' && booking.provider && (
                              <p className="text-sm text-gray-600 mb-2">
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
                                <p className="text-sm text-gray-600 mb-2">
                                  for {name}
                                </p>
                              );
                            })()}

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Calendar className="h-4 w-4" />
                                {formatDate(booking.scheduledDate, booking.scheduledTime)}
                              </div>

                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Clock className="h-4 w-4" />
                                {(booking as any).duration || booking.estimatedDuration || (booking as any).selectedDuration || booking.service?.duration || '—'} minutes
                              </div>

                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <MapPin className="h-4 w-4" />
                                {booking.location.type === 'online' ? 'Online/Virtual' : (
                                  booking.location.address?.street || booking.location.address?.city
                                    ? [booking.location.address.street, booking.location.address.city].filter(Boolean).join(', ')
                                    : booking.location.type === 'provider_location' ? 'Provider Location' : 'At Home'
                                )}
                              </div>

                              {booking.customerInfo.phone && (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Phone className="h-4 w-4" />
                                  {booking.customerInfo.phone}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-2xl font-bold text-gray-900 mb-1">
                              {formatPrice(booking.pricing.totalAmount || booking.pricing.total || 0, booking.pricing.currency)}
                            </div>

                            {booking.pricing.addOns.length > 0 && (
                              <p className="text-sm text-gray-500 mb-2">
                                Includes {booking.pricing.addOns.length} add-on(s)
                              </p>
                            )}

                            {/* Rating */}
                            {booking.status === 'completed' && (
                              <div className="mt-2">
                                {userType === 'customer' && booking.customerRating ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <span className="text-sm text-gray-600">
                                      You rated: {booking.customerRating.rating}/5
                                    </span>
                                  </div>
                                ) : userType === 'provider' && booking.providerRating ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                                    <span className="text-sm text-gray-600">
                                      Customer rated: {booking.providerRating.rating}/5
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">No rating yet</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Special Requests */}
                        {booking.customerInfo.specialRequests && (
                          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                            <h4 className="text-sm font-medium text-blue-900 mb-1">Special Requests:</h4>
                            <p className="text-sm text-blue-800">{booking.customerInfo.specialRequests}</p>
                          </div>
                        )}

                        {/* Recent Messages */}
                        {booking.messages.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">
                              Recent Messages ({booking.messages.length})
                            </h4>
                            <div className="bg-gray-50 p-3 rounded-lg">
                              {booking.messages.slice(-2).map((message) => (
                                <div key={message._id} className="text-sm">
                                  <span className="font-medium">
                                    {message.senderType === 'customer' ? 'Customer' : 'Provider'}:
                                  </span>
                                  <span className="ml-2 text-gray-700">{message.message}</span>
                                </div>
                              ))}
                              {booking.messages.length > 2 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  +{booking.messages.length - 2} more messages
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
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
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
                                  "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium",
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

                        {booking.messages.length > 0 && (
                          <Link
                            to={`/${userType}/bookings/${booking._id}?tab=messages`}
                            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm relative"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Messages
                            {unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                {unreadCount}
                              </span>
                            )}
                          </Link>
                        )}

                        {userType === 'customer' && canCancel && (
                          <button
                            onClick={() => handleBookingAction(booking._id, 'cancel')}
                            disabled={currentActionLoading === 'cancel'}
                            className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                          >
                            {currentActionLoading === 'cancel' ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
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
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No {userType === 'customer' ? 'bookings' : 'requests'} found
              </h3>
              <p className="text-gray-500 mb-6">
                {userType === 'customer'
                  ? "You haven't made any bookings yet."
                  : "You don't have any service requests yet."
                }
              </p>
              {userType === 'customer' && (
                <Link
                  to="/services"
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Browse Services
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex justify-center mt-8">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm",
                    pagination.page === 1
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  Previous
                </button>

                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const pageNum = pagination.page <= 3
                    ? i + 1
                    : Math.max(1, pagination.page - 2) + i;

                  if (pageNum > pagination.pages) return null;

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={cn(
                        "px-3 py-2 rounded-lg text-sm",
                        pageNum === pagination.page
                          ? "bg-blue-500 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm",
                    pagination.page === pagination.pages
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BookingList;