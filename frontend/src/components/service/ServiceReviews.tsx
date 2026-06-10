import React, { useState, useEffect, useCallback } from 'react';
import { Star, User, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { reviewsApi, type Review } from '@/services/reviewsApi';
import { cn } from '@/lib/utils';
import { ReviewVoting } from '@/components/common/ReviewVoting';

interface ServiceReviewsProps {
  providerId: string;
  initialPage?: number;
  /** Inline layout for provider profile page (no full-width gray section) */
  embedded?: boolean;
  /** Callback when review stats are loaded from live API */
  onStatsLoaded?: (stats: { total: number; averageRating: number }) => void;
}

interface RatingDistribution {
  [key: number]: number;
}

const RATING_DISTRIBUTION = [
  { stars: 5, percent: 0 },
  { stars: 4, percent: 0 },
  { stars: 3, percent: 0 },
  { stars: 2, percent: 0 },
  { stars: 1, percent: 0 },
];

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
};

/**
 * Validates that a URL is a safe image URL.
 * Only allows http:// and https:// protocols to prevent XSS via javascript: or data: URLs.
 */
const isValidImageUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols - blocks javascript:, data:, and other dangerous schemes
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

interface StarRatingDisplayProps {
  rating: number;
  maxStars?: number;
}

const StarRatingDisplay: React.FC<StarRatingDisplayProps> = ({ rating, maxStars = 5 }) => (
  <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of ${maxStars} stars`}>
    {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => (
      <Star
        key={star}
        className={`w-3.5 h-3.5 ${
          star <= rating
            ? 'text-amber-400 fill-amber-400'
            : 'text-gray-200 fill-gray-200'
        }`}
        aria-hidden="true"
      />
    ))}
  </div>
);

const ServiceReviews: React.FC<ServiceReviewsProps> = ({
  providerId,
  initialPage = 1,
  embedded = false,
  onStatsLoaded,
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [distribution, setDistribution] = useState<RatingDistribution>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // FIX: Added pagination state
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const REVIEWS_PER_PAGE = 10;

  const fetchReviews = useCallback(async (page: number = 1) => {
    // Don't fetch if providerId is empty or invalid
    if (!providerId || providerId.trim() === '') {
      // Debug: Removed console.log - use logger in production
      setIsLoading(false);
      setReviews([]);
      setTotal(0);
      setAverageRating(0);
      setDistribution({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
      return;
    }

    try {
      if (page === 1) {
        setIsLoading(true);
      } else {
        setIsPageLoading(true);
      }
      setError(null);

      const response = await reviewsApi.getPublicProviderReviews(providerId, { page, limit: REVIEWS_PER_PAGE });

      const reviewTotal = response.data?.total ?? 0;
      const apiAverage = response.data?.averageRating ?? 0;
      const resolvedAverage = reviewTotal > 0 ? apiAverage : 0;
      setReviews(response.data?.reviews ?? []);
      setTotal(reviewTotal);
      setAverageRating(resolvedAverage);
      setDistribution(response.data?.ratingDistribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
      setCurrentPage(page);
      setTotalPages(response.data?.pagination?.pages ?? 1);
      onStatsLoaded?.({ total: reviewTotal, averageRating: resolvedAverage });
    } catch (err) {
      // Keep error logging for debugging
      console.error('[ServiceReviews] Failed to fetch reviews:', err);
      setError('Failed to load reviews');
      toast.error('Failed to load reviews. Please try again.');
      // Set empty data on error to stop loading
      setReviews([]);
      setTotal(0);
      setAverageRating(0);
    } finally {
      setIsLoading(false);
      setIsPageLoading(false);
    }
  }, [providerId, onStatsLoaded]);

  useEffect(() => {
    fetchReviews(initialPage);
  }, [fetchReviews, initialPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      fetchReviews(newPage);
      // Scroll to top of reviews section
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getDisplayDistribution = () => {
    return RATING_DISTRIBUTION.map(dist => ({
      ...dist,
      percent: total > 0 ? Math.round(((distribution[dist.stars] || 0) / total) * 100) : 0
    }));
  };

  const wrapperClass = embedded ? '' : 'py-8 md:py-12 bg-gray-50';
  const containerClass = embedded ? '' : 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8';

  if (isLoading) {
    return (
      <section className={wrapperClass}>
        <div className={containerClass}>
          {!embedded && (
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
              Customer reviews
            </h2>
          )}
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-nilin mx-auto" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className={wrapperClass}>
        <div className={containerClass}>
          {!embedded && (
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
              Customer reviews
            </h2>
          )}
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => fetchReviews(1)}
                className="px-4 py-2 bg-nilin text-white rounded-lg hover:bg-opacity-90 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={wrapperClass}>
      <div className={containerClass}>
        {!embedded && (
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
            Customer reviews
          </h2>
        )}

        {/* Rating summary */}
        <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* Overall score */}
            <div className="text-center md:text-left flex-shrink-0">
              <div className="text-4xl md:text-5xl font-bold text-gray-900 mb-1">
                {averageRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-0.5 mb-1" role="img" aria-label={`${averageRating.toFixed(1)} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(averageRating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-200 fill-gray-200'
                    }`}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500">
                {total.toLocaleString()} reviews
              </p>
            </div>

            {/* Distribution bars */}
            <div className="flex-1 space-y-2">
              {getDisplayDistribution().map((dist) => (
                <div key={dist.stars} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-3">{dist.stars}</span>
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full"
                      style={{ width: `${dist.percent}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8">{dist.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Individual reviews */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="bg-white rounded-xl p-6 border border-gray-100 text-center">
              <p className="text-gray-500">No reviews yet. Be the first to review!</p>
            </div>
          ) : (
            reviews.map((review, index) => (
              <div
                key={review.id ?? `review-${index}`}
                className="bg-white rounded-xl p-4 md:p-5 border border-gray-100"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {review.customer?.avatar ? (
                      <img
                        src={review.customer.avatar}
                        alt={`${review.customer?.firstName || 'Customer'} ${review.customer?.lastName ? `${review.customer.lastName.charAt(0)}.` : ''}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {review.customer?.firstName || 'Anonymous'} {review.customer?.lastName ? `${review.customer.lastName.charAt(0)}.` : ''}
                      </h4>
                      <div className="flex items-center gap-2">
                        {review.isVerified && (
                          <span className="text-xs text-green-600 font-medium">Verified</span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 mb-2">
                      <StarRatingDisplay rating={review.rating ?? 0} />
                    </div>
                    {review.title ? (
                      <h5 className="font-medium text-gray-900 text-sm mb-1">{review.title}</h5>
                    ) : null}
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {review.comment || ''}
                    </p>
                    {review.photos && review.photos.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {review.photos
                          .filter((photo): photo is string => typeof photo === 'string' && isValidImageUrl(photo))
                          .map((photo, idx) => (
                            <img
                              key={idx}
                              src={photo}
                              alt={`Review photo ${idx + 1}`}
                              className="w-20 h-20 object-cover rounded-lg"
                              onError={(e) => {
                                // Hide broken images by setting display to none
                                const target = e.currentTarget;
                                target.style.display = 'none';
                              }}
                            />
                          ))}
                      </div>
                    )}

                    {/* FIX: Display provider response if exists */}
                    {review.response && (
                      <div className="mt-3 ml-4 pl-4 border-l-2 border-nilin-coral/30 bg-nilin-blush/20 rounded-r-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-nilin-coral">Provider Response</span>
                          <span className="text-xs text-gray-400">
                            {review.response.createdAt && formatDate(review.response.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">
                          {review.response.comment || (review.response as any).content || ''}
                        </p>
                      </div>
                    )}

                    {review.id && (
                      <div className="mt-3">
                        <ReviewVoting
                          reviewId={review.id}
                          initialHelpfulVotes={review.helpfulVotes ?? 0}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FIX: Added pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isPageLoading}
              className={cn(
                'p-2 rounded-lg border border-gray-200 transition-colors',
                currentPage === 1
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300'
              )}
              aria-label="Previous page"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                  if (i === 6) pageNum = totalPages;
                  if (i === 5) return <span key="ellipsis">...</span>;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                  if (i === 0) return <span key="ellipsis">...</span>;
                } else {
                  if (i === 0) return <span key="ellipsis-start">...</span>;
                  if (i === 6) return <span key="ellipsis-end">...</span>;
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isPageLoading}
                    className={cn(
                      'w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                      pageNum === currentPage
                        ? 'bg-nilin-coral text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || isPageLoading}
              className={cn(
                'p-2 rounded-lg border border-gray-200 transition-colors',
                currentPage === totalPages
                  ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-50 hover:border-gray-300'
              )}
              aria-label="Next page"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Page info */}
        {totalPages > 1 && (
          <p className="text-center text-sm text-gray-500 mt-2">
            Page {currentPage} of {totalPages} ({total} reviews)
          </p>
        )}
      </div>
    </section>
  );
};

export default ServiceReviews;
