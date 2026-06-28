/**
 * Customer Reviews Page
 *
 * Displays reviews written by the authenticated customer.
 * Uses the unified Review type from reviewsApi.ts which consolidates
 * all review functionality into a single service.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
  X,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronFirst,
  ChevronLast,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { showDeduplicatedError } from '../../utils/toastUtils';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { reviewsApi, type Review } from '../../services/reviewsApi';

// Helper to safely extract error message from various error types
const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  if (err && typeof err === 'object' && 'message' in err) {
    return (err as { message: unknown }).message as string;
  }
  return 'An unexpected error occurred';
};

// Helper to handle different error types
const handleFetchError = (err: unknown, context: string): string => {
  // Network error detection
  const isNetworkError = !navigator.onLine ||
    err instanceof TypeError ||
    (err as { message?: string })?.message?.includes('NetworkError') ||
    (err as { code?: string })?.code === 'ERR_NETWORK';

  if (isNetworkError) {
    showDeduplicatedError('Connection error', 'Please check your internet connection and try again');
    return 'Connection error. Please check your internet connection.';
  }

  const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
  const status = axiosErr?.response?.status;
  const serverMessage = axiosErr?.response?.data?.message;

  switch (status) {
    case 401:
      showDeduplicatedError('Session expired', 'Please log in again');
      return 'Your session has expired. Please log in again.';
    case 403:
      showDeduplicatedError('Access denied', 'You do not have permission to perform this action');
      return 'You do not have permission to perform this action.';
    case 404:
      showDeduplicatedError('Not found', `${context} not found`);
      return `${context} not found.`;
    case 429:
      showDeduplicatedError('Too many requests', 'Please wait before trying again');
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      showDeduplicatedError('Server error', 'Please try again later');
      return 'A server error occurred. Please try again later.';
    default:
      if (serverMessage) {
        showDeduplicatedError('Error', serverMessage);
        return serverMessage;
      }
      return 'An error occurred while loading your reviews.';
  }
};

// Retry helper for transient failures
const fetchWithRetry = async (
  fetchFn: () => Promise<void>,
  maxAttempts = 2,
  context = 'operation'
): Promise<{ success: boolean }> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fetchFn();
      return { success: true };
    } catch (err) {
      lastError = err;
      const axiosErr = err as { response?: { status?: number } };
      const status = axiosErr?.response?.status;

      // Only retry for retryable errors (network, 5xx)
      const isRetryable = !navigator.onLine || status === 0 || (status && status >= 500);

      if (!isRetryable || attempt === maxAttempts - 1) {
        throw err;
      }

      // Exponential backoff: 1s, 2s
      const delay = Math.pow(2, attempt) * 1000;
      toast.loading(`Retrying... (${attempt + 1}/${maxAttempts})`, { id: 'retry-toast' });
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError;
};

// Pagination state interface
interface PaginationState {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const ReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const [editForm, setEditForm] = useState({
    rating: 5,
    comment: '',
  });

  // Helper functions for comment expansion
  const isCommentLong = useCallback((comment: string, maxLength = 200) => comment.length > maxLength, []);
  const isExpanded = useCallback((reviewId: string) => expandedReviews.has(reviewId), [expandedReviews]);
  const toggleExpanded = useCallback((reviewId: string) => {
    setExpandedReviews(prev => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/reviews' } });
      return;
    }
    fetchReviews(1);
  }, [isAuthenticated]);

  const fetchReviews = async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reviewsApi.getCustomerReviews({ page, limit: 20 });
      setReviews(response.data.reviews);
      if (response.data.pagination) {
        setPagination({
          page: response.data.pagination.page,
          limit: response.data.pagination.limit,
          total: response.data.pagination.total,
          pages: response.data.pagination.pages,
        });
      }
    } catch (err: unknown) {
      const errorMessage = handleFetchError(err, 'Reviews');
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      toast.dismiss('retry-toast');
    }
  };

  const handleEdit = (review: Review) => {
    setEditingReview(review);
    setEditForm({
      rating: review.rating,
      comment: review.comment,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingReview) return;

    setIsSaving(true);
    setError(null);

    try {
      await reviewsApi.updateReview(editingReview.id, {
        rating: editForm.rating,
        comment: editForm.comment,
      });
      toast.success('Review updated successfully');
      setEditingReview(null);
      fetchReviews(pagination.page);
    } catch (err: unknown) {
      const errorMessage = handleFetchError(err, 'Review update');
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await reviewsApi.deleteReview(reviewId);
      toast.success('Review deleted successfully');
      setDeleteConfirm(null);
      // Update pagination total after delete
      setPagination(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
      }));
      setReviews(prev => prev.filter(r => r.id !== reviewId));
    } catch (err: unknown) {
      const errorMessage = handleFetchError(err, 'Review deletion');
      showDeduplicatedError('Delete failed', errorMessage);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const isWithinEditWindow = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const daysDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  };

  const renderStars = (rating: number, interactive = false, onChange?: (r: number) => void) => (
    <div
      className="flex items-center gap-1"
      role={interactive ? "radiogroup" : undefined}
      aria-label={interactive ? "Rating" : undefined}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onChange?.(star)}
          onKeyDown={(e) => {
            if (!interactive) return;
            if (e.key === 'ArrowRight' && star < 5) {
              e.preventDefault();
              onChange?.(star + 1);
            }
            if (e.key === 'ArrowLeft' && star > 1) {
              e.preventDefault();
              onChange?.(star - 1);
            }
          }}
          disabled={!interactive}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          aria-checked={interactive ? star === rating : undefined}
          role={interactive ? "radio" : undefined}
          tabIndex={interactive ? (star === rating ? 0 : -1) : -1}
          className={`${interactive ? 'cursor-pointer hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2' : 'cursor-default'} transition-transform rounded p-1 -ml-1`}
        >
          <Star
            className={`w-5 h-5 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );

  const renderModerationStatus = (review: Review) => {
    if (!review.moderationStatus || review.moderationStatus === 'approved') {
      return null;
    }

    const statusStyles = {
      pending: 'bg-amber-100 text-amber-700 border border-amber-200',
      rejected: 'bg-red-100 text-red-700 border border-red-200',
      hidden: 'bg-gray-100 text-gray-700 border border-gray-200',
    };

    const statusLabels = {
      pending: 'Pending Review',
      rejected: 'Not Approved',
      hidden: 'Hidden',
    };

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusStyles[review.moderationStatus as keyof typeof statusStyles]}`}>
        {statusLabels[review.moderationStatus as keyof typeof statusLabels]}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <main id="main-content" className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-nilin-coral" />
            </div>
            <div>
              <h1 className="text-3xl font-serif text-nilin-charcoal">My Reviews</h1>
              <p className="text-nilin-warmGray">Reviews you've written for services</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-red-800 block">{error}</span>
              </div>
              <button
                onClick={() => fetchReviews(pagination.page)}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          )}

          {/* Edit Form Modal */}
          {editingReview && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-review-modal"
            >
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingReview(null)} />
              <div id="edit-review-modal" className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-serif text-xl text-nilin-charcoal">Edit Review</h3>
                  <button
                    onClick={() => setEditingReview(null)}
                    className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    aria-label="Close edit modal"
                  >
                    <X className="w-5 h-5 text-nilin-warmGray" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Rating</label>
                    <div className="flex items-center gap-2">
                      {renderStars(editForm.rating, true, (r) =>
                        setEditForm({ ...editForm, rating: r })
                      )}
                      <span className="text-sm text-nilin-warmGray ml-2">{editForm.rating}/5</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">Your Review</label>
                    <textarea
                      value={editForm.comment}
                      onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none resize-none"
                      placeholder="Share your experience..."
                    />
                    <p className="text-xs text-nilin-warmGray mt-1">Reviews can be edited within 30 days of posting</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={isSaving}
                      className="btn-nilin flex-1 flex items-center justify-center gap-2"
                    >
                      {isSaving ? 'Saving...' : (
                        <>
                          <Check className="w-5 h-5" />
                          Save Changes
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setEditingReview(null)}
                      className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Screen Reader Status Announcer */}
          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />

          {/* Reviews List */}

          {/* Reviews List */}
          {reviews.length === 0 && pagination.page === 1 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-12 h-12 text-nilin-coral" />
              </div>
              <h3 className="text-2xl font-serif text-nilin-charcoal mb-3">Share Your Experience</h3>
              <p className="text-nilin-warmGray mb-8 max-w-md mx-auto leading-relaxed">
                You haven't written any reviews yet. Complete a booking and let others know about the services you've enjoyed!
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => navigate('/search')}
                  className="btn-nilin px-8 py-3"
                >
                  Browse Services
                </button>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="px-8 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium"
                >
                  View My Bookings
                </button>
              </div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <p className="text-nilin-warmGray">
                No reviews found on this page.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <article
                  key={review.id}
                  aria-label={`Review for ${review.service?.name || 'Service'} by ${review.provider?.name || 'Provider'}, rated ${review.rating} out of 5 stars`}
                  className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all"
                >
                  {/* Provider & Service Info */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white font-medium">
                          {review.provider?.name?.[0] || 'P'}
                        </div>
                        <div>
                          <h3 className="font-medium text-nilin-charcoal">{review.provider?.name || 'Provider'}</h3>
                          <p className="text-sm text-nilin-warmGray">{review.service?.name || 'Service'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      {renderModerationStatus(review)}
                    </div>
                  </div>

                  {/* Review Photos */}
                  {(review.photos?.length ?? 0) > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-4 h-4 text-nilin-warmGray" aria-hidden="true" />
                        <span className="text-sm text-nilin-warmGray">
                          {review.photos?.length} photo{(review.photos?.length ?? 0) > 1 ? 's' : ''} attached
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {review.photos?.slice(0, 4).map((photo, idx) => (
                          <div
                            key={idx}
                            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-nilin-muted"
                          >
                            <img
                              src={photo}
                              alt={`Review photo ${idx + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        ))}
                        {(review.photos?.length ?? 0) > 4 && (
                          <div className="relative flex-shrink-0 w-20 h-20 rounded-lg bg-nilin-muted flex items-center justify-center">
                            <span className="text-sm font-medium text-nilin-warmGray">
                              +{(review.photos?.length ?? 0) - 4}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Review Content */}
                  <div className="mb-4">
                    {/* Title if present */}
                    {review.title && (
                      <h4 className="font-medium text-nilin-charcoal mb-2">{review.title}</h4>
                    )}

                    {/* Comment with expand/collapse */}
                    <p className={`text-nilin-charcoal leading-relaxed ${!isExpanded(review.id) && isCommentLong(review.comment) ? 'line-clamp-3' : ''}`}>
                      {review.comment}
                    </p>

                    {/* Read more button for long comments */}
                    {isCommentLong(review.comment) && (
                      <button
                        onClick={() => toggleExpanded(review.id)}
                        className="text-nilin-coral text-sm font-medium mt-1 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 rounded"
                      >
                        {isExpanded(review.id) ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>

                  {/* Review Meta */}
                  <div className="flex items-center justify-between pt-4 border-t border-nilin-border">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-nilin-warmGray">
                        {formatDate(review.createdAt)}
                      </span>
                      {review.isVerified && (
                        <span className="badge-nilin-primary text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>

                    {isWithinEditWindow(review.createdAt) && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(review)}
                          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-nilin-muted transition-colors text-nilin-warmGray hover:text-nilin-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                          title="Edit review"
                          aria-label={`Edit review for ${review.service?.name || 'Service'}`}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(review.id)}
                          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors text-nilin-warmGray hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                          title="Delete review"
                          aria-label={`Delete review for ${review.service?.name || 'Service'}`}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Provider Response */}
                  {review.response && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-nilin-muted to-transparent rounded-nilin-lg border border-nilin-border/50">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white text-sm font-medium">
                          {review.provider?.name?.[0] || 'P'}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-nilin-charcoal">Provider Response</span>
                          <span className="text-xs text-nilin-warmGray ml-2">
                            {formatDate(review.response.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-nilin-warmGray leading-relaxed pl-11">{review.response.comment}</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {deleteConfirm && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-confirm-title"
              aria-describedby="delete-confirm-desc"
            >
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setDeleteConfirm(null)}
              />
              <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-sm w-full shadow-nilin-lg">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-nilin-rose/10 flex items-center justify-center mx-auto mb-4">
                    <Trash2 className="w-8 h-8 text-nilin-rose" />
                  </div>
                  <h3 id="delete-confirm-title" className="font-serif text-xl text-nilin-charcoal mb-2">Delete Review?</h3>
                  <p id="delete-confirm-desc" className="text-nilin-warmGray mb-6">
                    This action cannot be undone. Your review will be permanently removed.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(deleteConfirm)}
                      className="flex-1 py-3 rounded-nilin bg-nilin-rose text-white hover:bg-nilin-rose/90 transition-colors font-medium flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => fetchReviews(1)}
                disabled={pagination.page === 1}
                className="px-3 py-2 rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                aria-label="Go to first page"
              >
                <ChevronFirst className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchReviews(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-2 rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                aria-label="Go to previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="px-4 py-2 text-sm text-nilin-charcoal">
                Page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.pages}</span>
                <span className="text-nilin-warmGray ml-2">({pagination.total} reviews)</span>
              </span>

              <button
                onClick={() => fetchReviews(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-2 rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                aria-label="Go to next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchReviews(pagination.pages)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-2 rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                aria-label="Go to last page"
              >
                <ChevronLast className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Info Note */}
          <div className="mt-8 p-4 bg-nilin-muted rounded-nilin">
            <p className="text-sm text-nilin-warmGray">
              <strong>Note:</strong> Reviews can be edited within 30 days of posting. After that, reviews become permanent.
              New reviews will show a "Pending Review" status until approved by our team.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ReviewsPage;
