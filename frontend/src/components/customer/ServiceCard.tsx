import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Clock, MapPin, TrendingUp, ChevronRight, Heart, Check, Eye, Bell, Sparkles } from 'lucide-react';
import type { Service } from '../../types/service';
import { useAuthStore } from '../../stores/authStore';
import { favoritesApi } from '../../services/favoritesApi';
import { toast } from 'react-hot-toast';
import { usePriceConversion, formatPrice } from '../../utils/priceConverter';
import { useComparisonStore } from '../../stores/comparisonStore';
import { useTilt3D } from '../../hooks/useTilt3D';
import { formatDistance as formatDistanceKm } from '../../lib/utils';

export type { Service };

// N43: Price suffix constant
const PRICE_SUFFIX = '/ service';

// N48: i18n-ready 'by' prefix for provider attribution
const PROVIDER_PREFIX = 'by';

// M21: Extract price extraction to helper
function extractPrice(service: any): number {
  if (typeof service.price === 'number') return service.price;
  if (service.price?.amount != null) return service.price.amount;
  return 0;
}

// M22: Extract rating count extraction
function extractRatingCount(service: any): number {
  return service.reviewCount
    || (service.rating?.count ?? 0)
    || service.reviews?.count
    || 0;
}

interface ServiceCardProps {
  service: Service;
  variant?: 'default' | 'compact' | 'featured';
  onClick?: (service: Service) => void;
  isFavorited?: boolean;
  onFavoriteChange?: (isFavorited: boolean) => void;
  // Additional props for search results
  className?: string;
  showDistance?: boolean;
  onServiceClick?: (service: Service) => void;
  onProviderClick?: (providerId: string) => void;
  onFavorite?: (serviceId: string) => Promise<void>;
  onShare?: (service: Service) => void;
  isFavoriteLoading?: boolean;
  // NEW: Book Now handler for search results
  onBookNow?: (service: Service) => void;
  showBookNow?: boolean;
  // NEW: Quick View handler — opens a modal with full service details
  // without navigating away from the current page.
  onQuickView?: (service: Service) => void;
  // Whether to show the quick view eye button (default: true for default/featured variants)
  showQuickView?: boolean;
  // Bulk select mode props
  showCheckbox?: boolean;
  checked?: boolean;
  onCheck?: (serviceId: string) => void;
  // Notify Me handler for non-active services
  onNotifyMe?: (service: Service) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  variant = 'default',
  onClick,
  isFavorited: initialFavorited = false,
  onFavoriteChange,
  className,
  showDistance,
  onServiceClick,
  onProviderClick,
  onFavorite,
  onShare,
  isFavoriteLoading,
  onBookNow,
  showBookNow = false,
  onQuickView,
  showQuickView = true,
  showCheckbox = false,
  checked = false,
  onCheck,
  onNotifyMe,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const { convert, format, currency } = usePriceConversion();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isToggling, setIsToggling] = useState(false);

  // 3D tilt effect for the default variant (used in search results grid).
  // The hook returns refs + inline styles + mouse handlers we spread onto
  // the default variant's outer wrapper and glow overlay.
  // Only enable on devices that support motion (motion-safe check)
  // Disable for users who prefer reduced motion
  const supportsMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: no-preference)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const {
    cardRef: tiltCardRef,
    glowRef: tiltGlowRef,
    handlers: tiltHandlers,
    cardStyle: tiltCardStyle,
    glowStyle: tiltGlowStyle,
  } = useTilt3D({ enabled: supportsMotion });

  // Comparison store integration
  const isInComparison = useComparisonStore((s) => s.isSelected(service._id));
  const toggleComparison = useComparisonStore((s) => s.toggleService);
  const canAddToComparison = useComparisonStore((s) => s.canAdd);

  const handleToggleCompare = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInComparison && !canAddToComparison) {
      toast.error('You can compare up to 4 services. Remove one to add another.');
      return;
    }
    toggleComparison(service);
  };

  const handleClick = () => {
    if (onClick) {
      onClick(service);
    } else {
      navigate(`/services/${service._id}`);
    }
  };

  const handleBookNow = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onBookNow) {
      onBookNow(service);
    } else {
      navigate(`/book/${service._id}`, { state: { service } });
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: `/services/${service._id}` } });
      return;
    }

    if (isToggling) return;
    setIsToggling(true);

    try {
      // If onFavorite callback is provided (from store), use it
      if (onFavorite) {
        const providerId = service.provider?._id || (service as any).providerId;
        if (!providerId) {
          toast.error('Unable to favorite this service');
          return;
        }
        await onFavorite(providerId);
      } else {
        // Fall back to local API calls
        const providerId = service.provider?._id || (service as any).providerId;
        if (!providerId) {
          toast.error('Unable to favorite this service');
          return;
        }
        if (isFavorited) {
          await favoritesApi.removeFavorite(providerId);
          setIsFavorited(false);
          onFavoriteChange?.(false);
          toast.success('Removed from favorites');
        } else {
          await favoritesApi.addFavorite(providerId);
          setIsFavorited(true);
          onFavoriteChange?.(true);
          toast.success('Added to favorites');
        }
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast.error(err.response?.data?.message || 'Failed to update favorites. Please try again.');
    } finally {
      setIsToggling(false);
    }
  };

  // Extract display values from potentially nested objects
  const displayTitle = service.title || service.name;
  const rawPrice = (service as any).pricing?.currentPrice ?? extractPrice(service);
  const sourceCurrency = typeof service.price === 'object' ? service.price?.currency || 'AED' : 'AED';
  const displayPrice = convert(rawPrice, sourceCurrency);

  // The search API returns `images: string[]` but no derived `image` field.
  // Fall back to the first image so the card always shows a hero photo when
  // the service has one, regardless of which endpoint supplied the data.
  const heroImage = service.image ?? service.images?.[0];

  const displayRating = typeof service.rating === 'number'
    ? service.rating
    : (service.rating?.average || 0);

  const ratingCount = extractRatingCount(service);
  const distance = typeof (service as any).distance === 'number' ? (service as any).distance : null;
  const showDistanceLabel = showDistance && distance !== null && Number.isFinite(distance);

  // NILIN warm gradient backgrounds based on category
  const categoryGradients: Record<string, string> = {
    hair: 'bg-gradient-to-br from-nilin-blush to-nilin-peach',
    makeup: 'bg-gradient-to-br from-nilin-peach to-nilin-blush',
    nails: 'bg-gradient-to-br from-nilin-blush to-nilin-cream',
    'skin & aesthetics': 'bg-gradient-to-br from-nilin-peach to-nilin-blush',
    'massage & body': 'bg-gradient-to-br from-nilin-blush to-nilin-peach',
    'personal care': 'bg-gradient-to-br from-nilin-cream to-nilin-blush',
    default: 'bg-gradient-to-br from-nilin-blush to-nilin-peach',
  };

  // FIX: Added null check to prevent crash when category is undefined
  const gradientClass = categoryGradients[service.category?.toLowerCase() || ''] || categoryGradients.default;

  // Compact variant - for grids and lists
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="w-full min-h-[180px] flex flex-col text-left bg-white rounded-nilin border border-nilin-border overflow-hidden group cursor-pointer
          transition-all duration-300 ease-out
          hover:shadow-nilin-warm hover:-translate-y-1
          active:scale-[0.98]
          focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
      >
        {/* Image Area */}
        <div className={`relative h-28 ${gradientClass} overflow-hidden flex-shrink-0`}>
          {heroImage ? (
            <img
              src={heroImage}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-nilin-blush opacity-60" />
            </div>
          )}

          {/* Rating Badge */}
          {displayRating > 0 && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Star className="h-3 w-3 fill-nilin-coral text-nilin-coral" aria-hidden="true" />
              <span className="text-xs font-semibold text-nilin-charcoal">{displayRating.toFixed(1)}</span>
            </div>
          )}

          {/* Favorite Button */}
          <button
            onClick={handleToggleFavorite}
            aria-label={isFavorited ? "Remove this service from favorites" : "Add this service to favorites"}
            aria-pressed={isFavorited}
            className={`absolute top-2 left-2 p-1.5 rounded-full shadow-sm transition-all ${
              isFavorited
                ? 'bg-nilin-coral text-white'
                : 'bg-white/80 backdrop-blur-sm text-nilin-warmGray hover:bg-white'
            } ${isToggling ? 'opacity-50' : ''} active:scale-[0.95]`}
          >
            <Heart className={`h-3.5 w-3.5 transition-colors duration-200 ${isFavorited ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>

          {/* Book Now Overlay */}
          {showBookNow && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
              <button
                onClick={handleBookNow}
                aria-label={`Book ${displayTitle}`}
                className="px-4 py-2 bg-white text-nilin-rose font-semibold text-sm rounded-full shadow-lg hover:bg-nilin-blush transition-colors"
              >
                Book Now
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-grow">
          <h3 className="font-medium text-nilin-charcoal text-sm mb-1 line-clamp-1 truncate
            group-hover:text-nilin-rose transition-colors duration-300">
            {displayTitle}
          </h3>
          <div className="flex items-center justify-between mt-auto">
            <span className="text-lg font-bold text-nilin-charcoal">
              {format(displayPrice, currency)}
            </span>
            <ChevronRight className="h-4 w-4 text-nilin-lightGray group-hover:translate-x-1 group-hover:text-nilin-rose transition-all duration-300" aria-hidden="true" />
          </div>
        </div>
      </button>
    );
  }

  // Featured variant - larger, more prominent
  if (variant === 'featured') {
    return (
      <div
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }}}
        tabIndex={0}
        role="button"
        className="w-full min-h-[520px] flex flex-col text-left bg-white rounded-2xl border border-nilin-border overflow-hidden group cursor-pointer
          transition-all duration-300 ease-out
          hover:shadow-[0_12px_40px_rgba(232,180,168,0.2)]
          hover:-translate-y-2
          focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
      >
        {/* Image Area */}
        <div className={`relative h-56 ${gradientClass} overflow-hidden flex-shrink-0`}>
          {heroImage ? (
            <img
              src={heroImage}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-nilin-blush opacity-60" />
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            {service.isNew && (
              <span className="bg-nilin-coral text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                NEW
              </span>
            )}
            {service.isFeatured && (
              <span className="bg-nilin-rose text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <TrendingUp className="h-3 w-3" aria-hidden="true" />
                Featured
              </span>
            )}
          </div>

          {/* Rating Badge */}
          {displayRating > 0 && (
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
              <Star className="h-4 w-4 fill-nilin-coral text-nilin-coral" aria-hidden="true" />
              <span className="text-sm font-bold text-nilin-charcoal">{displayRating.toFixed(1)}</span>
              {ratingCount > 0 && (
                <span className="text-xs text-nilin-warmGray">({ratingCount})</span>
              )}
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-nilin-charcoal/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col flex-grow">
          {/* Category Tag */}
          <span className="inline-block px-3 py-1 bg-nilin-muted text-nilin-warmGray text-xs font-medium rounded-lg mb-3 w-fit">
            {service.category}
          </span>

          {/* Title */}
          {/* N50: Featured variant title consistency - line-clamp-1 for single line */}
          <h3 className="font-semibold text-nilin-charcoal text-lg mb-2 line-clamp-1 truncate
            group-hover:text-nilin-rose transition-colors duration-300">
            {displayTitle}
          </h3>

          {/* Description */}
          {/* N49: line-clamp-2 consistency */}
          {service.description && (
            <p className="text-sm text-nilin-warmGray mb-4 line-clamp-2 min-h-[2.5rem]">
              {service.description}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-5 text-sm text-nilin-warmGray mb-4 min-h-[1.5rem]">
            {service.duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-nilin-rose" aria-hidden="true" />
                <span>{service.duration} min</span>
              </div>
            )}
            {showDistanceLabel ? (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-nilin-rose" aria-hidden="true" />
                <span className="truncate">{formatDistanceKm(distance)}</span>
              </div>
            ) : service.provider?.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-nilin-rose" aria-hidden="true" />
                <span className="truncate">{service.provider.location}</span>
              </div>
            )}
          </div>

          {/* Spacer to push footer to bottom */}
          <div className="flex-grow" />

          {/* Price and CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-nilin-border">
            <div>
              {(service.provider || (service as any).providerName) && (
                /* N48: i18n-ready 'by' prefix for provider attribution */
                <p className="text-xs text-nilin-lightGray mb-0.5">
                  <span>{PROVIDER_PREFIX}</span> {service.provider?.businessName || (service as any).providerName || 'Service Provider'}
                </p>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-nilin-charcoal">{format(displayPrice, currency)}</span>
                {/* N51: Use PRICE_SUFFIX constant */}
                <span className="text-xs text-nilin-lightGray">{PRICE_SUFFIX}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              aria-label={`Book ${displayTitle}`}
              className="px-5 py-2.5 bg-nilin-coral text-white font-medium text-sm rounded-xl
                hover:bg-nilin-rose hover:shadow-nilin
                active:scale-95
                transition-all duration-200"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      ref={tiltCardRef}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); }}}
      onMouseEnter={tiltHandlers.onMouseEnter}
      onMouseLeave={tiltHandlers.onMouseLeave}
      tabIndex={0}
      role="button"
      style={tiltCardStyle}
      className="relative w-full min-h-[420px] flex flex-col text-left bg-white rounded-nilin border border-nilin-border group cursor-pointer
        hover:-translate-y-1 hover:shadow-nilin
        focus:outline-none focus:ring-2 focus:ring-nilin-coral/30
        motion-reduce:transition-none motion-reduce:hover:transform motion-reduce:hover:-translate-y-0 motion-reduce:hover:shadow-none"
    >
      {/* 3D glow overlay — radial gradient that follows the cursor. */}
      <div
        ref={tiltGlowRef}
        aria-hidden="true"
        style={tiltGlowStyle}
        className="pointer-events-none absolute inset-0 z-0"
      />

      {/* Image/Gradient Header */}
      <div className={`relative h-48 ${gradientClass}`}>
        {heroImage ? (
          <img
            src={heroImage}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-nilin-blush opacity-60" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-4 flex gap-2">
          {service.isNew && (
            <span className="bg-nilin-coral text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
              NEW
            </span>
          )}
          {service.isFeatured && (
            <span className="bg-nilin-rose text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              Featured
            </span>
          )}
        </div>

        {/* Rating Badge */}
        {displayRating > 0 && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <Star className="h-4 w-4 fill-nilin-coral text-nilin-coral" aria-hidden="true" />
            <span className="text-sm font-semibold text-nilin-charcoal">{displayRating.toFixed(1)}</span>
            {ratingCount > 0 && (
              <span className="text-xs text-nilin-warmGray">({ratingCount})</span>
            )}
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          aria-label={isFavorited ? "Remove this service from favorites" : "Add this service to favorites"}
          aria-pressed={isFavorited}
          className={`absolute top-3 left-3 p-2 rounded-full shadow-sm transition-all ${
            isFavorited
              ? 'bg-nilin-coral text-white'
              : 'bg-white/80 backdrop-blur-sm text-nilin-warmGray hover:bg-white'
          } ${isToggling ? 'opacity-50' : ''} active:scale-[0.95]`}
        >
          <Heart className={`h-4 w-4 transition-colors duration-200 ${isFavorited ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>

        {/* Compare Checkbox */}
        <button
          onClick={handleToggleCompare}
          aria-label={isInComparison ? `Remove ${displayTitle} from comparison` : `Add ${displayTitle} to comparison`}
          aria-pressed={isInComparison}
          className={`absolute bottom-3 right-3 w-7 h-7 rounded-full border-2 shadow-sm flex items-center justify-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 z-10 ${
            isInComparison
              ? 'bg-nilin-coral border-nilin-coral text-white'
              : 'bg-white/90 border-nilin-border text-nilin-warmGray/40 hover:border-nilin-coral'
          }`}
        >
          <Check className={`w-4 h-4 transition-transform duration-200 ${isInComparison ? 'scale-110' : ''}`} strokeWidth={3} aria-hidden="true" />
        </button>

        {/* Bulk Select Checkbox */}
        {showCheckbox && (
          <div
            className="absolute top-3 right-3 z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                e.stopPropagation();
                onCheck?.(service._id);
              }}
              aria-label={`Select ${displayTitle} for comparison`}
              className="w-6 h-6 rounded border-2 border-white bg-white/90 shadow-sm cursor-pointer
                checked:bg-nilin-coral checked:border-nilin-coral
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                transition-all duration-200"
            />
          </div>
        )}

        {/* Quick View Button */}
        {showQuickView && onQuickView && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickView(service); }}
            aria-label={`Quick view of ${displayTitle}`}
            className="absolute bottom-3 left-3 w-7 h-7 rounded-full bg-white/90 border border-nilin-border shadow-sm
              flex items-center justify-center text-nilin-warmGray
              hover:bg-nilin-blush hover:text-nilin-coral hover:border-nilin-coral
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1
              active:scale-[0.95] transition-all opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 z-20"
          >
            <Eye className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Category Tag */}
        <span className="inline-block px-2.5 py-1 bg-nilin-muted text-nilin-warmGray text-xs font-medium rounded-lg mb-2 w-fit">
          {service.category}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-nilin-charcoal mb-2 line-clamp-1
          group-hover:text-nilin-rose transition-colors duration-300">
          {displayTitle}
        </h3>

        {/* Description */}
        {service.description && (
          <p className="text-sm text-nilin-warmGray mb-3 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-nilin-warmGray mb-3 min-h-[1.5rem]">
          {service.duration && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-nilin-rose" aria-hidden="true" />
              <span>{service.duration} min</span>
            </div>
          )}
          {showDistanceLabel ? (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-nilin-rose" aria-hidden="true" />
              <span className="truncate">{formatDistanceKm(distance)}</span>
            </div>
          ) : service.provider?.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-nilin-rose" aria-hidden="true" />
              <span className="truncate">{service.provider.location}</span>
            </div>
          )}
        </div>

        {/* Spacer to push footer to bottom */}
        <div className="flex-grow" />

        {/* Price and Provider */}
        <div className="flex items-center justify-between pt-3 border-t border-nilin-border">
          <div>
            {(service.provider || (service as any).providerName) && (
              /* N48: i18n-ready 'by' prefix for provider attribution */
              <p className="text-xs text-nilin-lightGray mb-0.5">
                <span>{PROVIDER_PREFIX}</span> {service.provider?.businessName || (service as any).providerName || 'Service Provider'}
              </p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-nilin-charcoal">{format(displayPrice, currency)}</span>
              {/* N51: Use PRICE_SUFFIX constant */}
              <span className="text-xs text-nilin-lightGray">{PRICE_SUFFIX}</span>
            </div>
          </div>
          {service.status !== 'active' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNotifyMe?.(service);
              }}
              aria-label={`Notify me when ${displayTitle} is available`}
              className="flex items-center gap-1.5 px-4 py-2 bg-nilin-muted text-nilin-warmGray font-medium text-sm rounded-nilin
                hover:bg-nilin-blush hover:text-nilin-coral
                active:scale-95
                transition-all duration-200"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              Notify Me
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleBookNow(e);
              }}
              aria-label={`Book ${displayTitle}`}
              className="px-4 py-2 bg-nilin-coral text-white font-medium text-sm rounded-nilin
                hover:bg-nilin-rose hover:shadow-nilin
                active:scale-95
                transition-all duration-200"
            >
              Book
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
