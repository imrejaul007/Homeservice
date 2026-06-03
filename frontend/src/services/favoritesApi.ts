import { api } from './api';

/**
 * Custom error class for FavoritesApi errors
 */
export class FavoritesApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'FavoritesApiError';
  }
}

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
    try {
      const response = await api.get('/favorites');
      return response.data;
    } catch (error) {
      console.error('[favoritesApi] getFavorites error:', error);
      throw new FavoritesApiError(
        'Failed to fetch favorites',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Add a provider to favorites
   */
  async addFavorite(providerId: string, category?: string, notes?: string): Promise<AddFavoriteResponse> {
    try {
      const response = await api.post(`/favorites/${providerId}`, {
        category,
        notes,
      });
      return response.data;
    } catch (error) {
      console.error('[favoritesApi] addFavorite error:', error);
      throw new FavoritesApiError(
        'Failed to add favorite',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Remove a provider from favorites
   */
  async removeFavorite(providerId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/favorites/${providerId}`);
      return response.data;
    } catch (error) {
      console.error('[favoritesApi] removeFavorite error:', error);
      throw new FavoritesApiError(
        'Failed to remove favorite',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Check if a provider is favorited
   */
  async checkFavorite(providerId: string): Promise<CheckFavoriteResponse> {
    try {
      const response = await api.get(`/favorites/check/${providerId}`);
      return response.data;
    } catch (error) {
      console.error('[favoritesApi] checkFavorite error:', error);
      throw new FavoritesApiError(
        'Failed to check favorite status',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Update favorite notes
   */
  async updateFavorite(providerId: string, notes?: string, category?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.patch(`/favorites/${providerId}`, {
        notes,
        category,
      });
      return response.data;
    } catch (error) {
      console.error('[favoritesApi] updateFavorite error:', error);
      throw new FavoritesApiError(
        'Failed to update favorite',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Toggle favorite status (add if not favorited, remove if favorited)
   */
  async toggleFavorite(providerId: string): Promise<{ isFavorited: boolean }> {
    try {
      const checkResult = await this.checkFavorite(providerId);

      if (checkResult.data.isFavorited) {
        await this.removeFavorite(providerId);
        return { isFavorited: false };
      } else {
        await this.addFavorite(providerId);
        return { isFavorited: true };
      }
    } catch (error) {
      console.error('[favoritesApi] toggleFavorite error:', error);
      throw new FavoritesApiError(
        'Failed to toggle favorite',
        (error as FavoritesApiError)?.statusCode,
        error
      );
    }
  }
}

export const favoritesApi = new FavoritesApiService();
export default favoritesApi;
