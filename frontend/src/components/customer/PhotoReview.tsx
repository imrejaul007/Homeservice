import React, { useState, useCallback, useRef } from 'react';
import {
  Camera,
  Image,
  X,
  Star,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

// =============================================================================
// NILIN Customer Dashboard - Photo Review Component
// Image upload for reviews, photo gallery, before/after photos
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface PhotoReviewItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption?: string;
  type: 'before' | 'after' | 'general';
  uploadedAt: string;
  verified?: boolean;
}

export interface ReviewPhoto {
  file?: File;
  preview: string;
  type: 'before' | 'after' | 'general';
  caption?: string;
}

export interface PhotoReviewProps {
  /** Initial photos (from existing review) */
  initialPhotos?: PhotoReviewItem[];
  /** Callback when photos are updated */
  onPhotosChange?: (photos: ReviewPhoto[]) => void;
  /** Callback when review is submitted */
  onSubmit?: (photos: ReviewPhoto[], rating: number) => Promise<void>;
  /** Maximum number of photos allowed */
  maxPhotos?: number;
  /** Maximum file size in MB */
  maxFileSize?: number;
  /** Accept only verified photos */
  requireVerification?: boolean;
  /** Show before/after toggle */
  showBeforeAfter?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Image Upload Component
// =============================================================================

interface ImageUploadProps {
  onUpload: (file: File) => void;
  disabled?: boolean;
  maxFileSize?: number;
  className?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onUpload,
  disabled = false,
  maxFileSize = 10,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      alert(`Image must be smaller than ${maxFileSize}MB`);
      return;
    }

