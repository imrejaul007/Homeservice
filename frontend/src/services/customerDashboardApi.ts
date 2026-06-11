import { api } from './api';
import { AxiosError } from 'axios';

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
};

/**
 * Calculate exponential backoff delay with jitter
 */
function getRetryDelay(attempt: number): number {
  const delay = Math.min(
    RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (0-25% of delay)
  const jitter = delay * 0.25 * Math.random();
  return Math.floor(delay + jitter);
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof AxiosError) {
    // Network errors, timeouts, and 5xx errors are retryable
    if (!error.response) return true; // Network error
    if (error.response.status >= 500) return true; // Server error
    if (error.code === 'ECONNABORTED') return true; // Timeout
  }
  return false;
}

/**
 * Execute a function with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; context?: string } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? RETRY_CONFIG.maxRetries;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry on last attempt or non-retryable errors
      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }

      // Wait before retrying
      const delay = getRetryDelay(attempt);
      console.warn(`[Retry] ${options.context || 'Operation'} failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * ============================================
 * API RESPONSE FORMAT DOCUMENTATION
 * ============================================
 *
 * Backend Standard Response Format:
 * {
 *   success: boolean,
 *   data: T,           // The actual data payload
 *   message?: string,  // Optional message
 *   errors?: []        // Optional validation errors
 * }
 *
 * Example:
 * GET /api/customer/dashboard returns:
 * {
 *   success: true,
 *   data: {
 *     recentBookings: [...],
 *     upcomingBookings: [...],
 *     stats: {...},
 *     loyaltyPoints: {...},
 *     currentStreak: {...}
 *   }
 * }
 *
 * ============================================
 */

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  averageOrderValue: number;
  activeBookings?: number;
  inProgressBookings?: number;
  pendingBookings?: number;
  todayBookings?: number;
  totalProviders?: number;
  reviewsWritten?: number;
  pendingReviews?: number;
}

export interface BookingSummary {
  _id: string;
  bookingNumber: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'refunded';
  scheduledDate: Date | string;
  scheduledTime: string;
  duration: number;
  totalAmount: number;
  currency: string;
  serviceName: string;
  serviceCategory: string;
  providerName: string;
  providerId: string;
  providerAvatar?: string;
  createdAt: Date | string;
  canReview?: boolean;
}

export interface LoyaltyData {
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalEarned: number;
  totalSpent: number;
  referralCode: string;
  nextTierPoints?: number;
  pointsToNextTier?: number;
  streakDays?: number;
  progressToNext?: number;
  nextTier?: string;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: Date | string;
  totalActiveDays: number;
}

export interface ActivityItem {
  type: 'booking' | 'payment' | 'review' | 'loyalty' | 'streak';
  action: string;
  description: string;
  timestamp: Date | string;
  metadata?: Record<string, unknown>;
}

export interface RecommendedPro {
  _id: string;
  userId: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  businessName?: string;
  bio?: string;
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
  services: Array<{
    _id?: string;
    name: string;
    price: number | { amount: number; currency?: string; type?: string };
    category: string;
    duration?: number;
  }>;
  isVerified: boolean;
  tier: 'elite' | 'premium' | 'standard';
  distance?: number;
  score?: number;
}

export interface ServicePackage {
  _id: string;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  discountedPrice?: number;
  pricing: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  durationLabel: string;
  features: Array<{ name: string; included: boolean }>;
  services: Array<{ _id: string; name: string; duration: number; price: number }>;
  images: string[];
  includedItems: string[];
  addOns?: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  providerName: string;
  providerId: string;
  averageRating: number;
  totalReviews: number;
  isPopular: boolean;
  isFeatured: boolean;
}

export interface DashboardResponse {
  recentBookings: BookingSummary[];
  upcomingBookings: BookingSummary[];
  stats: DashboardStats;
  loyaltyPoints: LoyaltyData;
  currentStreak: StreakData;
}

export interface PackagesResponse {
  packages: ServicePackage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface BookingStats {
  total: number;
  pending: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
  refunded: number;
}

export interface UserProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  dateOfBirth?: string;
  bio?: string;
  language?: string;
  role: 'customer' | 'provider' | 'admin';
  isEmailVerified: boolean;
  accountStatus: string;
  createdAt: string;
  updatedAt: string;
  loyaltySystem?: {
    points: number;
    tier: string;
    benefits: string[];
    totalCoins: number;
    currentStreak: number;
    referralCode?: string;
  };
}

// ============================================
// ERROR CLASS
// ============================================

export class CustomerDashboardApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'CustomerDashboardApiError';
  }
}

// ============================================
// API SERVICE
// ============================================

class CustomerDashboardApiService {

  /**
   * Get unified dashboard data
   */
  async getDashboard(): Promise<DashboardResponse> {
    return withRetry(
      async () => {
        const response = await api.get('/customer/dashboard');
        return response.data.data;
      },
      { context: 'getDashboard' }
    ).catch((error) => {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch dashboard data';
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_DASHBOARD_FAILED');
    });
  }

  /**
   * Get dashboard statistics only
   */
  async getStats(): Promise<DashboardStats> {
    try {
      const response = await api.get('/customer/dashboard/stats');
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch dashboard stats';
      console.error('[customerDashboardApi] getStats error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_STATS_FAILED');
    }
  }

