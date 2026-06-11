import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Star,
  User,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Play,
} from 'lucide-react';
import type { Experience } from '../../types/experience';
import { cn } from '@/lib/utils';

interface ExperienceDetailModalProps {
  experience: Experience | null;
  isOpen: boolean;
  onClose: () => void;
}

const ExperienceDetailModal: React.FC<ExperienceDetailModalProps> = ({
  experience,
  isOpen,
  onClose,
}) => {
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setImageIndex(0);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, experience?._id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const goToPrevious = useCallback(() => {
    if (!experience?.images?.length) return;
    setImageIndex((i) => (i === 0 ? experience.images.length - 1 : i - 1));
  }, [experience?.images]);

  const goToNext = useCallback(() => {
    if (!experience?.images?.length) return;
    setImageIndex((i) => (i === experience.images.length - 1 ? 0 : i + 1));
  }, [experience?.images]);

  if (!isOpen || !experience) return null;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            'h-5 w-5',
            star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 fill-gray-300'
          )}
        />
      ))}
      <span className="ml-2 text-sm text-nilin-warmGray">{rating} out of 5</span>
    </div>
  );

  const customerName = experience.userId
    ? `${experience.userId.firstName} ${experience.userId.lastName?.charAt(0) || ''}.`.trim()
    : 'NILIN Customer';

  const providerName = experience.providerId
    ? `${experience.providerId.firstName} ${experience.providerId.lastName?.charAt(0) || ''}.`.trim()
    : null;

  const images = experience.images || [];
  const hasImages = images.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-nilin-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-nilin-lg animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-detail-title"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/90 shadow-md hover:bg-nilin-blush/50 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-nilin-charcoal" />
        </button>

        {/* Image gallery */}
        <div className="relative bg-nilin-cream">
          {hasImages ? (
            <>
              <div className="relative h-64 sm:h-80">
                <img
                  src={images[imageIndex]}
                  alt={`${experience.title} - photo ${imageIndex + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {experience.isFeatured && (
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-nilin-coral text-white text-xs font-medium rounded-full">
                    Featured
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goToPrevious}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-5 w-5 text-nilin-charcoal" />
                  </button>
                  <button
                    type="button"
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-md"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-5 w-5 text-nilin-charcoal" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-xs rounded-full">
                    {imageIndex + 1} / {images.length}
                  </div>
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setImageIndex(idx)}
                        className={cn(
                          'flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all',
                          idx === imageIndex ? 'border-nilin-coral scale-105' : 'border-transparent opacity-70'
                        )}
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="h-48 sm:h-56 bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center">
              <Sparkles className="h-12 w-12 text-nilin-coral/50" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-5">
          <div>
            <h2
              id="experience-detail-title"
              className="text-2xl sm:text-3xl font-serif text-nilin-charcoal mb-2 pr-8"
            >
              {experience.title}
            </h2>
            {renderStars(experience.rating)}
          </div>

          <p className="text-nilin-charcoal/80 leading-relaxed whitespace-pre-wrap">
            {experience.description}
          </p>

          {experience.videoUrl && (
            <a
              href={experience.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-nilin bg-nilin-blush/50 text-nilin-coral hover:bg-nilin-blush transition-colors text-sm font-medium"
            >
              <Play className="h-4 w-4" />
              Watch video
            </a>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-nilin-border/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-nilin-cream flex items-center justify-center overflow-hidden">
                {experience.userId?.avatar ? (
                  <img
                    src={experience.userId.avatar}
                    alt={customerName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-nilin-warmGray" />
                )}
              </div>
              <div>
                <p className="text-xs text-nilin-warmGray">Shared by</p>
                <p className="font-medium text-nilin-charcoal">{customerName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-nilin-coral" />
              </div>
              <div>
                <p className="text-xs text-nilin-warmGray">Posted</p>
                <p className="font-medium text-nilin-charcoal">{formatDate(experience.createdAt)}</p>
              </div>
            </div>

            {experience.serviceId?.name && (
              <div>
                <p className="text-xs text-nilin-warmGray">Service</p>
                <p className="font-medium text-nilin-charcoal">{experience.serviceId.name}</p>
              </div>
            )}

            {providerName && (
              <div>
                <p className="text-xs text-nilin-warmGray">Professional</p>
                <p className="font-medium text-nilin-charcoal">{providerName}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperienceDetailModal;
