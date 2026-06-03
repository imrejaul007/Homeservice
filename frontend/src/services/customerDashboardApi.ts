import { api } from './api';
import { AxiosError } from 'axios';

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
    name: string;
    price: number;
    category: string;
  }>;
  isVerified: boolean;
  tier: 'elite' | 'premium' | 'standard';
  distance?: number;
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
    try {
      const response = await api.get('/customer/dashboard');
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch dashboard data';
      console.error('[customerDashboardApi] getDashboard error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_DASHBOARD_FAILED');
    }
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
   */
  async getActivityFeed(limit: number = 20): Promise<ActivityItem[]> {
    try {
      const response = await api.get('/dashboard/activity', { params: { limit } });
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch activity feed';
      console.error('[customerDashboardApi] getActivityFeed error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_ACTIVITY_FAILED');
    }
  }

  /**
   * Get recommended professionals
   */
  async getRecommendedPros(limit: number = 10): Promise<RecommendedPro[]> {
    try {
      const response = await api.get('/dashboard/recommended-pros', { params: { limit } });
      return response.data.data;
    } catch (error) {
      const err = error as AxiosError;
      const message = (err.response?.data as { message?: string })?.message || err.message || 'Failed to fetch recommended pros';
      console.error('[customerDashboardApi] getRecommendedPros error:', message, err.response?.status);
      throw new CustomerDashboardApiError(message, err.response?.status, 'GET_RECOMMENDED_PROS_FAILED');
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
      return response.data.data;
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
   */
  async getRecentBookings(limit: number = 5): Promise<BookingSummary[]> {
    try {
      const response = await api.get('/bookings/customer', {
        params: {
          limit,
          sortBy: 'createdAt',
          order: 'desc',
        },
      });
      return response.data.data.bookings;
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
