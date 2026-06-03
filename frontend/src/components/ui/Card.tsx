import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { Heart, Star, Clock, MapPin, ArrowRight, BadgeCheck } from 'lucide-react';
import { FadeSection } from './FadeSection';

// =============================================================================
// NILIN Design System - Card Components
// Interactive cards with hover states, loading, and empty states
// =============================================================================

// =============================================================================
// Service Card - For displaying services in grids/lists
// =============================================================================

export interface ServiceCardConfig {
  _id: string;
  name: string;
  category?: string;
  rating?: {
    average: number;
    count: number;
  };
  duration?: number;
  price?: {
    amount: number;
  };
  images?: string[];
  provider?: {
    name?: string;
    verified?: boolean;
  };
  featured?: boolean;
  location?: {
    city?: string;
    area?: string;
  };
}

interface ServiceCardProps {
  service: ServiceCardConfig;
  /** Click handler */
  onClick: (id: string) => void;
  /** Favorite toggle handler */
  onFavorite?: (id: string) => void;
  /** Whether this service is favorited */
  isFavorited?: boolean;
  /** Image source getter */
  getImage?: (service: ServiceCardConfig) => string;
  /** Default fallback image */
  fallbackImage?: string;
  /** Card layout variant */
  variant?: 'list' | 'grid' | 'compact';
  /** Animation delay index */
  index?: number;
  /** Show provider info */
  showProvider?: boolean;
  /** Show location */
  showLocation?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Custom class name */
  className?: string;
}

// Default image getter
const defaultGetImage = (service: ServiceCardConfig): string => {
  if (service.images?.[0]) return service.images[0];
  const catSlug = service.category?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
  return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop';
};

const defaultFallbackImage = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop';

