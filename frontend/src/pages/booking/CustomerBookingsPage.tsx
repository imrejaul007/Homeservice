import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Filter, Calendar, X, Search, ChevronDown, ArrowUpDown, PenLine, RefreshCw, WifiOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import NavigationHeader from '../../components/layout/NavigationHeader';
import CustomerHubNav from '../../components/customer/CustomerHubNav';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import BookingCard from '../../components/customer/BookingCard';
import BookingReschedule from '../../components/customer/BookingReschedule';
import { useBookingStore } from '../../stores/bookingStore';
import type { BookingFilters } from '../../services/BookingService';
import { toast } from 'react-hot-toast';
import { showDeduplicatedError } from '../../utils/toastUtils';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { BookingCardSkeleton } from '../../components/common/Loading';
import { useBookingAdminUpdates } from '../../hooks/useSocket';
import { useDebounce } from '../../hooks/useDebounce';
import { CANCELLATION_REASONS } from '../../constants/booking';
import ExperienceSubmissionForm from '../../components/experience/ExperienceSubmissionForm';
import useWriteExperience from '../../hooks/useWriteExperience';

// Error types for better handling
type ErrorType = 'network' | 'server' | 'auth' | 'not_found' | 'rate_limit' | 'unknown';

interface ErrorState {
  message: string;
  type: ErrorType;
  retryable: boolean;
  timestamp: number;
}

// Toast deduplication constants
const TOAST_COOLDOWN_MS = 5000;
const RETRY_DELAYS_MS = [1000, 2000]; // Exponential backoff: 1s, 2s

const CustomerBookingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');
  const validStatuses = ['active', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
  const statusFromUrl = initialStatus && validStatuses.includes(initialStatus) ? initialStatus : undefined;

  const {
    customerBookings,
    customerBookingsPagination,
    getCustomerBookings,
    cancelBooking,
    rescheduleBooking: rescheduleBookingAction,
    isLoading,
    clearErrors
  } = useBookingStore();

  // Enhanced error state
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Toast deduplication ref
  const lastToastTime = useRef<number>(0);

  // Error categorization helper
  const categorizeError = useCallback((err: unknown): { message: string; type: ErrorType; retryable: boolean } => {
    // Network error detection
    const isNetworkError =
      !navigator.onLine ||
      err instanceof TypeError ||
      (err as { message?: string })?.message?.includes('NetworkError') ||
      (err as { message?: string })?.message?.includes('Failed to fetch');

    if (isNetworkError) {
      return { message: 'Connection error. Please check your internet connection.', type: 'network', retryable: true };
    }

    // HTTP status-based error detection
    const status = (err as { response?: { status?: number } })?.response?.status;
    const serverMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;

    switch (status) {
      case 0:
        return { message: 'Unable to connect to server. Please check your connection.', type: 'network', retryable: true };
      case 401:
      case 403:
        return { message: 'Please log in again to continue.', type: 'auth', retryable: false };
      case 404:
        return { message: serverMessage || 'Bookings not found.', type: 'not_found', retryable: false };
      case 429:
        return { message: 'Too many requests. Please wait a moment and try again.', type: 'rate_limit', retryable: true };
      case 500:
      case 502:
      case 503:
        return { message: 'Server error. Please try again later.', type: 'server', retryable: true };
      default:
        return {
          message: serverMessage || (err instanceof Error ? err.message : 'Failed to load bookings'),
          type: 'unknown',
          retryable: status === undefined || (status !== undefined && status >= 500)
        };
    }
  }, []);

  // Toast deduplication helper
  const showErrorToast = useCallback((title: string, message?: string) => {
    const now = Date.now();
    if (now - lastToastTime.current < TOAST_COOLDOWN_MS) return;
    lastToastTime.current = now;
    const fullMessage = message ? `${title}: ${message}` : title;
    toast.error(fullMessage);
  }, []);

  // Retry helper with exponential backoff
  const retryWithBackoff = useCallback(async (fn: () => Promise<void>, maxAttempts: number = 2): Promise<boolean> => {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await fn();
        return true;
      } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        const isRetryable = status === 0 || (status && status >= 500);

        if (!isRetryable || attempt === maxAttempts - 1) {
          return false;
        }

        // Exponential backoff: 1s, 2s
        await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      }
    }
    return false;
  }, []);

  const [filters, setFilters] = useState<BookingFilters>({
    page: 1,
    limit: 12,
    status: statusFromUrl as BookingFilters['status'],
  });

  const [selectedStatus, setSelectedStatus] = useState<string>(statusFromUrl || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<{
    id: string;
    serviceName: string;
    providerName: string;
    currentDate: Date;
    currentTime: string;
    duration: number;
  } | null>(null);
  const isFetchingRef = useRef(false);
  const { isFormOpen, prefilledBookingId, openWriteExperience, closeWriteExperience } = useWriteExperience();

  // Advanced filters state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sortBy, setSortBy] = useState<string>('scheduledDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Keep a ref to filters to avoid stale closure
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Subscribe to real-time booking updates
  const { bookingUpdated } = useBookingAdminUpdates();

  // Fetch bookings with retry mechanism
  const fetchBookings = useCallback(async () => {
    setErrorState(null);
    clearErrors();

    const success = await retryWithBackoff(async () => {
      await getCustomerBookings(filters);
    }, 2);

    if (!success) {
      // Get error from store if available, otherwise categorize the error
      const storeError = useBookingStore.getState().errors[0];
      const errorToReport = storeError || { message: 'Failed to load bookings' };

      const categorized = categorizeError(errorToReport);
      setErrorState({
        ...categorized,
        timestamp: Date.now()
      });
    }
  }, [filters, getCustomerBookings, categorizeError, retryWithBackoff, clearErrors]);

  // Fetch bookings when filters change
  useEffect(() => {
    fetchBookings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.status, filters.sortBy, filters.sortOrder, filters.minPrice, filters.maxPrice, filters.startDate, filters.endDate]);

  // Refresh bookings when admin updates a booking
  useEffect(() => {
    if (bookingUpdated && !isFetchingRef.current) {
      toast.success(`Booking #${bookingUpdated.bookingNumber.slice(-6)} status updated to ${bookingUpdated.status.replace('_', ' ')} by admin`);
      getCustomerBookings(filtersRef.current);
    }
  }, [bookingUpdated, getCustomerBookings]);

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch || undefined,
      page: 1
    }));
  }, [debouncedSearch]);

  // Update filters when advanced filter values change
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      sortBy: sortBy as BookingFilters['sortBy'],
      sortOrder,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1
    }));
  }, [sortBy, sortOrder, minPrice, maxPrice, startDate, endDate]);

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status);
    setFilters((prev) => ({
      ...prev,
      status: status === 'all' ? undefined : (status as BookingFilters['status']),
      page: 1
    }));
  };

  const handleClearAdvancedFilters = () => {
    setSortBy('scheduledDate');
    setSortOrder('desc');
    setMinPrice('');
    setMaxPrice('');
    setStartDate('');
    setEndDate('');
  };

  const hasAdvancedFilters = minPrice || maxPrice || startDate || endDate;

  // Empty state context
  const emptyStateTitle = searchQuery
    ? 'No search results'
    : selectedStatus !== 'all'
    ? `No ${selectedStatus.replace('_', ' ')} bookings`
    : 'No bookings yet';

  const emptyStateMessage = searchQuery
    ? `We couldn't find any bookings matching "${searchQuery}". Try adjusting your search or filters.`
    : selectedStatus !== 'all'
    ? `You don't have any ${selectedStatus.replace('_', ' ')} bookings at the moment.`
    : "You haven't made any bookings yet. Start exploring services to book your first appointment.";

  const showClearFiltersButton = searchQuery || selectedStatus !== 'all';

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
      const categorized = categorizeError(err);
      showDeduplicatedError('Failed to cancel booking', categorized.message);
    } finally {
      setCancellingBookingId(null);
      setCancelBookingId(null);
    }
  };

  const handleCancelClick = (bookingId: string) => {
    setCancelBookingId(bookingId);
    setShowCancelModal(true);
  };

  const handleRescheduleClick = (bookingId: string) => {
    const booking = customerBookings.find(b => b._id === bookingId);
    if (!booking) return;

    const serviceName = (booking.service as { name?: string; title?: string })?.name || (booking.service as { title?: string })?.title || 'Service';

    setRescheduleBooking({
      id: booking._id,
      serviceName,
      providerName: booking.provider?.firstName
        ? `${booking.provider.firstName} ${booking.provider.lastName || ''}`
        : 'Provider',
      currentDate: new Date(booking.scheduledDate),
      currentTime: booking.scheduledTime,
      duration: booking.estimatedDuration || booking.duration || 60,
    });
  };

  const handleReschedule = async (newDate: Date, newTime: string, reason?: string) => {
    if (!rescheduleBooking) return;

    try {
      await rescheduleBookingAction(
        rescheduleBooking.id,
        newDate.toISOString().split('T')[0],
        newTime,
        reason
      );
      toast.success('Booking rescheduled successfully');
      getCustomerBookings(filters);
      setRescheduleBooking(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reschedule booking';
      showDeduplicatedError('Failed to reschedule booking', message);
      throw new Error(message);
    }
  };

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const sortOptions = [
    { value: 'scheduledDate', label: 'Scheduled Date' },
    { value: 'createdAt', label: 'Created Date' },
    { value: 'totalAmount', label: 'Price' },
    { value: 'status', label: 'Status' }
  ];

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />
      <CustomerHubNav />

      {/* Skip link for keyboard accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1" id="main-content">
        <PageErrorBoundary pageName="My Bookings">
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">My Bookings</h1>
                <p className="text-nilin-warmGray">Manage and track your service bookings</p>
              </div>
              <button
                onClick={() => openWriteExperience()}
                disabled={isFormOpen}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose transition-colors font-medium self-start disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PenLine className="h-4 w-4" />
                Write Experience
              </button>
            </div>

            {/* Error Banner - Enhanced with error type differentiation */}
            {errorState && (
              <div
                className={`mb-6 p-4 rounded-nilin-lg flex items-start gap-3 ${
                  errorState.type === 'network'
                    ? 'bg-nilin-warning/10 border border-nilin-warning/20'
                    : 'bg-nilin-error/10 border border-nilin-error/20'
                }`}
                role="alert"
                aria-live="polite"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  errorState.type === 'network'
                    ? 'bg-nilin-warning/20'
                    : 'bg-nilin-error/20'
                }`}>
                  {errorState.type === 'network' ? (
                    <WifiOff className={`h-4 w-4 text-nilin-warning`} />
                  ) : errorState.type === 'auth' ? (
                    <AlertCircle className={`h-4 w-4 text-nilin-coral`} />
                  ) : (
                    <span className="text-lg font-bold text-nilin-error">!</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-nilin-charcoal font-medium">
                    {errorState.type === 'network' && 'Connection Error'}
                    {errorState.type === 'auth' && 'Authentication Required'}
                    {errorState.type === 'not_found' && 'Not Found'}
                    {errorState.type === 'rate_limit' && 'Too Many Requests'}
                    {errorState.type === 'server' && 'Server Error'}
                    {errorState.type === 'unknown' && 'Something went wrong'}
                  </p>
                  <p className="text-nilin-warmGray text-sm">{errorState.message}</p>
                </div>
                {errorState.retryable && (
                  <button
                    onClick={() => {
                      setIsRetrying(true);
                      fetchBookings().finally(() => setIsRetrying(false));
                    }}
                    disabled={isRetrying}
                    className="px-4 py-2.5 text-sm bg-nilin-blush text-nilin-charcoal hover:bg-nilin-peach rounded-nilin transition-colors font-medium disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 flex items-center gap-2"
                  >
                    {isRetrying ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Retry
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="glass-nilin rounded-nilin-lg p-4 mb-6">
              {/* Search Bar */}
              <div className="mb-4">
                <div className="relative">
                  <label htmlFor="booking-search" className="sr-only">Search bookings</label>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                  <input
                    id="booking-search"
                    type="text"
                    placeholder="Search by booking number, service, or provider..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-white border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral transition-shadow text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center hover:bg-nilin-muted rounded"
                    >
                      <X className="h-4 w-4 text-nilin-warmGray" />
                    </button>
                  )}
                </div>
              </div>

              {/* Status Filter Buttons */}
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Filter bookings by status">
                <div className="w-8 h-8 rounded-full bg-nilin-coral/20 flex items-center justify-center shrink-0" aria-hidden="true">
                  <Filter className="h-4 w-4 text-nilin-coral" />
                </div>
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    role="tab"
                    aria-pressed={selectedStatus === option.value}
                    aria-label={`Show ${option.label.toLowerCase()} bookings`}
                    className={`px-4 py-2 rounded-nilin text-sm font-medium transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                      selectedStatus === option.value
                        ? 'bg-nilin-coral text-white shadow-nilin-warm'
                        : 'bg-white text-nilin-warmGray border border-nilin-border hover:bg-nilin-muted'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Advanced Filters Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-nilin-border">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-charcoal bg-white border border-nilin-border rounded-nilin hover:bg-nilin-muted transition-colors focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  More Filters
                  <ChevronDown className={`h-4 w-4 transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} />
                </button>

                {hasAdvancedFilters && (
                  <button
                    onClick={handleClearAdvancedFilters}
                    aria-label="Clear all filters"
                    className="text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>

              {/* Advanced Filters Panel */}
              <AnimatePresence>
                {showAdvancedFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
                      {/* Sort By */}
                      <div>
                        <label htmlFor="sort-by" className="block text-xs font-medium text-nilin-charcoal mb-1.5">Sort by</label>
                        <select
                          id="sort-by"
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral bg-white"
                        >
                          {sortOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Sort Order */}
                      <div>
                        <label htmlFor="sort-order" className="block text-xs font-medium text-nilin-charcoal mb-1.5">Order</label>
                        <select
                          id="sort-order"
                          value={sortOrder}
                          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                          className="w-full px-3 py-2 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral bg-white"
                        >
                          <option value="desc">Newest First</option>
                          <option value="asc">Oldest First</option>
                        </select>
                      </div>

                      {/* Start Date */}
                      <div>
                        <label htmlFor="start-date" className="block text-xs font-medium text-nilin-charcoal mb-1.5">From Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray pointer-events-none" />
                          <input
                            id="start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral bg-white"
                          />
                        </div>
                      </div>

                      {/* End Date */}
                      <div>
                        <label htmlFor="end-date" className="block text-xs font-medium text-nilin-charcoal mb-1.5">To Date</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray pointer-events-none" />
                          <input
                            id="end-date"
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Price Range */}
                    <div className="mt-4 pt-4 border-t border-nilin-border">
                      <fieldset>
                        <legend className="block text-xs font-medium text-nilin-charcoal mb-2">Price Range (AED)</legend>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label htmlFor="min-price" className="sr-only">Minimum price</label>
                            <input
                              id="min-price"
                              type="number"
                              placeholder="Min"
                              value={minPrice}
                              onChange={(e) => setMinPrice(e.target.value)}
                              aria-label="Minimum price in AED"
                              className="w-full px-3 py-2 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral bg-white"
                            />
                          </div>
                          <span className="text-nilin-warmGray" aria-hidden="true">to</span>
                          <div className="flex-1">
                            <label htmlFor="max-price" className="sr-only">Maximum price</label>
                            <input
                              id="max-price"
                              type="number"
                              placeholder="Max"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              aria-label="Maximum price in AED"
                              className="w-full px-3 py-2 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral bg-white"
                            />
                          </div>
                        </div>
                      </fieldset>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Bookings Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <BookingCardSkeleton key={n} />
                ))}
              </div>
            ) : (customerBookings && customerBookings.length > 0) ? (
              <>
                <ul
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8 list-none"
                  aria-label={`${customerBookings.length} bookings found`}
                >
                  {customerBookings.map((booking) => (
                    <li key={booking._id}>
                      <BookingCard
                        booking={{
                          _id: booking._id,
                          bookingNumber: booking.bookingNumber || '',
                          serviceId: booking.serviceId || booking.service?._id || '',
                          estimatedDuration: booking.estimatedDuration || 0,
                          createdAt: booking.createdAt || booking.scheduledDate,
                          updatedAt: booking.updatedAt || booking.createdAt || booking.scheduledDate,
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
                          paymentStatus: booking.paymentStatus || 'pending',
                          customerReview: booking.customerReview,
                          providerReview: booking.providerReview,
                          hasExperience: booking.hasExperience,
                          location: booking.location?.address ? {
                            address: `${booking.location.address.street || ''}, ${booking.location.address.city || ''}`
                          } : undefined,
                          isGuestBooking: booking.isGuestBooking,
                          guestInfo: booking.guestInfo
                        }}
                        onView={() => handleViewBooking(booking._id)}
                        onReschedule={
                          booking.status === 'pending' || booking.status === 'confirmed'
                            ? () => handleRescheduleClick(booking._id)
                            : undefined
                        }
                        onCancel={
                          booking.status === 'pending' || booking.status === 'confirmed'
                            ? () => handleCancelClick(booking._id)
                            : undefined
                        }
                        onShareExperience={
                          booking.status === 'completed' && !booking.hasExperience && !booking.customerReview
                            ? (id: string) => openWriteExperience(id)
                            : undefined
                        }
                        isCancelling={cancellingBookingId === booking._id}
                      />
                    </li>
                  ))}
                </ul>

                {/* Pagination */}
                {customerBookingsPagination && customerBookingsPagination.pages > 1 && (
                  <div className="flex justify-center items-center gap-2">
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
                      disabled={(filters.page ?? 1) <= 1 || isLoading}
                      aria-label="Go to previous page"
                      className="px-4 py-2 rounded-nilin bg-white border border-nilin-border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-nilin-charcoal">
                      Page {filters.page} of {customerBookingsPagination.pages}
                    </span>
                    <button
                      onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
                      disabled={filters.page === customerBookingsPagination.pages || isLoading}
                      aria-label="Go to next page"
                      className="px-4 py-2 rounded-nilin bg-white border border-nilin-border font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Empty State - Context-aware messaging */
              <div className="glass-nilin rounded-nilin-lg p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-8 w-8 text-nilin-coral" />
                </div>
                <h3 className="text-xl font-serif text-nilin-charcoal mb-2">
                  {emptyStateTitle}
                </h3>
                <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                  {emptyStateMessage}
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {showClearFiltersButton && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedStatus('all');
                        setFilters(prev => ({ ...prev, status: undefined, search: undefined, page: 1 }));
                      }}
                      className="px-5 py-2.5 bg-nilin-blush text-nilin-charcoal rounded-nilin hover:bg-nilin-peach transition-colors font-medium focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      Clear filters
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/search')}
                    aria-label="Browse available services"
                    className="px-5 py-2.5 bg-nilin-coral text-white rounded-nilin hover:bg-nilin-rose transition-colors font-medium focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  >
                    Browse Services
                  </button>
                </div>
              </div>
            )}
          </main>
        </PageErrorBoundary>
      </div>

      <Footer />

      {/* Cancel Booking Confirmation Modal */}
      {showCancelModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="presentation"
          onKeyDown={(e) => { if (e.key === 'Escape') setShowCancelModal(false); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
            className="bg-white rounded-nilin-lg max-w-md w-full p-6 shadow-nilin-lg animate-fade-in"
            ref={(el) => el?.focus()}
          >
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-nilin-error/20 flex items-center justify-center mx-auto mb-4">
                <X className="h-6 w-6 text-nilin-error" />
              </div>
              <h3 id="cancel-modal-title" className="text-lg font-serif text-nilin-charcoal mb-2">Cancel Booking</h3>
              <p className="text-nilin-warmGray mb-6">
                Are you sure you want to cancel this booking? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCancelModal(false)}
                  aria-label="Keep this booking and close"
                  className="flex-1 px-4 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  Keep Booking
                </button>
                <button
                  onClick={handleCancelBooking}
                  disabled={cancellingBookingId !== null}
                  aria-label="Confirm cancellation of this booking"
                  className="flex-1 px-4 py-3 rounded-nilin bg-nilin-error text-white hover:bg-nilin-error/90 transition-colors font-medium disabled:opacity-50 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  {cancellingBookingId ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Cancelling...
                    </>
                  ) : 'Cancel Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ExperienceSubmissionForm
        isOpen={isFormOpen}
        onClose={closeWriteExperience}
        bookingId={prefilledBookingId}
        lockBooking={!!prefilledBookingId}
      />

      {/* Reschedule Modal */}
      {rescheduleBooking && (
        <BookingReschedule
          booking={rescheduleBooking}
          open={!!rescheduleBooking}
          onReschedule={handleReschedule}
          onOpenChange={(open) => !open && setRescheduleBooking(null)}
        />
      )}
    </div>
  );
};

export default CustomerBookingsPage;
