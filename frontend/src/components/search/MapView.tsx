import React, { useMemo, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Service } from '../../types/search';
import { createNILINMarkerIcon, userLocationIcon, createClusterIcon } from '../../lib/mapIcons';
import MapSearchCard from './MapSearchCard';
import { useLocationStore } from '../../stores/locationStore';

interface MapViewProps {
  services: Service[];
  onViewDetails: (service: Service) => void;
  onBookNow: (service: Service) => void;
  height?: string;
  isMobileCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Clustering configuration
const CLUSTER_LAT_THRESHOLD = 0.008; // ~1km at Dubai latitude
const CLUSTER_LNG_THRESHOLD = 0.008;

interface Cluster {
  lat: number;
  lng: number;
  count: number;
  services: Array<{ service: Service; coords: { lat: number; lng: number } }>;
}

/**
 * Extract coordinates from a service (handles GeoJSON [lng, lat] format).
 * Returns { lat, lng } or null if no valid coordinates.
 */
function getServiceCoords(service: Service): { lat: number; lng: number } | null {
  const coords = service.location?.coordinates?.coordinates;
  if (Array.isArray(coords) && coords.length === 2) {
    const [lng, lat] = coords;
    if (typeof lat === 'number' && typeof lng === 'number' && lat !== 0 && lng !== 0) {
      return { lat, lng };
    }
  }
  return null;
}

/**
 * Inner component that auto-fits map bounds to all markers.
 */
const FitBounds: React.FC<{ bounds: L.LatLngBoundsExpression | null }> = ({ bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      try {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
      } catch (e) {
        // Ignore bounds errors
      }
    }
  }, [bounds, map]);

  return null;
};

/**
 * Cluster nearby markers together based on proximity threshold.
 */
function clusterMarkers(
  markers: Array<{ service: Service; coords: { lat: number; lng: number } }>
): Cluster[] {
  const clusters: Cluster[] = [];

  for (const marker of markers) {
    // Find a nearby cluster
    const nearbyCluster = clusters.find(
      (c) =>
        Math.abs(c.lat - marker.coords.lat) < CLUSTER_LAT_THRESHOLD &&
        Math.abs(c.lng - marker.coords.lng) < CLUSTER_LNG_THRESHOLD
    );

    if (nearbyCluster) {
      nearbyCluster.count++;
      nearbyCluster.services.push(marker);
      // Update cluster center to average
      nearbyCluster.lat = (nearbyCluster.lat * (nearbyCluster.count - 1) + marker.coords.lat) / nearbyCluster.count;
      nearbyCluster.lng = (nearbyCluster.lng * (nearbyCluster.count - 1) + marker.coords.lng) / nearbyCluster.count;
    } else {
      clusters.push({
        lat: marker.coords.lat,
        lng: marker.coords.lng,
        count: 1,
        services: [marker],
      });
    }
  }

  return clusters;
}

/**
 * Map view of search results using OpenStreetMap tiles.
 * Shows services and user location with NILIN-branded markers.
 * Supports marker clustering for dense areas.
 */
