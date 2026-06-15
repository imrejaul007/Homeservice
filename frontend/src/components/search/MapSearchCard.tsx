import React from 'react';
import { Star, MapPin, Clock, Check, Package } from 'lucide-react';
import type { Service } from '../../types/search';
import { useComparisonStore } from '../../stores/comparisonStore';
import { usePriceConversion, formatPrice } from '../../utils/priceConverter';

interface MapSearchCardProps {
  service: Service;
  onViewDetails: (service: Service) => void;
  onBookNow: (service: Service) => void;
  compact?: boolean;
}

/**
 * Compact service card used inside Leaflet map popups.
 * Includes an "Add to Compare" checkbox.
 */
const MapSearchCard: React.FC<MapSearchCardProps> = ({
  service,
  onViewDetails,
  onBookNow,
  compact = false,
}) => {
  const { convert, format, currency } = usePriceConversion();
  const isInComparison = useComparisonStore((s) => s.isSelected(service._id));
  const toggleComparison = useComparisonStore((s) => s.toggleService);
  const canAdd = useComparisonStore((s) => s.canAdd);

  const displayTitle = service.title || service.name;
  const rawPrice = (service as any).pricing?.currentPrice
    ?? (typeof service.price === 'number' ? service.price : service.price?.amount || 0);
  const sourceCurrency = typeof service.price === 'object' ? service.price?.currency || 'AED' : 'AED';
  const displayPrice = convert(rawPrice, sourceCurrency);

  const displayRating = typeof service.rating === 'number' ? service.rating : service.rating?.average || 0;
  const ratingCount = service.reviewCount || (typeof service.rating === 'object' ? service.rating?.count : 0) || 0;
  const distance = (service as any).distance;
  const city = service.location?.address?.city || service.provider?.location || '';

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isInComparison && !canAdd) {
      alert('You can compare up to 4 services at a time. Remove one to add another.');
      return;
    }
    toggleComparison(service);
  };

  return (
    <div className="w-72 font-sans">
      {/* Image */}
      {service.image ? (
        <div
          className="h-32 w-full bg-cover bg-center rounded-t-lg overflow-hidden cursor-pointer"
          style={{ backgroundImage: `url(${service.image})` }}
          onClick={() => onViewDetails(service)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onViewDetails(service); }}
        />
      ) : (
        <div className="h-32 w-full bg-nilin-blush/30 flex items-center justify-center rounded-t-lg cursor-pointer" onClick={() => onViewDetails(service)}>
          <Package className="w-8 h-8 text-nilin-coral opacity-50" />
        </div>
      )}

      <div className={`p-3 ${compact ? '' : 'space-y-2'}`}>
        {/* Title + Compare */}
        <div className="flex items-start justify-between gap-2">
          <h4
            className="font-semibold text-sm text-nilin-charcoal line-clamp-2 cursor-pointer hover:text-nilin-rose transition-colors"
            onClick={() => onViewDetails(service)}
          >
            {displayTitle}
          </h4>
          <button
            onClick={handleCompareToggle}
            aria-label={isInComparison ? 'Remove from comparison' : 'Add to comparison'}
            aria-pressed={isInComparison}
            className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
              isInComparison
                ? 'bg-nilin-coral border-nilin-coral text-white'
                : 'bg-white border-nilin-border text-transparent hover:border-nilin-coral'
            }`}
          >
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </div>

        {/* Rating + Distance */}
        <div className="flex items-center gap-3 text-xs text-nilin-warmGray">
          {displayRating > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-nilin-coral text-nilin-coral" />
              <span className="font-semibold text-nilin-charcoal">{displayRating.toFixed(1)}</span>
              {ratingCount > 0 && <span>({ratingCount})</span>}
            </div>
          )}
          {distance != null && (
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-nilin-rose" />
              <span>{distance.toFixed(1)} km</span>
            </div>
          )}
        </div>

        {/* City */}
        {city && (
          <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{city}</span>
          </div>
        )}

        {/* Duration + Price */}
        <div className="flex items-center gap-3 pt-2 border-t border-nilin-border">
          <span className="flex-1">
            {service.duration ? (
              <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
                <Clock className="w-3.5 h-3.5" />
                <span>{service.duration} min</span>
              </div>
            ) : null}
          </span>
          <span className="font-bold text-sm text-nilin-charcoal">
            {format(displayPrice, currency)}
          </span>
        </div>

        {/* CTAs */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onViewDetails(service)}
            className="flex-1 px-2 py-1.5 text-xs font-medium text-nilin-charcoal bg-nilin-muted hover:bg-nilin-blush rounded-nilin transition-colors"
          >
            Details
          </button>
          <button
            onClick={() => onBookNow(service)}
            className="flex-1 px-2 py-1.5 text-xs font-medium text-white bg-nilin-coral hover:bg-nilin-rose rounded-nilin transition-colors"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default MapSearchCard;
