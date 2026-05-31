import { api } from './api';
import { AxiosError } from 'axios';

// Error class for review API errors
export class ReviewApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'ReviewApiError';
  }
}

export interface Review {
  _id: string;
  bookingId?: string;
  provider: {
    id: string;
    name: string;
    avatar?: string;
  };
  service: {
    id: string;
    name: string;
  };
  rating: number;
  comment: string;
  images?: string[];
  response?: {
    comment: string;
    createdAt: string;
  };
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ReviewsResponse {
  success: boolean;
  data: {
    reviews: Review[];
    total: number;
    page: number;
    pages: number;
  };
}

interface ReviewResponse {
  success: boolean;
  data: {
    review: Review;
  };
}

class ReviewApiService {
  /**
   * Get reviews written by the current user
   */
  async getMyReviews(options?: {
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
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch reviews';
      console.error('[reviewApi] getMyReviews error:', message, err.response?.status);
      throw new ReviewApiError(message, err.response?.status, 'GET_REVIEWS_FAILED');
    }
  }

  /**
   * Get a single review
   */
  async getReview(reviewId: string): Promise<ReviewResponse> {
    try {
      const response = await api.get(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch review';
      console.error('[reviewApi] getReview error:', message, err.response?.status);
      throw new ReviewApiError(message, err.response?.status, 'GET_REVIEW_FAILED');
    }
  }

  /**
   * Update a review (only within 30 days)
   */
  async updateReview(
    reviewId: string,
    updates: {
      rating?: number;
      comment?: string;
      images?: string[];
    }
  ): Promise<ReviewResponse> {
    try {
      const response = await api.patch(`/reviews/${reviewId}`, updates);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to update review';
      console.error('[reviewApi] updateReview error:', message, err.response?.status);
      throw new ReviewApiError(message, err.response?.status, 'UPDATE_REVIEW_FAILED');
    }
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/reviews/${reviewId}`);
      return response.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to delete review';
      console.error('[reviewApi] deleteReview error:', message, err.response?.status);
      throw new ReviewApiError(message, err.response?.status, 'DELETE_REVIEW_FAILED');
    }
  }
}

export const reviewApi = new ReviewApiService();
export default reviewApi;
