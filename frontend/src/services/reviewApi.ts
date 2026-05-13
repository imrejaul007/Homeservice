import { api } from './api';

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
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const queryString = params.toString();
    const url = queryString ? `/reviews/my-reviews?${queryString}` : '/reviews/my-reviews';

    const response = await api.get(url);
    return response.data;
  }

  /**
   * Get a single review
   */
  async getReview(reviewId: string): Promise<ReviewResponse> {
    const response = await api.get(`/reviews/${reviewId}`);
    return response.data;
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
    const response = await api.patch(`/reviews/${reviewId}`, updates);
    return response.data;
  }

  /**
   * Delete a review
   */
  async deleteReview(reviewId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/reviews/${reviewId}`);
    return response.data;
  }
}

export const reviewApi = new ReviewApiService();
export default reviewApi;
