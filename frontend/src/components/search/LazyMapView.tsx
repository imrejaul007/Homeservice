import React, { Suspense, lazy, Component, ReactNode, useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import type { Service } from '../../types/search';

const MapView = lazy(() => import('./MapView'));

interface LazyMapViewProps {
  services: Service[];
  onViewDetails: (service: Service) => void;
  onBookNow: (service: Service) => void;
  height?: string;
  isMobileCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Simple error boundary for map loading failures
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

const MapErrorFallback = ({ retry }: { retry?: () => void }) => (
  <div className="flex flex-col items-center justify-center h-full bg-nilin-muted rounded-2xl border border-nilin-blush/30 p-8 text-center">
    <MapPin className="w-12 h-12 text-nilin-warmGray mb-4" />
    <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Unable to load map</h3>
    <p className="text-sm text-nilin-warmGray mb-4">Try viewing as list instead</p>
    {retry && (
      <button onClick={retry} className="px-4 py-2 bg-nilin-coral text-white rounded-xl text-sm font-medium">
        Try Again
      </button>
    )}
  </div>
);

class MapErrorBoundary extends Component<{ children: ReactNode; height?: string }, ErrorBoundaryState> {
  constructor(props: { children: ReactNode; height?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  retry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex flex-col items-center justify-center bg-nilin-muted rounded-2xl border border-nilin-blush/30"
          style={{ height: this.props.height || '600px' }}
        >
          <MapErrorFallback retry={this.retry} />
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Responsive height hook - returns different heights for mobile/desktop.
 */
function useResponsiveMapHeight(height?: string): string {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // If custom height is provided, use it
  if (height) return height;

  // Responsive default: smaller on mobile, taller on desktop
  return isMobile ? '50vh' : '600px';
}

/**
 * Lazy-loaded wrapper around MapView to avoid loading Leaflet
 * (~40KB gzipped) until the user switches to Map view mode.
 */
const LazyMapView: React.FC<LazyMapViewProps> = (props) => {
  const responsiveHeight = useResponsiveMapHeight(props.height);

  return (
    <MapErrorBoundary height={responsiveHeight}>
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center bg-nilin-muted rounded-2xl border border-nilin-border"
            style={{ height: responsiveHeight }}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-nilin-coral border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-nilin-warmGray">Loading map…</p>
            </div>
          </div>
        }
      >
        <MapView
          {...props}
          height={responsiveHeight}
          isMobileCollapsed={props.isMobileCollapsed}
          onToggleCollapse={props.onToggleCollapse}
        />
      </Suspense>
    </MapErrorBoundary>
  );
};

export default LazyMapView;