    onUpload(file);
  }, [onUpload, maxFileSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-xl p-6 text-center transition-colors',
        isDragging
          ? 'border-nilin-coral bg-nilin-coral/5'
          : 'border-gray-300 hover:border-nilin-coral/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
        disabled={disabled}
      />

      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 rounded-full bg-nilin-blush/50 flex items-center justify-center">
          <Upload className="h-6 w-6 text-nilin-coral" />
        </div>
        <p className="text-sm font-medium text-nilin-charcoal">
          Click to upload or drag and drop
        </p>
        <p className="text-xs text-nilin-warmGray">
          PNG, JPG up to {maxFileSize}MB
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// Photo Thumbnail Component
// =============================================================================

interface PhotoThumbnailProps {
  photo: ReviewPhoto;
  onRemove: () => void;
  onCaptionChange: (caption: string) => void;
  onTypeChange: (type: 'before' | 'after' | 'general') => void;
  showBeforeAfter?: boolean;
}

const PhotoThumbnail: React.FC<PhotoThumbnailProps> = ({
  photo,
  onRemove,
  onCaptionChange,
  onTypeChange,
  showBeforeAfter = false,
}) => {
  const [showCaption, setShowCaption] = useState(false);

  const typeColors = {
    before: 'bg-blue-100 text-blue-700 border-blue-200',
    after: 'bg-green-100 text-green-700 border-green-200',
    general: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const typeLabels = {
    before: 'Before',
    after: 'After',
    general: 'Photo',
  };

  return (
    <div className="relative group">
      {/* Image */}
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
        {photo.file ? (
          <img
            src={photo.preview}
            alt="Uploaded"
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={photo.preview}
            alt="Review photo"
            className="w-full h-full object-cover"
          />
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            onClick={onRemove}
            className="p-2 rounded-full bg-white/90 text-red-500 hover:bg-white transition-colors"
            aria-label="Remove photo"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {/* Type Badge */}
        <div className="absolute top-2 left-2">
          <select
            value={photo.type}
            onChange={(e) => onTypeChange(e.target.value as 'before' | 'after' | 'general')}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'text-xs font-medium px-2 py-1 rounded-lg border appearance-none cursor-pointer',
              typeColors[photo.type]
            )}
          >
            <option value="before">Before</option>
            <option value="after">After</option>
            <option value="general">Photo</option>
          </select>
        </div>

        {/* Caption Toggle */}
        <button
          onClick={() => setShowCaption(!showCaption)}
          className="absolute top-2 right-2 p-2 rounded-full bg-white/90 text-nilin-charcoal opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Add caption"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>

      {/* Caption Input */}
      {showCaption && (
        <input
          type="text"
          value={photo.caption || ''}
          onChange={(e) => onCaptionChange(e.target.value)}
          placeholder="Add a caption..."
          className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
        />
      )}
    </div>
  );
};

// =============================================================================
// Photo Gallery Modal
// =============================================================================

interface PhotoGalleryModalProps {
  photos: PhotoReviewItem[] | ReviewPhoto[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const PhotoGalleryModal: React.FC<PhotoGalleryModalProps> = ({
  photos,
  initialIndex = 0,
  open,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  const currentPhoto = photos[currentIndex];
  const currentPhotoItem = currentPhoto as PhotoReviewItem | undefined;

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
    setIsZoomed(false);
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
    setIsZoomed(false);
  }, [photos.length]);

  // Reset index when modal opens with new photos
  React.useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      setIsZoomed(false);
    }
  }, [open, initialIndex]);

  if (!open || !currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <span className="text-white text-sm">
            {currentIndex + 1} / {photos.length}
          </span>
          {currentPhoto.type !== 'general' && (
            <Badge
              variant={currentPhoto.type === 'before' ? 'default' : 'success'}
              size="sm"
              className="bg-white/20 text-white border-0"
            >
              {currentPhoto.type === 'before' ? 'Before' : 'After'}
            </Badge>
          )}
          {currentPhotoItem?.verified && (
            <Badge variant="success" size="sm" className="bg-white/20 text-white border-0">
              <CheckCircle className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsZoomed(!isZoomed)}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label={isZoomed ? 'Zoom out' : 'Zoom in'}
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close gallery"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {/* Previous Button */}
        {photos.length > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Image Container */}
        <div
          className={cn(
            'relative transition-transform duration-300',
            isZoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
          )}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <img
            src={'url' in currentPhoto ? currentPhoto.url : currentPhoto.preview}
            alt={'caption' in currentPhoto && currentPhoto.caption || 'Review photo'}
            className="max-h-[80vh] max-w-full object-contain"
          />

          {/* Caption */}
          {'caption' in currentPhoto && currentPhoto.caption && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
              <p className="text-white text-sm">{currentPhoto.caption}</p>
            </div>
          )}
        </div>

        {/* Next Button */}
        {photos.length > 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Thumbnails Strip */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-2 p-4 overflow-x-auto">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setCurrentIndex(index)}
              className={cn(
                'relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all',
                index === currentIndex
                  ? 'ring-2 ring-white'
                  : 'opacity-60 hover:opacity-100'
              )}
            >
              <img
                src={photo.thumbnailUrl || photo.url}
                alt=""
                className="w-full h-full object-cover"
              />
              {photo.type !== 'general' && (
                <div className="absolute bottom-1 right-1">
                  <Badge
                    variant={photo.type === 'before' ? 'default' : 'success'}
                    size="sm"
                    className="bg-black/60 text-white border-0 px-1 py-0.5 text-xs"
                  >
                    {photo.type === 'before' ? 'B' : 'A'}
                  </Badge>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Star Rating Input
// =============================================================================

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const StarRatingInput: React.FC<StarRatingInputProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  const [hoverValue, setHoverValue] = useState(0);

  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-10 w-10',
  };

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral rounded"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              sizes[size],
              (hoverValue || value) >= star
                ? 'text-amber-400 fill-amber-400'
                : 'text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const PhotoReview: React.FC<PhotoReviewProps> = ({
  initialPhotos = [],
  onPhotosChange,
  onSubmit,
  maxPhotos = 5,
  maxFileSize = 10,
  requireVerification = false,
  showBeforeAfter = true,
  className,
}) => {
  const [photos, setPhotos] = useState<ReviewPhoto[]>([]);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Convert initial photos to ReviewPhoto format
  React.useEffect(() => {
    if (initialPhotos.length > 0) {
      const converted: ReviewPhoto[] = initialPhotos.map((photo) => ({
        preview: photo.url,
        type: photo.type,
        caption: photo.caption,
      }));
      setPhotos(converted);
    }
  }, [initialPhotos]);

  const handlePhotoUpload = useCallback((file: File) => {
    if (photos.length >= maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed`);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhoto: ReviewPhoto = {
        file,
        preview: reader.result as string,
        type: 'general',
        caption: '',
      };

      setPhotos((prev) => {
        const updated = [...prev, newPhoto];
        onPhotosChange?.(updated);
        return updated;
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  }, [photos.length, maxPhotos, onPhotosChange]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      onPhotosChange?.(updated);
      return updated;
    });
  }, [onPhotosChange]);

  const handleUpdatePhoto = useCallback((index: number, updates: Partial<ReviewPhoto>) => {
    setPhotos((prev) => {
      const updated = prev.map((photo, i) =>
        i === index ? { ...photo, ...updates } : photo
      );
      onPhotosChange?.(updated);
      return updated;
    });
  }, [onPhotosChange]);

  const handleSubmit = async () => {
    if (photos.length === 0 && !reviewText.trim()) {
      setError('Please add at least one photo or write a review');
      return;
    }

    if (rating === 0) {
      setError('Please select a rating');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (onSubmit) {
        await onSubmit(photos, rating);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Photo Upload Area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-nilin-charcoal">
            Add Photos ({photos.length}/{maxPhotos})
          </h3>
          {showBeforeAfter && photos.length > 0 && (
            <p className="text-xs text-nilin-warmGray">
              Mark photos as Before/After to show transformation
            </p>
          )}
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {photos.map((photo, index) => (
            <PhotoThumbnail
              key={index}
              photo={photo}
              onRemove={() => handleRemovePhoto(index)}
              onCaptionChange={(caption) => handleUpdatePhoto(index, { caption })}
              onTypeChange={(type) => handleUpdatePhoto(index, { type })}
              showBeforeAfter={showBeforeAfter}
            />
          ))}

          {photos.length < maxPhotos && (
            <ImageUpload
              onUpload={handlePhotoUpload}
              maxFileSize={maxFileSize}
              className="aspect-square"
            />
          )}
        </div>
      </div>

      {/* View Gallery Button */}
      {photos.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openGallery(0)}
          leftIcon={<Image className="h-4 w-4" />}
        >
          View All Photos ({photos.length})
        </Button>
      )}

      {/* Rating */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-nilin-charcoal">
          Rate your experience
        </label>
        <div className="flex items-center gap-4">
          <StarRatingInput value={rating} onChange={setRating} size="lg" />
          <span className="text-sm text-nilin-warmGray">
            {rating > 0 ? `${rating}/5 stars` : 'Tap to rate'}
          </span>
        </div>
      </div>

      {/* Review Text */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-nilin-charcoal">
          Share your experience (optional)
        </label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          placeholder="Tell others about your experience..."
          rows={4}
          className={cn(
            'w-full px-4 py-3 rounded-xl border border-nilin-blush/50',
            'focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral',
            'text-nilin-charcoal resize-none'
          )}
        />
        <p className="text-xs text-nilin-warmGray text-right">
          {reviewText.length}/500 characters
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        variant="primary"
        fullWidth
        onClick={handleSubmit}
        loading={isSubmitting}
        disabled={isSubmitting}
        leftIcon={<Send className="h-4 w-4" />}
      >
        Submit Review
      </Button>

      {/* Verification Notice */}
      {requireVerification && (
        <p className="text-xs text-nilin-warmGray text-center">
          Photos may be marked as verified after staff review
        </p>
      )}

      {/* Photo Gallery Modal */}
      <PhotoGalleryModal
        photos={photos}  // FIX: Use current photos state instead of initialPhotos
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialIndex={galleryIndex}
      />
    </div>
  );
};

// =============================================================================
// Photo Gallery Component (Standalone)
// =============================================================================

interface StandalonePhotoGalleryProps {
  photos: PhotoReviewItem[];
  title?: string;
  showFilter?: boolean;
  className?: string;
}

export const PhotoGallery: React.FC<StandalonePhotoGalleryProps> = ({
  photos,
  title = 'Photo Gallery',
  showFilter = true,
  className,
}) => {
  const [filter, setFilter] = useState<'all' | 'before' | 'after'>('all');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const filteredPhotos = filter === 'all'
    ? photos
    : photos.filter((p) => p.type === filter);

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-nilin-charcoal">{title}</h3>
        <Badge variant="default" size="sm">
          {photos.length} photos
        </Badge>
      </div>

      {/* Filter Tabs */}
      {showFilter && (
        <div className="flex items-center gap-2">
          {(['all', 'before', 'after'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
                filter === f
                  ? 'bg-nilin-coral text-white'
                  : 'bg-nilin-blush/50 text-nilin-charcoal hover:bg-nilin-blush'
              )}
            >
              {f === 'all' ? 'All' : f === 'before' ? 'Before' : 'After'}
            </button>
          ))}
        </div>
      )}

      {/* Photo Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="text-center py-8 text-nilin-warmGray">
          No photos in this category
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {filteredPhotos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => openGallery(index)}
              className="relative aspect-square rounded-lg overflow-hidden group"
            >
              <img
                src={photo.thumbnailUrl || photo.url}
                alt={photo.caption || 'Photo'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Type Badge */}
              {photo.type !== 'general' && (
                <div className="absolute bottom-1 left-1">
                  <Badge
                    variant={photo.type === 'before' ? 'default' : 'success'}
                    size="sm"
                    className="bg-black/60 text-white border-0 px-1 py-0.5 text-xs"
                  >
                    {photo.type === 'before' ? 'B' : 'A'}
                  </Badge>
                </div>
              )}

              {/* Verified Badge */}
              {photo.verified && (
                <div className="absolute top-1 right-1">
                  <Badge variant="success" size="sm" className="bg-green-500 border-0">
                    <CheckCircle className="h-3 w-3" />
                  </Badge>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Gallery Modal */}
      <PhotoGalleryModal
        photos={filteredPhotos}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialIndex={galleryIndex}
      />
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default PhotoReview;
