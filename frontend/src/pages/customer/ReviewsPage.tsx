/**
 * Customer Reviews Page
 *
 * Displays reviews written by the authenticated customer.
 * Uses the unified Review type from reviewsApi.ts which consolidates
 * all review functionality into a single service.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Edit2,
  Trash2,
  AlertCircle,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
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

const ReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const [editForm, setEditForm] = useState({
    rating: 5,
    comment: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/reviews' } });
      return;
    }
    fetchReviews();
  }, [isAuthenticated]);

  const fetchReviews = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reviewsApi.getCustomerReviews();
      setReviews(response.data.reviews);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || getErrorMessage(err));
    } finally {
      setIsLoading(false);
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
      setEditingReview(null);
      fetchReviews();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await reviewsApi.deleteReview(reviewId);
      setDeleteConfirm(null);
      fetchReviews();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete review');
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
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onChange?.(star)}
          disabled={!interactive}
          className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
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

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
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
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Edit Form Modal */}
          {editingReview && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setEditingReview(null)} />
              <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-serif text-xl text-nilin-charcoal">Edit Review</h3>
                  <button
                    onClick={() => setEditingReview(null)}
                    className="p-2 rounded-full hover:bg-nilin-muted transition-colors"
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

          {/* Reviews List */}
          {reviews.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">No reviews yet</h3>
              <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                You haven't written any reviews yet. Complete a booking and share your experience!
              </p>
              <button onClick={() => navigate('/search')} className="btn-nilin">
                Browse Services
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all">
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
                    </div>
                  </div>

                  {/* Review Content */}
                  <div className="mb-4">
                    <p className="text-nilin-charcoal leading-relaxed">{review.comment}</p>
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
                          className="p-2 rounded-lg hover:bg-nilin-muted transition-colors text-nilin-warmGray hover:text-nilin-charcoal"
                          title="Edit review"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(review.id)}
                          className="p-2 rounded-lg hover:bg-red-50 transition-colors text-nilin-warmGray hover:text-red-500"
                          title="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Provider Response */}
                  {review.response && (
                    <div className="mt-4 p-4 bg-nilin-muted rounded-nilin">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white text-xs font-medium">
                          {review.provider?.name?.[0] || 'P'}
                        </div>
                        <span className="text-sm font-medium text-nilin-charcoal">Provider Response</span>
                      </div>
                      <p className="text-sm text-nilin-warmGray">{review.response.comment}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info Note */}
          <div className="mt-8 p-4 bg-nilin-muted rounded-nilin">
            <p className="text-sm text-nilin-warmGray">
              <strong>Note:</strong> Reviews can be edited within 30 days of posting. After that, reviews become permanent to maintain platform integrity.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ReviewsPage;