const MapView: React.FC<MapViewProps> = ({
  services,
  onViewDetails,
  onBookNow,
  height = '600px',
  isMobileCollapsed = false,
  onToggleCollapse,
}) => {
  const userLocation = useLocationStore((s) => s.currentLocation);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);

  // Build valid markers list
  const markers = useMemo(() => {
    return services
      .map((service) => {
        const coords = getServiceCoords(service);
        return coords ? { service, coords } : null;
      })
      .filter((m): m is { service: Service; coords: { lat: number; lng: number } } => m !== null);
  }, [services]);

  // Cluster markers when there are many nearby
  const clusters = useMemo(() => {
    if (markers.length <= 1) return null;
    return clusterMarkers(markers);
  }, [markers]);

  const hasClusters = clusters !== null && clusters.some((c) => c.count > 1);
  const displayItems = hasClusters ? clusters : markers;

  // Calculate bounds - with validation to prevent undefined coordinates
  const bounds = useMemo<L.LatLngBoundsExpression | null>(() => {
    if (markers.length === 0) return null;
    const points: [number, number][] = markers.map((m) => [m.coords.lat, m.coords.lng]);
    // Guard against undefined or invalid user location coordinates
    if (userLocation?.coordinates &&
        typeof userLocation.coordinates.lat === 'number' &&
        typeof userLocation.coordinates.lng === 'number') {
      points.push([userLocation.coordinates.lat, userLocation.coordinates.lng]);
    }
    return points as L.LatLngBoundsExpression;
  }, [markers, userLocation]);

  // Determine initial center - with validation to prevent undefined lat/lng
  const center: [number, number] = useMemo(() => {
    // Guard against undefined or invalid coordinates
    if (userLocation?.coordinates &&
        typeof userLocation.coordinates.lat === 'number' &&
        typeof userLocation.coordinates.lng === 'number') {
      return [userLocation.coordinates.lat, userLocation.coordinates.lng];
    }
    if (markers.length > 0) {
      return [markers[0].coords.lat, markers[0].coords.lng];
    }
    // Default: Dubai
    return [25.2048, 55.2708];
  }, [markers, userLocation]);

  // Expanded cluster markers for popup
  const expandedClusterMarkers = useMemo(() => {
    if (!expandedCluster || !clusters) return [];
    const cluster = clusters.find(
      (c) => `${c.lat.toFixed(4)}-${c.lng.toFixed(4)}` === expandedCluster
    );
    return cluster?.services || [];
  }, [expandedCluster, clusters]);

  // Guard: ensure center is valid before rendering map
  const hasValidCenter = Array.isArray(center) &&
    center.length === 2 &&
    typeof center[0] === 'number' &&
    typeof center[1] === 'number' &&
    !Number.isNaN(center[0]) &&
    !Number.isNaN(center[1]);

  if (markers.length === 0 || !hasValidCenter) {
    return (
      <div
        className="flex items-center justify-center bg-nilin-muted rounded-2xl border border-nilin-blush/40"
        style={{ height }}
      >
        <div className="text-center p-8">
          <p className="text-nilin-warmGray text-sm">
            {markers.length === 0
              ? 'No services with location data to display on the map.'
              : 'Loading map location...'}
          </p>
        </div>
      </div>
    );
  }

  const containerClasses = isMobileCollapsed
    ? 'h-16 rounded-b-2xl'
    : 'rounded-2xl';

  return (
    <div className={containerClasses} style={{ height: isMobileCollapsed ? undefined : height }}>
      <div
        className="relative overflow-hidden border border-nilin-blush/40 shadow-nilin w-full"
        style={{ height: isMobileCollapsed ? '100%' : '100%' }}
      >
        <MapContainer
          center={center}
          zoom={11}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%', display: isMobileCollapsed ? 'none' : 'block' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {bounds && <FitBounds bounds={bounds} />}

          {/* User location marker - with validation */}
          {Boolean(
            userLocation?.coordinates &&
            typeof userLocation.coordinates.lat === 'number' &&
            typeof userLocation.coordinates.lng === 'number'
          ) && (
            <Marker
              position={[userLocation.coordinates.lat, userLocation.coordinates.lng]}
              icon={userLocationIcon()}
            >
              <Popup>
                <div className="text-center font-sans">
                  <p className="font-semibold text-nilin-charcoal">Your location</p>
                  {userLocation.address?.city && (
                    <p className="text-xs text-nilin-warmGray">{userLocation.address.city}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {/* Cluster or individual markers */}
          {hasClusters && clusters
            ? clusters.map((cluster, idx) => {
                const clusterKey = `${cluster.lat.toFixed(4)}-${cluster.lng.toFixed(4)}`;
                if (cluster.count === 1) {
                  const { service, coords } = cluster.services[0];
                  const price =
                    (service as any).pricing?.currentPrice ??
                    (typeof service.price === 'number' ? service.price : service.price?.amount ?? 0);
                  const currency = typeof service.price === 'object' ? service.price?.currency || 'AED' : 'AED';
                  const label = price > 0 ? `${currency} ${Math.round(price)}` : '★';

                  return (
                    <Marker
                      key={`single-${clusterKey}`}
                      position={[coords.lat, coords.lng]}
                      icon={createNILINMarkerIcon(label)}
                    >
                      <Popup maxWidth={280} minWidth={260}>
                        <MapSearchCard
                          service={service}
                          onViewDetails={onViewDetails}
                          onBookNow={onBookNow}
                        />
                      </Popup>
                    </Marker>
                  );
                }

                return (
                  <Marker
                    key={`cluster-${clusterKey}`}
                    position={[cluster.lat, cluster.lng]}
                    icon={createClusterIcon(cluster.count)}
                    eventHandlers={{
                      click: () => setExpandedCluster(clusterKey),
                    }}
                  >
                    <Popup maxWidth={300}>
                      <div className="font-sans">
                        <p className="font-semibold text-nilin-charcoal mb-2">
                          {cluster.count} services in this area
                        </p>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {cluster.services.slice(0, 5).map(({ service }) => {
                            const price =
                              (service as any).pricing?.currentPrice ??
                              (typeof service.price === 'number' ? service.price : service.price?.amount ?? 0);
                            const currency = typeof service.price === 'object' ? service.price?.currency || 'AED' : 'AED';
                            return (
                              <div
                                key={service._id}
                                className="flex items-center justify-between gap-2 p-2 hover:bg-nilin-muted rounded-lg cursor-pointer"
                                onClick={() => onViewDetails(service)}
                              >
                                <span className="text-sm text-nilin-charcoal truncate">{service.name}</span>
                                <span className="text-xs font-medium text-nilin-coral">
                                  {currency} {Math.round(price)}
                                </span>
                              </div>
                            );
                          })}
                          {cluster.services.length > 5 && (
                            <p className="text-xs text-nilin-warmGray text-center">
                              +{cluster.services.length - 5} more services
                            </p>
                          )}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })
            : markers.map(({ service, coords }) => {
                const price =
                  (service as any).pricing?.currentPrice ??
                  (typeof service.price === 'number' ? service.price : service.price?.amount ?? 0);
                const currency = typeof service.price === 'object' ? service.price?.currency || 'AED' : 'AED';
                const label = price > 0 ? `${currency} ${Math.round(price)}` : '★';

                return (
                  <Marker
                    key={service._id}
                    position={[coords.lat, coords.lng]}
                    icon={createNILINMarkerIcon(label)}
                  >
                    <Popup maxWidth={280} minWidth={260}>
                      <MapSearchCard
                        service={service}
                        onViewDetails={onViewDetails}
                        onBookNow={onBookNow}
                      />
                    </Popup>
                  </Marker>
                );
              })}
        </MapContainer>

        {/* Mobile collapse toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="absolute bottom-3 right-3 z-[70] lg:hidden bg-white/95 backdrop-blur-sm p-2.5 rounded-full shadow-nilin text-nilin-charcoal hover:bg-nilin-muted transition-colors"
            aria-label={isMobileCollapsed ? 'Show map' : 'Hide map'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isMobileCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        )}

        {/* Result count badge */}
        <div className="absolute top-3 left-3 z-[70] bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-nilin text-xs font-medium text-nilin-charcoal">
          {markers.length} {markers.length === 1 ? 'service' : 'services'} on map
          {hasClusters && ` (${clusters.filter((c) => c.count > 1).length} clusters)`}
        </div>
      </div>
    </div>
  );
};

export default MapView;
