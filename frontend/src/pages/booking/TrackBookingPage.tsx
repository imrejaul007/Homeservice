import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  Package,
  Clock,
  Calendar,
  MapPin,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
  Phone,
  MessageCircle,
  Star,
  ChevronRight,
  Share2,
  ArrowLeft,
  RefreshCw,
  Copy,
  Printer,
  Timer,
  Tag,
  ArrowRight,
  Wifi,
  WifiOff,
  Navigation,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import ExperienceSubmissionForm from '../../components/experience/ExperienceSubmissionForm';
import CancellationModal from '../../components/booking/CancellationModal';
import RescheduleModal from '../../components/booking/RescheduleModal';
import TrackingMap from '../../components/tracking/TrackingMap';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { experienceApi } from '../../services/experienceApi';
import { socketService, type BookingEvent } from '../../services/socket';
import { BookingChat } from '../../components/chat';

interface PricingInfo {
  basePrice?: number;
  addOns?: Array<{ name: string; price: number }>;
  discounts?: Array<{ type: string; code?: string; amount: number; description: string }>;
  subtotal?: number;
  tax?: number;
  totalAmount: number;
  currency: string;
  couponDiscount?: number;
}

interface LocationInfo {
  type: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  notes?: string;
}

interface TrackingData {
  bookingNumber: string;
  emailVerificationRequired?: boolean;
  status: string;
  statusHistory: Array<{
    status: string;
    timestamp: string;
    reason?: string;
  }>;
  service?: {
    name: string;
    category: string;
    subcategory?: string;
    image?: string;
  };
  provider?: { _id?: string; name: string; phone?: string; avatar?: string };
  customerId?: string;
  providerId?: string;
  location?: LocationInfo;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  pricing: PricingInfo;
  customerInfo?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
  isGuestBooking: boolean;
  createdAt: string;
  _id?: string;
  guestEmail?: string;
  // Real-time tracking data
  providerLocation?: {
    lat: number;
    lng: number;
    heading?: number;
    speed?: number;
    timestamp?: string;
  };
  destinationLocation?: {
    lat: number;
    lng: number;
  };
  etaMinutes?: number;
  distanceRemaining?: number;
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Declined',
  no_show: 'No Show',
};

// NILIN brand colors for status badges
const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200' },
  confirmed: { bg: 'bg-nilin-coral/10', text: 'text-nilin-coral', border: 'border-nilin-coral/20' },
  in_progress: { bg: 'bg-nilin-rose/10', text: 'text-nilin-rose', border: 'border-nilin-rose/20' },
  completed: { bg: 'bg-nilin-success/10', text: 'text-nilin-success', border: 'border-nilin-success/20' },
  cancelled: { bg: 'bg-nilin-error/10', text: 'text-nilin-error', border: 'border-nilin-error/20' },
  rejected: { bg: 'bg-nilin-error/10', text: 'text-nilin-error', border: 'border-nilin-error/20' },
  no_show: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

// Progress steps for visual stepper
const progressSteps = ['pending', 'confirmed', 'in_progress', 'completed'];

