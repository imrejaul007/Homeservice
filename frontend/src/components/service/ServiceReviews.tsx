import React from 'react';
import { Star, User } from 'lucide-react';

interface ServiceReviewsProps {
  rating: number;
  reviewCount: number;
}

// Mock review data - will be replaced with real API data when reviews are implemented
const MOCK_REVIEWS = [
  {
    id: '1',
    name: 'Sarah M.',
    rating: 5,
    date: '2 weeks ago',
    comment: 'Amazing service! The professional was punctual, friendly, and did an incredible job. Will definitely book again.',
  },
  {
    id: '2',
    name: 'Fatima A.',
    rating: 5,
    date: '1 month ago',
    comment: 'Loved every minute of it. Very professional setup and the results exceeded my expectations.',
  },
  {
    id: '3',
    name: 'Priya K.',
    rating: 4,
    date: '1 month ago',
    comment: 'Great experience overall. The specialist was very skilled and explained everything clearly.',
  },
  {
    id: '4',
    name: 'Aisha R.',
    rating: 5,
    date: '2 months ago',
    comment: 'Perfect for a busy schedule. Having this done at home was so convenient and the quality was salon-level.',
  },
];

const RATING_DISTRIBUTION = [
  { stars: 5, percent: 72 },
  { stars: 4, percent: 18 },
  { stars: 3, percent: 6 },
  { stars: 2, percent: 3 },
  { stars: 1, percent: 1 },
];

const ServiceReviews: React.FC<ServiceReviewsProps> = ({ rating, reviewCount }) => {
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
                {rating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center md:justify-start gap-0.5 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-4 h-4 ${
                      star <= Math.round(rating)
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-gray-200 fill-gray-200'
                    }`}
                  />
                ))}
              </div>
              <p className="text-sm text-gray-500">
                {reviewCount.toLocaleString()} reviews
              </p>
            </div>

            {/* Distribution bars */}
            <div className="flex-1 space-y-2">
              {RATING_DISTRIBUTION.map((dist) => (
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
          {MOCK_REVIEWS.map((review) => (
            <div
              key={review.id}
              className="bg-white rounded-xl p-4 md:p-5 border border-gray-100"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-gray-900 text-sm">
                      {review.name}
                    </h4>
                    <span className="text-xs text-gray-400">{review.date}</span>
                  </div>
                  <div className="flex items-center gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= review.rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-gray-200 fill-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {review.comment}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceReviews;
