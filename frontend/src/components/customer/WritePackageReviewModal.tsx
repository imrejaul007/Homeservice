/**
 * Write Package Review Modal Component
 * Allows customers to write reviews directly from the package detail page
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Star,
  X,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
  Clock,
  Package,
} from 'lucide-react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Modal } from '../common/Modal';
import { reviewsApi } from '../../services/reviewsApi';
import { toast } from 'react-hot-toast';

interface WritePackageReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageId: string;
  packageName: string;
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

export const WritePackageReviewModal: React.FC<WritePackageReviewModalProps> = ({
  open,
  onOpenChange,
  packageId,
  packageName,
  onReviewSubmitted,
}) => {
  // State
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<{
    eligible: boolean;
    reason?: string;
    message?: string;
    daysRemaining?: number;
    reviewWindowDays?: number;
  } | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(true);

  // Focus trap refs
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Check eligibility when modal opens
  const checkEligibility = useCallback(async () => {
    if (!open || !packageId) return;

    setIsCheckingEligibility(true);
    setError(null);

    try {
      const response = await reviewsApi.getPackageReviewEligibility(packageId);
      setEligibility(response.data);
    } catch (err: unknown) {
      console.error('Failed to check review eligibility:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to check eligibility';
      setError(errMsg);
      setEligibility({ eligible: false, reason: 'error', message: errMsg });
    } finally {
      setIsCheckingEligibility(false);
    }
  }, [open, packageId]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setRating(0);
      setTitle('');
      setComment('');
      setError(null);
      setEligibility(null);
      return;
    }
    checkEligibility();
  }, [open, checkEligibility]);

  // Focus trap effect
  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      setTimeout(() => focusableElements[0]?.focus(), 50);
    }

    return () => {
      if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
        previousActiveElement.current.focus();
      }
    };
  }, [open]);

  const handleSubmit = async () => {
    if (!eligibility?.eligible) {
      toast.error('You are not eligible to review this package');
      return;
    }

    if (rating === 0) {
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
      const response = await reviewsApi.submitPackageReview(packageId, {
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

  const isComplete = eligibility?.eligible && rating > 0 && comment.trim().length >= 10;

  // Render eligibility check state
  if (isCheckingEligibility) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogPrimitive.Title className="sr-only">Write a Review for {packageName}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">Checking if you are eligible to write a review for this package.</DialogPrimitive.Description>
        <div className="flex-1 flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
        </div>
      </Modal>
    );
  }

  // Render not eligible state
  if (eligibility && !eligibility.eligible) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        <DialogPrimitive.Title className="sr-only">Write a Review for {packageName}</DialogPrimitive.Title>
        <DialogPrimitive.Description className="sr-only">
          {eligibility.reason === 'already_reviewed'
            ? 'You have already reviewed this package.'
            : eligibility.reason === 'no_booking'
              ? 'You must complete a booking for this package before reviewing.'
              : eligibility.reason === 'package_not_found'
                ? 'This package is no longer available or has been removed.'
                : 'The review window has expired.'}
        </DialogPrimitive.Description>
        <div ref={modalRef}>
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-nilin-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-nilin-coral" />
              </div>
              <div>
                <h2 className="text-xl font-serif text-nilin-charcoal">Write a Review</h2>
                <p className="text-sm text-nilin-warmGray truncate max-w-[200px]">{packageName}</p>
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
            <div className="text-center py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                eligibility.reason === 'already_reviewed'
                  ? 'bg-green-100'
                  : eligibility.reason === 'package_not_found'
                    ? 'bg-gray-100'
                    : 'bg-amber-100'
              }`}>
                {eligibility.reason === 'already_reviewed' ? (
                  <CheckCircle className="w-8 h-8 text-green-600" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-amber-600" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
                {eligibility.reason === 'already_reviewed'
                  ? 'Already Reviewed'
                  : eligibility.reason === 'no_booking'
                    ? 'No Completed Booking'
                    : eligibility.reason === 'package_not_found'
                      ? 'Package Unavailable'
                      : 'Review Window Expired'}
              </h3>
              <p className="text-sm text-nilin-warmGray mb-4 max-w-sm mx-auto">
                {eligibility.message}
              </p>
              {eligibility.reason === 'review_window_expired' && (
                <p className="text-xs text-nilin-warmGray">
                  Reviews must be submitted within {eligibility.reviewWindowDays || 14} days of service completion.
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-nilin-border">
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-3 rounded-xl bg-gray-100 text-nilin-charcoal font-medium hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  // Render review form
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col"
    >
      <DialogPrimitive.Title className="sr-only">Write a Review for {packageName}</DialogPrimitive.Title>
      <DialogPrimitive.Description className="sr-only">
        Share your experience with this package. Your review will be submitted for admin approval.
      </DialogPrimitive.Description>
      <div ref={modalRef}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-nilin-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
              <Star className="w-5 h-5 text-nilin-coral" />
            </div>
            <div>
              <h2 className="text-xl font-serif text-nilin-charcoal">Write a Review</h2>
              <p className="text-sm text-nilin-warmGray truncate max-w-[200px]">{packageName}</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Package Info */}
          <div className="flex items-center gap-4 p-4 bg-nilin-muted/50 rounded-xl">
            <div className="w-12 h-12 rounded-full bg-nilin-coral/10 flex items-center justify-center">
              <Package className="w-6 h-6 text-nilin-coral" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-nilin-charcoal">{packageName}</h4>
              <p className="text-sm text-nilin-warmGray">
                {eligibility?.daysRemaining !== undefined && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {eligibility.daysRemaining} days left to review
                  </span>
                )}
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
              placeholder="Share your experience with this package. What did you like? What could be improved?"
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
              <strong>Note:</strong> Your review will be submitted for admin approval and will appear on the package page once approved. Reviews can be edited within 30 days of submission.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-nilin-border">
          <div className="flex gap-3">
            <button
              onClick={() => onOpenChange(false)}
              className="flex-1 py-3 rounded-xl border border-nilin-border text-nilin-charcoal font-medium hover:bg-nilin-muted transition-colors"
              disabled={isSubmitting}
            >
              Cancel
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
      </div>
    </Modal>
  );
};

export default WritePackageReviewModal;
