import { api } from './api';

/**
 * Custom error class for WishlistApi errors
 */
export class WishlistApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'WishlistApiError';
  }
}

export interface WishlistPackage {
  packageId: string;
  packageName: string;
  packagePrice: number;
  providerId: string;
  providerName: string;
  addedAt?: string;
  category?: string;
  notes?: string;
  package?: {
    id?: string;
    name?: string;
    description?: string;
    currentPrice: number;
    originalPrice?: number;
    currency?: string;
    duration?: {
      totalMinutes: number;
      formatted: string;
    };
    category?: string;
    images?: string[];
    isFeatured?: boolean;
    isPopular?: boolean;
    averageRating?: number;
    totalReviews?: number;
  };
}

interface WishlistResponse {
  success: boolean;
  data: {
    wishlist: WishlistPackage[];
    total: number;
    pagination: {
      cursor: string | null;
      hasMore: boolean;
      limit: number;
      total: number;
    };
  };
}

interface AddToWishlistResponse {
  success: boolean;
  message: string;
  data: {
    packageId: string;
    packageName: string;
    addedAt: string;
    package?: {
      id: string;
      name: string;
      currentPrice: number;
      originalPrice?: number;
      currency?: string;
      averageRating: number;
    };
  };
}

interface CheckWishlistResponse {
  success: boolean;
  data: {
    isInWishlist: boolean;
  };
}

interface ToggleWishlistResponse {
  success: boolean;
  message: string;
  data: {
    isInWishlist: boolean;
    packageId: string;
    packageName?: string;
  };
}

class WishlistApiService {
  /**
   * Get all wishlist items for the current user
   */
  async getWishlist(params?: {
    cursor?: string;
    limit?: number;
    sortOrder?: 'asc' | 'desc';
  }): Promise<WishlistResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.cursor) queryParams.set('cursor', params.cursor);
      if (params?.limit) queryParams.set('limit', params.limit.toString());
      if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

      const queryString = queryParams.toString();
      const url = queryString ? `/wishlist?${queryString}` : '/wishlist';

      const response = await api.get(url);
      return response.data;
    } catch (error) {
      console.error('[wishlistApi] getWishlist error:', error);
      throw new WishlistApiError(
        'Failed to fetch wishlist',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Add a package to wishlist
   */
  async addToWishlist(packageId: string, notes?: string): Promise<AddToWishlistResponse> {
    try {
      const response = await api.post(`/wishlist/${packageId}`, {
        notes,
      });
      return response.data;
    } catch (error) {
      console.error('[wishlistApi] addToWishlist error:', error);
      throw new WishlistApiError(
        'Failed to add to wishlist',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Remove a package from wishlist
   */
  async removeFromWishlist(packageId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/wishlist/${packageId}`);
      return response.data;
    } catch (error) {
      console.error('[wishlistApi] removeFromWishlist error:', error);
      throw new WishlistApiError(
        'Failed to remove from wishlist',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Check if a package is in wishlist
   */
  async checkWishlist(packageId: string): Promise<CheckWishlistResponse> {
    try {
      const response = await api.get(`/wishlist/check/${packageId}`);
      return response.data;
    } catch (error) {
      console.error('[wishlistApi] checkWishlist error:', error);
      throw new WishlistApiError(
        'Failed to check wishlist status',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Toggle package wishlist status (add if not in wishlist, remove if in wishlist)
   */
  async toggleWishlist(packageId: string, notes?: string): Promise<ToggleWishlistResponse> {
    try {
      const response = await api.post(`/wishlist/${packageId}/toggle`, {
        notes,
      });
      return response.data;
    } catch (error) {
      console.error('[wishlistApi] toggleWishlist error:', error);
      throw new WishlistApiError(
        'Failed to toggle wishlist',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }

  /**
   * Update wishlist item notes
   */
  async updateWishlistItem(
    packageId: string,
    notes?: string,
    category?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.patch(`/wishlist/${packageId}`, {
        notes,
        category,
      });
      return response.data;
    } catch (error) {
      console.error('[wishlistApi] updateWishlistItem error:', error);
      throw new WishlistApiError(
        'Failed to update wishlist item',
        (error as { response?: { status?: number } })?.response?.status,
        error
      );
    }
  }
}

export const wishlistApi = new WishlistApiService();
export default wishlistApi;
