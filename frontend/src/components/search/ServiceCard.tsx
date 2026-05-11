import React from 'react';
import { Star, MapPin, Clock, DollarSign, User, Heart, Share2, Eye } from 'lucide-react';
import type { Service } from '@/types/search';
import { cn, formatPrice, formatDistance, truncateText } from '@/lib/utils';

interface ServiceCardProps {
  service: Service;
  className?: string;
  variant?: 'default' | 'compact' | 'featured';
  showDistance?: boolean;
  onServiceClick?: (service: Service) => void;
  onProviderClick?: (providerId: string) => void;
  onFavorite?: (serviceId: string) => void;
  onShare?: (service: Service) => void;
  isFavorited?: boolean;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  className,
  variant = 'default',
  showDistance = false,
  onServiceClick,
  onProviderClick,
  onFavorite,
  onShare,
  isFavorited = false,
}) => {
  const handleClick = () => {
    onServiceClick?.(service);
  };

  const handleProviderClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onProviderClick?.(service.providerId);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite?.(service._id);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare?.(service);
  };

  const renderStars = (rating: number, count?: number) => {
    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                'h-4 w-4',
                star <= rating
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-gray-300'
              )}
            />
          ))}
        </div>
        {count !== undefined && (
          <span className="text-sm text-gray-500">({count})</span>
        )}
      </div>
    );
  };

  const cardVariants = {
    default: 'p-4',
    compact: 'p-3',
    featured: 'p-6 ring-2 ring-blue-200',
  };

  const imageSize = {
    default: 'h-48',
    compact: 'h-32',
    featured: 'h-56',
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group',
        cardVariants[variant],
        className
      )}
    >
      {/* Service Image */}
      <div className={cn('relative overflow-hidden rounded-lg mb-3', imageSize[variant])}>
        {service.images.length > 0 ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <div className="text-gray-400 text-center">
              <div className="text-4xl mb-2">🔧</div>
              <p className="text-sm">No image</p>
            </div>
          </div>
        )}

        {/* Overlay Actions */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleFavorite}
            className={cn(
              'p-2 rounded-full shadow-sm backdrop-blur-sm transition-colors',
              isFavorited
                ? 'bg-red-100 text-red-600'
                : 'bg-white/80 text-gray-600 hover:bg-white'
            )}
          >
            <Heart className={cn('h-4 w-4', isFavorited && 'fill-current')} />
          </button>
          <button
            onClick={handleShare}
            className="p-2 rounded-full bg-white/80 text-gray-600 hover:bg-white shadow-sm backdrop-blur-sm transition-colors"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {service.isFeatured && (
            <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              Featured
            </span>
          )}
          {service.isPopular && (
            <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium">
              Popular
            </span>
          )}
        </div>

        {/* Distance Badge */}
        {showDistance && service.distance && (
          <div className="absolute bottom-2 left-2">
            <span className="bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
              {formatDistance(service.distance)}
            </span>
          </div>
        )}
      </div>

      {/* Service Info */}
      <div className="space-y-2">
        {/* Title and Category */}
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
            {service.name}
          </h3>
          <p className="text-sm text-blue-600 font-medium capitalize">
            {service.category.replace('-', ' ')}
            {service.subcategory && ` • ${service.subcategory.replace('-', ' ')}`}
          </p>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2">
          {truncateText(service.shortDescription || service.description, 100)}
        </p>

        {/* Rating and Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {renderStars(service.rating.average, service.rating.count)}
            <span className="text-sm text-gray-600">
              {service.rating.average.toFixed(1)}
            </span>
          </div>
          <div className="text-right">
            <div className="font-semibold text-gray-900">
              {formatPrice(service.price.amount, service.price.currency)}
            </div>
            <div className="text-xs text-gray-500">
              {service.price.type === 'hourly' && '/hour'}
              {service.price.type === 'fixed' && 'fixed price'}
            </div>
          </div>
        </div>

        {/* Location and Duration */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            <span>
              {service.location.address.city}, {service.location.address.state}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{service.duration}min</span>
          </div>
        </div>

        {/* Provider Info */}
        {service.provider && (
          <div 
            onClick={handleProviderClick}
            className="flex items-center gap-2 pt-2 border-t border-gray-100 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
          >
            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
              {service.provider.avatar ? (
                <img
                  src={service.provider.avatar}
                  alt={`${service.provider.firstName} ${service.provider.lastName}`}
                  className="w-full h-full object-cover rounded-full"
                />
              ) : (
                <User className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {service.provider.firstName} {service.provider.lastName}
              </p>
              {service.provider.rating && (
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                  <span className="text-xs text-gray-500">
                    {service.provider.rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
            <Eye className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
          </div>
        )}

        {/* Tags */}
        {service.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {service.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
            {service.tags.length > 3 && (
              <span className="text-xs text-gray-500">
                +{service.tags.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceCard;