import React, { useState, useEffect } from 'react';
import { Star, User, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { reviewsApi, type Review } from '@/services/reviewsApi';

interface ServiceReviewsProps {
  providerId: string;
  rating: number;
  reviewCount: number;
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

const ServiceReviews: React.FC<ServiceReviewsProps> = ({ providerId, rating, reviewCount }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [averageRating, setAverageRating] = useState(rating);
  const [distribution, setDistribution] = useState<RatingDistribution>({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await reviewsApi.getProviderReviews(providerId);
      setReviews(response.data?.reviews ?? []);
      setTotal(response.data?.total ?? 0);
      setAverageRating(response.data?.averageRating ?? rating);
      setDistribution(response.data?.ratingDistribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      setError('Failed to load reviews');
      toast.error('Failed to load reviews. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (providerId) {
      fetchReviews();
    }
  }, [providerId, rating]);

  const getDisplayDistribution = () => {
    return RATING_DISTRIBUTION.map(dist => ({
      ...dist,
      percent: total > 0 ? Math.round(((distribution[dist.stars] || 0) / total) * 100) : 0
    }));
  };

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
            Customer reviews
          </h2>
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-nilin mx-auto" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-8 md:py-12 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
            Customer reviews
          </h2>
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchReviews}
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
    <section className="py-8 md:py-12 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
          Customer reviews
        </h2>

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
            reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-xl p-4 md:p-5 border border-gray-100"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {review.customer?.avatar ? (
                      <img
                        src={review.customer.avatar}
                        alt={`${review.customer.firstName} ${review.customer?.lastName || ''}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium text-gray-900 text-sm">
                        {review.customer?.firstName} {review.customer?.lastName ? `${review.customer.lastName.charAt(0)}.` : ''}
                      </h4>
                      <div className="flex items-center gap-2">
                        {review.isVerified && (
                          <span className="text-xs text-green-600 font-medium">Verified</span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(review.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 mb-2">
                      <StarRatingDisplay rating={review.rating} />
                    </div>
                    {review.title && (
                      <h5 className="font-medium text-gray-900 text-sm mb-1">{review.title}</h5>
                    )}
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {review.comment}
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
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default ServiceReviews;
