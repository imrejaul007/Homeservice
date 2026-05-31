/**
 * Review Draft Component for Customer Dashboard
 * Save, edit, and submit review drafts with auto-save functionality
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Star,
  Clock,
  Save,
  Send,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  Image as ImageIcon,
  X,
  Calendar,
  Briefcase,
  AlertCircle,
} from 'lucide-react';

// Types
export interface ReviewDraftData {
  id: string;
  bookingId: string;
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  scheduledDate: Date;
  rating?: number;
  title?: string;
  comment?: string;
  photos?: string[];
  isComplete: boolean;
  isExpired: boolean;
  expiresAt: Date;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    isExpired: boolean;
    formatted: string;
  };
  lastSavedAt: Date;
}

export interface ReviewDraftProps {
  bookingId: string;
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  scheduledDate: Date;
  initialData?: Partial<{
    rating: number;
    title: string;
    comment: string;
    photos: string[];
  }>;
  onSave: (data: {
    rating?: number;
    title?: string;
    comment?: string;
    photos?: string[];
  }) => Promise<{ success: boolean; isComplete?: boolean; error?: string }>;
  onSubmit: () => Promise<{ success: boolean; reviewId?: string; error?: string }>;
  onDelete?: () => Promise<{ success: boolean; error?: string }>;
  autoSaveInterval?: number; // milliseconds, default 30000 (30 seconds)
  minCommentLength?: number;
  maxCommentLength?: number;
}

export interface ReviewDraftListProps {
  drafts: ReviewDraftData[];
  onEditDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => Promise<void>;
  isLoading?: boolean;
}

// Star Rating Component
interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  readonly = false,
  size = 'md',
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-7 h-7',
    lg: 'w-8 h-8',
  };

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
          onMouseLeave={() => !readonly && setHoverValue(null)}
          className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform`}
        >
          <Star
            className={`${sizeClasses[size]} ${
              (hoverValue !== null ? star <= hoverValue : star <= value)
                ? 'fill-amber-400 text-amber-400'
                : 'fill-gray-200 text-gray-200'
            } transition-colors`}
          />
        </button>
      ))}
    </div>
  );
};

// Draft List Item Component
interface DraftListItemProps {
  draft: ReviewDraftData;
  onEdit: () => void;
  onDelete: () => void;
}

const DraftListItem: React.FC<DraftListItemProps> = ({ draft, onEdit, onDelete }) => {
  const isExpiringSoon =
    !draft.timeRemaining.isExpired &&
    (draft.timeRemaining.days < 1 || (draft.timeRemaining.days === 1 && draft.timeRemaining.hours < 12));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900">{draft.serviceName}</h4>
          <p className="text-sm text-gray-500">with {draft.providerName}</p>
        </div>
        <div className="flex items-center gap-2">
          {draft.isExpired && (
            <span className="px-2 py-1 bg-red-50 text-red-600 text-xs rounded-full font-medium">
              Expired
            </span>
          )}
          {!draft.isExpired && isExpiringSoon && (
            <span className="px-2 py-1 bg-amber-50 text-amber-600 text-xs rounded-full font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {draft.timeRemaining.formatted}
            </span>
          )}
          {draft.isComplete && !draft.isExpired && (
            <span className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded-full font-medium flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Ready
            </span>
          )}
        </div>
      </div>

      {draft.rating && (
        <div className="mb-3">
          <StarRating value={draft.rating} onChange={() => {}} readonly />
        </div>
      )}

      {draft.comment && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{draft.comment}</p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {new Date(draft.scheduledDate).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Saved {new Date(draft.lastSavedAt).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDelete}
            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Main Review Draft Editor Component
export const ReviewDraft: React.FC<ReviewDraftProps> = ({
  bookingId,
  bookingNumber,
  serviceName,
  providerName,
  scheduledDate,
  initialData,
  onSave,
  onSubmit,
  onDelete,
  autoSaveInterval = 30000,
  minCommentLength = 10,
  maxCommentLength = 1000,
}) => {
  const [rating, setRating] = useState<number>(initialData?.rating || 0);
  const [title, setTitle] = useState<string>(initialData?.title || '');
  const [comment, setComment] = useState<string>(initialData?.comment || '');
  const [photos, setPhotos] = useState<string[]>(initialData?.photos || []);

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showExpirationWarning, setShowExpirationWarning] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Check completeness
  const isComplete = rating > 0 && comment.trim().length >= minCommentLength;

  // Auto-save effect
  useEffect(() => {
    if (hasUnsavedChanges && !isSaving) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave();
      }, autoSaveInterval);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [hasUnsavedChanges, autoSaveInterval]);

  // Track changes
  const handleChange = useCallback(() => {
    if (!hasUnsavedChanges) {
      setHasUnsavedChanges(true);
    }
    setSaveError(null);
  }, [hasUnsavedChanges]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const result = await onSave({
        rating: rating || undefined,
        title: title || undefined,
        comment: comment || undefined,
        photos: photos.length > 0 ? photos : undefined,
      });

      if (result.success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        if (result.isComplete) {
          setShowExpirationWarning(false);
        }
      } else {
        setSaveError(result.error || 'Failed to save draft');
      }
    } catch (error) {
      setSaveError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  }, [rating, title, comment, photos, onSave]);

  // Submit handler
  const handleSubmit = useCallback(async () => {
    if (!isComplete) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const result = await onSubmit();

      if (result.success) {
        // Success - parent should handle navigation
      } else {
        setSubmitError(result.error || 'Failed to submit review');
      }
    } catch (error) {
      setSubmitError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }, [isComplete, isSubmitting, onSubmit]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!onDelete) return;
    if (!confirm('Are you sure you want to delete this draft?')) return;

    await onDelete();
  }, [onDelete]);

  // Photo handlers
  const handleAddPhoto = useCallback((url: string) => {
    setPhotos((prev) => [...prev, url]);
    handleChange();
  }, [handleChange]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    handleChange();
  }, [handleChange]);

  // Show warning if comment is too short
  const commentTooShort = comment.trim().length > 0 && comment.trim().length < minCommentLength;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900">Write a Review</h2>
          <span className="text-sm text-gray-500 font-mono">{bookingNumber}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <Briefcase className="w-4 h-4" />
            {serviceName}
          </span>
          <span>with {providerName}</span>
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {new Date(scheduledDate).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6 space-y-6">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={(r) => { setRating(r); handleChange(); }} size="lg" />
            <span className="text-sm text-gray-500">
              {rating === 0 && 'Tap to rate'}
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </span>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review Title <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); handleChange(); }}
            placeholder="Summarize your experience..."
            maxLength={100}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">{title.length}/100</p>
        </div>

        {/* Comment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Your Review <span className="text-red-500">*</span>
          </label>
          <textarea
            ref={commentRef}
            value={comment}
            onChange={(e) => { setComment(e.target.value); handleChange(); }}
            placeholder="Share your experience with this service..."
            rows={5}
            maxLength={maxCommentLength}
            className={`w-full px-4 py-3 border rounded-xl text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              commentTooShort ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
            }`}
          />
          <div className="mt-1 flex items-center justify-between">
            {commentTooShort ? (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                At least {minCommentLength} characters required
              </p>
            ) : (
              <span />
            )}
            <p className={`text-xs ${comment.length >= maxCommentLength * 0.9 ? 'text-amber-600' : 'text-gray-400'}`}>
              {comment.length}/{maxCommentLength}
            </p>
          </div>
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add Photos <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative group">
                <img
                  src={photo}
                  alt={`Review photo ${index + 1}`}
                  className="w-20 h-20 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(index)}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button
                type="button"
                onClick={() => {
                  const url = prompt('Enter image URL:');
                  if (url) handleAddPhoto(url);
                }}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                <ImageIcon className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

        {/* Expiration Warning */}
        {showExpirationWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">Draft will expire soon</p>
              <p className="text-sm text-amber-700 mt-1">
                Complete and submit your review before the draft expires to avoid losing your feedback.
              </p>
            </div>
          </motion.div>
        )}

        {/* Error Messages */}
        {saveError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
            </>
          ) : hasUnsavedChanges ? (
            <>
              <Clock className="w-4 h-4 text-amber-500" />
              <span>Unsaved changes</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4 text-gray-400" />
              <span>Draft saved</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
            >
              Delete Draft
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isSubmitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete || isSaving || isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
};

// Draft List Component
export const ReviewDraftList: React.FC<ReviewDraftListProps> = ({
  drafts,
  onEditDraft,
  onDeleteDraft,
  isLoading = false,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = useCallback(
    async (draftId: string) => {
      setDeletingId(draftId);
      try {
        await onDeleteDraft(draftId);
      } finally {
        setDeletingId(null);
      }
    },
    [onDeleteDraft]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
        <Save className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Review Drafts</h3>
        <p className="text-sm text-gray-500">
          Start writing reviews after your appointments to save them as drafts.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Your Review Drafts ({drafts.length})
        </h3>
        <p className="text-sm text-gray-500">
          Drafts expire 30 days after creation
        </p>
      </div>

      <AnimatePresence>
        {drafts.map((draft) => (
          <DraftListItem
            key={draft.id}
            draft={draft}
            onEdit={() => onEditDraft(draft.id)}
            onDelete={() => handleDelete(draft.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ReviewDraft;