/**
 * ServiceCard - Interactive service display card
 *
 * Supports multiple layouts: list (horizontal), grid (vertical), compact
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onClick,
  onFavorite,
  isFavorited = false,
  getImage = defaultGetImage,
  fallbackImage = defaultFallbackImage,
  variant = 'list',
  index = 0,
  showProvider = false,
  showLocation = false,
  loading = false,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageSrc = imageError ? fallbackImage : getImage(service);

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-nilin-border/50 bg-white/60 overflow-hidden',
          variant === 'list' && 'flex',
          className
        )}
      >
        <div className="bg-nilin-blush animate-pulse" style={{ width: variant === 'list' ? 80 : '100%', height: variant === 'list' ? 80 : 160 }} />
        <div className="p-4 flex-1 space-y-3">
          <div className="h-5 bg-nilin-blush rounded animate-pulse w-3/4" />
          <div className="h-4 bg-nilin-blush rounded animate-pulse w-1/2" />
          <div className="h-4 bg-nilin-blush rounded animate-pulse w-1/4" />
        </div>
      </div>
    );
  }

  // List variant
  if (variant === 'list') {
    return (
      <FadeSection delay={index * 75}>
        <div
          onClick={() => onClick(service._id)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className={cn(
            'flex items-center gap-4 p-4 rounded-2xl border border-nilin-border/50',
            'bg-white/60 backdrop-blur-md',
            'hover:bg-white hover:shadow-nilin-lg hover:-translate-y-0.5',
            'transition-all duration-300 cursor-pointer group',
            className
          )}
        >
          {/* Image */}
          <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
            <img
              src={imageSrc}
              alt={service.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />

            {/* Favorite button */}
            {onFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite(service._id);
                }}
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm
                           flex items-center justify-center
                           opacity-0 group-hover:opacity-100
                           transition-all duration-200 hover:bg-white hover:scale-110"
                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isFavorited ? 'text-nilin-coral fill-nilin-coral' : 'text-nilin-warmGray'
                  )}
                />
              </button>
            )}

            {/* Featured badge */}
            {service.featured && (
              <span className="absolute top-1.5 left-1.5 px-2 py-0.5 bg-nilin-coral text-white text-xs rounded-full font-medium">
                Featured
              </span>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-nilin-charcoal text-sm line-clamp-1
                           group-hover:text-nilin-coral transition-colors">
              {service.name}
            </h3>

            {/* Rating and duration */}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-nilin-warmGray">
              <span className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span className="font-medium text-amber-700">
                  {service.rating?.average?.toFixed(1) || '4.8'}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {service.duration || 60} min
              </span>
            </div>

            {/* Provider */}
            {showProvider && service.provider && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-xs text-nilin-warmGray">
                  by {service.provider.name || 'Professional'}
                </span>
                {service.provider.verified && (
                  <BadgeCheck className="w-3.5 h-3.5 text-nilin-success" />
                )}
              </div>
            )}

            {/* Category badge */}
            {service.category && (
              <span className="inline-block mt-2 px-2 py-0.5 bg-nilin-blush/60 text-nilin-rose text-xs rounded-full">
                {service.category}
              </span>
            )}
          </div>

          {/* Price and arrow */}
          <div className="text-right flex-shrink-0">
            <div className="font-bold text-nilin-charcoal">
              AED {service.price?.amount || 199}
            </div>
            <div className="text-xs text-nilin-warmGray">per session</div>
            <ArrowRight
              className="hidden group-hover:flex w-4 h-4 text-nilin-coral mt-2 mx-auto
                         group-hover:translate-x-1 transition-all duration-200"
            />
          </div>
        </div>
      </FadeSection>
    );
  }

  // Grid variant
  return (
    <FadeSection delay={index * 100}>
      <div
        onClick={() => onClick(service._id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          'rounded-2xl border border-nilin-border/50 bg-white/60 overflow-hidden',
          'hover:bg-white hover:shadow-nilin-lg hover:-translate-y-1',
          'transition-all duration-300 cursor-pointer group',
          className
        )}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={imageSrc}
            alt={service.name}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />

          {/* Favorite button */}
          {onFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(service._id);
              }}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm
                         flex items-center justify-center
                         opacity-0 group-hover:opacity-100
                         transition-all duration-200 hover:bg-white hover:scale-110"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={cn(
                  'w-5 h-5 transition-colors',
                  isFavorited ? 'text-nilin-coral fill-nilin-coral' : 'text-nilin-warmGray'
                )}
              />
            </button>
          )}

          {/* Featured badge */}
          {service.featured && (
            <span className="absolute top-3 left-3 px-2.5 py-1 bg-nilin-coral text-white text-xs rounded-full font-medium">
              Featured
            </span>
          )}

          {/* Location */}
          {showLocation && service.location && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2.5 py-1 bg-black/50 backdrop-blur-sm text-white text-xs rounded-full">
              <MapPin className="w-3 h-3" />
              {service.location.area || service.location.city || 'Nearby'}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-nilin-charcoal line-clamp-1
                         group-hover:text-nilin-coral transition-colors">
            {service.name}
          </h3>

          {/* Rating and reviews */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="font-medium text-amber-700 text-xs">
                {service.rating?.average?.toFixed(1) || '4.8'}
              </span>
            </span>
            <span className="text-xs text-nilin-warmGray">
              ({service.rating?.count || 127} reviews)
            </span>
          </div>

          {/* Provider and category */}
          <div className="flex items-center justify-between mt-3">
            {service.category && (
              <span className="px-2 py-0.5 bg-nilin-blush/60 text-nilin-rose text-xs rounded-full">
                {service.category}
              </span>
            )}
            <span className="flex items-center gap-1 text-nilin-warmGray text-xs">
              <Clock className="w-3 h-3" />
              {service.duration || 60} min
            </span>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-nilin-border/30">
            <div>
              <span className="font-bold text-nilin-charcoal text-lg">
                AED {service.price?.amount || 199}
              </span>
              <span className="text-xs text-nilin-warmGray ml-1">per session</span>
            </div>
            <ArrowRight
              className="w-5 h-5 text-nilin-coral opacity-0 group-hover:opacity-100
                         group-hover:translate-x-1 transition-all duration-200"
            />
          </div>
        </div>
      </div>
    </FadeSection>
  );
};

// =============================================================================
// Compact Service Card - For horizontal scrolling lists
// =============================================================================

interface CompactServiceCardProps {
  service: ServiceCardConfig;
  onClick: (id: string) => void;
  getImage?: (service: ServiceCardConfig) => string;
  fallbackImage?: string;
}

