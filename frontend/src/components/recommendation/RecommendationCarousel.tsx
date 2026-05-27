import React, { useRef, useState, useCallback, useMemo } from 'react';
import {
  ChevronRight,
  Star,
  MapPin,
  Image as ImageIcon,
  Search,
  CheckCircle,
  Clock,
} from 'lucide-react';
import type { ServiceRecommendation } from '@/hooks/useRecommendations';
import { useRecommendationFeedback } from '@/hooks/useRecommendations';

// =============================================================================
// Types
// =============================================================================

interface RecommendationCarouselProps {
  recommendations: ServiceRecommendation[];
  title?: string;
  subtitle?: string;
  onSeeAll?: () => void;
  emptyMessage?: string;
  showMatchFactors?: boolean;
  horizontal?: boolean;
  maxVisible?: number;
  testID?: string;
}

interface CarouselItemProps {
  recommendation: ServiceRecommendation;
  onPress: () => void;
  showMatchFactors?: boolean;
  isActive?: boolean;
}

// =============================================================================
// Carousel Item Component
// =============================================================================

const CARD_WIDTH = 280;
const CARD_HEIGHT = 320;

const CarouselItem: React.FC<CarouselItemProps> = ({
  recommendation,
  onPress,
  showMatchFactors = false,
  isActive = true,
}) => {
  const { service, reasons, matchFactors } = recommendation;
  const { trackClick } = useRecommendationFeedback();

  const handlePress = useCallback(() => {
    trackClick(service._id);
    onPress();
  }, [service._id, trackClick, onPress]);

  const discount = service.price.discounts?.find((d) => d.type === 'first_time');

  return (
    <button
      onClick={handlePress}
      className={`flex-shrink-0 bg-white rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden text-left ${isActive ? '' : 'opacity-60'}`}
      style={{ width: CARD_WIDTH }}
    >
      {/* Service Image */}
      <div className="relative h-32">
        {service.images && service.images.length > 0 ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-row gap-1">
          {service.isFeatured && (
            <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-bold rounded">
              Featured
            </span>
          )}
          {service.isPopular && (
            <span className="px-2 py-1 bg-green-500 text-white text-[10px] font-bold rounded">
              Popular
            </span>
          )}
          {discount && (
            <span className="px-2 py-1 bg-pink-600 text-white text-[10px] font-bold rounded">
              {discount.percentage}% OFF
            </span>
          )}
        </div>

        {/* Price Tag */}
        <div className="absolute bottom-2 right-2 bg-black/75 px-2.5 py-1.5 rounded-lg flex flex-row items-baseline">
          <span className="text-white text-base font-bold">
            {service.price.currency} {service.price.amount.toFixed(0)}
          </span>
          {service.price.type === 'hourly' && (
            <span className="text-white/80 text-xs ml-0.5">/hr</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3.5">
        {/* Category */}
        <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1">
          {service.category}
        </p>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
          {service.name}
        </h3>

        {/* Rating & Duration */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-[13px] font-semibold text-gray-900">
              {service.rating.average.toFixed(1)}
            </span>
            <span className="text-xs text-gray-500">({service.rating.count})</span>
          </div>
          <span className="text-xs text-gray-500">{service.duration} min</span>
        </div>

        {/* Match Factors */}
        {showMatchFactors && matchFactors && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {matchFactors.categoryMatch && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-600 text-[11px] font-medium rounded-full">
                <CheckCircle className="w-3 h-3" />
                Category Match
              </span>
            )}
            {matchFactors.historyMatch && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 text-[11px] font-medium rounded-full">
                <Clock className="w-3 h-3" />
                Booked Before
              </span>
            )}
          </div>
        )}

        {/* Reasons */}
        {reasons.length > 0 && (
          <div className="mb-2 space-y-0.5">
            {reasons.slice(0, 2).map((reason, index) => (
              <p key={index} className="text-xs text-gray-500 italic truncate">
                {reason}
              </p>
            ))}
          </div>
        )}

        {/* Location */}
        <div className="flex items-center gap-1">
          <MapPin className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500 truncate">
            {service.location.address.city}
          </span>
        </div>
      </div>
    </button>
  );
};

// =============================================================================
// Main Carousel Component
// =============================================================================

const RecommendationCarousel: React.FC<RecommendationCarouselProps> = ({
  recommendations,
  title = 'Recommended for You',
  subtitle,
  onSeeAll,
  emptyMessage = 'No recommendations available',
  showMatchFactors = false,
  horizontal = true,
  maxVisible,
  testID,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleRecommendations = useMemo(() => {
    return maxVisible ? recommendations.slice(0, maxVisible) : recommendations;
  }, [recommendations, maxVisible]);

  const handleServicePress = useCallback(
    (serviceId: string) => {
      window.location.href = `/services/${serviceId}`;
    },
    []
  );

  if (visibleRecommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-5" data-testid={testID}>
        <Search className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 text-center">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="py-4" data-testid={testID}>
      {/* Header */}
      {(title || onSeeAll) && (
        <div className="flex items-start justify-between px-4 mb-4">
          <div className="flex-1">
            {title && <h2 className="text-xl font-bold text-gray-900 mb-1">{title}</h2>}
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          {onSeeAll && (
            <button
              onClick={onSeeAll}
              className="flex items-center gap-1 px-2 py-1 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <span>See All</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Carousel */}
      <div className="relative">
        <div
          className={`flex gap-4 overflow-x-auto pb-4 px-4 scrollbar-hide ${
            horizontal ? 'snap-x snap-mandatory' : ''
          }`}
          style={{
            scrollSnapType: horizontal ? 'x mandatory' : undefined,
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {visibleRecommendations.map((item, index) => (
            <div
              key={item.service._id}
              className="scroll-snap-align-start"
              style={{ scrollSnapAlign: horizontal ? 'start' : undefined }}
            >
              <CarouselItem
                recommendation={item}
                onPress={() => handleServicePress(item.service._id)}
                showMatchFactors={showMatchFactors}
                isActive={horizontal ? index === activeIndex : true}
              />
            </div>
          ))}
        </div>

        {/* Pagination Dots */}
        {horizontal && visibleRecommendations.length > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-4">
            {visibleRecommendations.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveIndex(index)}
                className={`rounded-full transition-all ${
                  index === activeIndex
                    ? 'w-5 h-2 bg-blue-600'
                    : 'w-1.5 h-1.5 bg-gray-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecommendationCarousel;
