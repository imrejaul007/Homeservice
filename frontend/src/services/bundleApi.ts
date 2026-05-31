import { api } from './api';

// ============================================
// Bundle Types
// ============================================

export interface BundleService {
  serviceId: string;
  serviceName: string;
  description: string;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  duration: number;
  categoryName: string;
}

export interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  services: BundleService[];
  originalTotalPrice: number;
  bundlePrice: number;
  discountPercent: number;
  savings: number;
  images: string[];
  thumbnail?: string;
  categoryId: string;
  categoryName: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  averageRating: number;
  reviewCount: number;
  duration: number;
  durationUnit: 'minutes' | 'hours' | 'days';
  validityDays: number;
  maxBookings: number;
  bookingsUsed: number;
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string[];
  terms?: string;
  cancellationPolicy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BundleListItem {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  images: string[];
  thumbnail?: string;
  categoryName: string;
  providerName: string;
  originalTotalPrice: number;
  bundlePrice: number;
  discountPercent: number;
  averageRating: number;
  reviewCount: number;
  duration: number;
  durationUnit: 'minutes' | 'hours' | 'days';
  validityDays: number;
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
}

export interface GetBundlesOptions {
  page?: number;
  limit?: number;
  categoryId?: string;
  providerId?: string;
  featured?: boolean;
  popular?: boolean;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: 'price' | 'rating' | 'popularity' | 'newest' | 'discount';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateBundlePayload {
  name: string;
  description: string;
  shortDescription: string;
  serviceIds: string[];
  bundlePrice: number;
  validityDays: number;
  maxBookings?: number;
  images?: string[];
  categoryId: string;
  tags?: string[];
  terms?: string;
  cancellationPolicy?: string;
}

export interface UpdateBundlePayload {
  name?: string;
  description?: string;
  shortDescription?: string;
  serviceIds?: string[];
  bundlePrice?: number;
  validityDays?: number;
  maxBookings?: number;
  images?: string[];
  tags?: string[];
  terms?: string;
  cancellationPolicy?: string;
  isActive?: boolean;
  isFeatured?: boolean;
}

export interface BookBundlePayload {
  bundleId: string;
  scheduledDate: string;
  scheduledTime: string;
  address: string;
  notes?: string;
  promoCode?: string;
  paymentMethod: 'card' | 'wallet' | 'cash';
}

export interface BookingBundleResponse {
  bookingId: string;
  bookingReference: string;
  status: 'pending' | 'confirmed' | 'failed';
  bundleName: string;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  scheduledDate: string;
  scheduledTime: string;
  confirmationCode?: string;
  estimatedArrival?: string;
  providerDetails?: {
    name: string;
    phone: string;
    avatar?: string;
    rating: number;
  };
}

// ============================================
// Bundle API Service
// ============================================

export interface BundleApi {
  /**
   * Get all bundles with filtering and pagination
   */
  getBundles: (options?: GetBundlesOptions) => Promise<{
    bundles: BundleListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single bundle by ID
   */
  getBundle: (id: string) => Promise<Bundle>;

  /**
   * Get a bundle by slug
   */
  getBundleBySlug: (slug: string) => Promise<Bundle>;

  /**
   * Create a new bundle
   */
  createBundle: (data: CreateBundlePayload) => Promise<Bundle>;

  /**
   * Update an existing bundle
   */
  updateBundle: (id: string, data: UpdateBundlePayload) => Promise<Bundle>;

  /**
   * Delete a bundle
   */
  deleteBundle: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Book a bundle service
   */
  bookBundle: (data: BookBundlePayload) => Promise<BookingBundleResponse>;

  /**
   * Get bundles by category
   */
  getBundlesByCategory: (
    categoryId: string,
    options?: Omit<GetBundlesOptions, 'categoryId'>
  ) => Promise<{
    bundles: BundleListItem[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Get featured bundles
   */
  getFeaturedBundles: (limit?: number) => Promise<BundleListItem[]>;

  /**
   * Get popular bundles
   */
  getPopularBundles: (limit?: number) => Promise<BundleListItem[]>;

  /**
   * Search bundles
   */
  searchBundles: (
    query: string,
    options?: Omit<GetBundlesOptions, 'search'>
  ) => Promise<{
    bundles: BundleListItem[];
    total: number;
  }>;

  /**
   * Get my bundles (provider's bundles)
   */
  getMyBundles: (options?: {
    page?: number;
    limit?: number;
    status?: 'active' | 'inactive' | 'all';
  }) => Promise<{
    bundles: Bundle[];
    total: number;
    page: number;
    limit: number;
  }>;

  /**
   * Get bundle availability for dates
   */
  getBundleAvailability: (
    id: string,
    startDate: string,
    endDate: string
  ) => Promise<{
    dates: Array<{
      date: string;
      available: boolean;
      slots: string[];
    }>;
  }>;

  /**
   * Add review to a booked bundle
   */
  reviewBundle: (
    bundleId: string,
    rating: number,
    review?: string,
    photos?: string[]
  ) => Promise<{
    success: boolean;
    reviewId: string;
  }>;
}

export const bundleApi: BundleApi = {
  /**
   * Get all bundles with filtering and pagination
   * @param options - Query options including filters and sorting
   */
  getBundles: async (options = {}) => {
    const response = await api.get('/bundles', { params: options });
    return response.data.data;
  },

  /**
   * Get a single bundle by ID with full details
   * @param id - The bundle ID
   */
  getBundle: async (id: string) => {
    const response = await api.get(`/bundles/${id}`);
    return response.data.data;
  },

  /**
   * Get a single bundle by slug (SEO-friendly URL)
   * @param slug - The bundle slug
   */
  getBundleBySlug: async (slug: string) => {
    const response = await api.get(`/bundles/slug/${slug}`);
    return response.data.data;
  },

  /**
   * Create a new bundle
   * @param data - Bundle data including services and pricing
   */
  createBundle: async (data: CreateBundlePayload) => {
    const response = await api.post('/bundles', data);
    return response.data.data;
  },

  /**
   * Update an existing bundle
   * @param id - The bundle ID
   * @param data - Fields to update
   */
  updateBundle: async (id: string, data: UpdateBundlePayload) => {
    const response = await api.patch(`/bundles/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a bundle
   * @param id - The bundle ID to delete
   */
  deleteBundle: async (id: string) => {
    const response = await api.delete(`/bundles/${id}`);
    return response.data;
  },

  /**
   * Book a bundle service
   * @param data - Booking details including date, time, address, and payment
   */
  bookBundle: async (data: BookBundlePayload) => {
    const response = await api.post('/bundles/book', data);
    return response.data.data;
  },

  /**
   * Get bundles by category
   * @param categoryId - The category ID
   * @param options - Additional filter options
   */
  getBundlesByCategory: async (categoryId: string, options = {}) => {
    const response = await api.get(`/bundles/category/${categoryId}`, {
      params: options,
    });
    return response.data.data;
  },

  /**
   * Get featured bundles for homepage
   * @param limit - Maximum number of bundles to return (default 10)
   */
  getFeaturedBundles: async (limit = 10) => {
    const response = await api.get('/bundles/featured', { params: { limit } });
    return response.data.data;
  },

  /**
   * Get popular bundles
   * @param limit - Maximum number of bundles to return (default 10)
   */
  getPopularBundles: async (limit = 10) => {
    const response = await api.get('/bundles/popular', { params: { limit } });
    return response.data.data;
  },

  /**
   * Search bundles by query
   * @param query - Search query string
   * @param options - Additional filter options
   */
  searchBundles: async (query: string, options = {}) => {
    const response = await api.get('/bundles/search', {
      params: { query, ...options },
    });
    return response.data.data;
  },

  /**
   * Get provider's own bundles
   * @param options - Pagination and filter options
   */
  getMyBundles: async (options = {}) => {
    const response = await api.get('/bundles/my', { params: options });
    return response.data.data;
  },

  /**
   * Get available time slots for a bundle
   * @param id - The bundle ID
   * @param startDate - Start date (YYYY-MM-DD)
   * @param endDate - End date (YYYY-MM-DD)
   */
  getBundleAvailability: async (
    id: string,
    startDate: string,
    endDate: string
  ) => {
    const response = await api.get(`/bundles/${id}/availability`, {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  /**
   * Add a review to a booked bundle
   * @param bundleId - The bundle ID
   * @param rating - Rating (1-5)
   * @param review - Optional review text
   * @param photos - Optional photo URLs
   */
  reviewBundle: async (
    bundleId: string,
    rating: number,
    review?: string,
    photos?: string[]
  ) => {
    const response = await api.post(`/bundles/${bundleId}/review`, {
      rating,
      review,
      photos,
    });
    return response.data.data;
  },
};

export default bundleApi;
