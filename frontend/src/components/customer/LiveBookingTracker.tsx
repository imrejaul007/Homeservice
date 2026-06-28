import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Navigation, Phone, MessageSquare, Clock, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { bookingService } from '../../services/BookingService';
import { socketService } from '../../services/socket';

// =============================================================================
// NILIN Customer Dashboard - Live Booking Tracker Component
// Real-time map tracking for active bookings
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface LiveBookingTrackerProps {
  /** Booking ID to track */
  bookingId: string;
  /** Auto-refresh interval in ms */
  refreshInterval?: number;
  /** Callback when ETA updates */
  onEtaUpdate?: (eta: number) => void;
  /** Callback when provider arrives */
  onProviderArrival?: () => void;
  /** Callback when booking completes */
  onBookingComplete?: () => void;
  /** Additional CSS classes */
  className?: string;
}

export type BookingStatus = 'pending' | 'confirmed' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

interface ProviderLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

interface BookingTrackingData {
  bookingId: string;
  status: BookingStatus;
  serviceName: string;
  provider: {
    id: string;
    name: string;
    phone: string;
    avatar?: string;
    rating: number;
    currentLocation?: ProviderLocation;
  };
  customerLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  scheduledTime: Date;
  estimatedArrival?: Date;
  etaMinutes?: number;
  distanceRemaining?: number;
  checkinTime?: Date;
  completionTime?: Date;
  timeline: Array<{
    id: string;
    status: BookingStatus;
    title: string;
    description?: string;
    timestamp?: Date;
    completed: boolean;
    current: boolean;
  }>;
}

// =============================================================================
// Map Placeholder Component (Replace with actual map library)
// =============================================================================

interface MapPlaceholderProps {
  providerLocation?: ProviderLocation;
  customerLocation: { lat: number; lng: number; address: string };
  className?: string;
}

const MapPlaceholder: React.FC<MapPlaceholderProps> = ({
  providerLocation,
  customerLocation,
  className,
}) => {
  // In production, replace with Google Maps, Mapbox, or similar
  // For demo, show a styled placeholder

  return (
    <div className={cn(
      'relative w-full h-full min-h-[200px] rounded-xl overflow-hidden',
      'bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50',
      className
    )}>
      {/* Grid Pattern */}
      <div className="absolute inset-0 opacity-30">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94A3B8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Provider Marker */}
      {providerLocation && (
        <div className="absolute transform -translate-x-1/2 -translate-y-1/2 animate-pulse"
          style={{
            left: '40%',
            top: '45%',
          }}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-nilin-coral flex items-center justify-center shadow-lg">
              <Navigation className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-nilin-coral" />
          </div>
        </div>
      )}

      {/* Customer/Service Location Marker */}
      <div
        className="absolute transform -translate-x-1/2 -translate-y-1/2"
        style={{
          left: '70%',
          top: '60%',
        }}
      >
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-green-500" />
        </div>
      </div>

      {/* Route Line */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <path
          d={providerLocation
            ? 'M 40% 45% Q 55% 50% 70% 60%'
            : 'M 70% 60% L 70% 60%'
          }
          fill="none"
          stroke="#E8604C"
          strokeWidth="3"
          strokeDasharray="8 4"
          strokeLinecap="round"
          className="animate-dash"
        />
      </svg>

      {/* Map Attribution */}
      <div className="absolute bottom-2 right-2 px-2 py-1 bg-white/80 rounded text-xs text-gray-500">
        Map View
      </div>
    </div>
  );
};

// =============================================================================
// Timeline Component
// =============================================================================

interface TrackingTimelineProps {
  timeline: BookingTrackingData['timeline'];
  compact?: boolean;
}