export const CompactServiceCard: React.FC<CompactServiceCardProps> = ({
  service,
  onClick,
  getImage = defaultGetImage,
  fallbackImage = defaultFallbackImage,
}) => {
  const [imageError, setImageError] = useState(false);

  return (
    <button
      onClick={() => onClick(service._id)}
      className="flex-shrink-0 w-36 rounded-xl border border-nilin-border/50 bg-white/60
                 overflow-hidden hover:shadow-nilin-md hover:-translate-y-0.5
                 transition-all duration-200 text-left group"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden">
        <img
          src={imageError ? fallbackImage : getImage(service)}
          alt={service.name}
          onError={() => setImageError(true)}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      </div>

      {/* Content */}
      <div className="p-2.5">
        <h4 className="font-medium text-nilin-charcoal text-sm line-clamp-1
                       group-hover:text-nilin-coral transition-colors">
          {service.name}
        </h4>
        <div className="flex items-center gap-1 mt-1">
          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span className="text-xs text-nilin-warmGray">
            {service.rating?.average?.toFixed(1) || '4.8'}
          </span>
        </div>
        <p className="font-semibold text-nilin-charcoal text-sm mt-1">
          AED {service.price?.amount || 199}
        </p>
      </div>
    </button>
  );
};

// =============================================================================
// Provider Card - For displaying provider info
// =============================================================================

interface ProviderCardConfig {
  _id: string;
  name: string;
  avatar?: string;
  rating?: {
    average: number;
    count: number;
  };
  services?: number;
  verified?: boolean;
  specialties?: string[];
}

interface ProviderCardProps {
  provider: ProviderCardConfig;
  onClick: (id: string) => void;
  onFavorite?: (id: string) => void;
  isFavorited?: boolean;
  variant?: 'default' | 'compact';
}

export const ProviderCard: React.FC<ProviderCardProps> = ({
  provider,
  onClick,
  onFavorite,
  isFavorited = false,
  variant = 'default',
}) => {
  return (
    <div
      onClick={() => onClick(provider._id)}
      className={cn(
        'rounded-2xl border border-nilin-border/50 bg-white/60 backdrop-blur-md',
        'hover:bg-white hover:shadow-nilin-lg hover:-translate-y-0.5',
        'transition-all duration-300 cursor-pointer group',
        variant === 'compact' ? 'p-3' : 'p-4'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={cn(
          'relative rounded-full overflow-hidden flex-shrink-0',
          variant === 'compact' ? 'w-12 h-12' : 'w-16 h-16'
        )}>
          <img
            src={provider.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(provider.name)}&background=E8B4A8&color=fff`}
            alt={provider.name}
            className="w-full h-full object-cover"
          />
          {provider.verified && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-nilin-success rounded-full flex items-center justify-center border-2 border-white">
              <BadgeCheck className="w-3 h-3 text-white" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-nilin-charcoal text-sm truncate
                           group-hover:text-nilin-coral transition-colors">
              {provider.name}
            </h3>
          </div>

          {/* Rating */}
          {provider.rating && (
            <div className="flex items-center gap-1 mt-0.5">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-xs font-medium text-nilin-charcoal">
                {provider.rating.average.toFixed(1)}
              </span>
              <span className="text-xs text-nilin-warmGray">
                ({provider.rating.count} reviews)
              </span>
            </div>
          )}

          {/* Services count */}
          {provider.services !== undefined && (
            <p className="text-xs text-nilin-warmGray mt-0.5">
              {provider.services} services
            </p>
          )}

          {/* Specialties */}
          {provider.specialties && provider.specialties.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {provider.specialties.slice(0, 2).map((specialty, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 bg-nilin-blush/60 text-nilin-rose text-xs rounded-full"
                >
                  {specialty}
                </span>
              ))}
              {provider.specialties.length > 2 && (
                <span className="px-2 py-0.5 bg-nilin-blush/60 text-nilin-warmGray text-xs rounded-full">
                  +{provider.specialties.length - 2}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Favorite button */}
        {onFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onFavorite(provider._id);
            }}
            className="p-2 rounded-full hover:bg-nilin-blush/50 transition-colors"
          >
            <Heart
              className={cn(
                'w-5 h-5 transition-colors',
                isFavorited ? 'text-nilin-coral fill-nilin-coral' : 'text-nilin-warmGray'
              )}
            />
          </button>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export {
  ServiceCard,
  CompactServiceCard,
  ProviderCard,
};
export default ServiceCard;