const TrackBookingPage: React.FC = () => {
  const { bookingNumber: urlBookingNumber } = useParams<{ bookingNumber: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  const [bookingNumber, setBookingNumber] = useState(urlBookingNumber || '');
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailInputError, setEmailInputError] = useState<string | null>(null);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [showExperienceForm, setShowExperienceForm] = useState(false);
  const [hasExperience, setHasExperience] = useState(false);
  const [checkingExperience, setCheckingExperience] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [countdown, setCountdown] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null);
  const [statusChanged, setStatusChanged] = useState(false);

  // Cancellation and reschedule modal state
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);

  // Socket connection state
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Ref to track booking ID for socket cleanup
  const bookingIdRef = useRef<string | undefined>();

  const bookingInternalId = isAuthenticated ? tracking?._id : undefined;

  const sanitizeTrackingForViewer = (data: TrackingData): TrackingData => {
    if (isAuthenticated) return data;
    const { _id, customerId, providerId, ...publicData } = data;
    return publicData;
  };

  const resolveVerificationEmail = (explicitEmail?: string): string | undefined => {
    const candidate =
      explicitEmail?.trim().toLowerCase() ||
      verificationEmail.trim().toLowerCase() ||
      user?.email?.trim().toLowerCase() ||
      searchParams.get('email')?.trim().toLowerCase() ||
      '';
    return candidate || undefined;
  };

  useEffect(() => {
    const urlEmail = searchParams.get('email');
    if (urlEmail) {
      setEmailInput(urlEmail);
      setVerificationEmail(urlEmail.trim().toLowerCase());
    }
  }, [searchParams]);

  useEffect(() => {
    if (urlBookingNumber) {
      fetchTracking(urlBookingNumber);
    }
  }, [urlBookingNumber, isAuthenticated, user?.email]);

  // Countdown timer for upcoming bookings
  useEffect(() => {
    if (!tracking?.scheduledDate || !tracking?.scheduledTime) return;
    if (['completed', 'cancelled', 'rejected', 'no_show'].includes(tracking.status)) {
      setCountdown(null);
      return;
    }

    const calculateCountdown = () => {
      const appointmentDate = new Date(`${tracking.scheduledDate}T${tracking.scheduledTime}`);
      const now = new Date();
      const diff = appointmentDate.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown(null);
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [tracking?.scheduledDate, tracking?.scheduledTime, tracking?.status]);

  // Setup Socket.IO connection for real-time updates
  useEffect(() => {
    if (!bookingInternalId || !isAuthenticated) return;

    let unsubscribeConfirmed: (() => void) | undefined;
    let unsubscribeCancelled: (() => void) | undefined;
    let unsubscribeRescheduled: (() => void) | undefined;
    let unsubscribeCompleted: (() => void) | undefined;
    let unsubscribeStatusChanged: (() => void) | undefined;
    let unsubscribeLocation: (() => void) | undefined;

    const setupSocketListeners = async () => {
      try {
        // Connect to socket if not already connected
        if (!socketService.isConnected()) {
          await socketService.connect();
        }
        setIsConnected(true);

        // Join the booking room to receive updates
        socketService.joinBookingRoom(bookingInternalId);
        bookingIdRef.current = bookingInternalId;

        unsubscribeStatusChanged = socketService.on('booking:status_changed', (event: BookingEvent) => {
          if (event.bookingId === bookingInternalId) {
            handleStatusUpdate(event);
          }
        });

        // Listen for specific status events
        unsubscribeConfirmed = socketService.on('booking:confirmed', (event: BookingEvent) => {
          if (event.bookingId === bookingInternalId) {
            handleStatusUpdate(event);
            toast.success('Your booking has been confirmed!');
          }
        });

        unsubscribeCancelled = socketService.on('booking:cancelled', (event: BookingEvent) => {
          if (event.bookingId === bookingInternalId) {
            handleStatusUpdate(event);
            toast.error('Your booking has been cancelled.');
          }
        });

        unsubscribeRescheduled = socketService.on('booking:rescheduled', (event: BookingEvent) => {
          if (event.bookingId === bookingInternalId) {
            handleStatusUpdate(event);
            toast.success('Your booking has been rescheduled.');
            // Refresh tracking data
            fetchTracking(tracking.bookingNumber);
          }
        });

        unsubscribeCompleted = socketService.on('booking:completed', (event: BookingEvent) => {
          if (event.bookingId === bookingInternalId) {
            handleStatusUpdate(event);
            toast.success('Your booking has been completed!');
          }
        });

        // Listen for provider location updates during in_progress
        unsubscribeLocation = socketService.on('booking:provider_location', (event: {
          bookingId: string;
          latitude: number;
          longitude: number;
          etaMinutes?: number;
          distanceRemaining?: number;
        }) => {
          if (event.bookingId === bookingInternalId) {
            setTracking((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                providerLocation: { lat: event.latitude, lng: event.longitude },
                etaMinutes: event.etaMinutes,
                distanceRemaining: event.distanceRemaining,
              };
            });
          }
        });
      } catch (error) {
        console.error('Failed to setup socket listeners:', error);
        setIsConnected(false);
      }
    };

    setupSocketListeners();

    // Cleanup function
    return () => {
      if (bookingIdRef.current) {
        socketService.leaveBookingRoom(bookingIdRef.current);
      }
      unsubscribeStatusChanged?.();
      unsubscribeConfirmed?.();
      unsubscribeCancelled?.();
      unsubscribeRescheduled?.();
      unsubscribeCompleted?.();
      unsubscribeLocation?.();
    };
  }, [bookingInternalId, isAuthenticated, tracking?.bookingNumber]);

  // Handle real-time status updates
  const handleStatusUpdate = (event: BookingEvent) => {
    setLastUpdate(new Date());
    setStatusChanged(true);
    setTimeout(() => setStatusChanged(false), 600);

    setTracking((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        status: event.status,
        statusHistory: [
          {
            status: event.status,
            timestamp: new Date(event.timestamp).toISOString(),
          },
          ...prev.statusHistory,
        ],
      };
    });
  };

  // Check if user has submitted experience for completed booking
  useEffect(() => {
    if (tracking?.status === 'completed' && bookingInternalId && isAuthenticated) {
      checkExperienceSubmission();
    }
  }, [tracking?.status, bookingInternalId, isAuthenticated]);

  const checkExperienceSubmission = async () => {
    if (!bookingInternalId) return;
    setCheckingExperience(true);
    try {
      const response = await experienceApi.checkExperienceExists(bookingInternalId);
      setHasExperience(response.data?.exists || false);
    } catch {
      setHasExperience(false);
    } finally {
      setCheckingExperience(false);
    }
  };

  const fetchTracking = async (number: string, emailOverride?: string) => {
    try {
      setLoading(true);
      setError(null);
      if (!emailOverride) {
        setTracking(null);
      }

      const emailParam = resolveVerificationEmail(emailOverride);
      const response = await api.get(`/bookings/track/${encodeURIComponent(number)}`, {
        params: emailParam ? { email: emailParam } : undefined,
      });

      if (response.data.success) {
        const data = sanitizeTrackingForViewer(response.data.data as TrackingData);
        const requiresEmail = Boolean(data.emailVerificationRequired);

        setNeedsEmailVerification(requiresEmail);
        setTracking(data);

        if (emailParam && !requiresEmail) {
          setVerificationEmail(emailParam);
        }
      } else {
        setError(response.data.message || 'Booking not found');
      }
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { message?: string } }; request?: unknown };
      if (error.response?.status === 404) {
        setError('Booking not found. Please verify your booking number.');
      } else if (error.response?.status === 403) {
        setError(error.response?.data?.message || 'Email does not match this booking. Please try again.');
      } else if (!error.response) {
        setError('Network error. Please check your connection and try again.');
      } else {
        setError(error.response?.data?.message || 'Unable to connect. Please try again.');
      }
    } finally {
      setLoading(false);
      setVerifyingEmail(false);
    }
  };

  const handleEmailVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailInput.trim().toLowerCase();

    if (!trimmed) {
      setEmailInputError('Please enter the email used for this booking');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailInputError('Please enter a valid email address');
      return;
    }

    setEmailInputError(null);
    setVerifyingEmail(true);
    setVerificationEmail(trimmed);
    await fetchTracking(bookingNumber || urlBookingNumber || '', trimmed);
  };

  // Handle cancellation
  const handleCancelBooking = async (reason: string) => {
    if (!bookingInternalId) return;

    setCancelling(true);
    try {
      const response = await api.patch(`/bookings/${bookingInternalId}/cancel`, { reason });

      if (response.data.success) {
        toast.success('Booking cancelled successfully');
        setShowCancellationModal(false);
        // Refresh to get updated status
        await fetchTracking(tracking.bookingNumber);
      } else {
        toast.error(response.data.message || 'Failed to cancel booking');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  // Handle reschedule
  const handleRescheduleBooking = async (newDate: string, newTime: string, reason: string) => {
    if (!bookingInternalId) return;

    setRescheduling(true);
    try {
      const response = await api.patch(`/bookings/${bookingInternalId}/reschedule`, {
        scheduledDate: newDate,
        scheduledTime: newTime,
        reason,
      });

      if (response.data.success) {
        toast.success('Booking rescheduled successfully');
        setShowRescheduleModal(false);
        // Refresh to get updated status and new time
        await fetchTracking(tracking.bookingNumber);
      } else {
        toast.error(response.data.message || 'Failed to reschedule booking');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to reschedule booking');
    } finally {
      setRescheduling(false);
    }
  };

  // Check if booking can be cancelled/rescheduled
  const canCancel = ['pending', 'confirmed'].includes(tracking?.status || '');
  const canReschedule = ['pending', 'confirmed'].includes(tracking?.status || '');

  // Copy booking number
  const handleCopyBookingNumber = async () => {
    if (!tracking?.bookingNumber) return;
    try {
      await navigator.clipboard.writeText(tracking.bookingNumber);
      toast.success('Booking number copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  // Share booking
  const handleShareBooking = async () => {
    if (!tracking) return;
    setShowShareMenu(false);

    const shareData = {
      title: `Booking ${tracking.bookingNumber}`,
      text: `My ${tracking.service?.name || 'service'} appointment is scheduled for ${new Date(tracking.scheduledDate).toLocaleDateString()} at ${tracking.scheduledTime}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied! Share it with others.');
    }
  };

  // Print booking
  const handlePrint = () => {
    window.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = bookingNumber.trim().toUpperCase();

    if (!trimmed) {
      setInputError('Please enter a booking number');
      return;
    }

    if (trimmed.length < 5) {
      setInputError('Booking number is too short');
      return;
    }

    setInputError(null);
    await fetchTracking(trimmed);
    navigate(`/track/${trimmed}`);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatAddress = (location?: LocationInfo) => {
    if (!location?.address) return null;
    const { street, city, state, zipCode } = location.address;
    return `${street}, ${city}, ${state} ${zipCode}`;
  };

  const formatDateSafe = (dateStr: string | undefined, fallback: string = 'Date not set') => {
    if (!dateStr) return fallback;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get progress step index
  const currentStepIndex = progressSteps.indexOf(tracking?.status || 'pending');

  // Status icon for timeline
  const getStatusIcon = (status: string, isCurrent: boolean) => {
    const isCompleted = status === 'completed' || status === 'confirmed';
    const isCancelled = status === 'cancelled' || status === 'rejected';
    const isInProgress = status === 'in_progress';

    if (isCompleted) {
      return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
          isCurrent ? 'bg-nilin-success text-white shadow-lg shadow-nilin-success/30' : 'bg-nilin-success/20 text-nilin-success'
        }`}>
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
        </div>
      );
    }
    if (isCancelled) {
      return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isCurrent ? 'bg-nilin-error text-white' : 'bg-nilin-error/20 text-nilin-error'
        }`}>
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
        </div>
      );
    }
    if (isInProgress) {
      return (
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isCurrent ? 'bg-nilin-rose text-white animate-pulse' : 'bg-nilin-rose/20 text-nilin-rose'
        }`}>
          <Clock className="w-4 h-4" aria-hidden="true" />
        </div>
      );
    }
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
        isCurrent ? 'border-nilin-coral bg-nilin-coral/10 text-nilin-coral' : 'border-gray-300 bg-gray-50 text-gray-400'
      }`}>
        <span className="text-xs font-medium" aria-hidden="true">{progressSteps.indexOf(status) + 1}</span>
      </div>
    );
  };

  const statusColorsClass = statusColors[tracking?.status || 'pending'];

  // Skeleton loading component
  const SkeletonCard = () => (
    <div className="bg-white rounded-nilin-lg shadow-nilin overflow-hidden animate-pulse">
      <div className="bg-nilin-cream px-6 py-5 border-b border-nilin-border">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-6 w-40 bg-gray-200 rounded" />
          </div>
          <div className="h-8 w-28 bg-gray-200 rounded-full" />
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="flex gap-4">
          <div className="w-20 h-20 bg-gray-200 rounded-nilin" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-32 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-200 rounded-nilin" />
              <div className="space-y-2">
                <div className="h-3 w-12 bg-gray-200 rounded" />
                <div className="h-4 w-20 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-cream via-nilin-blush to-nilin-peach">
      <NavigationHeader />

      {/* Skip link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <main id="main-content" className="pt-20 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumb />
          </div>

          {/* Back Link */}
          <Link
            to="/"
            aria-label="Back to home page"
            className="inline-flex items-center gap-2 text-nilin-warmGray hover:text-nilin-charcoal mb-6 transition-all duration-200 hover:-translate-x-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Back to Home
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-nilin-coral/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-nilin-glow">
              <Package className="w-8 h-8 text-nilin-coral" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-serif font-light tracking-widest text-nilin-charcoal mb-2">Track Your Booking</h1>
            <p className="text-nilin-warmGray">Track your service journey</p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSubmit} aria-label="Track booking by number" className="mb-8">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" aria-hidden="true" />
                <label htmlFor="booking-number" className="sr-only">
                  Booking Number
                </label>
                <input
                  id="booking-number"
                  type="text"
                  value={bookingNumber}
                  onChange={(e) => {
                    setBookingNumber(e.target.value.toUpperCase());
                    setInputError(null);
                  }}
                  placeholder="e.g. RZ-20260212-A1B2"
                  aria-describedby={inputError ? 'booking-error' : 'booking-hint'}
                  aria-invalid={!!inputError || !!error}
                  autoComplete="off"
                  autoCapitalize="characters"
                  className={`w-full pl-12 pr-4 py-3 bg-white border rounded-nilin text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral transition-all duration-200 ${
                    inputError ? 'border-red-400 ring-1 ring-red-400' : 'border-nilin-border'
                  }`}
                />
                <p id="booking-hint" className="sr-only">
                  Enter your booking number to track your service booking status
                </p>
                {inputError && (
                  <p id="booking-error" className="mt-1 text-sm text-red-500" role="alert">{inputError}</p>
                )}
              </div>
              <button
                type="submit"
                disabled={!bookingNumber.trim() || loading}
                aria-busy={loading}
                className="px-6 py-3 bg-nilin-coral text-white rounded-nilin font-semibold hover:bg-nilin-rose transition-all duration-200 hover-lift disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" aria-hidden="true" />
                ) : (
                  'Track'
                )}
              </button>
            </div>
          </form>

          {/* Error State */}
          {error && (
            <div role="alert" className="bg-white border border-nilin-error/30 rounded-nilin-lg p-6 text-center mb-8 shadow-nilin animate-nilin-in">
              <AlertCircle className="w-8 h-8 text-nilin-error mx-auto mb-3" aria-hidden="true" />
              <p className="text-nilin-charcoal font-semibold">{error}</p>
              <p className="text-nilin-warmGray text-sm mt-1">Please check the booking number and try again.</p>
              <button
                onClick={() => fetchTracking(bookingNumber)}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-rose transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Try Again
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && <SkeletonCard />}

          {/* Empty State */}
          {!loading && !error && !tracking && bookingNumber && (
            <div className="bg-white rounded-nilin-lg shadow-nilin p-12 text-center animate-nilin-in">
              <Package className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">No Booking Found</h3>
              <p className="text-nilin-warmGray">
                We couldn't find booking "{bookingNumber}". Please check the number and try again.
              </p>
            </div>
          )}

          {/* Tracking Results */}
          {tracking && !loading && (
            <div className="bg-white/80 backdrop-blur-md rounded-nilin-lg shadow-nilin-lg border border-nilin-border/50 overflow-hidden animate-nilin-in">
              {needsEmailVerification && (
                <div className="p-6 border-b border-nilin-border bg-nilin-cream/60">
                  <h2 className="text-lg font-semibold text-nilin-charcoal mb-2">Verify your email</h2>
                  <p className="text-sm text-nilin-warmGray mb-4">
                    Enter the email address used when booking <span className="font-mono font-medium">{tracking.bookingNumber}</span> to view full tracking details.
                  </p>
                  <form onSubmit={handleEmailVerificationSubmit} className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label htmlFor="track-verify-email" className="sr-only">Booking email</label>
                      <input
                        id="track-verify-email"
                        type="email"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          setEmailInputError(null);
                        }}
                        placeholder="you@example.com"
                        autoComplete="email"
                        aria-invalid={!!emailInputError}
                        aria-describedby={emailInputError ? 'track-email-error' : undefined}
                        className={`w-full px-4 py-3 bg-white border rounded-nilin text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/50 focus:border-nilin-coral ${
                          emailInputError ? 'border-red-400' : 'border-nilin-border'
                        }`}
                      />
                      {emailInputError && (
                        <p id="track-email-error" className="mt-1 text-sm text-red-500" role="alert">{emailInputError}</p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={verifyingEmail || !emailInput.trim()}
                      className="px-6 py-3 bg-nilin-coral text-white rounded-nilin font-semibold hover:bg-nilin-rose transition-colors disabled:opacity-50"
                    >
                      {verifyingEmail ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto" aria-hidden="true" />
                      ) : (
                        'Verify email'
                      )}
                    </button>
                  </form>
                </div>
              )}

              {!needsEmailVerification && (
              <>
              {/* Status Banner */}
              <div className="bg-gradient-to-r from-nilin-cream to-nilin-blush/30 px-6 py-5 border-b border-nilin-border/50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="text-xs text-nilin-warmGray uppercase tracking-wider">Booking Number</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xl font-bold text-nilin-charcoal font-mono">{tracking.bookingNumber}</p>
                      <button
                        onClick={handleCopyBookingNumber}
                        className="p-1.5 rounded-lg hover:bg-nilin-coral/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                        aria-label="Copy booking number"
                        title="Copy booking number"
                      >
                        <Copy className="w-4 h-4 text-nilin-warmGray hover:text-nilin-coral" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-5 py-2 rounded-full text-base font-bold transition-all duration-300 ${statusColorsClass.bg} ${statusColorsClass.text} border ${statusColorsClass.border} shadow-sm ${statusChanged ? 'scale-110 ring-2 ring-offset-2 ring-nilin-coral' : ''}`}
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {statusLabels[tracking.status] || tracking.status}
                    </span>
                    <button
                      onClick={handleShareBooking}
                      className="p-2 rounded-lg hover:bg-nilin-coral/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                      aria-label="Share booking"
                      title="Share booking"
                    >
                      <Share2 className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Visual Progress Stepper */}
              {!['cancelled', 'rejected', 'no_show'].includes(tracking.status) && (
                <div className="px-6 py-4 bg-nilin-cream/50 border-b border-nilin-border/50">
                  <div className="flex items-center justify-between relative">
                    {/* Progress Line Background */}
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-10" />
                    {/* Progress Line Fill */}
                    <div
                      className="absolute top-4 left-0 h-0.5 bg-gradient-to-r from-nilin-coral to-nilin-rose transition-all duration-500 -z-10"
                      style={{ width: `${currentStepIndex >= 0 ? (currentStepIndex / (progressSteps.length - 1)) * 100 : 0}%` }}
                    />
                    {progressSteps.map((step, idx) => (
                      <div key={step} className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                          idx <= currentStepIndex
                            ? 'bg-gradient-to-br from-nilin-coral to-nilin-rose text-white shadow-lg shadow-nilin-coral/30'
                            : 'bg-white border-2 border-gray-200 text-gray-400'
                        }`}>
                          {idx < currentStepIndex ? (
                            <CheckCircle className="w-5 h-5" aria-hidden="true" />
                          ) : (
                            <span className="text-xs font-bold" aria-hidden="true">{idx + 1}</span>
                          )}
                        </div>
                        <span className={`text-xs mt-2 font-medium ${idx <= currentStepIndex ? 'text-nilin-charcoal' : 'text-nilin-warmGray'}`}>
                          {statusLabels[step]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Countdown Timer */}
              {countdown && ['pending', 'confirmed'].includes(tracking.status) && (
                <div className="mx-6 mt-4 bg-gradient-to-r from-nilin-coral/10 to-nilin-rose/10 rounded-xl p-4 border border-nilin-coral/20">
                  <p className="text-xs text-nilin-warmGray text-center mb-3 uppercase tracking-wider">Your appointment starts in</p>
                  <div className="flex justify-center gap-4">
                    {[
                      { value: countdown.days, label: 'Days' },
                      { value: countdown.hours, label: 'Hours' },
                      { value: countdown.minutes, label: 'Min' },
                      { value: countdown.seconds, label: 'Sec' },
                    ].map(({ value, label }) => (
                      <div key={label} className="text-center">
                        <div className="bg-white rounded-lg px-3 py-2 shadow-sm min-w-[50px]">
                          <span className="text-2xl font-bold text-nilin-charcoal">{value.toString().padStart(2, '0')}</span>
                        </div>
                        <span className="text-xs text-nilin-warmGray mt-1 block">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service Info */}
              {tracking.service && (
                <div className="p-6 border-b border-nilin-border">
                  <h2 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-4">Service</h2>
                  <div className="flex items-center gap-4">
                    {tracking.service.image ? (
                      <img
                        src={tracking.service.image}
                        alt={`${tracking.service.name} - Booking ${tracking.bookingNumber}`}
                        className="w-20 h-20 rounded-nilin object-cover transition-transform duration-200 hover:scale-105"
                        width={80}
                        height={80}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                        <Package className="w-8 h-8 text-nilin-coral" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-nilin-charcoal text-lg truncate" title={tracking.service.name}>
                        {tracking.service.name}
                      </h3>
                      <p className="text-nilin-warmGray text-sm">{tracking.service.category}</p>
                      {tracking.service.subcategory && (
                        <p className="text-nilin-warmGray/70 text-xs">{tracking.service.subcategory}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Provider Card */}
              {tracking.provider && (
                <div className="p-6 border-b border-nilin-border bg-gradient-to-br from-white to-nilin-cream/30">
                  <h2 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-4">Service Provider</h2>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-nilin-border">
                    <div className="w-14 h-14 rounded-full bg-nilin-coral/20 flex items-center justify-center overflow-hidden">
                      {tracking.provider.avatar ? (
                        <img src={tracking.provider.avatar} alt={tracking.provider.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl font-bold text-nilin-coral">{tracking.provider.name?.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-nilin-charcoal text-lg">{tracking.provider.name}</p>
                      <div className="flex items-center gap-1 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-3 h-3 text-yellow-400 fill-current" aria-hidden="true" />
                        ))}
                        <span className="text-xs text-nilin-warmGray ml-1">4.9 (127 reviews)</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {tracking.provider.phone && (
                        <a
                          href={`tel:${tracking.provider.phone}`}
                          className="w-11 h-11 rounded-full bg-green-50 border border-green-200 flex items-center justify-center hover:bg-green-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                          aria-label={`Call ${tracking.provider.name}`}
                        >
                          <Phone className="w-5 h-5 text-green-600" aria-hidden="true" />
                        </a>
                      )}
                      <a
                        href={tracking.location ? `https://maps.google.com?q=${encodeURIComponent(formatAddress(tracking.location) || '')}` : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-11 h-11 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                        aria-label="Get directions"
                      >
                        <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Tracking Map - Show during in_progress status */}
              {tracking.status === 'in_progress' && (
                <div className="p-6 border-b border-nilin-border">
                  <h2 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-nilin-coral" aria-hidden="true" />
                    Live Tracking
                  </h2>
                  <TrackingMap
                    providerLocation={tracking.providerLocation}
                    destinationLocation={tracking.destinationLocation}
                    providerName={tracking.provider?.name}
                    destinationAddress={tracking.location ? formatAddress(tracking.location) : undefined}
                    etaMinutes={tracking.etaMinutes}
                    distanceRemaining={tracking.distanceRemaining}
                    height="280px"
                  />
                </div>
              )}

              {/* Booking Details */}
              <div className="p-6 space-y-4 border-b border-nilin-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center group-hover:bg-nilin-coral/15 transition-colors">
                      <Calendar className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Date</p>
                      <p className="font-medium">{formatDateSafe(tracking.scheduledDate)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Time</p>
                      <p className="font-medium">{tracking.scheduledTime || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <Timer className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Duration</p>
                      <p className="font-medium">{tracking.duration ? formatDuration(tracking.duration) : 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-nilin-charcoal">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Provider</p>
                      <p className="font-medium">{tracking.provider?.name || 'To be assigned'}</p>
                    </div>
                  </div>
                </div>

                {/* Location */}
                {tracking.location && (
                  <div className="flex items-start gap-3 text-nilin-charcoal pt-4 border-t border-nilin-border">
                    <div className="w-10 h-10 rounded-nilin bg-nilin-coral/10 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5 text-nilin-coral" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-600">Location</p>
                      <p className="font-medium">{formatAddress(tracking.location)}</p>
                      {tracking.location.notes && (
                        <p className="text-sm text-nilin-warmGray mt-1">{tracking.location.notes}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Pricing */}
              {tracking.pricing && (
                <div className="p-6 border-b border-nilin-border">
                  <h2 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-4">Pricing Details</h2>
                  <div className="space-y-2">
                    {tracking.pricing.basePrice != null && (
                      <div className="flex justify-between text-nilin-charcoal">
                        <span>Service Fee</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.basePrice.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.addOns?.map((addon, idx) => (
                      <div key={idx} className="flex justify-between text-nilin-charcoal">
                        <span>{addon.name}</span>
                        <span>+{tracking.pricing.currency} {addon.price.toFixed(2)}</span>
                      </div>
                    ))}
                    {tracking.pricing.discounts?.map((discount, idx) => (
                      <div key={idx} className="flex justify-between text-nilin-success">
                        <span>
                          {discount.description || 'Discount'}
                          {discount.code && <span className="text-xs ml-1">({discount.code})</span>}
                        </span>
                        <span>-{tracking.pricing.currency} {discount.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    {tracking.pricing.couponDiscount && tracking.pricing.couponDiscount > 0 && !tracking.pricing.discounts?.some(d => d.code) && (
                      <div className="flex justify-between text-nilin-success">
                        <span>Coupon Discount</span>
                        <span>-{tracking.pricing.currency} {tracking.pricing.couponDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.subtotal != null && (
                      <div className="flex justify-between text-nilin-warmGray pt-2 border-t border-nilin-border">
                        <span>Subtotal</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.subtotal.toFixed(2)}</span>
                      </div>
                    )}
                    {tracking.pricing.tax != null && (
                      <div className="flex justify-between text-nilin-warmGray">
                        <span>Tax (VAT)</span>
                        <span>{tracking.pricing.currency} {tracking.pricing.tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center font-bold text-nilin-charcoal text-lg pt-3 mt-2 bg-nilin-cream -mx-6 px-6 py-3">
                      <span>Total</span>
                      <span className="text-xl">{tracking.pricing.currency} {tracking.pricing.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Offer Details Section */}
              {(tracking.pricing.couponDiscount || (tracking.pricing.discounts && tracking.pricing.discounts.length > 0)) && (
                <div className="p-6 border-b border-nilin-border">
                  <h2 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-4 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-nilin-success" aria-hidden="true" />
                    Savings Applied
                  </h2>
                  <div className="bg-nilin-success/10 rounded-xl p-4 border border-nilin-success/20">
                    {tracking.pricing.discounts?.map((discount, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-nilin-charcoal">
                            {discount.description || 'Special Offer'}
                          </p>
                          {discount.code && (
                            <p className="text-xs text-nilin-warmGray mt-1 font-mono">Code: {discount.code}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-nilin-success">
                            -{tracking.pricing.currency} {discount.amount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {!tracking.pricing.discounts?.length && tracking.pricing.couponDiscount && (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-nilin-charcoal">Promo Code Discount</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-nilin-success">
                            -{tracking.pricing.currency} {tracking.pricing.couponDiscount.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Price Comparison */}
                    {tracking.pricing.basePrice != null && tracking.pricing.couponDiscount > 0 && (
                      <div className="mt-4 pt-4 border-t border-nilin-success/20">
                        <div className="text-center">
                          <p className="text-sm text-nilin-warmGray mb-1">You Save</p>
                          <p className="text-3xl font-bold text-nilin-success">
                            -{tracking.pricing.currency} {tracking.pricing.couponDiscount?.toFixed(2) || tracking.pricing.discounts?.[0]?.amount.toFixed(2)}
                          </p>
                          <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-lg text-nilin-warmGray line-through">
                              {tracking.pricing.currency} {tracking.pricing.basePrice.toFixed(2)}
                            </span>
                            <ArrowRight className="w-5 h-5 text-nilin-success" aria-hidden="true" />
                            <span className="text-xl font-bold text-nilin-charcoal">
                              {tracking.pricing.currency} {tracking.pricing.totalAmount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Timeline */}
              {tracking.statusHistory && tracking.statusHistory.length > 0 && (
                <div className="p-6">
                  <h2 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wide mb-4">Status Timeline</h2>
                  <ul className="space-y-0" role="list">
                    {tracking.statusHistory.map((entry, index) => {
                      const isCurrent = index === 0;
                      return (
                        <li key={index} className="flex gap-4 relative" role="listitem">
                          <div className="flex flex-col items-center w-6">
                            {getStatusIcon(entry.status, isCurrent)}
                            {index < tracking.statusHistory.length - 1 && (
                              <div className={`w-px flex-1 mt-1 min-h-[2rem] ${isCurrent ? 'bg-nilin-coral/30' : 'bg-nilin-border'}`} />
                            )}
                          </div>
                          <div className={`flex-1 pb-6 ${index === tracking.statusHistory.length - 1 ? 'pb-0' : ''} animate-slide-up`} style={{ animationDelay: `${index * 100}ms` }}>
                            <p className={`font-medium ${isCurrent ? 'text-nilin-charcoal' : 'text-nilin-warmGray'}`}>
                              {statusLabels[entry.status] || entry.status}
                            </p>
                            <p className="text-sm text-gray-600">
                              {new Date(entry.timestamp).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {entry.reason && (
                              <p className="text-sm text-nilin-warmGray mt-1">{entry.reason}</p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* Booking Chat */}
              {isAuthenticated &&
                bookingInternalId &&
                tracking.providerId &&
                (user?._id || user?.id || tracking.customerId) &&
                !['cancelled', 'rejected'].includes(tracking.status) && (
                <div className="p-6 border-b border-nilin-border">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <h2 className="font-semibold text-nilin-charcoal flex items-center gap-2 flex-shrink-0">
                      <MessageCircle className="w-4 h-4 text-nilin-coral" aria-hidden="true" />
                      Message {tracking.provider?.name || 'your provider'}
                    </h2>
                    <button
                      type="button"
                      aria-label={`Message ${tracking.provider?.name || 'your provider'} about booking ${tracking.bookingNumber}`}
                      onClick={() =>
                        navigate('/customer/messages', {
                          state: {
                            bookingId: bookingInternalId,
                            providerId: tracking.providerId,
                          },
                        })
                      }
                      className="text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded"
                    >
                      Open in Messages
                    </button>
                  </div>
                  <BookingChat
                    bookingId={bookingInternalId}
                    customerId={(user?._id || user?.id || tracking.customerId)!}
                    customerName={
                      `${user?.firstName || tracking.customerInfo?.firstName || ''} ${user?.lastName || tracking.customerInfo?.lastName || ''}`.trim() || 'Customer'
                    }
                    customerAvatar={user?.avatar}
                    providerId={tracking.providerId}
                    providerName={tracking.provider?.name || 'Provider'}
                    currentUserId={(user?._id || user?.id)!}
                    currentUserRole="customer"
                    bookingStatus={tracking.status}
                    serviceName={tracking.service?.name}
                    scheduledDate={`${tracking.scheduledDate}T${tracking.scheduledTime || '00:00'}`}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="p-6 bg-gradient-to-b from-nilin-cream to-nilin-blush/30 border-t border-nilin-border/50">
                {/* Real-time update indicator */}
                <div className="flex items-center justify-between mb-4">
                  {isConnected ? (
                    <div className="flex items-center gap-2 text-xs text-nilin-success animate-pulse" role="status" aria-live="polite">
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nilin-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-nilin-success"></span>
                      </div>
                      <span>Live updates active</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-orange-500">
                      <WifiOff className="w-3 h-3" aria-hidden="true" />
                      <span>Reconnecting...</span>
                    </div>
                  )}
                  {lastUpdate && (
                    <span className="text-xs text-nilin-warmGray">
                      Last update: {lastUpdate.toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {/* Cancel and Reschedule Buttons */}
                {canCancel && isAuthenticated && (
                  <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    {canReschedule && (
                      <button
                        onClick={() => setShowRescheduleModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-nilin-border text-nilin-charcoal rounded-nilin font-medium hover:bg-nilin-blush/30 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                        aria-label="Reschedule booking for a different date or time"
                      >
                        <Calendar className="w-4 h-4" aria-hidden="true" />
                        Reschedule
                      </button>
                    )}
                    <button
                      onClick={() => setShowCancellationModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-nilin-muted border border-nilin-border text-nilin-charcoal rounded-nilin font-medium hover:bg-nilin-error/10 hover:border-nilin-error/30 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-error focus-visible:ring-offset-2"
                      aria-label="Cancel this booking"
                    >
                      <AlertCircle className="w-4 h-4" aria-hidden="true" />
                      Cancel Booking
                    </button>
                  </div>
                )}

                {/* Print Button */}
                <button
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-nilin-border text-nilin-charcoal rounded-nilin font-medium hover:bg-nilin-blush/30 transition-colors duration-200 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  aria-label="Print booking details"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" />
                  Print Booking
                </button>

                {/* Completed - Share Experience */}
                {tracking.status === 'completed' && isAuthenticated && (
                  <div className="mb-4">
                    {checkingExperience ? (
                      <div className="flex items-center justify-center gap-2 text-nilin-warmGray py-3">
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span className="text-sm">Checking...</span>
                      </div>
                    ) : hasExperience ? (
                      <div className="flex items-center justify-center gap-2 text-nilin-success bg-nilin-success/10 rounded-nilin p-4" role="status" aria-live="polite">
                        <Star className="w-5 h-5 fill-current" aria-hidden="true" />
                        <span className="font-medium">Experience Shared</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowExperienceForm(true)}
                        aria-label="Share your experience for this booking"
                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-nilin-coral text-white rounded-nilin font-semibold hover:bg-nilin-rose hover-lift transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                      >
                        <Share2 className="w-5 h-5" aria-hidden="true" />
                        Share Your Experience
                      </button>
                    )}
                  </div>
                )}

                {/* View Full Details for logged-in users */}
                {isAuthenticated && bookingInternalId && (
                  <Link
                    to={`/customer/bookings/${bookingInternalId}`}
                    aria-label={`View full details for booking ${tracking.bookingNumber}`}
                    className="block w-full text-center px-6 py-3 bg-nilin-charcoal text-white rounded-nilin font-semibold hover:bg-nilin-warmGray transition-all duration-200 hover-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                  >
                    View Full Details
                    <ChevronRight className="w-5 h-5 inline ml-1" aria-hidden="true" />
                  </Link>
                )}

                {/* Login prompt for guests */}
                {!isAuthenticated && tracking.status !== 'cancelled' && tracking.status !== 'rejected' && (
                  <div className="space-y-3">
                    <p className="text-center text-nilin-warmGray text-sm">
                      Sign in with the same email used for this booking to see it in My Bookings
                    </p>
                    <Link
                      to="/login"
                      state={{
                        returnTo: '/customer/bookings',
                        email: verificationEmail || emailInput || tracking.guestEmail || tracking.customerInfo?.email,
                        message:
                          'Use the email from your booking confirmation to link this booking to your account.',
                      }}
                      className="block w-full text-center px-6 py-3 bg-nilin-charcoal text-white rounded-nilin font-semibold hover:bg-nilin-warmGray transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      Sign In
                    </Link>
                  </div>
                )}
              </div>
              </>
              )}

              {needsEmailVerification && (
                <div className="p-6 text-center text-nilin-warmGray text-sm">
                  Status: <span className="font-medium text-nilin-charcoal">{statusLabels[tracking.status] || tracking.status}</span>
                </div>
              )}
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 text-center">
            <p className="text-nilin-warmGray text-sm mb-2">Need help with your booking?</p>
            <Link
              to="/contact"
              className="text-nilin-coral hover:text-nilin-rose hover:underline transition-all duration-200 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded"
            >
              Contact Support
            </Link>
          </div>
        </div>
      </main>

      <Footer />

      {/* Experience Submission Modal */}
      {showExperienceForm && bookingInternalId && (
        <ExperienceSubmissionForm
          isOpen={showExperienceForm}
          onClose={() => setShowExperienceForm(false)}
          bookingId={bookingInternalId}
          onSuccess={() => {
            setShowExperienceForm(false);
            setHasExperience(true);
          }}
        />
      )}

      {/* Cancellation Modal */}
      {showCancellationModal && tracking && (
        <CancellationModal
          isOpen={showCancellationModal}
          onClose={() => setShowCancellationModal(false)}
          booking={tracking}
          onConfirm={handleCancelBooking}
          isLoading={cancelling}
        />
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && tracking && (
        <RescheduleModal
          isOpen={showRescheduleModal}
          onClose={() => setShowRescheduleModal(false)}
          booking={tracking}
          onConfirm={handleRescheduleBooking}
          isLoading={rescheduling}
        />
      )}
    </div>
  );
};

export default TrackBookingPage;