  /**
   * Get loyalty data only
   */
  async getLoyalty(): Promise<LoyaltyData> {
    try {
      const response = await api.get('/customer/dashboard/loyalty');
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch loyalty data';
      console.error('[customerDashboardApi] getLoyalty error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_LOYALTY_FAILED');
    }
  }

  /**
   * Get streak data only
   */
  async getStreak(): Promise<StreakData> {
    try {
      const response = await api.get('/customer/dashboard/streak');
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch streak data';
      console.error('[customerDashboardApi] getStreak error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_STREAK_FAILED');
    }
  }

  /**
   * Get activity feed
   * @param limit - Number of activities to return
   * @param signal - Optional AbortSignal for request cancellation
   */
  async getActivityFeed(limit: number = 20, signal?: AbortSignal): Promise<ActivityItem[]> {
    try {
      const response = await api.get('/dashboard/activity', {
        params: { limit },
        signal,
      });
      return response.data.data;
    } catch (error) {
      // Ignore abort errors - they are expected when request is cancelled
      if (signal?.aborted) {
        return [];
      }
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch activity feed';
      console.error('[customerDashboardApi] getActivityFeed error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_ACTIVITY_FAILED');
    }
  }

  /**
   * Get recommended professionals with optional location for distance calculation
   * Returns both recommended pros and recently used providers
   */
  async getRecommendedPros(
    limit: number = 10,
    location?: { latitude: number; longitude: number }
  ): Promise<{ pros: RecommendedPro[]; recentlyUsed: RecommendedPro[] }> {
    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 10000);

      // Build params with optional location for geospatial queries
      const params: Record<string, any> = { limit };
      if (location?.latitude !== undefined && location?.longitude !== undefined) {
        params.latitude = location.latitude;
        params.longitude = location.longitude;
      }

      const response = await api.get('/dashboard/recommended-pros', { params, signal: controller.signal });
      const data = response.data.data;

      // Backend returns: { pros: [], recentlyUsed: [], pagination: {} }
      // Extract and return both arrays
      return {
        pros: Array.isArray(data?.pros) ? data.pros : [],
        recentlyUsed: Array.isArray(data?.recentlyUsed) ? data.recentlyUsed : [],
      };
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch recommended pros';
      console.error('[customerDashboardApi] getRecommendedPros error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_RECOMMENDED_PROS_FAILED');
    }
  }

  /**
   * Get featured packages (public route)
   */
  async getFeaturedPackages(options: {
    limit?: number;
    category?: string;
  } = {}): Promise<{ packages: ServicePackage[]; total: number }> {
    try {
      const response = await api.get('/packages/featured', { params: options });
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch featured packages';
      console.error('[customerDashboardApi] getFeaturedPackages error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_FEATURED_PACKAGES_FAILED');
    }
  }

  /**
   * Get service packages (public route)
   */
  async getPackages(options: {
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    sortBy?: 'price' | 'rating' | 'popularity';
    page?: number;
    limit?: number;
    featured?: boolean;
  } = {}): Promise<PackagesResponse> {
    try {
      const response = await api.get('/packages', { params: options });
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch packages';
      console.error('[customerDashboardApi] getPackages error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_PACKAGES_FAILED');
    }
  }

  /**
   * Get user profile
   * @returns Current authenticated user's profile data
   */
  async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await api.get('/auth/me');
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch user profile';
      console.error('[customerDashboardApi] getUserProfile error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_USER_PROFILE_FAILED');
    }
  }

  /**
   * Get booking statistics by status
   * @returns Booking counts grouped by status
   */
  async getBookingStats(): Promise<BookingStats> {
    try {
      const response = await api.get('/bookings/count');
      const data = response.data.data as {
        count?: number;
        statusBreakdown?: Record<string, number>;
      };
      const breakdown = data.statusBreakdown || {};
      const empty: BookingStats = {
        total: data.count ?? 0,
        pending: breakdown.pending ?? 0,
        confirmed: breakdown.confirmed ?? 0,
        inProgress: breakdown.in_progress ?? 0,
        completed: breakdown.completed ?? 0,
        cancelled: breakdown.cancelled ?? 0,
        noShow: breakdown.no_show ?? 0,
        refunded: breakdown.refunded ?? 0,
      };
      return empty;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch booking stats';
      console.error('[customerDashboardApi] getBookingStats error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_BOOKING_STATS_FAILED');
    }
  }

  /**
   * Get recent bookings (latest)
   * @param limit - Number of bookings to return (default: 5)
   * @returns Array of recent booking summaries
   *
   * Backend returns: { success, data: { bookings: [...] } }
   */
  async getRecentBookings(limit: number = 5): Promise<BookingSummary[]> {
    try {
      const response = await api.get('/bookings/customer', {
        params: {
          limit,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        },
      });
      // Handle both nested (data.bookings) and flat (data) response formats
      const data = response.data.data;
      if (Array.isArray(data?.bookings)) {
        return data.bookings;
      }
      if (Array.isArray(data)) {
        return data;
      }
      console.warn('[customerDashboardApi] getRecentBookings: Unexpected response format', data);
      return [];
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch recent bookings';
      console.error('[customerDashboardApi] getRecentBookings error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_RECENT_BOOKINGS_FAILED');
    }
  }
}

// Export singleton instance
export const customerDashboardApi = new CustomerDashboardApiService();
export default customerDashboardApi;
