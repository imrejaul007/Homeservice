import React, { useState, useRef, useEffect, memo } from 'react';
import { cn } from '@/lib/utils';

export type ImageSize = 'thumbnail' | 'card' | 'hero' | 'full';
export type ImageSizeConfig = {
  thumbnail: string;
  card: string;
  hero: string;
};

interface OptimizedImageProps {
  /** Primary image source */
  src: string;
  /** Fallback source when primary fails */
  fallbackSrc?: string;
  /** Image alt text (required for accessibility) */
  alt: string;
  /** Image size preset for srcset generation */
  size?: ImageSize;
  /** Custom sizes attribute for srcset (overrides preset) */
  sizes?: string;
  /** CSS class name */
  className?: string;
  /** Aspect ratio for container (e.g., "aspect-[4/3]", "aspect-square") */
  aspectRatio?: string;
  /** Show blur placeholder while loading */
  blurPlaceholder?: boolean;
  /** Priority loading (disables lazy loading for above-fold images) */
  priority?: boolean;
  /** Fit mode for object-fit */
  fit?: 'cover' | 'contain' | 'fill';
  /** Additional wrapper styles */
  wrapperClassName?: string;
  /** Callback when image loads */
  onLoad?: () => void;
  /** Callback when image errors */
  onError?: (error: string) => void;
  /** Children to render on top (badges, overlays, etc.) */
  children?: React.ReactNode;
  /** Badge text to display */
  badge?: string;
  /** Badge class override */
  badgeClassName?: string;
  /** Test ID for testing */
  'data-testid'?: string;
}

// Widths for responsive srcset generation
const SRCSET_WIDTHS = {
  thumbnail: [300, 400],
  card: [400, 600, 800],
  hero: [800, 1200, 1600, 1920],
  full: [600, 800, 1200, 1600],
};

// Quality settings per size
const QUALITY_MAP = {
  thumbnail: 70,
  card: 80,
  hero: 85,
  full: 80,
};

/**
 * Generate srcset string for responsive images
 * Supports Unsplash URLs with size parameters
 */
function generateSrcSet(src: string, size: ImageSize): string {
  // Skip srcset for non-Unsplash URLs or data URLs
  if (!src.includes('unsplash.com') || src.includes('source=')) {
    return '';
  }

  const widths = SRCSET_WIDTHS[size];
  const quality = QUALITY_MAP[size];

  // Remove existing width/quality params from URL
  const baseUrl = src.split('?')[0];

  return widths
    .map((w) => `${baseUrl}?w=${w}&q=${quality}&fit=crop ${w}w`)
    .join(', ');
}

/**
 * Extracts URL without existing query params for cache-busting
 */
function getCleanUrl(src: string): string {
  return src.includes('?') ? `${src.split('?')[0]}?${src.split('?')[1]}` : src;
}

/**
 * OptimizedImage - A performant image component with lazy loading and responsive srcset
 *
 * Features:
 * - Lazy loading by default (except when priority=true)
 * - Automatic srcset generation for responsive images (Unsplash only)
 * - Blur placeholder effect for smooth loading experience
 * - Error handling with optional fallback image
 * - Support for badges and overlays
 * - Accessible by default (requires alt text)
 */
const OptimizedImage: React.FC<OptimizedImageProps> = memo(function OptimizedImage({
  src,
  fallbackSrc,
  alt,
  size = 'card',
  sizes,
  className,
  aspectRatio,
  blurPlaceholder = true,
  priority = false,
  fit = 'cover',
  wrapperClassName,
  onLoad,
  onError,
  children,
  badge,
  badgeClassName = 'bg-nilin-coral text-white',
  'data-testid': testId,
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset state when src changes
  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
    setCurrentSrc(src);
  }, [src]);

  // Check if image is already cached
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    // Try fallback if available
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(false);
    } else {
      onError?.('Image failed to load');
    }
  };

  const srcSet = generateSrcSet(src, size);
  const sizesAttr = sizes || `(max-width: 640px) 100vw, (max-width: 1024px) 50vw, ${size === 'hero' ? '100vw' : '33vw'}`;

  const fitClasses = {
    cover: 'object-cover',
    contain: 'object-contain',
    fill: 'object-fill',
  };

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        aspectRatio,
        wrapperClassName
      )}
      data-testid={testId}
    >
      {/* Blur placeholder */}
      {blurPlaceholder && !isLoaded && !hasError && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse"
          style={{
            backgroundImage: `url(${currentSrc}&blur=50&w=20)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(10px)',
            transform: 'scale(1.1)', // Prevent blur edges showing
          }}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={currentSrc}
        srcSet={srcSet || undefined}
        sizes={sizesAttr}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        fetchpriority={priority ? 'high' : undefined}
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          'w-full h-full transition-opacity duration-300',
          fitClasses[fit],
          isLoaded ? 'opacity-100' : 'opacity-0',
          className
        )}
      />

      {/* Error placeholder */}
      {hasError && !fallbackSrc && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Image unavailable</span>
        </div>
      )}

      {/* Badge */}
      {badge && (
        <span
          className={cn(
            'absolute top-3 left-3 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm',
            badgeClassName
          )}
        >
          {badge}
        </span>
      )}

      {/* Children (overlays, additional badges, etc.) */}
      {children && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="pointer-events-auto">
            {children}
          </div>
        </div>
      )}
    </div>
  );
});

export default OptimizedImage;
