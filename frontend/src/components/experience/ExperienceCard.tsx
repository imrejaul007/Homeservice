import React, { useState, useEffect, useCallback } from 'react';
import { Star, User, X, ChevronLeft, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import type { Experience } from '../../types/experience';
import { cn } from '@/lib/utils';

interface ExperienceCardProps {
  experience: Experience;
  isFeatured?: boolean;
}

interface LightboxState {
  isOpen: boolean;
  currentIndex: number;
  images: string[];
}

const ExperienceCard: React.FC<ExperienceCardProps> = ({ experience, isFeatured = false }) => {
  const [lightbox, setLightbox] = useState<LightboxState>({
    isOpen: false,
    currentIndex: 0,
    images: [],
  });

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (!lightbox.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [lightbox.isOpen, lightbox.currentIndex]);

  const openLightbox = (index: number, images: string[]) => {
    setLightbox({ isOpen: true, currentIndex: index, images });
  };

  const closeLightbox = useCallback(() => {
    setLightbox((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const goToPrevious = useCallback(() => {
    setLightbox((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1,
    }));
  }, []);

  const goToNext = useCallback(() => {
    setLightbox((prev) => ({
      ...prev,
      currentIndex: prev.currentIndex === prev.images.length - 1 ? 0 : prev.currentIndex + 1,
    }));
  }, []);

  const handleImageClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    openLightbox(index, experience.images);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeLightbox();
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

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName?.charAt(0) || ''}`.toUpperCase();
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
        <div className="relative overflow-hidden rounded-nilin shadow-nilin card-3d hover-lift group cursor-pointer">
          {/* Main Image */}
          <div
            className="relative h-full min-h-[400px]"
            onClick={(e) => handleImageClick(e, 0)}
          >
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

          {/* Thumbnail Strip for multiple images */}
          {experience.images && experience.images.length > 1 && (
            <div className="absolute bottom-28 left-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              {experience.images.slice(1, 4).map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => handleImageClick(e, idx + 1)}
                  className="w-16 h-16 rounded-lg overflow-hidden border-2 border-white/50 hover:border-white transition-colors"
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {experience.images.length > 4 && (
                <button
                  onClick={(e) => handleImageClick(e, 4)}
                  className="w-16 h-16 rounded-lg bg-black/50 border-2 border-white/50 hover:border-white transition-colors flex items-center justify-center"
                >
                  <span className="text-white text-xs font-medium">+{experience.images.length - 4}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Lightbox Modal */}
        <LightboxModal
          isOpen={lightbox.isOpen}
          images={lightbox.images}
          currentIndex={lightbox.currentIndex}
          onClose={closeLightbox}
          onPrevious={goToPrevious}
          onNext={goToNext}
          onOverlayClick={handleOverlayClick}
        />
      </>
    );
  }

  // Standard card
  return (
    <>
      <div className="relative overflow-hidden rounded-nilin shadow-nilin card-3d hover-lift group cursor-pointer">
        {/* Image */}
        <div
          className="relative h-48"
          onClick={(e) => handleImageClick(e, 0)}
        >
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

      {/* Lightbox Modal */}
      <LightboxModal
        isOpen={lightbox.isOpen}
        images={lightbox.images}
        currentIndex={lightbox.currentIndex}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onOverlayClick={handleOverlayClick}
      />
    </>
  );
};

// Lightbox Modal Component
interface LightboxModalProps {
  isOpen: boolean;
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOverlayClick: (e: React.MouseEvent) => void;
}

const LightboxModal: React.FC<LightboxModalProps> = ({
  isOpen,
  images,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
  onOverlayClick,
}) => {
  if (!isOpen || images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
      onClick={onOverlayClick}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Close lightbox"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* Close on click outside hint */}
      <div className="absolute top-4 left-4 text-white/60 text-sm">
        Click outside or press ESC to close
      </div>

      {/* Image Counter */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-white text-sm font-medium">
        {currentIndex + 1} / {images.length}
      </div>

      {/* Previous Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Main Image */}
      <div
        className="relative max-w-5xl max-h-[85vh] w-full h-full flex items-center justify-center p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
        />
      </div>

      {/* Next Button */}
      {images.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label="Next image"
        >
          <ChevronRight className="w-8 h-8 text-white" />
        </button>
      )}

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-white/10 backdrop-blur-sm rounded-full">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                // Navigate to this index - we need to call a different function
                // For now, we can just trigger a custom event or use state
              }}
              className={cn(
                'w-12 h-12 rounded-lg overflow-hidden border-2 transition-all',
                idx === currentIndex
                  ? 'border-white scale-110'
                  : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExperienceCard;
