import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, MapPin, User } from 'lucide-react';

// Fix default marker icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Location {
  lat: number;
  lng: number;
}

interface TrackingMapProps {
  providerLocation?: Location;
  destinationLocation?: Location;
  providerName?: string;
  destinationAddress?: string;
  etaMinutes?: number;
  distanceRemaining?: number;
  height?: string;
}

/**
 * Create a provider marker icon (coral colored).
 */
function createProviderIcon(): L.DivIcon {
  return L.divIcon({
    className: 'provider-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #E8B4A8 0%, #D4958A 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        border: 3px solid white;
        animation: pulse 2s infinite;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

/**
 * Create a destination marker icon (blue colored).
 */
function createDestinationIcon(): L.DivIcon {
  return L.divIcon({
    className: 'destination-marker',
    html: `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 12px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

/**
 * Inner component that auto-fits map bounds to show all markers.
 */
const FitBounds: React.FC<{ bounds: L.LatLngBoundsExpression | null }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, animate: true });
      } catch (e) {
        // Ignore bounds errors
      }
    }
  }, [bounds, map]);

  return null;
};

/**
 * Tracking Map component for real-time booking tracking.
 * Shows provider location and destination on the map.
 */
const TrackingMap: React.FC<TrackingMapProps> = ({
  providerLocation,
  destinationLocation,
  providerName,
  destinationAddress,
  etaMinutes,
  distanceRemaining,
  height = '300px',
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  // Calculate bounds if we have locations
  const bounds = React.useMemo(() => {
    const points: L.LatLngExpression[] = [];
    if (providerLocation?.lat && providerLocation?.lng) {
      points.push([providerLocation.lat, providerLocation.lng]);
    }
    if (destinationLocation?.lat && destinationLocation?.lng) {
      points.push([destinationLocation.lat, destinationLocation.lng]);
    }
    if (points.length >= 2) {
      return L.latLngBounds(points);
    }
    return null;
  }, [providerLocation, destinationLocation]);

  // Default center (Dubai) if no provider location
  const defaultCenter: [number, number] = [25.2048, 55.2708];
  const center: [number, number] = providerLocation?.lat && providerLocation?.lng
    ? [providerLocation.lat, providerLocation.lng]
    : destinationLocation?.lat && destinationLocation?.lng
      ? [destinationLocation.lat, destinationLocation.lng]
      : defaultCenter;

  // Check if we have any locations to show
  const hasLocations = (providerLocation?.lat && providerLocation?.lng) ||
                       (destinationLocation?.lat && destinationLocation?.lng);

  if (!hasLocations) {
    return (
      <div
        style={{ height }}
        className="bg-nilin-muted rounded-xl flex items-center justify-center"
      >
        <div className="text-center text-nilin-warmGray p-4">
          <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Location tracking not available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow-lg border border-nilin-border">
      {/* Pulse animation style */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>

      {/* ETA/Distance info bar */}
      {(etaMinutes !== undefined || distanceRemaining !== undefined) && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg border border-nilin-border flex items-center gap-3">
          {etaMinutes !== undefined && (
            <div className="flex items-center gap-1.5">
              <Navigation className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm font-semibold text-nilin-charcoal">
                {etaMinutes <= 0 ? 'Arriving' : `${etaMinutes} min`}
              </span>
            </div>
          )}
          {distanceRemaining !== undefined && (
            <>
              {etaMinutes !== undefined && (
                <div className="w-px h-4 bg-nilin-border" />
              )}
              <span className="text-sm text-nilin-warmGray">
                {distanceRemaining < 1
                  ? `${Math.round(distanceRemaining * 1000)} m`
                  : `${distanceRemaining.toFixed(1)} km`}
              </span>
            </>
          )}
        </div>
      )}

      <MapContainer
        center={center}
        zoom={14}
        style={{ height, width: '100%' }}
        ref={mapRef}
        whenReady={() => setIsMapReady(true)}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Provider marker */}
        {providerLocation?.lat && providerLocation?.lng && (
          <Marker
            position={[providerLocation.lat, providerLocation.lng]}
            icon={createProviderIcon()}
          >
            <Popup>
              <div className="text-center py-1">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-nilin-coral" />
                  </div>
                  <span className="font-semibold text-nilin-charcoal">
                    {providerName || 'Provider'}
                  </span>
                </div>
                <p className="text-xs text-nilin-warmGray">Provider Location</p>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination marker */}
        {destinationLocation?.lat && destinationLocation?.lng && (
          <Marker
            position={[destinationLocation.lat, destinationLocation.lng]}
            icon={createDestinationIcon()}
          >
            <Popup>
              <div className="text-center py-1">
                <p className="font-semibold text-nilin-charcoal">Destination</p>
                {destinationAddress && (
                  <p className="text-xs text-nilin-warmGray mt-1">{destinationAddress}</p>
                )}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Auto-fit bounds when map is ready */}
        {isMapReady && bounds && <FitBounds bounds={bounds} />}
      </MapContainer>
    </div>
  );
};

export default TrackingMap;
