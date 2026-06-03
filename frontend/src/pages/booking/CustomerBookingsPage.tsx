import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, Calendar, X } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import BookingCard from '../../components/customer/BookingCard';
import { useBookingStore } from '../../stores/bookingStore';
import type { BookingFilters } from '../../services/BookingService';
import { toast } from 'react-hot-toast';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { BookingCardSkeleton } from '../../components/common/Loading';
import { useBookingAdminUpdates } from '../../hooks/useSocket';
import { CANCELLATION_REASONS } from '../../constants/booking';

const CustomerBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    customerBookings,
    customerBookingsPagination,
    getCustomerBookings,
    cancelBooking,
    isLoading
  } = useBookingStore();

  const [filters, setFilters] = useState<BookingFilters>({
    page: 1,
    limit: 12,
    status: undefined
  });

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const isFetchingRef = useRef(false);

  // Subscribe to real-time booking updates from admin actions
  const { bookingUpdated } = useBookingAdminUpdates();

  // Fetch bookings when filters change
  useEffect(() => {
    getCustomerBookings(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.status, getCustomerBookings]);

  // Refresh bookings when admin updates a booking (real-time update)
  useEffect(() => {
    if (bookingUpdated && !isFetchingRef.current) {
      // Show toast notification about the update
      toast.success(`Booking #${bookingUpdated.bookingNumber.slice(-6)} status updated to ${bookingUpdated.status.replace('_', ' ')} by admin`);
      // Refresh the bookings list
      getCustomerBookings(filters);
    }
  }, [bookingUpdated, getCustomerBookings, filters]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setFilters((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : (status as BookingFilters['status']),
      page: 1
    }));
  };

  const handleViewBooking = (bookingId: string) => {
    navigate(`/customer/bookings/${bookingId}`);
  };

  const handleCancelBooking = async () => {
    if (!cancelBookingId) return;

    setCancellingBookingId(cancelBookingId);
    setShowCancelModal(false);
    try {
      await cancelBooking(cancelBookingId, { reason: CANCELLATION_REASONS.CUSTOMER_REQUEST });
      toast.success('Booking cancelled successfully');
      getCustomerBookings(filters);
    } catch (err: unknown) {
      // Axios errors have response.data property
      const axiosError = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Failed to cancel booking. Please try again.';
      toast.error(errorMessage);
    } finally {
      setCancellingBookingId(null);
      setCancelBookingId(null);
    }
  };

  const handleCancelClick = (bookingId: string) => {
    setCancelBookingId(bookingId);
    setShowCancelModal(true);
  };

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <PageErrorBoundary pageName="My Bookings">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">My Bookings</h1>
              <p className="text-nilin-warmGray">Manage and track your service bookings</p>
            </div>

            {/* Filters */}
            <div className="glass-nilin rounded-nilin-lg p-4 mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                  <Filter className="h-4 w-4 text-nilin-coral" />
                </div>
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`px-4 py-2 rounded-nilin text-sm font-medium transition-all ${
                      selectedStatus === option.value
                        ? 'bg-nilin-coral text-white shadow-nilin-warm'
                        : 'bg-white text-nilin-warmGray border border-nilin-border hover:bg-nilin-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bookings Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <BookingCardSkeleton key={n} />
                ))}
              </div>
            ) : customerBookings && customerBookings.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {customerBookings.map((booking) => (
                    <BookingCard
                      key={booking._id}
                      booking={{
                        _id: booking._id,
                        service: {
                          _id: booking.service?._id || '',
                          title: booking.service?.name || 'Service',
                          category: booking.service?.category
                        },
                        provider: {
                          _id: booking.provider?._id || '',
                          name: booking.provider?.firstName
                            ? `${booking.provider.firstName} ${booking.provider.lastName || ''}`
                            : 'Provider',
                          phone: booking.provider?.phone
                        },
                        scheduledDate: booking.scheduledDate,
                        scheduledTime: booking.scheduledTime,
                        status: booking.status,
                        totalPrice: booking.pricing?.totalAmount || booking.pricing?.total || 0,
                        location: booking.location?.address ? {
                          address: `${booking.location.address.street || ''}, ${booking.location.address.city || ''}`
                        } : undefined,
                        isGuestBooking: booking.isGuestBooking,
                        guestInfo: booking.guestInfo
                      }}
                      onView={() => handleViewBooking(booking._id)}
                      onCancel={
                        booking.status === 'pending' || booking.status === 'confirmed'
                          ? () => handleCancelClick(booking._id)
                          : undefined
                      }
                      isCancelling={cancellingBookingId === booking._id}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {customerBookingsPagination && customerBookingsPagination.pages > 1 && (
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
                      disabled={filters.page === 1}
                      className="px-4 py-2 rounded-nilin bg-white border border-nilin-border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-nilin-charcoal">
                      Page {filters.page} of {customerBookingsPagination.pages}
                    </span>
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
                      disabled={filters.page === customerBookingsPagination.pages}
                      className="px-4 py-2 rounded-nilin bg-white border border-nilin-border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="glass-nilin rounded-nilin-lg p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-nilin-coral" />
                </div>
                <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No bookings found</h3>
                <p className="text-nilin-warmGray mb-6">
                  {selectedStatus !== 'all'
                    ? `No ${selectedStatus} bookings at the moment`
                    : "You haven't made any bookings yet"}
                </p>
                <button
                  onClick={() => navigate('/search')}
                  className="btn-nilin"
                >
                  Browse Services
                </button>
              </div>
            )}
          </div>
        </PageErrorBoundary>
      </div>

      <Footer />

      {/* Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-nilin-lg max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <X className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Cancel Booking</h3>
              <p className="text-nilin-warmGray mb-6">
                Are you sure you want to cancel this booking? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  className="flex-1 px-4 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancelBooking}
                  disabled={cancellingBookingId !== null}
                  className="flex-1 px-4 py-3 rounded-nilin bg-red-500 text-white hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
                >
                  {cancellingBookingId ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerBookingsPage;
