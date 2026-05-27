import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  MessageSquare,
  Filter,
  X,
  Send,
  AlertCircle,
  Check,
  ChevronDown,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

// Types
interface Review {
  id: string;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  isVerified: boolean;
  createdAt: string;
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  response?: {
    comment: string;
    createdAt: string;
  };
}

interface ReviewsResponse {
  success: boolean;
  data: {
    reviews: Review[];
    total: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
  };
}

const ProviderReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  });
  const [totalReviews, setTotalReviews] = useState(0);

  // Filter state
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'provider') {
      navigate('/login', { state: { returnTo: '/provider/reviews' } });
      return;
    }
    fetchReviews();
  }, [isAuthenticated, user]);

  const fetchReviews = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Use the authenticated endpoint that returns the provider's own reviews
      const response = await api.get<ReviewsResponse>('/reviews/provider/me');
      const data = response.data;

      if (data.success) {
        setReviews(data.data.reviews);
        setAverageRating(data.data.averageRating);
        setRatingDistribution(data.data.ratingDistribution);
        setTotalReviews(data.data.total);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyingTo || !replyText.trim()) return;

    setIsSubmittingReply(true);
    setError(null);

    try {
      const response = await api.post(`/reviews/${replyingTo.id}/reply`, {
        comment: replyText.trim(),
      });

      if (response.data.success) {
        // Update the review with the new response
        setReviews((prev) =>
          prev.map((r) =>
            r.id === replyingTo.id
              ? { ...r, response: { comment: replyText.trim(), createdAt: new Date().toISOString() } }
              : r
          )
        );
        setReplyingTo(null);
        setReplyText('');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit reply');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || 'C';
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  // Filter reviews based on selected rating
  const filteredReviews = selectedRating
    ? reviews.filter((r) => r.rating === selectedRating)
    : reviews;

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
              <p className="text-nilin-warmGray">Customer feedback for your services</p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 hover:bg-red-100 rounded"
              >
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
            {/* Average Rating Card */}
            <div className="col-span-2 glass-nilin rounded-nilin-lg p-4 text-center">
              <div className="text-4xl font-bold text-nilin-charcoal mb-1">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex justify-center mb-2">{renderStars(Math.round(averageRating), 'md')}</div>
              <div className="text-sm text-nilin-warmGray">
                {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
              </div>
            </div>

            {/* Rating Distribution */}
            {[5, 4, 3, 2, 1].map((rating) => (
              <button
                key={rating}
                onClick={() => setSelectedRating(selectedRating === rating ? null : rating)}
                className={`glass-nilin rounded-nilin-lg p-3 text-center transition-all ${
                  selectedRating === rating
                    ? 'ring-2 ring-nilin-coral bg-nilin-coral/10'
                    : 'hover:bg-nilin-muted'
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className="text-sm font-medium text-nilin-charcoal">{rating}</span>
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                </div>
                <div className="text-xs text-nilin-warmGray">
                  {ratingDistribution[rating] || 0}
                </div>
              </button>
            ))}
          </div>

          {/* Filter Indicator */}
          {selectedRating && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-nilin-warmGray">Filtering by:</span>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-nilin-coral/10 text-nilin-coral rounded-full text-sm">
                {selectedRating} {selectedRating === 1 ? 'Star' : 'Stars'}
                <button
                  onClick={() => setSelectedRating(null)}
                  className="ml-1 hover:bg-nilin-coral/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            </div>
          )}

          {/* Reviews List */}
          {filteredReviews.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">
                {selectedRating ? 'No reviews with this rating' : 'No reviews yet'}
              </h3>
              <p className="text-nilin-warmGray max-w-md mx-auto">
                {selectedRating
                  ? 'Try selecting a different rating filter.'
                  : 'Once customers complete bookings with you, their reviews will appear here.'}
              </p>
              {selectedRating && (
                <button
                  onClick={() => setSelectedRating(null)}
                  className="btn-nilin mt-4"
                >
                  Clear Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map((review) => (
                <div
                  key={review.id}
                  className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all"
                >
                  {/* Customer Info & Rating */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white font-medium">
                        {review.customer?.avatar ? (
                          <img
                            src={review.customer.avatar}
                            alt={review.customer.firstName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getInitials(review.customer?.firstName, review.customer?.lastName)
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-nilin-charcoal">
                          {review.customer
                            ? `${review.customer.firstName} ${review.customer.lastName}`
                            : 'Customer'}
                        </h3>
                        <p className="text-sm text-nilin-warmGray">
                          {formatDate(review.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      {review.isVerified && (
                        <span className="badge-nilin-primary text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Review Title */}
                  {review.title && (
                    <h4 className="font-medium text-nilin-charcoal mb-2">{review.title}</h4>
                  )}

                  {/* Review Content */}
                  <p className="text-nilin-charcoal leading-relaxed mb-4">{review.comment}</p>

                  {/* Provider Response */}
                  {review.response && (
                    <div className="mt-4 p-4 bg-nilin-muted rounded-nilin border-l-4 border-nilin-coral">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-nilin-coral" />
                        <span className="text-sm font-medium text-nilin-charcoal">Your Response</span>
                        <span className="text-xs text-nilin-warmGray">
                          {formatDate(review.response.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-nilin-warmGray">{review.response.comment}</p>
                    </div>
                  )}

                  {/* Reply Button */}
                  {!review.response && (
                    <div className="mt-4 pt-4 border-t border-nilin-border">
                      <button
                        onClick={() => setReplyingTo(replyingTo?.id === review.id ? null : review)}
                        className="flex items-center gap-2 text-nilin-coral hover:text-nilin-coral/80 transition-colors text-sm font-medium"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Reply to Review
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Reply Modal */}
          {replyingTo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
              />
              <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-xl text-nilin-charcoal">Reply to Review</h3>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="p-2 rounded-full hover:bg-nilin-muted transition-colors"
                  >
                    <X className="w-5 h-5 text-nilin-warmGray" />
                  </button>
                </div>

                {/* Original Review Preview */}
                <div className="mb-4 p-3 bg-nilin-muted rounded-nilin">
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(replyingTo.rating)}
                    <span className="text-xs text-nilin-warmGray">
                      {replyingTo.customer
                        ? `${replyingTo.customer.firstName} ${replyingTo.customer.lastName}`
                        : 'Customer'}
                    </span>
                  </div>
                  <p className="text-sm text-nilin-warmGray line-clamp-2">
                    {replyingTo.comment}
                  </p>
                </div>

                {/* Reply Input */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Your Response
                  </label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none resize-none"
                    placeholder="Thank the customer for their feedback and address any concerns..."
                  />
                  <p className="text-xs text-nilin-warmGray mt-1 text-right">
                    {replyText.length}/500
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmitReply}
                    disabled={isSubmittingReply || !replyText.trim()}
                    className="btn-nilin flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingReply ? (
                      'Sending...'
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Reply
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="flex-1 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info Note */}
          <div className="mt-8 p-4 bg-nilin-muted rounded-nilin">
            <p className="text-sm text-nilin-warmGray">
              <strong>Tip:</strong> Responding to reviews shows customers you value their feedback and can help build trust with potential new customers.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderReviewsPage;
