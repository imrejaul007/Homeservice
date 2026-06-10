import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Navigation, RefreshCw, ChevronRight, Locate, AlertCircle } from 'lucide-react';
import { cn, formatPrice, formatDistance } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useLocationStore } from '../../stores/locationStore';
import { Service } from '../../types/service';
import { searchApi } from '../../services/searchApi';

// =============================================================================
// NILIN Customer Dashboard - Nearby Services Component
// Geolocation-based services with distance display
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface NearbyServicesProps {
  /** Limit number of nearby services */
  limit?: number;
  /** Maximum search radius in km */
  maxRadius?: number;
  /** Category filter */
  category?: string;
  /** Show map preview */
  showMapPreview?: boolean;
  /** Callback when service is clicked */
  onServiceClick?: (service: Service) => void;
  /** Callback when location permission is needed */
  onLocationPermissionNeeded?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface NearbyServiceWithDistance extends Service {
  distanceKm: number;
}

type LocationStatus = 'loading' | 'granted' | 'denied' | 'undetermined' | 'error';

// =============================================================================
// Service Distance Card
// =============================================================================

interface NearbyServiceCardProps {
  service: NearbyServiceWithDistance;
  onServiceClick?: (service: Service) => void;
}

const NearbyServiceCard: React.FC<NearbyServiceCardProps> = ({
  service,
  onServiceClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onServiceClick?.(service);
  };

  const getDistanceLabel = (distance: number): string => {
    if (distance < 1) {
      return 'Very close';
    } else if (distance < 2) {
      return 'Walking distance';
    } else if (distance < 5) {
      return 'Short drive';
    } else if (distance < 10) {
      return 'Moderate distance';
    } else {
      return 'Further away';
    }
  };

  const getDistanceColor = (distance: number): string => {
    if (distance < 2) return 'text-green-600 bg-green-50';
    if (distance < 5) return 'text-amber-600 bg-amber-50';
    if (distance < 10) return 'text-orange-600 bg-orange-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <article
      onClick={handleClick}
      className="group flex gap-4 p-4 bg-white rounded-2xl border border-nilin-blush/30 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${service.name} - ${formatDistance(service.distanceKm)} away`}
    >
      {/* Image */}
      <div className="flex-shrink-0 relative w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-blue-50 to-cyan-50">
        {!imageError && service.images?.[0] ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MapPin className="h-8 w-8 text-blue-300" />
          </div>
        )}

        {/* Distance Badge */}
        <div className="absolute bottom-2 right-2">
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            getDistanceColor(service.distanceKm)
          )}>
            {formatDistance(service.distanceKm)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-nilin-charcoal line-clamp-1 group-hover:text-blue-600 transition-colors">
            {service.name}
          </h3>
          <ChevronRight className="flex-shrink-0 h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
        </div>

        <p className="text-sm text-nilin-warmGray mt-0.5">
          {service.category}
          {service.subcategory && ` / ${service.subcategory}`}
        </p>

        {/* Rating & Price */}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1">
            <svg className="h-4 w-4 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.538-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-medium text-nilin-charcoal">
              {service.rating?.average?.toFixed(1) || '0.0'}
            </span>
            <span className="text-xs text-nilin-warmGray">
              ({service.rating?.count || 0})
            </span>
          </div>

          <span className="text-sm font-bold text-nilin-coral">
            {formatPrice(service.price?.amount || 0, service.price?.currency)}
          </span>
        </div>

        {/* Distance Info */}
        <p className={cn(
          'text-xs mt-2',
          getDistanceColor(service.distanceKm)
        )}>
          {getDistanceLabel(service.distanceKm)}
        </p>
      </div>
    </article>
  );
};

// =============================================================================
// Location Permission Request
// =============================================================================

interface LocationRequestProps {
  onRequestPermission: () => void;
  isLoading: boolean;
}

