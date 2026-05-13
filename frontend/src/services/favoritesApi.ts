import { api } from './api';

export interface FavoriteProvider {
  providerId: string;
  addedAt?: string;
  category?: string;
  notes?: string;
  provider?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    profilePhoto?: string;
    bio?: string;
    businessName?: string;
    averageRating?: number;
    totalReviews?: number;
    services?: Array<{
      name?: string;
      price?: {
        amount?: number;
        currency?: string;
      };
    }>;
  };
}

interface FavoritesResponse {
  success: boolean;
  data: {
    favorites: FavoriteProvider[];
    total: number;
  };
}

interface AddFavoriteResponse {
  success: boolean;
  message: string;
  data: {
    providerId: string;
    addedAt: string;
    provider: {
      id: string;
      firstName: string;
      lastName: string;
      avatar?: string;
      businessName?: string;
      averageRating: number;
    };
  };
}

interface CheckFavoriteResponse {
  success: boolean;
  data: {
    isFavorited: boolean;
  };
}

class FavoritesApiService {
  /**
   * Get all favorites for the current user
   */
  async getFavorites(): Promise<FavoritesResponse> {
    const response = await api.get('/favorites');
    return response.data;
  }

  /**
   * Add a provider to favorites
   */
  async addFavorite(providerId: string, category?: string, notes?: string): Promise<AddFavoriteResponse> {
    const response = await api.post(`/favorites/${providerId}`, {
      category,
      notes,
    });
    return response.data;
  }

  /**
   * Remove a provider from favorites
   */
  async removeFavorite(providerId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete(`/favorites/${providerId}`);
    return response.data;
  }

  /**
   * Check if a provider is favorited
   */
  async checkFavorite(providerId: string): Promise<CheckFavoriteResponse> {
    const response = await api.get(`/favorites/check/${providerId}`);
    return response.data;
  }

  /**
   * Update favorite notes
   */
  async updateFavorite(providerId: string, notes?: string, category?: string): Promise<any> {
    const response = await api.patch(`/favorites/${providerId}`, {
      notes,
      category,
    });
    return response.data;
  }

  /**
   * Toggle favorite status (add if not favorited, remove if favorited)
   */
  async toggleFavorite(providerId: string): Promise<{ isFavorited: boolean }> {
    const checkResult = await this.checkFavorite(providerId);

    if (checkResult.data.isFavorited) {
      await this.removeFavorite(providerId);
      return { isFavorited: false };
    } else {
      await this.addFavorite(providerId);
      return { isFavorited: true };
    }
  }
}

export const favoritesApi = new FavoritesApiService();
export default favoritesApi;
