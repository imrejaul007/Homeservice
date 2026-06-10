/**
 * Write Review Modal Component
 * Allows customers to write reviews for completed bookings
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Camera,
  Clock,
  Calendar,
  User,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { reviewsApi, type Review } from '../../services/reviewsApi';
import { bookingApi } from '../../services/bookingApi';
import { toast } from 'react-hot-toast';

// Types
interface BookingForReview {
  _id: string;
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  providerAvatar?: string;
  completedAt: string;
  serviceCategory?: string;
}

interface WriteReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedBookingId?: string;
  onReviewSubmitted?: (reviewId: string) => void;
}

// Star Rating Component
interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  const [hoverValue, setHoverValue] = useState(0);

  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating" aria-describedby="rating-description">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverValue(star)}
            onMouseLeave={() => setHoverValue(0)}
            onFocus={() => setHoverValue(star)}
            className="transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral rounded p-0.5"
            aria-label={`${star} star${star !== 1 ? 's' : ''} - ${ratingLabels[star]}`}
          >
            <Star
              className={`${sizes[size]} ${
                (hoverValue || value) >= star
                  ? 'fill-amber-400 text-amber-400'
                  : 'fill-gray-200 text-gray-200'
              } transition-colors`}
            />
          </button>
        ))}
      </div>
      <span id="rating-description" className="text-sm text-nilin-warmGray">
        {value > 0 ? ratingLabels[value] : 'Tap a star to rate'}
      </span>
    </div>
  );
};

// Booking Selection Card
interface BookingCardProps {
  booking: BookingForReview;
  selected: boolean;
  onSelect: () => void;
}

const BookingCard: React.FC<BookingCardProps> = ({ booking, selected, onSelect }) => {
  const completedDate = new Date(booking.completedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-nilin-coral bg-nilin-coral/5'
          : 'border-gray-200 hover:border-nilin-coral/50 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-nilin-coral/10 flex items-center justify-center flex-shrink-0">
          {booking.providerAvatar ? (
            <img
              src={booking.providerAvatar}
              alt=""
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <User className="w-6 h-6 text-nilin-coral" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-nilin-charcoal truncate">{booking.serviceName}</h4>
          <p className="text-sm text-nilin-warmGray">with {booking.providerName}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-nilin-warmGray">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {completedDate}
            </span>
            <span className="font-mono text-nilin-coral">#{booking.bookingNumber.slice(-6)}</span>
          </div>
        </div>
        {selected && (
          <div className="w-6 h-6 rounded-full bg-nilin-coral flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
    </button>
  );
};

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  open,
  onOpenChange,
  preSelectedBookingId,
  onReviewSubmitted,
}) => {
  const navigate = useNavigate();

  // State
  const [completedBookings, setCompletedBookings] = useState<BookingForReview[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<BookingForReview | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'write'>('select');

  // Focus trap refs
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus trap effect
  useEffect(() => {
    if (!open) return;

    // Store the currently focused element before modal opens
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the first interactive element in the modal
    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      // Focus the first element after a brief delay to ensure modal is rendered
      setTimeout(() => focusableElements[0]?.focus(), 50);
    }

    // Restore focus when modal closes
    return () => {
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [open]);

  // Tab key trap effect
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: move backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: move forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Fetch completed bookings that haven't been reviewed
  const fetchCompletedBookings = useCallback(async () => {
    try {
      setIsLoadingBookings(true);
      setError(null);

      const response = await bookingApi.getBookings({
        reviewable: true,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const bookings: BookingForReview[] = response.bookings.map((booking) => ({
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        serviceName: booking.service?.name || 'Service',
        providerName: booking.provider
          ? `${booking.provider.firstName}${booking.provider.lastName ? ` ${booking.provider.lastName}` : ''}`
          : 'Provider',
        providerAvatar: booking.provider?.avatar,
        completedAt: booking.completedAt || (booking as any).estimatedEndTime || new Date().toISOString(),
        serviceCategory: booking.service?.category,
      }));

      setCompletedBookings(bookings);

      // Auto-select if preSelectedBookingId is provided
      if (preSelectedBookingId) {
        const preselected = bookings.find((b) => b._id === preSelectedBookingId);
        if (preselected) {
          setSelectedBooking(preselected);
          setStep('write');
        }
      }
    } catch (err) {
      console.error('Failed to fetch completed bookings:', err);
      setError('Failed to load completed bookings. Please try again.');
    } finally {
      setIsLoadingBookings(false);
    }
  }, [preSelectedBookingId]);

  useEffect(() => {
    if (!open) {
      setStep('select');
      setSelectedBooking(null);
      setRating(0);
      setTitle('');
      setComment('');
      setError(null);
      setCompletedBookings([]);
      return;
    }
    fetchCompletedBookings();
  }, [open, fetchCompletedBookings]);

  const handleSelectBooking = (booking: BookingForReview) => {
    setSelectedBooking(booking);
    setStep('write');
  };

  const handleBackToSelect = () => {
    setStep('select');
    setSelectedBooking(null);
  };

  const handleSubmit = async () => {
    if (!selectedBooking || rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    if (comment.trim().length < 10) {
      toast.error('Please write at least 10 characters in your review');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await reviewsApi.submitReview(selectedBooking._id, {
        rating,
        comment: comment.trim(),
        title: title.trim() || undefined,
      });

      if (response.success) {
        toast.success('Review submitted successfully! It will appear after admin approval.');
        onReviewSubmitted?.(response.data.review._id || response.data.review.id);
        onOpenChange(false);
      }
    } catch (err: unknown) {
      console.error('Failed to submit review:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to submit review. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = rating > 0 && comment.trim().length >= 10;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
    >
      {/* Focus trap container */}
      <div ref={modalRef}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-nilin-border">
        <div className="flex items-center gap-3">
          {step === 'write' && (
            <button
              onClick={handleBackToSelect}
              className="p-2 -ml-2 rounded-lg hover:bg-nilin-muted transition-colors"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-serif text-nilin-charcoal">
              {step === 'select' ? 'Write a Review' : 'Your Review'}
            </h2>
            {selectedBooking && step === 'write' && (
              <p className="text-sm text-nilin-warmGray">
                for {selectedBooking.serviceName}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="p-2 rounded-lg hover:bg-nilin-muted transition-colors"
        >
          <X className="w-5 h-5 text-nilin-warmGray" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 1: Select Booking */}
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-nilin-warmGray mb-4">
              Select a completed service to review:
            </p>

            {isLoadingBookings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-nilin-warmGray mb-4">{error}</p>
                <button
                  onClick={fetchCompletedBookings}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : completedBookings.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
                  <Star className="w-8 h-8 text-nilin-coral" />
                </div>
                <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
                  Nothing to Review Yet
                </h3>
                <p className="text-sm text-nilin-warmGray mb-4">
                  Complete a service first — then you can share your experience here.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/customer/book-services');
                  }}
                  className="px-5 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl font-medium"
                >
                  Book a Service
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {completedBookings.map((booking) => (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    selected={selectedBooking?._id === booking._id}
                    onSelect={() => handleSelectBooking(booking)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Write Review */}
        {step === 'write' && selectedBooking && (
          <div className="space-y-6">
            {/* Selected Service Info */}
            <div className="flex items-center gap-4 p-4 bg-nilin-muted/50 rounded-xl">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                {selectedBooking.providerAvatar ? (
                  <img
                    src={selectedBooking.providerAvatar}
                    alt=""
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-nilin-coral" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-nilin-charcoal">
                  {selectedBooking.serviceName}
                </h4>
                <p className="text-sm text-nilin-warmGray">
                  with {selectedBooking.providerName}
                </p>
              </div>
            </div>

            {/* Rating */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-nilin-charcoal">
                Your Rating <span className="text-red-500">*</span>
              </label>
              <StarRating value={rating} onChange={setRating} size="lg" />
              {rating === 0 && (
                <p className="text-xs text-nilin-warmGray">Tap a star to rate</p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-nilin-charcoal">
                Review Title <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience..."
                maxLength={100}
                className="w-full px-4 py-3 rounded-xl border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-colors"
              />
              <p className="text-xs text-nilin-warmGray text-right">{title.length}/100</p>
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-nilin-charcoal">
                Your Review <span className="text-red-500">*</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience with this service. What did you like? What could be improved?"
                rows={5}
                maxLength={1000}
                className={`w-full px-4 py-3 rounded-xl border resize-none focus:ring-2 focus:ring-nilin-coral/20 outline-none transition-colors ${
                  comment.trim().length > 0 && comment.trim().length < 10
                    ? 'border-amber-400 bg-amber-50'
                    : 'border-nilin-border focus:border-nilin-coral'
                }`}
              />
              <div className="flex items-center justify-between">
                {comment.trim().length > 0 && comment.trim().length < 10 ? (
                  <p className="text-xs text-amber-600">
                    At least 10 characters required ({10 - comment.trim().length} more)
                  </p>
                ) : (
                  <span />
                )}
                <p className={`text-xs ${comment.length >= 900 ? 'text-amber-600' : 'text-nilin-warmGray'}`}>
                  {comment.length}/1000
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Note */}
            <div className="p-4 bg-nilin-muted/50 rounded-xl">
              <p className="text-xs text-nilin-warmGray">
                <strong>Note:</strong> Your review will be submitted for admin approval and will appear on the provider's profile once approved. Reviews can be edited within 30 days of submission.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {step === 'write' && (
        <div className="p-6 border-t border-nilin-border">
          <div className="flex gap-3">
            <button
              onClick={handleBackToSelect}
              className="flex-1 py-3 rounded-xl border border-nilin-border text-nilin-charcoal font-medium hover:bg-nilin-muted transition-colors"
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                isComplete && !isSubmitting
                  ? 'bg-gradient-to-r from-nilin-coral to-nilin-rose text-white hover:shadow-nilin-warm'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Star className="w-5 h-5" />
                  Submit Review
                </>
              )}
            </button>
          </div>
        </div>
      )}
      </div>
    </Modal>
  );
};

export default WriteReviewModal;
