/**
 * Provider Calendar Page
 *
 * Displays a full calendar view of provider bookings with the ability to:
 * - View bookings by month/day
 * - Accept or decline pending bookings
 * - View booking details
 * - See blocked time periods
 * - Real-time updates via socket
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import ProviderHubNav from '../../components/provider/ProviderHubNav';
import { CalendarView, CalendarBooking } from '../../components/provider/CalendarView';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { bookingService } from '../../services/BookingService';
import { socketService } from '../../services/socket';
import { toast } from 'react-hot-toast';

const ProviderCalendarPage: React.FC = () => {
  const navigate = useNavigate();

  // Booking state
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date range for fetching bookings
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    return { start, end };
  });

  // Fetch request tracking to avoid race conditions
  const fetchRequestId = useRef(0);

  // Fetch bookings from API
  const fetchBookings = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);

    const requestId = ++fetchRequestId.current;

    try {
      const data = await bookingService.getProviderBookings({
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
      });

      // Only update state if this is the most recent request
      if (requestId === fetchRequestId.current) {
        const transformedBookings = (data.data?.bookings || []).map(transformBookingToCalendar);
        setBookings(transformedBookings);
        setError(null);
      }
    } catch (err) {
      if (requestId === fetchRequestId.current) {
        const message = err instanceof Error ? err.message : 'Failed to load bookings';
        setError(message);
        toast.error(message);
      }
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [dateRange]);

  // Initial fetch and socket setup
  useEffect(() => {
    fetchBookings();

    // Socket event listeners for real-time updates
    const unsubscribeBookingStatus = socketService.onBookingStatusChanged((data) => {
      void fetchBookings(false);

      // Update existing booking status
      setBookings(prev => prev.map(b => {
        if (b.id === data.bookingId || b.id === data._id) {
          return { ...b, status: data.status as CalendarBooking['status'] };
        }
        return b;
      }));

      // Show toast based on status
      if (data.status === 'confirmed') {
        toast.success('Booking confirmed!');
      } else if (data.status === 'cancelled') {
        toast('Booking was cancelled', { icon: '📋' });
      } else if (data.status === 'rejected') {
        toast('Booking was declined', { icon: '📋' });
      }
    });

    const unsubscribeNewRequest = socketService.onNewBookingRequest((data) => {
      void fetchBookings(false);

      // Add new booking to list if within date range
      const booking = data.booking;
      if (booking && isWithinDateRange(new Date(booking.timestamp), dateRange)) {
        const newBooking = transformBookingToCalendar({
          _id: booking._id || booking.bookingId,
          status: 'pending',
          customer: { firstName: 'New', lastName: 'Customer' },
          service: { name: 'Service', category: '' },
        });
        setBookings(prev => {
          if (prev.some(b => b.id === newBooking.id)) return prev;
          return [...prev, newBooking];
        });
        toast.success('New booking request received!');
      }
    });

    return () => {
      unsubscribeBookingStatus();
      unsubscribeNewRequest();
    };
  }, [fetchBookings, dateRange]);

  // Helper to check if date is within range
  const isWithinDateRange = (date: Date, range: { start: Date; end: Date }): boolean => {
    return date >= range.start && date <= range.end;
  };

  // Transform booking to CalendarBooking format
  const transformBookingToCalendar = (booking: any): CalendarBooking => {
    return {
      id: booking._id || booking.id,
      customerName: booking.customer?.firstName
        ? `${booking.customer.firstName} ${booking.customer.lastName || ''}`.trim()
        : 'Unknown Customer',
      customerAvatar: booking.customer?.avatar,
      customerPhone: booking.customer?.phone,
      serviceName: booking.service?.name || 'Unknown Service',
      category: booking.service?.category || '',
      startTime: booking.scheduledDate
        ? `${booking.scheduledDate}T${booking.scheduledTime || '09:00'}`
        : new Date().toISOString(),
      endTime: booking.estimatedEndTime || new Date().toISOString(),
      status: booking.status || 'pending',
      price: booking.pricing?.totalAmount || booking.pricing?.total || 0,
      currency: booking.pricing?.currency || 'USD',
      location: booking.location?.address?.street,
      notes: booking.customerInfo?.specialRequests,
      isInstantBook: booking.isInstantBook,
    };
  };

  // Handle date range change from calendar navigation
  const handleDateRangeChange = useCallback((date: Date) => {
    setCurrentDate(date);
    const newStart = new Date(date.getFullYear(), date.getMonth() - 1, 1);
    const newEnd = new Date(date.getFullYear(), date.getMonth() + 2, 0);
    setDateRange({ start: newStart, end: newEnd });
  }, []);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    fetchBookings(true);
  }, [fetchBookings]);

  // Handle booking click - navigate to booking details
  const handleBookingClick = useCallback((booking: CalendarBooking) => {
    navigate(`/provider/bookings/${booking.id}`);
  }, [navigate]);

  // Handle accepting a booking
  const handleAcceptBooking = useCallback(async (bookingId: string) => {
    try {
      await bookingService.acceptBooking(bookingId);
      toast.success('Booking accepted successfully');
      // Update local state
      setBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'confirmed' as const } : b
      ));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept booking';
      toast.error(message);
      throw error; // Re-throw so CalendarView can handle rollback
    }
  }, []);

  // Handle declining a booking
  const handleDeclineBooking = useCallback(async (bookingId: string) => {
    try {
      await bookingService.declineBooking(bookingId);
      toast.success('Booking declined');
      // Update local state
      setBookings(prev => prev.filter(b => b.id !== bookingId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decline booking';
      toast.error(message);
      throw error;
    }
  }, []);

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />
      <ProviderHubNav />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Screen reader status announcer */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoading ? 'Loading calendar data...' : ''}
        {error ? `Error: ${error}` : ''}
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <PageErrorBoundary pageName="Calendar">
        <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors font-sans text-sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Booking Calendar</h1>
            <p className="text-base text-nilin-warmGray font-sans">
              View and manage your bookings in a calendar format
            </p>
          </div>

          {/* Error State */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Calendar View Component */}
          <CalendarView
            bookings={bookings}
            isLoading={isLoading}
            onBookingClick={handleBookingClick}
            onAcceptBooking={handleAcceptBooking}
            onDeclineBooking={handleDeclineBooking}
            onDateRangeChange={handleDateRangeChange}
            onRefresh={handleRefresh}
          />

          {/* Quick Stats / Legend */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-xl p-4 border border-nilin-border/50">
              <p className="text-xs text-nilin-warmGray font-sans mb-1">Quick Tip</p>
              <p className="text-sm text-nilin-charcoal font-sans">
                Click a date to see bookings
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-nilin-border/50">
              <p className="text-xs text-nilin-warmGray font-sans mb-1">Legend</p>
              <div className="flex flex-wrap gap-2 mt-1">
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Pending
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Confirmed
                </span>
                <span className="inline-flex items-center gap-1 text-xs">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  In Progress
                </span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border border-nilin-border/50">
              <p className="text-xs text-nilin-warmGray font-sans mb-1">This Month</p>
              <p className="text-lg font-bold text-nilin-charcoal">
                {bookings.filter(b => {
                  const bookingDate = new Date(b.startTime);
                  const now = new Date();
                  return bookingDate.getMonth() === now.getMonth() &&
                         bookingDate.getFullYear() === now.getFullYear();
                }).length} bookings
              </p>
            </div>

            <div className="glass rounded-xl p-4 border border-nilin-border/50">
              <p className="text-xs text-nilin-warmGray font-sans mb-1">Pending Action</p>
              <p className="text-lg font-bold text-nilin-charcoal">
                {bookings.filter(b => b.status === 'pending').length} pending
              </p>
            </div>
          </div>
        </main>
      </PageErrorBoundary>

      <Footer />
    </div>
  );
};

export default ProviderCalendarPage;