const LocationRequest: React.FC<LocationRequestProps> = ({
  onRequestPermission,
  isLoading,
}) => {
  return (
    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white shadow-md flex items-center justify-center">
        <Locate className="h-8 w-8 text-blue-500" />
      </div>

      <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
        Enable Location
      </h3>

      <p className="text-sm text-nilin-warmGray mb-4 max-w-sm mx-auto">
        Allow location access to discover services near you and see accurate distances.
      </p>

      <Button
        variant="primary"
        onClick={onRequestPermission}
        loading={isLoading}
        leftIcon={<Navigation className="h-4 w-4" />}
      >
        Enable Location
      </Button>

      <p className="text-xs text-nilin-warmGray mt-4">
        Your location is only used to find nearby services and is never shared.
      </p>
    </div>
  );
};

// =============================================================================
// Location Denied State
// =============================================================================

interface LocationDeniedProps {
  onChangeLocation: () => void;
}

const LocationDenied: React.FC<LocationDeniedProps> = ({ onChangeLocation }) => {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white shadow-md flex items-center justify-center">
        <AlertCircle className="h-8 w-8 text-amber-500" />
      </div>

      <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
        Location Access Denied
      </h3>

      <p className="text-sm text-nilin-warmGray mb-4 max-w-sm mx-auto">
        You have blocked location access. Change your browser settings or select a city manually.
      </p>

      <Button
        variant="secondary"
        onClick={onChangeLocation}
        leftIcon={<MapPin className="h-4 w-4" />}
      >
        Select City Manually
      </Button>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const NearbyServices: React.FC<NearbyServicesProps> = ({
  limit = 10,
  maxRadius = 25,
  category,
  showMapPreview = false,
  onServiceClick,
  onLocationPermissionNeeded,
  className,
}) => {
  const navigate = useNavigate();
  const [nearbyServices, setNearbyServices] = useState<NearbyServiceWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('undetermined');

  const {
    currentLocation,
    selectedCity,
    permissionStatus,
    isLoading: isLocationLoading,
    requestLocationPermission,
    getCurrentLocation,
  } = useLocationStore();

  // Fetch nearby services based on location
  const fetchNearbyServices = useCallback(async () => {
    if (!currentLocation && !selectedCity) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build query params for nearby services API
      const params: Record<string, string | number> = {
        limit,
        sortBy: 'distance',
      };

      if (category) {
        params.category = category;
      }

      if (currentLocation?.coordinates) {
        params.lat = currentLocation.coordinates.latitude;
        params.lng = currentLocation.coordinates.longitude;
        params.radius = maxRadius;
      }

      // Use the search API for nearby services
      const response = await searchApi.searchServices(params as any);

      if (response.data?.services) {
        // Add distances from API response or calculate from coordinates
        const servicesWithDistance: NearbyServiceWithDistance[] = response.data.services.map(
          (service: Service) => {
            let distanceKm = 0;
            if (service.location?.address && 'coordinates' in service.location.address) {
              const coords = (service.location.address as { coordinates?: { coordinates?: number[]; latitude?: number; longitude?: number } }).coordinates;
              if (coords) {
                const lat = coords.coordinates?.[1] || coords.latitude || 0;
                const lng = coords.coordinates?.[0] || coords.longitude || 0;
                distanceKm = calculateDistance(
                  currentLocation?.coordinates?.latitude || 0,
                  currentLocation?.coordinates?.longitude || 0,
                  lat,
                  lng
                );
              }
            }
            return {
              ...service,
              distanceKm,
            };
          }
        );

        // Sort by distance
        servicesWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

        setNearbyServices(servicesWithDistance);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load nearby services';
      setError(errorMessage);
      console.error('Error fetching nearby services:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation, selectedCity, limit, maxRadius, category]);

  // Helper function to calculate distance between two coordinates
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Handle location permission request
  const handleRequestPermission = useCallback(async () => {
    setLocationStatus('loading');

    try {
      const granted = await requestLocationPermission();
      setLocationStatus(granted ? 'granted' : 'denied');

      if (granted) {
        await getCurrentLocation();
      } else {
        onLocationPermissionNeeded?.();
      }
    } catch {
      setLocationStatus('error');
    }
  }, [requestLocationPermission, getCurrentLocation, onLocationPermissionNeeded]);

  // Update location status from store
  useEffect(() => {
    if (permissionStatus === 'granted') {
      setLocationStatus('granted');
    } else if (permissionStatus === 'denied') {
      setLocationStatus('denied');
    } else if (permissionStatus === 'undetermined') {
      setLocationStatus('undetermined');
    }
  }, [permissionStatus]);

  // Fetch services when location changes
  useEffect(() => {
    if (currentLocation || selectedCity) {
      fetchNearbyServices();
    } else {
      setIsLoading(false);
    }
  }, [currentLocation, selectedCity, fetchNearbyServices]);

  const handleServiceClick = useCallback((service: Service) => {
    if (onServiceClick) {
      onServiceClick(service);
    } else {
      navigate(`/services/${service._id}`);
    }
  }, [navigate, onServiceClick]);

  // Loading State
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <Skeleton className="h-7 w-36" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 p-4 bg-white rounded-2xl">
              <Skeleton className="w-24 h-24 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Location Permission State
  if (locationStatus === 'undetermined' || locationStatus === 'loading') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Nearby Services
            </h2>
          </div>
        </div>

        <LocationRequest
          onRequestPermission={handleRequestPermission}
          isLoading={locationStatus === 'loading'}
        />
      </div>
    );
  }

  // Location Denied State
  if (locationStatus === 'denied' || locationStatus === 'error') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Nearby Services
            </h2>
          </div>
        </div>

        <LocationDenied onChangeLocation={() => navigate('/locations')} />
      </div>
    );
  }

  // Error State
  if (error && nearbyServices.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Nearby Services
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchNearbyServices}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Retry
          </Button>
        </div>

        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          title="Unable to load nearby services"
          description="We couldn't find services in your area. Try expanding your search radius."
          action={{
            label: 'Try Again',
            onClick: fetchNearbyServices,
          }}
        />
      </div>
    );
  }

  // Empty State
  if (nearbyServices.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Nearby Services
            </h2>
          </div>
        </div>

        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No services nearby"
          description={`No services found within ${maxRadius}km of your location. Try expanding your search.`}
          compact
        />
      </div>
    );
  }

  // Group services by distance
  const veryClose = nearbyServices.filter(s => s.distanceKm < 2);
  const walkingDistance = nearbyServices.filter(s => s.distanceKm >= 2 && s.distanceKm < 5);
  const shortDrive = nearbyServices.filter(s => s.distanceKm >= 5 && s.distanceKm < 10);
  const furtherAway = nearbyServices.filter(s => s.distanceKm >= 10);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-100 to-cyan-100">
            <MapPin className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Nearby Services
            </h2>
            <p className="text-sm text-nilin-warmGray">
              {currentLocation?.address?.city || selectedCity?.name || 'Your Area'}
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={fetchNearbyServices}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Distance Legend */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="success" dot>
          Very Close (&lt;2km)
        </Badge>
        <Badge variant="warning" dot>
          Walking (2-5km)
        </Badge>
        <Badge variant="primary" dot>
          Short Drive (5-10km)
        </Badge>
      </div>

      {/* Very Close Section */}
      {veryClose.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-nilin-warmGray mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Very Close to You
          </h3>
          <div className="space-y-3">
            {veryClose.slice(0, 3).map((service) => (
              <NearbyServiceCard
                key={service._id}
                service={service}
                onServiceClick={handleServiceClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* Walking Distance Section */}
      {walkingDistance.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-nilin-warmGray mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Walking Distance
          </h3>
          <div className="space-y-3">
            {walkingDistance.slice(0, 3).map((service) => (
              <NearbyServiceCard
                key={service._id}
                service={service}
                onServiceClick={handleServiceClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* Short Drive Section */}
      {shortDrive.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-nilin-warmGray mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            Short Drive Away
          </h3>
          <div className="space-y-3">
            {shortDrive.slice(0, 3).map((service) => (
              <NearbyServiceCard
                key={service._id}
                service={service}
                onServiceClick={handleServiceClick}
              />
            ))}
          </div>
        </section>
      )}

      {/* View All Button */}
      <div className="text-center pt-2">
        <Button
          variant="outline"
          rightIcon={<ChevronRight className="h-4 w-4" />}
          onClick={() => navigate(`/services?lat=${currentLocation?.coordinates.latitude}&lng=${currentLocation?.coordinates.longitude}&radius=${maxRadius}`)}
        >
          View All Nearby Services ({nearbyServices.length})
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default NearbyServices;
