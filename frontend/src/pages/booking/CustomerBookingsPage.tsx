import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search, Calendar } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import BookingCard from '../../components/customer/BookingCard';
import { useBookingStore } from '../../stores/bookingStore';
import type { BookingFilters } from '../../services/BookingService';
import { toast } from 'react-hot-toast';

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

  useEffect(() => {
    getCustomerBookings(filters);
  }, [filters]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setFilters({
      ...filters,
      status: status === 'all' ? undefined : (status as any),
      page: 1
    });
  };

  const handleViewBooking = (bookingId: string) => {
    navigate(`/customer/bookings/${bookingId}`);
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setCancellingBookingId(bookingId);
    try {
      await cancelBooking(bookingId, { reason: 'Customer requested cancellation' });
      toast.success('Booking cancelled successfully');
      getCustomerBookings(filters);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to cancel booking. Please try again.');
    } finally {
      setCancellingBookingId(null);
    }
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
                <div key={n} className="glass-nilin rounded-nilin-lg h-48 animate-pulse"></div>
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
                      } : undefined
                    }}
                    onView={() => handleViewBooking(booking._id)}
                    onCancel={
                      booking.status === 'pending' || booking.status === 'confirmed'
                        ? () => handleCancelBooking(booking._id)
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
                    onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
                    disabled={filters.page === 1}
                    className="px-4 py-2 rounded-nilin bg-white border border-nilin-border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-nilin-charcoal">
                    Page {filters.page} of {customerBookingsPagination.pages}
                  </span>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
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
      </div>

      <Footer />
    </div>
  );
};

export default CustomerBookingsPage;
