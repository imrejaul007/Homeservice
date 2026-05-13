import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Clock, MapPin, TrendingUp, ChevronRight, Heart } from 'lucide-react';
import type { Service } from '../../types/service';
import { useAuthStore } from '../../stores/authStore';
import { favoritesApi } from '../../services/favoritesApi';

export type { Service };

interface ServiceCardProps {
  service: Service;
  variant?: 'default' | 'compact' | 'featured';
  onClick?: (service: Service) => void;
  isFavorited?: boolean;
  onFavoriteChange?: (isFavorited: boolean) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  variant = 'default',
  onClick,
  isFavorited: initialFavorited = false,
  onFavoriteChange
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isToggling, setIsToggling] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick(service);
    } else {
      navigate(`/services/${service._id}`);
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
      if (isFavorited) {
        await favoritesApi.removeFavorite(service._id);
        setIsFavorited(false);
        onFavoriteChange?.(false);
      } else {
        await favoritesApi.addFavorite(service._id);
        setIsFavorited(true);
        onFavoriteChange?.(true);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    } finally {
      setIsToggling(false);
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

  // NILIN warm gradient backgrounds based on category
  const categoryGradients: Record<string, string> = {
    hair: 'bg-gradient-to-br from-[#F5E6E0] to-[#FAE5E0]',
    makeup: 'bg-gradient-to-br from-[#FAE5E0] to-[#F5E6E0]',
    nails: 'bg-gradient-to-br from-[#F5E6E0] to-[#EDE5DD]',
    'skin & aesthetics': 'bg-gradient-to-br from-[#FAE5E0] to-[#F5E6E0]',
    'massage & body': 'bg-gradient-to-br from-[#F5E6E0] to-[#FAE5E0]',
    'personal care': 'bg-gradient-to-br from-[#EDE5DD] to-[#F5E6E0]',
    default: 'bg-gradient-to-br from-[#F5E6E0] to-[#FAE5E0]',
  };

  const gradientClass = categoryGradients[service.category.toLowerCase()] || categoryGradients.default;

  // Compact variant - for grids and lists
  if (variant === 'compact') {
    return (
      <button
        onClick={handleClick}
        className="w-full text-left bg-white rounded-xl border border-[#E8E4E0] overflow-hidden group cursor-pointer
          transition-all duration-300 ease-out
          hover:shadow-[0_8px_30px_rgba(232,180,168,0.15)]
          hover:-translate-y-1
          focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/30"
      >
        {/* Image Area */}
        <div className={`relative h-28 ${gradientClass} overflow-hidden`}>
          {service.image ? (
            <img
              src={service.image}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-4xl opacity-40">✨</span>
            </div>
          )}

          {/* Rating Badge */}
          {displayRating > 0 && (
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Star className="h-3 w-3 fill-[#E8B4A8] text-[#E8B4A8]" />
              <span className="text-xs font-semibold text-[#2D2D2D]">{displayRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-medium text-[#2D2D2D] text-sm mb-1 line-clamp-1
            group-hover:text-[#D4A89A] transition-colors duration-200">
            {displayTitle}
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-[#2D2D2D]">
              AED {displayPrice}
            </span>
            <ChevronRight className="h-4 w-4 text-[#9B9B9B] group-hover:translate-x-1 transition-transform duration-200" />
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
        className="w-full text-left bg-white rounded-2xl border border-[#E8E4E0] overflow-hidden group cursor-pointer
          transition-all duration-300 ease-out
          hover:shadow-[0_12px_40px_rgba(232,180,168,0.2)]
          hover:-translate-y-2
          focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/30"
      >
        {/* Image Area */}
        <div className={`relative h-56 ${gradientClass} overflow-hidden`}>
          {service.image ? (
            <img
              src={service.image}
              alt={displayTitle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-6xl opacity-40">✨</span>
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            {service.isNew && (
              <span className="bg-[#E8B4A8] text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                NEW
              </span>
            )}
            {service.isFeatured && (
              <span className="bg-[#D4A89A] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <TrendingUp className="h-3 w-3" />
                Featured
              </span>
            )}
          </div>

          {/* Rating Badge */}
          {displayRating > 0 && (
            <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
              <Star className="h-4 w-4 fill-[#E8B4A8] text-[#E8B4A8]" />
              <span className="text-sm font-bold text-[#2D2D2D]">{displayRating.toFixed(1)}</span>
              {ratingCount > 0 && (
                <span className="text-xs text-[#6B6B6B]">({ratingCount})</span>
              )}
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#2D2D2D]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Category Tag */}
          <span className="inline-block px-3 py-1 bg-[#F8F6F4] text-[#6B6B6B] text-xs font-medium rounded-lg mb-3">
            {service.category}
          </span>

          {/* Title */}
          <h3 className="font-semibold text-[#2D2D2D] text-lg mb-2 line-clamp-2
            group-hover:text-[#D4A89A] transition-colors duration-200">
            {displayTitle}
          </h3>

          {/* Description */}
          {service.description && (
            <p className="text-sm text-[#6B6B6B] mb-4 line-clamp-2">
              {service.description}
            </p>
          )}

          {/* Meta Info */}
          <div className="flex items-center gap-5 text-sm text-[#6B6B6B] mb-4">
            {service.duration && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-[#D4A89A]" />
                <span>{service.duration} min</span>
              </div>
            )}
            {service.provider?.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#D4A89A]" />
                <span className="truncate">{service.provider.location}</span>
              </div>
            )}
          </div>

          {/* Price and CTA */}
          <div className="flex items-center justify-between pt-4 border-t border-[#E8E4E0]">
            <div>
              {service.provider && (
                <p className="text-xs text-[#9B9B9B] mb-0.5">by {service.provider.name}</p>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#2D2D2D]">AED {displayPrice}</span>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
              className="px-5 py-2.5 bg-[#E8B4A8] text-white font-medium text-sm rounded-xl
                hover:bg-[#D4A89A] hover:shadow-[0_4px_20px_rgba(232,180,168,0.3)]
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
      onClick={handleClick}
      className="w-full text-left bg-white rounded-xl border border-[#E8E4E0] overflow-hidden group cursor-pointer
        transition-all duration-300 ease-out
        hover:shadow-[0_8px_30px_rgba(232,180,168,0.15)]
        hover:-translate-y-1
        focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/30"
    >
      {/* Image/Gradient Header */}
      <div className={`relative h-48 ${gradientClass} overflow-hidden`}>
        {service.image ? (
          <img
            src={service.image}
            alt={displayTitle}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-5xl opacity-40">✨</span>
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-3 left-3 flex gap-2">
          {service.isNew && (
            <span className="bg-[#7BA889] text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm">
              NEW
            </span>
          )}
          {service.isFeatured && (
            <span className="bg-[#D4A89A] text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
              <TrendingUp className="h-3 w-3" />
              Featured
            </span>
          )}
        </div>

        {/* Rating Badge */}
        {displayRating > 0 && (
          <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
            <Star className="h-4 w-4 fill-[#E8B4A8] text-[#E8B4A8]" />
            <span className="text-sm font-semibold text-[#2D2D2D]">{displayRating.toFixed(1)}</span>
            {ratingCount > 0 && (
              <span className="text-xs text-[#6B6B6B]">({ratingCount})</span>
            )}
          </div>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className={`absolute top-3 left-3 p-2 rounded-full shadow-sm transition-all ${
            isFavorited
              ? 'bg-red-500 text-white'
              : 'bg-white/80 backdrop-blur-sm text-gray-600 hover:bg-white'
          } ${isToggling ? 'opacity-50' : ''}`}
        >
          <Heart className={`h-4 w-4 ${isFavorited ? 'fill-current' : ''}`} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category Tag */}
        <span className="inline-block px-2.5 py-1 bg-[#F8F6F4] text-[#6B6B6B] text-xs font-medium rounded-lg mb-2">
          {service.category}
        </span>

        {/* Title */}
        <h3 className="font-semibold text-[#2D2D2D] mb-2 line-clamp-2
          group-hover:text-[#D4A89A] transition-colors duration-200">
          {displayTitle}
        </h3>

        {/* Description */}
        {service.description && (
          <p className="text-sm text-[#6B6B6B] mb-3 line-clamp-2">
            {service.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-sm text-[#6B6B6B] mb-3">
          {service.duration && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#D4A89A]" />
              <span>{service.duration} min</span>
            </div>
          )}
          {service.provider?.location && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-[#D4A89A]" />
              <span className="truncate">{service.provider.location}</span>
            </div>
          )}
        </div>

        {/* Price and Provider */}
        <div className="flex items-center justify-between pt-3 border-t border-[#E8E4E0]">
          <div>
            {service.provider && (
              <p className="text-xs text-[#9B9B9B] mb-0.5">by {service.provider.name}</p>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-[#2D2D2D]">AED {displayPrice}</span>
              <span className="text-xs text-[#9B9B9B]">/ service</span>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            className="px-4 py-2 bg-[#E8B4A8] text-white font-medium text-sm rounded-lg
              hover:bg-[#D4A89A] hover:shadow-[0_4px_20px_rgba(232,180,168,0.25)]
              active:scale-95
              transition-all duration-200"
          >
            Book
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
