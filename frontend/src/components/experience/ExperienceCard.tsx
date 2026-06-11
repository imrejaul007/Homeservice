import React, { useState } from 'react';
import { Star, User } from 'lucide-react';
import type { Experience } from '../../types/experience';
import ExperienceDetailModal from './ExperienceDetailModal';
import { cn } from '@/lib/utils';

interface ExperienceCardProps {
  experience: Experience;
  isFeatured?: boolean;
  onSelect?: (experience: Experience) => void;
}

const ExperienceCard: React.FC<ExperienceCardProps> = ({
  experience,
  isFeatured = false,
  onSelect,
}) => {
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = () => {
    if (onSelect) {
      onSelect(experience);
    } else {
      setDetailOpen(true);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 1) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              'h-3.5 w-3.5',
              star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'
            )}
          />
        ))}
      </div>
    );
  };

  // Featured card (large, spans 2 columns and 2 rows)
  if (isFeatured) {
    return (
      <>
        <div
          className="relative overflow-hidden rounded-nilin shadow-nilin card-3d hover-lift group cursor-pointer"
          onClick={openDetail}
          onKeyDown={(e) => e.key === 'Enter' && openDetail()}
          role="button"
          tabIndex={0}
          aria-label={`View experience: ${experience.title}`}
        >
          {/* Main Image */}
          <div className="relative h-full min-h-[400px]">
            {experience.images && experience.images.length > 0 ? (
              <img
                src={experience.images[0]}
                alt={experience.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center">
                <span className="text-6xl opacity-50">✨</span>
              </div>
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            {/* Featured Badge */}
            {experience.isFeatured && (
              <div className="absolute top-4 left-4 px-3 py-1.5 bg-nilin-coral text-white text-xs font-medium rounded-full shadow-md">
                Featured
              </div>
            )}

            {/* Image Count Badge */}
            {experience.images && experience.images.length > 1 && (
              <div className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                +{experience.images.length - 1} more
              </div>
            )}

            {/* Content Overlay */}
            <div className="absolute inset-x-0 bottom-0 p-6">
              {/* User Info */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center overflow-hidden">
                  {experience.userId?.avatar ? (
                    <img
                      src={experience.userId.avatar}
                      alt={`${experience.userId.firstName} ${experience.userId.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">
                    {experience.userId?.firstName} {experience.userId?.lastName?.charAt(0)}.
                  </p>
                  <p className="text-white/70 text-xs">{formatDate(experience.createdAt)}</p>
                </div>
              </div>

              {/* Title and Rating */}
              <div className="mb-2">
                <h3 className="text-xl font-serif text-white mb-1">{experience.title}</h3>
                {renderStars(experience.rating)}
              </div>

              {/* Description */}
              <p className="text-white/85 text-sm line-clamp-2">{experience.description}</p>

              {/* Provider & Service */}
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
                <div className="text-xs text-white/70">
                  <span className="text-white/90">By </span>
                  {experience.providerId?.firstName} {experience.providerId?.lastName?.charAt(0)}.
                </div>
                <div className="text-xs text-white/70">
                  {experience.serviceId?.name}
                </div>
              </div>
            </div>
          </div>

        </div>

        <ExperienceDetailModal
          experience={experience}
          isOpen={detailOpen}
          onClose={() => setDetailOpen(false)}
        />
      </>
    );
  }

  // Standard card
  return (
    <>
      <div
        className="relative overflow-hidden rounded-nilin shadow-nilin card-3d hover-lift group cursor-pointer"
        onClick={openDetail}
        onKeyDown={(e) => e.key === 'Enter' && openDetail()}
        role="button"
        tabIndex={0}
        aria-label={`View experience: ${experience.title}`}
      >
        {/* Image */}
        <div className="relative h-48">
          {experience.images && experience.images.length > 0 ? (
            <img
              src={experience.images[0]}
              alt={experience.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center">
              <span className="text-4xl opacity-50">✨</span>
            </div>
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

          {/* Image Count Badge */}
          {experience.images && experience.images.length > 1 && (
            <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-xs font-medium rounded-full">
              {experience.images.length} photos
            </div>
          )}

          {/* Featured Badge */}
          {experience.isFeatured && (
            <div className="absolute top-3 left-3 px-2 py-1 bg-nilin-coral text-white text-xs font-medium rounded-full">
              Featured
            </div>
          )}

          {/* Rating Badge */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full">
            {renderStars(experience.rating)}
            <span className="text-white text-xs font-medium">{experience.rating}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 bg-white">
          <h3 className="font-medium text-nilin-charcoal mb-1 line-clamp-1">{experience.title}</h3>
          <p className="text-sm text-nilin-warmGray line-clamp-2 mb-3">{experience.description}</p>

          {/* Provider & Service */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-nilin-cream flex items-center justify-center overflow-hidden">
                <User className="w-3 h-3 text-nilin-warmGray" />
              </div>
              <span className="text-nilin-warmGray truncate max-w-[100px]">
                {experience.providerId?.firstName} {experience.providerId?.lastName?.charAt(0)}.
              </span>
            </div>
            <span className="text-nilin-coral truncate max-w-[80px]">
              {experience.serviceId?.name}
            </span>
          </div>
        </div>
      </div>

      <ExperienceDetailModal
        experience={experience}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
};

export default ExperienceCard;
