import { api } from './api';
import { AxiosError } from 'axios';

// Error class for reviews API errors
export class ReviewsApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ReviewsApiError';
  }
}

// Unified Review interface - encompasses all review data across the app
export interface Review {
  // Primary identifiers (both formats supported)
  id: string;
  _id?: string; // Alternative identifier used by some endpoints

  // Review content
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  images?: string[]; // Alternative field name used by some endpoints

  // Verification & moderation
  isVerified: boolean;
  moderationStatus?: 'pending' | 'approved' | 'rejected' | 'hidden';

  // Engagement
  helpfulVotes?: number;

  // Timestamps
  createdAt: string;
  updatedAt?: string;

  // Related entities - customer who wrote the review
  customer?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };

  // Related entities - provider who received the review
  provider?: {
    id: string;
    name: string;
    avatar?: string;
  };

  // Related entities - service the review is for
  service?: {
    id: string;
    name: string;
  };

  // Provider response to the review
  response?: {
    comment: string;
    createdAt: string;
  };

  // Booking reference (customer view)
  bookingId?: string;
}

export type ProviderReviewScope = 'approved' | 'all' | 'pending';

interface ReviewsResponse {
  success: boolean;
  data: {
    reviews: Review[];
    total: number;
    totalReviews: number;
    averageRating: number;
    ratingDistribution: Record<number, number>;
    approvedCount: number;
    pendingCount: number;
    reviewDisplaySettings?: {
      showPendingOnReviewsPage: boolean;
    };
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

interface SingleReviewResponse {
  success: boolean;
  data: {
    review: Review;
  };
}

interface DeleteResponse {
  success: boolean;
  message: string;
}

class ReviewsApi {
  /**
   * Get reviews for the current provider (authenticated provider's reviews)
   */
  async getMyReviews(options: {
    scope?: ProviderReviewScope;
    limit?: number;
    page?: number;
    rating?: number;
  } = {}): Promise<ReviewsResponse> {
    try {
      const { scope = 'all', limit, page, rating } = options;
      const params: Record<string, string | number> = { scope };
      if (limit !== undefined) params.limit = limit;
      if (page !== undefined) params.page = page;
      if (rating !== undefined) params.rating = rating;

      const response = await api.get<ReviewsResponse>('/provider/reviews', { params });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch reviews';
      console.error('[reviewsApi] getMyReviews error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_MY_REVIEWS_FAILED');
    }
  }

  /**
   * Get reviews written by the current user (customer perspective)
   * Uses /reviews/my-reviews endpoint
   */
  async getCustomerReviews(options?: {
    page?: number;
    limit?: number;
  }): Promise<ReviewsResponse> {
    try {
      const params: Record<string, number> = {};
      if (options?.page !== undefined) params.page = options.page;
      if (options?.limit !== undefined) params.limit = options.limit;

      const response = await api.get('/reviews/my-reviews', { params });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch customer reviews';
      console.error('[reviewsApi] getCustomerReviews error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_CUSTOMER_REVIEWS_FAILED');
    }
  }

  /**
   * Get public reviews for a specific provider (used on service/provider pages for customers)
   * Uses GET /reviews/provider/:providerId endpoint
   */
  async getPublicProviderReviews(providerId: string, options: {
    page?: number;
    limit?: number;
  } = {}): Promise<ReviewsResponse> {
    try {
      const params: Record<string, number> = {};
      if (options.page !== undefined) params.page = options.page;
      if (options.limit !== undefined) params.limit = options.limit;
      // Apply defaults only if not provided
      if (params.page === undefined) params.page = 1;
      if (params.limit === undefined) params.limit = 10;

      const response = await api.get<ReviewsResponse>(`/reviews/provider/${providerId}`, { params });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch provider reviews';
      console.error('[reviewsApi] getPublicProviderReviews error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_PUBLIC_PROVIDER_REVIEWS_FAILED');
    }
  }

  /** @deprecated Use getPublicProviderReviews instead */
  async getProviderReviews(_providerId: string, _scope: ProviderReviewScope = 'approved'): Promise<ReviewsResponse> {
    console.warn('[reviewsApi] getProviderReviews is deprecated. Use getPublicProviderReviews instead.');
    // Return empty data instead of calling getMyReviews which is for the authenticated user
    return {
      success: true,
      data: {
        reviews: [],
        total: 0,
        totalReviews: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        approvedCount: 0,
        pendingCount: 0,
      },
    };
  }

  /**
   * Get a single review by ID
   */
  async getReview(reviewId: string): Promise<SingleReviewResponse> {
    try {
      if (!reviewId) {
        throw new ReviewsApiError('Review ID is required', undefined, 'INVALID_REVIEW_ID');
      }
      const response = await api.get(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch review';
      console.error('[reviewsApi] getReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_REVIEW_FAILED');
    }
  }

  /**
   * Update review display settings (provider settings)
   */
  async updateReviewDisplaySettings(settings: {
    showPendingOnReviewsPage: boolean;
  }): Promise<{ success: boolean }> {
    try {
      const payload = {
        reviewDisplaySettings: {
          showPendingOnReviewsPage: settings.showPendingOnReviewsPage,
        },
      };
      const response = await api.patch('/provider/settings', payload);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to update review settings';
      console.error('[reviewsApi] updateReviewDisplaySettings error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'UPDATE_SETTINGS_FAILED');
    }
  }

  /**
   * Submit a new review for a booking
   */
  async submitReview(
    bookingId: string,
    data: { rating: number; comment: string; title?: string; photos?: string[]; images?: string[] }
  ): Promise<SingleReviewResponse> {
    try {
      const payload: Record<string, string | number | string[]> = {
        rating: data.rating,
        comment: data.comment,
      };
      if (data.title !== undefined) payload.title = data.title;
      if (data.photos !== undefined) payload.photos = data.photos;
      if (data.images !== undefined) payload.images = data.images;

      const response = await api.post(`/reviews/booking/${bookingId}`, payload);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to submit review';
      console.error('[reviewsApi] submitReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'SUBMIT_REVIEW_FAILED');
    }
  }

  /**
   * Update an existing review (customer - within 30 days)
   */
  async updateReview(
    reviewId: string,
    updates: {
      rating?: number;
      comment?: string;
      images?: string[];
      photos?: string[];
    }
  ): Promise<SingleReviewResponse> {
    try {
      const payload: Record<string, string | number | string[]> = {};
      if (updates.rating !== undefined) payload.rating = updates.rating;
      if (updates.comment !== undefined) payload.comment = updates.comment;
      if (updates.images !== undefined) payload.images = updates.images;
      if (updates.photos !== undefined) payload.photos = updates.photos;

      const response = await api.patch(`/reviews/${reviewId}`, payload);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to update review';
      console.error('[reviewsApi] updateReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'UPDATE_REVIEW_FAILED');
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<DeleteResponse> {
    try {
      if (!reviewId) {
        throw new ReviewsApiError('Review ID is required', undefined, 'INVALID_REVIEW_ID');
      }
      const response = await api.delete(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to delete review';
      console.error('[reviewsApi] deleteReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'DELETE_REVIEW_FAILED');
    }
  }

  /**
   * Reply to a review (provider)
   */
  async replyToReview(reviewId: string, comment: string): Promise<{ success: boolean }> {
    try {
      if (comment === undefined) {
        throw new ReviewsApiError('Comment is required', undefined, 'INVALID_REPLY');
      }
      const response = await api.post(`/reviews/${reviewId}/reply`, { comment });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to submit reply';
      console.error('[reviewsApi] replyToReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'REPLY_FAILED');
    }
  }

  /**
   * Check if the user can review a specific package
   * Returns eligibility information including whether they have a completed booking
   *
   * Note: 404 "Package not found" is handled gracefully - returns not eligible
   */
  async getPackageReviewEligibility(packageId: string): Promise<{
    success: boolean;
    data: {
      eligible: boolean;
      reason?: 'no_booking' | 'already_reviewed' | 'review_window_expired' | 'package_not_found';
      message?: string;
      bookingId?: string;
      packageName?: string;
      completedAt?: string;
      daysRemaining?: number;
      reviewWindowDays?: number;
      daysSinceCompletion?: number;
    };
  }> {
    try {
      if (!packageId) {
        throw new ReviewsApiError('Package ID is required', undefined, 'INVALID_PACKAGE_ID');
      }
      const response = await api.get(`/reviews/package/${packageId}/eligibility`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const statusCode = err.response?.status;
      const responseData = err.response?.data as { message?: string } | undefined;

      // Handle 404 "Package not found" gracefully - return not eligible instead of throwing
      if (statusCode === 404 && responseData?.message?.includes('Package not found')) {
        console.log('[reviewsApi] Package not found (404) - returning not eligible');
        return {
          success: true,
          data: {
            eligible: false,
            reason: 'package_not_found' as const,
            message: 'This package is no longer available or has been removed.',
          },
        };
      }

      const message = responseData?.message || err.message || 'Failed to check review eligibility';
      console.error('[reviewsApi] getPackageReviewEligibility error:', message, statusCode);
      throw new ReviewsApiError(message, statusCode, 'GET_ELIGIBILITY_FAILED');
    }
  }

  /**
   * Submit a review for a package directly from the package detail page
   * The backend will find the user's completed booking for this package
   */
  async submitPackageReview(
    packageId: string,
    data: { rating: number; comment: string; title?: string; photos?: string[]; images?: string[] }
  ): Promise<SingleReviewResponse> {
    try {
      if (!packageId) {
        throw new ReviewsApiError('Package ID is required', undefined, 'INVALID_PACKAGE_ID');
      }
      const payload: Record<string, string | number | string[]> = {
        rating: data.rating,
        comment: data.comment,
      };
      if (data.title !== undefined) payload.title = data.title;
      if (data.photos !== undefined) payload.photos = data.photos;
      if (data.images !== undefined) payload.images = data.images;

      const response = await api.post(`/reviews/package/${packageId}`, payload);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to submit package review';
      console.error('[reviewsApi] submitPackageReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'SUBMIT_PACKAGE_REVIEW_FAILED');
    }
  }

  /**
   * Vote on a review (mark as helpful or not helpful)
   */
  async voteReview(
    reviewId: string,
    helpful: boolean
  ): Promise<{ success: boolean; message: string; helpfulVotes: number; userVote: boolean | null }> {
    try {
      if (!reviewId) {
        throw new ReviewsApiError('Review ID is required', undefined, 'INVALID_REVIEW_ID');
      }
      const response = await api.post(`/reviews/${reviewId}/vote`, { helpful });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to vote on review';
      console.error('[reviewsApi] voteReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'VOTE_REVIEW_FAILED');
    }
  }

  /**
   * Get review voting stats
   */
  async getReviewVotes(reviewId: string): Promise<{
    success: boolean;
    data: {
      helpfulVotes: number;
      notHelpfulVotes: number;
      userVote: boolean | null;
    };
  }> {
    try {
      if (!reviewId) {
        throw new ReviewsApiError('Review ID is required', undefined, 'INVALID_REVIEW_ID');
      }
      const response = await api.get(`/reviews/${reviewId}/votes`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get review votes';
      console.error('[reviewsApi] getReviewVotes error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_REVIEW_VOTES_FAILED');
    }
  }

  /**
   * Get review analytics for a provider
   */
  async getProviderReviewAnalytics(
    providerId: string,
    period: '30d' | '90d' | '1y' | 'all' = '30d'
  ): Promise<{
    success: boolean;
    data: {
      summary: {
        totalReviews: number;
        averageRating: number;
        responseRate: number;
        recentAvgRating: number;
      };
      trends: Array<{ month: string; averageRating: number; count: number }>;
      ratingDistribution: Record<number, number>;
      period: string;
    };
  }> {
    try {
      if (!providerId) {
        throw new ReviewsApiError('Provider ID is required', undefined, 'INVALID_PROVIDER_ID');
      }
      const response = await api.get(`/reviews/analytics/provider/${providerId}`, {
        params: { period },
      });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to get review analytics';
      console.error('[reviewsApi] getProviderReviewAnalytics error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_REVIEW_ANALYTICS_FAILED');
    }
  }
}

export const reviewsApi = new ReviewsApi();
export default reviewsApi;
