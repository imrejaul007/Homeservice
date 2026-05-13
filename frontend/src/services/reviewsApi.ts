import { api } from './api';

export interface Review {
  id: string;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  isVerified: boolean;
  createdAt: string;
  customer?: { id: string; firstName: string; lastName: string; avatar?: string };
}

interface ReviewsResponse {
  success: boolean;
  data: { reviews: Review[]; total: number; averageRating: number; ratingDistribution: Record<number, number> };
}

class ReviewsApi {
  async getProviderReviews(providerId: string): Promise<ReviewsResponse> {
    const response = await api.get(`/reviews/provider/${providerId}`);
    return response.data;
  }
  async submitReview(bookingId: string, data: { rating: number; comment: string; title?: string; photos?: string[] }): Promise<any> {
    const response = await api.post(`/reviews/booking/${bookingId}`, data);
    return response.data;
  }
}

export const reviewsApi = new ReviewsApi();
export default reviewsApi;
