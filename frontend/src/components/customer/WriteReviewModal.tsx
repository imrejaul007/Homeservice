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
  Calendar,
  User,
  Sparkles,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { reviewsApi } from '../../services/reviewsApi';
import { bookingService } from '../../services/BookingService';
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
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

  // Brand-consistent NILIN gradient colors for stars
  const getStarColor = (star: number, isFilled: boolean) => {
    if (!isFilled) return 'text-nilin-border';
    if (star === 5) return 'text-nilin-coral'; // Brand highlight for 5 stars
    if (star >= 4) return 'text-nilin-rose';  // NILIN rose for 4 stars
    return 'text-nilin-rose/70';               // Subtle NILIN rose for 1-3 stars
  };

  // Glow effect for selected/highlighted stars using NILIN coral
  const getStarGlow = (star: number, isFilled: boolean, isHovered: boolean) => {
    if (!isFilled) return '';
    if (star === 5) return 'drop-shadow-[0_0_8px_rgba(239,107,102,0.6)]'; // Coral glow for 5
    if (star >= 4) return 'drop-shadow-[0_0_6px_rgba(239,107,102,0.4)]';    // Coral glow for 4+
    return 'drop-shadow-[0_0_4px_rgba(239,107,102,0.3)]';                  // Coral glow for 1-3
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Premium star row with animated background */}
      <div className="relative px-4 py-6 bg-gradient-to-b from-nilin-cream/30 to-transparent rounded-nilin-lg">
        <div className="flex items-center justify-center gap-1" role="radiogroup" aria-label="Rating (required)" aria-describedby="rating-description">
          {[1, 2, 3, 4, 5].map((star) => {
            const isFilled = (hoverValue || value) >= star;
            const isHovered = hoverValue > 0 && hoverValue === star;
            const isSelected = value >= star;

            return (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                onMouseEnter={() => setHoverValue(star)}
                onMouseLeave={() => setHoverValue(0)}
                onFocus={() => setHoverValue(star)}
                className={`
                  relative transition-all duration-300 ease-out rounded-nilin-lg p-1.5
                  ${isHovered ? 'scale-110' : 'hover:scale-105'}
                  ${isSelected && !isHovered ? 'scale-105' : ''}
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2
                  will-change-transform
                `}
                aria-label={`${star} star${star !== 1 ? 's' : ''} - ${ratingLabels[star]}`}
                aria-checked={isFilled}
              >
                {/* Subtle background pulse for selected stars */}
                {isSelected && !isHovered && (
                  <span className="absolute inset-0 bg-nilin-coral/10 rounded-xl animate-pulse" />
                )}

                <Star
                  className={`
                    ${sizes[size]}
                    ${isFilled ? 'fill-current' : 'fill-none'}
                    ${getStarColor(star, isFilled)}
                    ${getStarGlow(star, isFilled, isHovered)}
                    transition-all duration-300 ease-out
                  `}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating label with smooth transition */}
      <div aria-live="polite" aria-atomic="true">
        <span
          id="rating-description"
          className={`
            block text-center text-base font-medium transition-colors duration-300
            ${value > 0 ? 'text-nilin-charcoal' : 'text-nilin-warmGray'}
          `}
        >
          {value > 0 ? ratingLabels[value] : 'Tap a star to rate'}
        </span>
      </div>
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
      aria-pressed={selected}
      aria-selected={selected}
      className={`
        w-full text-left p-4 rounded-nilin-lg border-2 transition-all duration-200
        ${selected
          ? 'border-nilin-coral bg-gradient-to-r from-nilin-coral/8 to-nilin-rose/5 shadow-sm shadow-nilin-coral/10'
          : 'border-nilin-border hover:border-nilin-coral/40 hover:bg-nilin-cream/50 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-start gap-4">
        <div className="relative">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
            selected
              ? 'bg-gradient-to-br from-nilin-coral to-nilin-rose ring-2 ring-white shadow-md'
              : 'bg-nilin-coral/10'
          }`}>
            {booking.providerAvatar ? (
              <img
                src={booking.providerAvatar}
                alt=""
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className={`w-6 h-6 ${selected ? 'text-white' : 'text-nilin-coral'}`} />
            )}
          </div>
          {selected && (
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-nilin-coral flex items-center justify-center ring-2 ring-white">
              <CheckCircle className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-nilin-charcoal truncate">{booking.serviceName}</h4>
          <p className="text-sm text-nilin-warmGray">with {booking.providerName}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-nilin-warmGray">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3" />
              {completedDate}
            </span>
            <span className={`font-mono px-2 py-0.5 rounded-full text-xs ${
              selected ? 'bg-nilin-coral/15 text-nilin-coral' : 'bg-nilin-muted text-nilin-warmGray'
            }`}>
              #{booking.bookingNumber.slice(-6)}
            </span>
          </div>
        </div>
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

      const response = await bookingService.getCustomerBookings({
        reviewable: true,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      const bookings: BookingForReview[] = (response.data?.bookings || []).map((booking) => ({
        _id: booking._id,
        bookingNumber: booking.bookingNumber,
        serviceName: booking.service?.name || 'Service',
        providerName: booking.provider
          ? `${booking.provider.firstName}${booking.provider.lastName ? ` ${booking.provider.lastName}` : ''}`
          : 'Provider',
        providerAvatar: booking.provider?.avatar,
        completedAt: booking.completedAt || booking.estimatedEndTime || new Date().toISOString(),
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
    setError(null);
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
      className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col glass-nilin-strong rounded-nilin-lg"
    >
      <div ref={modalRef}>
      {/* Premium Header with gradient accent */}
      <div className="flex items-center justify-between p-5 border-b border-nilin-border bg-gradient-to-r from-nilin-cream/70 via-nilin-cream/40 to-transparent relative">
        {/* Top accent line */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-nilin-coral via-nilin-rose to-transparent rounded-b-full opacity-80" />
        <div className={`flex items-center gap-3 ${step === 'write' ? '' : 'pl-9'}`}>
          {step === 'write' && (
            <button
              onClick={handleBackToSelect}
              aria-label="Go back to booking selection"
              className="p-2 -ml-2 rounded-full hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <div>
            <h2 id="review-modal-title" className="text-xl font-serif text-nilin-charcoal">
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
          aria-label="Close review modal"
          className="p-2 rounded-full hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
        >
          <X className="w-5 h-5 text-nilin-warmGray" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Step 1: Select Booking */}
        {step === 'select' && (
          <div className="space-y-4">
            <p className="text-sm text-nilin-warmGray mb-5 leading-relaxed">
              Select a completed service to share your experience:
            </p>

            {isLoadingBookings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-8 h-8 text-nilin-coral" />
                </div>
                <p className="text-nilin-charcoal mb-4 font-medium">{error}</p>
                <button
                  onClick={fetchCompletedBookings}
                  className="px-5 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-nilin-lg font-medium hover:shadow-lg hover:shadow-nilin-coral/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  Try Again
                </button>
              </div>
            ) : completedBookings.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 animate-pulse" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 flex items-center justify-center border border-nilin-coral/20">
                    <Sparkles className="w-9 h-9 text-nilin-coral" />
                  </div>
                </div>
                <h3 className="text-xl font-serif text-nilin-charcoal mb-2">
                  All Caught Up
                </h3>
                <p className="text-sm text-nilin-warmGray mb-8 max-w-[260px] mx-auto leading-relaxed">
                  Complete a service to unlock the ability to share your experience.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/customer/book-services');
                  }}
                  className="px-6 py-3 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-full font-medium shadow-lg shadow-nilin-coral/25 hover:shadow-xl hover:shadow-nilin-coral/30 transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
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
            {/* Selected Service Info - Premium Card */}
            <div className="flex items-center gap-4 p-5 bg-gradient-to-br from-nilin-coral/8 via-nilin-rose/5 to-nilin-cream/30 rounded-nilin-lg border border-nilin-coral/15 shadow-sm">
              {/* Avatar with gradient ring */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center ring-4 ring-white shadow-lg">
                  {selectedBooking.providerAvatar ? (
                    <img
                      src={selectedBooking.providerAvatar}
                      alt=""
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-nilin-coral" />
                  )}
                </div>
                {/* Completed badge */}
                <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-nilin-coral text-white text-xs font-medium rounded-full shadow-sm">
                  Done
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-nilin-charcoal text-lg leading-tight">
                  {selectedBooking.serviceName}
                </h4>
                <p className="text-sm text-nilin-warmGray mt-0.5">
                  with {selectedBooking.providerName}
                </p>
              </div>

              {/* Premium badge */}
              <div className="px-3.5 py-1.5 bg-gradient-to-r from-nilin-coral/15 to-nilin-rose/10 rounded-full border border-nilin-coral/20">
                <span className="text-xs font-semibold bg-gradient-to-r from-nilin-coral to-nilin-rose bg-clip-text text-transparent">Ready to review</span>
              </div>
            </div>

            {/* Rating Section - Premium */}
            <div className="space-y-4 p-5 bg-gradient-to-b from-nilin-cream/40 to-transparent rounded-nilin-lg border border-nilin-coral/15">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-nilin-charcoal">
                  Your Rating <span className="text-nilin-coral">*</span>
                </label>
                {rating > 0 && (
                  <span className="text-xs text-nilin-coral font-medium flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {rating}/5
                  </span>
                )}
              </div>
              <StarRating value={rating} onChange={setRating} size="lg" />
            </div>

            {/* Title */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label htmlFor="review-title" className="block text-sm font-semibold text-nilin-charcoal">
                  Review Title <span className="text-nilin-warmGray font-normal">(optional)</span>
                </label>
                <span className="text-xs text-nilin-warmGray">{title.length}/100</span>
              </div>
              <div className="relative">
                <input
                  id="review-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summarize your experience..."
                  maxLength={100}
                  className="w-full px-4 py-3.5 rounded-nilin-lg border border-nilin-border bg-nilin-cream/20 focus:bg-white
                    focus:border-nilin-coral focus:ring-4 focus:ring-nilin-coral/10 outline-none transition-all
                    placeholder:text-nilin-warmGray/50 font-medium shadow-sm"
                />
              </div>
            </div>

            {/* Comment */}
            <div className="space-y-4 p-5 bg-nilin-cream/30 rounded-nilin-lg border border-nilin-border/30">
              <div className="flex items-center justify-between">
                <label htmlFor="review-comment" className="block text-sm font-semibold text-nilin-charcoal">
                  Your Review <span className="text-nilin-coral">*</span>
                </label>
                <span className={`text-xs ${comment.length >= 900 ? 'text-nilin-warning font-semibold' : 'text-nilin-warmGray'}`}>
                  {comment.length}/1000
                </span>
              </div>
              <div className="relative">
                <textarea
                  id="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience with this service. What did you like? What could be improved?"
                  rows={5}
                  maxLength={1000}
                  className={`
                    w-full px-4 py-3.5 rounded-nilin-lg border resize-none
                    outline-none transition-all placeholder:text-nilin-warmGray/50 font-medium shadow-sm
                    ${comment.trim().length > 0 && comment.trim().length < 10
                      ? 'border-nilin-warning bg-nilin-warning/10 focus:border-nilin-warning focus:ring-4 focus:ring-nilin-warning/10'
                      : 'border-nilin-border bg-white focus:border-nilin-coral focus:ring-4 focus:ring-nilin-coral/10'
                    }
                  `}
                />
                {/* Character progress bar */}
                <div className="absolute bottom-3 right-3 left-3 h-1 bg-nilin-border/30 rounded-full">
                  <div
                    className={`
                      h-full rounded-full transition-all duration-300
                      ${comment.length >= 900 ? 'bg-nilin-warning' : comment.length >= 500 ? 'bg-nilin-coral' : 'bg-nilin-coral/60'}
                    `}
                    style={{ width: `${Math.min((comment.length / 1000) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                {comment.trim().length > 0 && comment.trim().length < 10 ? (
                  <div role="alert" className="text-xs text-nilin-warning flex items-center gap-1.5 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-nilin-warning animate-pulse" />
                    {10 - comment.trim().length} more characters needed
                  </div>
                ) : (
                  <span className="text-xs text-nilin-warmGray/60">Be specific and detailed</span>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-4 bg-gradient-to-r from-nilin-coral/10 to-nilin-rose/5 border border-nilin-coral/20 rounded-nilin-lg flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-nilin-coral" />
                </div>
                <p className="text-sm text-nilin-charcoal font-medium">{error}</p>
              </div>
            )}

            {/* Note - Premium styling */}
            <div className="p-4 bg-nilin-cream/50 rounded-nilin-lg border border-nilin-border/30 shadow-sm">
              <p className="text-xs text-nilin-warmGray leading-relaxed">
                <span className="font-semibold text-nilin-charcoal">Note:</span> Your review will be submitted for admin approval and will appear on the provider's profile once approved. Reviews can be edited within 30 days of submission.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Premium Footer with gradient accent */}
      {step === 'write' && (
        <div className="p-5 border-t border-nilin-border bg-gradient-to-r from-transparent via-nilin-cream/40 to-transparent relative">
          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-nilin-rose/80 to-transparent rounded-t-full" />
          <div className="flex gap-3">
            <button
              onClick={handleBackToSelect}
              className="flex-1 py-3.5 rounded-nilin-lg border border-nilin-border/60 text-nilin-charcoal font-medium hover:bg-nilin-muted hover:border-nilin-border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
              disabled={isSubmitting}
            >
              Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              className={`
                flex-1 py-3.5 rounded-nilin-lg font-medium flex items-center justify-center gap-2 transition-all
                ${isComplete && !isSubmitting
                  ? 'bg-gradient-to-r from-nilin-coral to-nilin-rose text-white shadow-lg shadow-nilin-coral/25 hover:shadow-xl hover:shadow-nilin-coral/35 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2'
                  : 'bg-nilin-muted text-nilin-lightGray cursor-not-allowed'
                }
              `}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Star className="w-5 h-5" />
                  <span>Submit Review</span>
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
