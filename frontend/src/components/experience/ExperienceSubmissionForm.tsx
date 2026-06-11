import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Star,
  Upload,
  Image as ImageIcon,
  Video,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Trash2,
  GripVertical
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { experienceApi } from '../../services/experienceApi';
import type { AvailableBooking } from '../../types/experience';

interface ExperienceSubmissionFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  bookingId?: string;
  experienceId?: string;
  initialData?: Partial<FormData>;
  requireBooking?: boolean;
  lockBooking?: boolean;
}

interface FormData {
  bookingId: string;
  rating: number;
  title: string;
  description: string;
  images: (File | string)[];
  videoUrl: string;
}

interface FormErrors {
  bookingId?: string;
  rating?: string;
  title?: string;
  description?: string;
  images?: string;
  videoUrl?: string;
  general?: string;
}

const ExperienceSubmissionForm: React.FC<ExperienceSubmissionFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
  bookingId,
  experienceId,
  initialData,
  requireBooking = false,
  lockBooking = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [availableBookings, setAvailableBookings] = useState<AvailableBooking[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    bookingId: bookingId || '',
    rating: 0,
    title: '',
    description: '',
    images: [],
    videoUrl: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [hoverRating, setHoverRating] = useState(0);

  // Load available bookings when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableBookings();
      if (bookingId) {
        setFormData((prev) => ({ ...prev, bookingId }));
      } else if (initialData) {
        setFormData((prev) => ({ ...prev, ...initialData }));
      }
    }
  }, [isOpen, bookingId, initialData]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        bookingId: '',
        rating: 0,
        title: '',
        description: '',
        images: [],
        videoUrl: ''
      });
      setErrors({});
      setShowSuccess(false);
      setUploadProgress({});
    }
  }, [isOpen]);

  const fetchAvailableBookings = async () => {
    setIsLoading(true);
    try {
      const response = await experienceApi.getAvailableBookings();
      if (response.success && response.data.bookings) {
        setAvailableBookings(response.data.bookings);
      }
    } catch (error) {
      console.error('Error fetching available bookings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = useCallback((
    field: keyof FormData,
    value: string | number | (File | string)[]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newFiles: File[] = [];
    const maxImages = 10;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file
      const validation = experienceApi.isValidImageFile(file);
      if (!validation.valid) {
        setErrors(prev => ({ ...prev, images: validation.error }));
        continue;
      }

      // Check max images
      const currentImageCount = formData.images.filter(img => !(img instanceof File)).length;
      const newFileCount = formData.images.filter(img => img instanceof File).length;

      if (currentImageCount + newFileCount + newFiles.length >= maxImages) {
        setErrors(prev => ({ ...prev, images: `Maximum ${maxImages} images allowed` }));
        break;
      }

      newFiles.push(file);
    }

    // Preview images
    for (const file of newFiles) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, e.target?.result as string]
        }));
      };
      reader.readAsDataURL(file);
    }
  }, [formData.images]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageUpload(e.dataTransfer.files);
  }, [handleImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  }, []);

  const selectedBooking = availableBookings.find(b => b._id === formData.bookingId);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (requireBooking && !formData.bookingId) {
      newErrors.bookingId = 'Please select a booking';
    }

    if (formData.rating < 1 || formData.rating > 5) {
      newErrors.rating = 'Please select a rating';
    }

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    } else if (formData.title.length > 100) {
      newErrors.title = 'Title must be less than 100 characters';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    } else if (formData.description.length > 2000) {
      newErrors.description = 'Description must be less than 2000 characters';
    }

    if (formData.videoUrl && !experienceApi.isValidVideoUrl(formData.videoUrl)) {
      newErrors.videoUrl = 'Please enter a valid YouTube or Vimeo URL';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = {
        ...(formData.bookingId && { bookingId: formData.bookingId }),
        title: formData.title.trim(),
        description: formData.description.trim(),
        rating: formData.rating,
        images: formData.images,
        videoUrl: formData.videoUrl.trim() || undefined,
      };

      const response = experienceId
        ? await experienceApi.updateExperience(experienceId, payload)
        : await experienceApi.submitExperience(payload);

      if (response.success) {
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
      } else {
        setErrors({ general: response.message || 'Failed to submit experience' });
      }
    } catch (error) {
      console.error('Error submitting experience:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to submit experience. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = () => {
    const bookingOk = requireBooking ? !!formData.bookingId : true;
    return (
      bookingOk &&
      formData.rating >= 1 &&
      formData.title.trim().length >= 5 &&
      formData.title.trim().length <= 100 &&
      formData.description.trim().length >= 20 &&
      formData.description.trim().length <= 2000
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-nilin-charcoal/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-nilin-lg animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-nilin-border/50 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Share Your Experience</h2>
            <p className="text-sm text-nilin-warmGray mt-1">
              Tell us about your NILIN experience
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-nilin-blush/50 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-nilin-warmGray" />
          </button>
        </div>

        {/* Success State */}
        {showSuccess ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-nilin-success/20 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-nilin-success" />
            </div>
            <h3 className="text-xl font-medium text-nilin-charcoal mb-2">
              {experienceId ? 'Experience Updated!' : 'Experience Submitted!'}
            </h3>
            <p className="text-nilin-warmGray">
              Submitted for review — we&apos;ll notify you when it&apos;s published.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="flex items-start gap-3 p-4 bg-nilin-error/10 border border-nilin-error/20 rounded-xl">
                <AlertCircle className="h-5 w-5 text-nilin-error flex-shrink-0 mt-0.5" />
                <p className="text-sm text-nilin-error">{errors.general}</p>
              </div>
            )}

            {/* Booking Selection (optional) */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Link to a Booking {requireBooking ? <span className="text-nilin-error">*</span> : <span className="text-nilin-warmGray font-normal">(optional)</span>}
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => !isLoading && !lockBooking && setShowDropdown(!showDropdown)}
                  disabled={isLoading || lockBooking}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-3 border rounded-xl transition-all',
                    errors.bookingId
                      ? 'border-nilin-error bg-nilin-error/5'
                      : 'border-nilin-border hover:border-nilin-coral/50',
                    isLoading && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2 text-nilin-warmGray">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading bookings...
                    </span>
                  ) : selectedBooking ? (
                    <span className="text-nilin-charcoal">
                      {selectedBooking.service.name} - {selectedBooking.provider.firstName} {selectedBooking.provider.lastName}
                    </span>
                  ) : (
                    <span className="text-nilin-warmGray">
                      {requireBooking ? 'Select a completed booking' : 'No booking linked (optional)'}
                    </span>
                  )}
                  <ChevronDown className={cn(
                    'h-5 w-5 text-nilin-warmGray transition-transform',
                    showDropdown && 'rotate-180'
                  )} />
                </button>

                {showDropdown && !lockBooking && (
                  <div className="absolute z-20 w-full mt-2 bg-white border border-nilin-border rounded-xl shadow-lg overflow-hidden">
                    {!requireBooking && (
                      <button
                        type="button"
                        onClick={() => {
                          handleInputChange('bookingId', '');
                          setShowDropdown(false);
                        }}
                        className={cn(
                          'w-full px-4 py-3 text-left hover:bg-nilin-blush/30 transition-colors border-b border-nilin-border/50',
                          !formData.bookingId && 'bg-nilin-blush/50'
                        )}
                      >
                        <p className="font-medium text-nilin-charcoal text-sm">No booking link</p>
                        <p className="text-xs text-nilin-warmGray">Share a general NILIN experience</p>
                      </button>
                    )}
                    {availableBookings.length === 0 ? (
                      <div className="p-4 text-center text-nilin-warmGray text-sm">
                        No completed bookings available
                      </div>
                    ) : (
                      availableBookings.map((booking) => (
                        <button
                          key={booking._id}
                          type="button"
                          onClick={() => {
                            handleInputChange('bookingId', booking._id);
                            setShowDropdown(false);
                          }}
                          className={cn(
                            'w-full px-4 py-3 text-left hover:bg-nilin-blush/30 transition-colors',
                            formData.bookingId === booking._id && 'bg-nilin-blush/50'
                          )}
                        >
                          <p className="font-medium text-nilin-charcoal text-sm">
                            {booking.service.name}
                          </p>
                          <p className="text-xs text-nilin-warmGray">
                            {booking.provider.firstName} {booking.provider.lastName} • Completed {new Date(booking.completedAt).toLocaleDateString()}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {errors.bookingId && (
                <p className="text-xs text-nilin-error mt-1">{errors.bookingId}</p>
              )}
            </div>

            {/* Star Rating */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Your Rating <span className="text-nilin-error">*</span>
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleInputChange('rating', star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={`Rate ${star} stars`}
                  >
                    <Star
                      className={cn(
                        'h-8 w-8 transition-colors',
                        star <= (hoverRating || formData.rating)
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-gray-300 fill-gray-300'
                      )}
                    />
                  </button>
                ))}
                <span className="ml-2 text-sm text-nilin-warmGray">
                  {formData.rating > 0 && (
                    ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][formData.rating - 1]
                  )}
                </span>
              </div>
              {errors.rating && (
                <p className="text-xs text-nilin-error mt-1">{errors.rating}</p>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Title <span className="text-nilin-error">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Give your experience a title"
                maxLength={100}
                className={cn(
                  'w-full px-4 py-3 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
                  errors.title ? 'border-nilin-error' : 'border-nilin-border focus:border-nilin-coral'
                )}
              />
              <div className="flex justify-between mt-1">
                {errors.title ? (
                  <p className="text-xs text-nilin-error">{errors.title}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-nilin-warmGray">
                  {formData.title.length}/100
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Description <span className="text-nilin-error">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Share the details of your experience. What did you like? What made it special?"
                rows={5}
                maxLength={2000}
                className={cn(
                  'w-full px-4 py-3 border rounded-xl transition-all resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
                  errors.description ? 'border-nilin-error' : 'border-nilin-border focus:border-nilin-coral'
                )}
              />
              <div className="flex justify-between mt-1">
                {errors.description ? (
                  <p className="text-xs text-nilin-error">{errors.description}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-nilin-warmGray">
                  {formData.description.length}/2000
                </span>
              </div>
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Photos (Optional)
              </label>

              {/* Drop Zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
                  isDragging
                    ? 'border-nilin-coral bg-nilin-coral/5'
                    : 'border-nilin-border hover:border-nilin-coral/50',
                  errors.images && 'border-nilin-error'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                />
                <Upload className="h-10 w-10 mx-auto mb-3 text-nilin-warmGray" />
                <p className="text-nilin-charcoal font-medium">
                  Drag & drop your photos here
                </p>
                <p className="text-sm text-nilin-warmGray mt-1">
                  or click to browse • Max 10 photos
                </p>
              </div>

              {errors.images && (
                <p className="text-xs text-nilin-error mt-1">{errors.images}</p>
              )}

              {/* Image Previews */}
              {formData.images.length > 0 && (
                <div className="grid grid-cols-5 gap-3 mt-4">
                  {formData.images.map((image, index) => (
                    <div
                      key={index}
                      className="relative group aspect-square rounded-lg overflow-hidden bg-nilin-blush/30"
                    >
                      <img
                        src={typeof image === 'string' ? image : URL.createObjectURL(image)}
                        alt={`Upload ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 p-1 bg-nilin-error rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Video URL */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Video URL (Optional)
              </label>
              <div className="relative">
                <Video className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) => handleInputChange('videoUrl', e.target.value)}
                  placeholder="YouTube or Vimeo URL"
                  className={cn(
                    'w-full pl-12 pr-4 py-3 border rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
                    errors.videoUrl ? 'border-nilin-error' : 'border-nilin-border focus:border-nilin-coral'
                  )}
                />
              </div>
              {errors.videoUrl && (
                <p className="text-xs text-nilin-error mt-1">{errors.videoUrl}</p>
              )}
              <p className="text-xs text-nilin-warmGray mt-1">
                Share a video of your experience
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-nilin-border/50">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 border border-nilin-border rounded-xl text-nilin-charcoal hover:bg-nilin-blush/30 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!isFormValid() || isSubmitting}
                className={cn(
                  'flex-1 px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
                  isFormValid() && !isSubmitting
                    ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-nilin-warm btn-3d'
                    : 'bg-nilin-warmGray/50 text-white cursor-not-allowed'
                )}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Submit Experience
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ExperienceSubmissionForm;
