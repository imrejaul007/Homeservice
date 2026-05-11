import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Clock, MapPin, TrendingUp } from 'lucide-react';
import type { Service } from '../../types/service';

export type { Service };

interface ServiceCardProps {
  service: Service;
  variant?: 'default' | 'compact' | 'featured';
  onClick?: (service: Service) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  variant = 'default',
  onClick
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick(service);
    } else {
      navigate(`/services/${service._id}`);
    }
  };

  // Extract display values from potentially nested objects
  const displayTitle = service.title || service.name;
  const displayPrice = typeof service.price === 'number'
    ? service.price
    : (service.price?.amount || 0);

  const displayRating = typeof service.rating === 'number'
    ? service.rating
    : (service.rating?.average || 0);

  const ratingCount = service.reviewCount ||
    (typeof service.rating === 'object' ? service.rating?.count : 0) ||
    service.reviews?.count || 0;

  // Gradient backgrounds based on category
  const categoryGradients: Record<string, string> = {
    hair: 'bg-gradient-to-br from-nilin-pink to-nilin-lavender',
    makeup: 'bg-gradient-to-br from-rose-100 to-pink-200',
    nails: 'bg-gradient-to-br from-nilin-lavender to-purple-200',
    'skin & aesthetics': 'bg-gradient-to-br from-purple-100 to-purple-200',
    'massage & body': 'bg-gradient-to-br from-nilin-blue to-blue-200',
    'personal care': 'bg-gradient-to-br from-nilin-cream to-amber-200',
    default: 'bg-gradient-to-br from-nilin-pink to-nilin-lavender',
  };

  const gradientClass = categoryGradients[service.category.toLowerCase()] || categoryGradients.default;

  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="w-full text-left bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden group"
      >
        <div className={`h-32 ${gradientClass} flex items-center justify-center`}>
          <div className="text-4xl opacity-50">
            {service.image ? (
              <img src={service.image} alt={displayTitle} className="w-full h-full object-cover" />
            ) : (
              '🏠'
            )}
          </div>
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-1">
            {displayTitle}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-gray-900">
              AED {displayPrice}
            </span>
            {displayRating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-medium text-gray-700">{displayRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="w-full text-left bg-white rounded-xl border border-gray-200 hover:shadow-xl transition-all duration-300 overflow-hidden group cursor-pointer"
    >
      {/* Image/Gradient Header */}
      <div className={`relative h-48 ${gradientClass} overflow-hidden`}>
        {service.image ? (
          <img
            src={service.image}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl opacity-40">
            🏠
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {service.isNew && (
            <span className="bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
              NEW
            </span>
          )}
          {service.isFeatured && (
            <span className="bg-gradient-nilin-primary text-gray-900 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Featured
            </span>
          )}
        </div>

        {/* Rating Badge */}
        {displayRating > 0 && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-semibold text-gray-900">{displayRating.toFixed(1)}</span>
            {ratingCount > 0 && (
              <span className="text-xs text-gray-600">({ratingCount})</span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category Tag */}
        <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-md mb-2">
          {service.category}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {displayTitle}
        </h3>

        {/* Description */}
        {service.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
          {service.duration && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{service.duration} min</span>
            </div>
          )}
          {service.provider?.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span className="truncate">{service.provider.location}</span>
            </div>
          )}
        </div>

        {/* Price and Provider */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            {service.provider && (
              <p className="text-xs text-gray-500 mb-1">by {service.provider.name}</p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">AED {displayPrice}</span>
              <span className="text-sm text-gray-500">/ service</span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="px-4 py-2 bg-gradient-nilin-primary text-gray-900 font-medium text-sm rounded-lg hover:shadow-md transition-shadow"
          >
            Book Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
