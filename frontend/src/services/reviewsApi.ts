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
      const response = await api.get<ReviewsResponse>('/provider/reviews', {
        params: {
          scope,
          ...(limit != null ? { limit } : {}),
          ...(page != null ? { page } : {}),
          ...(rating != null ? { rating } : {}),
        },
      });
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
      const params = new URLSearchParams();
      if (options?.page) params.append('page', options.page.toString());
      if (options?.limit) params.append('limit', options.limit.toString());

      const queryString = params.toString();
      const url = queryString ? `/reviews/my-reviews?${queryString}` : '/reviews/my-reviews';

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch customer reviews';
      console.error('[reviewsApi] getCustomerReviews error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'GET_CUSTOMER_REVIEWS_FAILED');
    }
  }

  /** @deprecated Use getMyReviews instead */
  async getProviderReviews(_providerId: string, scope: ProviderReviewScope = 'approved'): Promise<ReviewsResponse> {
    console.warn('[reviewsApi] getProviderReviews is deprecated. Use getMyReviews instead.');
    return this.getMyReviews({ scope, limit: 20 });
  }

  /**
   * Get a single review by ID
   */
  async getReview(reviewId: string): Promise<SingleReviewResponse> {
    try {
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
      const response = await api.patch('/provider/settings', {
        reviewDisplaySettings: settings,
      });
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
      const response = await api.post(`/reviews/booking/${bookingId}`, data);
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
      const response = await api.patch(`/reviews/${reviewId}`, updates);
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
      const response = await api.post(`/reviews/${reviewId}/reply`, { comment });
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to submit reply';
      console.error('[reviewsApi] replyToReview error:', message, err.response?.status);
      throw new ReviewsApiError(message, err.response?.status, 'REPLY_FAILED');
    }
  }
}

export const reviewsApi = new ReviewsApi();
export default reviewsApi;
