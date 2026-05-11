import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Filter, Search } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import BookingCard from '../../components/customer/BookingCard';
import { useBookingStore } from '../../stores/bookingStore';
import type { BookingFilters } from '../../services/BookingService';

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
    if (window.confirm('Are you sure you want to cancel this booking?')) {
      await cancelBooking(bookingId, { reason: 'Customer requested cancellation' });
      getCustomerBookings(filters);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All Bookings' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationHeader />

      {/* Breadcrumb Navigation */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
            <p className="text-gray-600">Manage and track your service bookings</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border p-4 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <Filter className="h-5 w-5 text-gray-400" />
              {statusOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedStatus === option.value
                      ? 'bg-gradient-nilin-primary text-gray-900'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                <div key={n} className="bg-white rounded-xl h-64 animate-pulse border"></div>
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
                  />
                ))}
              </div>

              {/* Pagination */}
              {customerBookingsPagination && customerBookingsPagination.pages > 1 && (
                <div className="flex justify-center items-center gap-2">
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
                    disabled={filters.page === 1}
                    className="px-4 py-2 rounded-lg bg-white border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-gray-700">
                    Page {filters.page} of {customerBookingsPagination.pages}
                  </span>
                  <button
                    onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
                    disabled={filters.page === customerBookingsPagination.pages}
                    className="px-4 py-2 rounded-lg bg-white border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="bg-white rounded-xl border p-12 text-center">
              <div className="text-6xl mb-4">📅</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No bookings found</h3>
              <p className="text-gray-600 mb-6">
                {selectedStatus !== 'all'
                  ? `No ${selectedStatus} bookings at the moment`
                  : "You haven't made any bookings yet"}
              </p>
              <button
                onClick={() => navigate('/search')}
                className="px-6 py-3 bg-gradient-nilin-primary text-gray-900 font-semibold rounded-lg hover:shadow-lg transition-shadow"
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