const TrackingTimeline: React.FC<TrackingTimelineProps> = ({ timeline, compact }) => {
  if (compact) {
    // Compact horizontal timeline
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-nilin-blush/30">
        {timeline.map((item, index) => (
          <React.Fragment key={item.id}>
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                item.completed && 'bg-green-100 text-green-600',
                item.current && 'bg-nilin-coral text-white',
                !item.completed && !item.current && 'bg-gray-100 text-gray-400'
              )}>
                {item.completed ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span className="text-xs text-nilin-warmGray mt-1 max-w-[60px] text-center">
                {item.title}
              </span>
            </div>

            {index < timeline.length - 1 && (
              <div className={cn(
                'flex-1 h-0.5 mx-2',
                timeline[index + 1].completed || timeline[index + 1].current
                  ? 'bg-green-400'
                  : 'bg-gray-200'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  }

  // Full vertical timeline
  return (
    <div className="space-y-0">
      {timeline.map((item, index) => (
        <div key={item.id} className="relative">
          {/* Connector Line */}
          {index < timeline.length - 1 && (
            <div className={cn(
              'absolute left-4 top-10 w-0.5 h-full',
              timeline[index + 1].completed || timeline[index + 1].current
                ? 'bg-green-400'
                : 'bg-gray-200'
            )} />
          )}

          {/* Timeline Item */}
          <div className="relative flex items-start gap-4 pb-6 last:pb-0">
            <div className={cn(
              'relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0',
              item.completed && 'bg-green-100 text-green-600',
              item.current && 'bg-nilin-coral text-white ring-4 ring-nilin-coral/20',
              !item.completed && !item.current && 'bg-gray-100 text-gray-400'
            )}>
              {item.completed ? (
                <CheckCircle className="h-5 w-5" />
              ) : item.current ? (
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>

            <div className="flex-1 pt-1">
              <h4 className={cn(
                'font-medium',
                item.current ? 'text-nilin-charcoal' :
                item.completed ? 'text-green-700' : 'text-gray-400'
              )}>
                {item.title}
              </h4>
              {item.description && (
                <p className="text-sm text-nilin-warmGray mt-0.5">
                  {item.description}
                </p>
              )}
              {item.timestamp && (
                <p className="text-xs text-gray-400 mt-1">
                  {item.timestamp.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Provider Info Card
// =============================================================================

interface ProviderInfoCardProps {
  provider: BookingTrackingData['provider'];
  etaMinutes?: number;
  distanceRemaining?: number;
  onCall?: () => void;
  onMessage?: () => void;
}

const ProviderInfoCard: React.FC<ProviderInfoCardProps> = ({
  provider,
  etaMinutes,
  distanceRemaining,
  onCall,
  onMessage,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/30">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative">
          {provider.avatar && !imageError ? (
            <img
              src={provider.avatar}
              alt={provider.name}
              className="w-14 h-14 rounded-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-nilin-coral to-rose-500 flex items-center justify-center">
              <span className="text-lg font-bold text-white">
                {provider.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Online Indicator */}
          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-nilin-charcoal">{provider.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-amber-500">★ {provider.rating.toFixed(1)}</span>
          </div>

          {/* ETA */}
          {etaMinutes !== undefined && (
            <div className="flex items-center gap-1 mt-1 text-sm">
              <Clock className="h-4 w-4 text-nilin-coral" />
              <span className="text-nilin-coral font-medium">
                {etaMinutes <= 0 ? 'Arriving now' : `${etaMinutes} min away`}
              </span>
              {distanceRemaining !== undefined && (
                <span className="text-nilin-warmGray">
                  ({distanceRemaining.toFixed(1)} km)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onCall}
            className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center hover:bg-green-200 transition-colors"
            aria-label="Call provider"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            onClick={onMessage}
            className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors"
            aria-label="Message provider"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// API Helper Functions
// =============================================================================

const mapApiBookingToTrackingData = (booking: any): BookingTrackingData => {
  const statusToTimelineStatus = (status: string): BookingStatus => {
    const mapping: Record<string, BookingStatus> = {
      pending: 'pending',
      confirmed: 'confirmed',
      en_route: 'en_route',
      arrived: 'arrived',
      in_progress: 'in_progress',
      completed: 'completed',
      cancelled: 'cancelled',
    };
    return mapping[status] || 'pending';
  };

  const buildTimeline = (bookingData: any) => {
    const timelineItems = [];
    const status = bookingData.status;
    const statuses = ['confirmed', 'en_route', 'arrived', 'in_progress', 'completed'];
    const currentIndex = status === 'cancelled' ? -1 : statuses.indexOf(status);

    // Booking Confirmed
    timelineItems.push({
      id: '1',
      status: 'confirmed' as BookingStatus,
      title: 'Booking Confirmed',
      description: 'Your booking has been confirmed',
      timestamp: bookingData.confirmedAt ? new Date(bookingData.confirmedAt) : undefined,
      completed: currentIndex >= 0,
      current: status === 'confirmed',
    });

    // Provider En Route
    timelineItems.push({
      id: '2',
      status: 'en_route' as BookingStatus,
      title: 'Provider En Route',
      description: bookingData.provider ? `${bookingData.provider.firstName || ''} is on the way` : 'Provider is on the way',
      timestamp: bookingData.providerResponse?.arrivalTime ? new Date(bookingData.providerResponse.arrivalTime) : undefined,
      completed: currentIndex >= 1,
      current: status === 'en_route',
    });

    // Provider Arrived
    timelineItems.push({
      id: '3',
      status: 'arrived' as BookingStatus,
      title: 'Provider Arrived',
      description: 'Provider has arrived at your location',
      completed: currentIndex >= 2,
      current: status === 'arrived',
    });

    // Service In Progress
    timelineItems.push({
      id: '4',
      status: 'in_progress' as BookingStatus,
      title: 'Service In Progress',
      description: 'Your service is being performed',
      timestamp: bookingData.startedAt ? new Date(bookingData.startedAt) : undefined,
      completed: currentIndex >= 3,
      current: status === 'in_progress',
    });

    // Service Completed
    timelineItems.push({
      id: '5',
      status: 'completed' as BookingStatus,
      title: 'Service Completed',
      description: 'Service has been completed',
      timestamp: bookingData.completedAt ? new Date(bookingData.completedAt) : undefined,
      completed: status === 'completed',
      current: false,
    });

    return timelineItems;
  };

  const fullName = booking.provider
    ? `${booking.provider.firstName || ''} ${booking.provider.lastName || ''}`.trim()
    : 'Provider';

  return {
    bookingId: booking._id,
    status: statusToTimelineStatus(booking.status),
    serviceName: booking.service?.name || 'Service',
    provider: {
      id: booking.provider?._id || '',
      name: fullName,
      phone: booking.provider?.phone || '',
      avatar: booking.provider?.avatar,
      rating: 4.5, // Default rating
      currentLocation: booking.providerLocation ? {
        lat: booking.providerLocation.latitude,
        lng: booking.providerLocation.longitude,
        timestamp: new Date(),
      } : undefined,
    },
    customerLocation: {
      lat: booking.location?.address?.coordinates?.lat || 0,
      lng: booking.location?.address?.coordinates?.lng || 0,
      address: booking.location?.address?.street || booking.customerInfo?.accessInstructions || '',
    },
    scheduledTime: new Date(`${booking.scheduledDate}T${booking.scheduledTime}`),
    estimatedArrival: booking.providerResponse?.estimatedArrival
      ? new Date(booking.providerResponse.estimatedArrival)
      : undefined,
    etaMinutes: booking.etaMinutes,
    distanceRemaining: booking.distanceRemaining,
    timeline: buildTimeline(booking),
  };
};

// =============================================================================
// Main Component
// =============================================================================

export const LiveBookingTracker: React.FC<LiveBookingTrackerProps> = ({
  bookingId,
  refreshInterval = 30000, // 30 seconds
  onEtaUpdate,
  onProviderArrival,
  onBookingComplete,
  className,
}) => {
  const [trackingData, setTrackingData] = useState<BookingTrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch tracking data from API
  const fetchTrackingData = useCallback(async () => {
    try {
      setError(null);

      const response = await bookingService.getBooking(bookingId);

      if (response.success && response.data?.booking) {
        const data = mapApiBookingToTrackingData(response.data.booking);
        setTrackingData(data);
        onEtaUpdate?.(data.etaMinutes || 0);

        // Trigger arrival callback when provider arrives
        if (data.status === 'arrived' && trackingData?.status !== 'arrived') {
          onProviderArrival?.();
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tracking data';
      setError(errorMessage);
      console.error('Error fetching tracking data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, onEtaUpdate, onProviderArrival]);

  // Subscribe to real-time updates via socket
  useEffect(() => {
    // Helper to check if the event is for this booking
    const isForThisBooking = (data: any): boolean => {
      return data.bookingId === bookingId || data.bookingNumber === bookingId;
    };

    // Subscribe to generic booking status changes
    const unsubscribeStatus = socketService.on('booking:status_changed', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    // Subscribe to specific booking state events
    const unsubscribeConfirmed = socketService.on('booking:confirmed', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    const unsubscribeEnRoute = socketService.on('booking:en_route', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    const unsubscribeArrived = socketService.on('booking:arrived', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    const unsubscribeStarted = socketService.on('booking:started', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    const unsubscribeCompleted = socketService.on('booking:completed', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    const unsubscribeCancelled = socketService.on('booking:cancelled', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    const unsubscribeReminder = socketService.on('booking:reminder', (data: any) => {
      if (isForThisBooking(data)) {
        fetchTrackingData();
      }
    });

    // Subscribe to provider location updates
    const unsubscribeLocation = socketService.on('booking:provider_location', (data: any) => {
      if (data.bookingId === bookingId) {
        setTrackingData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            etaMinutes: data.etaMinutes,
            distanceRemaining: data.distanceRemaining,
            provider: {
              ...prev.provider,
              currentLocation: data.location ? {
                lat: data.location.latitude,
                lng: data.location.longitude,
                heading: data.location.heading,
                speed: data.location.speed,
                timestamp: new Date(),
              } : prev.provider.currentLocation,
            },
          };
        });
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeConfirmed();
      unsubscribeEnRoute();
      unsubscribeArrived();
      unsubscribeStarted();
      unsubscribeCompleted();
      unsubscribeCancelled();
      unsubscribeReminder();
      unsubscribeLocation();
    };
  }, [bookingId, fetchTrackingData]);

  // Start polling as fallback
  useEffect(() => {
    fetchTrackingData();

    intervalRef.current = setInterval(fetchTrackingData, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchTrackingData, refreshInterval]);

  // Handle status changes
  useEffect(() => {
    if (trackingData?.status === 'completed') {
      onBookingComplete?.();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  }, [trackingData?.status, onBookingComplete]);

  const handleCall = useCallback(() => {
    if (trackingData?.provider.phone) {
      window.open(`tel:${trackingData.provider.phone}`);
    }
  }, [trackingData]);

  const handleMessage = useCallback(() => {
    if (trackingData?.provider.phone) {
      window.open(`sms:${trackingData.provider.phone}`);
    }
  }, [trackingData]);

  // Get status badge
  const getStatusBadge = (status: BookingStatus) => {
    switch (status) {
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      case 'confirmed':
        return <Badge variant="primary">Confirmed</Badge>;
      case 'en_route':
        return <Badge variant="primary">On the way</Badge>;
      case 'arrived':
        return <Badge variant="success">Arrived</Badge>;
      case 'in_progress':
        return <Badge variant="primary">In Progress</Badge>;
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'cancelled':
        return <Badge variant="error">Cancelled</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  // Loading State
  if (isLoading && !trackingData) {
    return (
      <div className={cn('bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30', className)}>
        <Skeleton className="w-full h-48" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error State
  if (error && !trackingData) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-sm border border-nilin-blush/30 text-center', className)}>
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
        <h3 className="font-semibold text-nilin-charcoal mb-2">Unable to track booking</h3>
        <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
        <Button variant="primary" onClick={fetchTrackingData}>
          Try Again
        </Button>
      </div>
    );
  }

  if (!trackingData) return null;

  return (
    <div className={cn('bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30', className)}>
      {/* Header */}
      <div className="p-4 border-b border-nilin-blush/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-nilin-charcoal">Live Tracking</h2>
              {getStatusBadge(trackingData.status)}
            </div>
            <p className="text-sm text-nilin-warmGray mt-1">
              {trackingData.serviceName}
            </p>
          </div>

          <div className="text-right">
            <p className="text-sm font-medium text-nilin-charcoal">
              {trackingData.scheduledTime.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-xs text-nilin-warmGray">
              {trackingData.scheduledTime.toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="h-48">
        <MapPlaceholder
          providerLocation={trackingData.provider.currentLocation}
          customerLocation={trackingData.customerLocation}
        />
      </div>

      {/* Provider Info */}
      <div className="p-4">
        <ProviderInfoCard
          provider={trackingData.provider}
          etaMinutes={trackingData.etaMinutes}
          distanceRemaining={trackingData.distanceRemaining}
          onCall={handleCall}
          onMessage={handleMessage}
        />
      </div>

      {/* Timeline Toggle */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowFullTimeline(!showFullTimeline)}
          className="w-full flex items-center justify-between py-2 text-sm font-medium text-nilin-charcoal hover:text-nilin-coral transition-colors"
        >
          <span>Booking Progress</span>
          {showFullTimeline ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Timeline */}
      {showFullTimeline && (
        <div className="px-4 pb-4">
          <TrackingTimeline timeline={trackingData.timeline} />
        </div>
      )}

      {/* Compact Timeline (always visible) */}
      {!showFullTimeline && (
        <div className="px-4 pb-4">
          <TrackingTimeline timeline={trackingData.timeline} compact />
        </div>
      )}

      {/* Address */}
      <div className="px-4 pb-4">
        <div className="flex items-start gap-3 p-3 bg-nilin-blush/20 rounded-xl">
          <MapPin className="h-5 w-5 text-nilin-coral flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-nilin-charcoal">
              Service Location
            </p>
            <p className="text-sm text-nilin-warmGray mt-0.5">
              {trackingData.customerLocation.address}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default LiveBookingTracker;
