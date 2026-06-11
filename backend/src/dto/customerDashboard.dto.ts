import mongoose from 'mongoose';

/**
 * Customer Dashboard DTOs
 * Data Transfer Objects for customer dashboard API responses
 */

// ============================================
// Dashboard Response DTOs
// ============================================

export interface DashboardStatsDTO {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  averageOrderValue: number;
}

export interface LoyaltyDataDTO {
  points: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  totalEarned: number;
  totalSpent: number;
  referralCode: string;
  nextTierPoints?: number;
  pointsToNextTier?: number;
}

export interface StreakDataDTO {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: Date;
  totalActiveDays: number;
}

export interface BookingSummaryDTO {
  _id: mongoose.Types.ObjectId;
  bookingNumber: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  scheduledDate: Date;
  scheduledTime: string;
  duration: number;
  totalAmount: number;
  currency: string;
  serviceName: string;
  serviceCategory: string;
  providerName: string;
  providerId: mongoose.Types.ObjectId;
  providerAvatar?: string;
  createdAt: Date;
}

export interface DashboardResponseDTO {
  recentBookings: BookingSummaryDTO[];
  upcomingBookings: BookingSummaryDTO[];
  stats: DashboardStatsDTO;
  loyaltyPoints: LoyaltyDataDTO;
  currentStreak: StreakDataDTO;
}

// ============================================
// Activity Feed DTOs
// ============================================

export interface ActivityItemDTO {
  type: 'booking' | 'payment' | 'review' | 'loyalty' | 'streak';
  action: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedResponseDTO {
  activities: ActivityItemDTO[];
}

// ============================================
// Recommended Pros DTOs
// ============================================

export interface RecommendedServiceDTO {
  name: string;
  price: number;
  category: string;
}

export interface RecommendedProDTO {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  avatar?: string;
  businessName?: string;
  bio?: string;
  averageRating: number;
  totalReviews: number;
  completedJobs: number;
  services: RecommendedServiceDTO[];
  isVerified: boolean;
  tier: 'elite' | 'premium' | 'standard';
  distance?: number;
  score: number;
}

export interface RecommendedProsPaginationDTO {
  total: number;
  hasMore: boolean;
}

export interface RecommendedProsResponseDTO {
  recentlyUsed: RecommendedProDTO[];
  pros: RecommendedProDTO[];
  pagination: RecommendedProsPaginationDTO;
}

// ============================================
// Service Packages DTOs
// ============================================

export interface PackageAddOnDTO {
  name: string;
  price: number;
  description?: string;
}

export interface ServicePackageDTO {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  category: string;
  basePrice: number;
  discountedPrice?: number;
  pricing?: {
    originalPrice: number;
    currentPrice: number;
    currency: string;
    type: 'fixed' | 'hourly' | 'custom';
  };
  duration: {
    totalMinutes: number;
    formatted: string;
  };
  durationLabel?: string;
  images: string[];
  includedItems: string[];
  addOns?: PackageAddOnDTO[];
  features?: Array<{ name: string; included: boolean }>;
  services?: Array<{
    _id?: string;
    serviceId?: string;
    serviceName: string;
    originalPrice: number;
    duration?: number;
    price?: number;
  }>;
  provider?: {
    _id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
    isVerified?: boolean;
  };
  providerName: string;
  providerId: mongoose.Types.ObjectId | string;
  averageRating: number;
  totalReviews: number;
  isPopular: boolean;
  isFeatured: boolean;
  stats?: {
    rating: number;
    reviewCount: number;
    totalPurchases: number;
  };
}

export interface ServicePackagesResponseDTO {
  packages: ServicePackageDTO[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============================================
// Query Parameter DTOs
// ============================================

export interface GetPackagesQueryDTO {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'price' | 'rating' | 'popularity';
  page?: number;
  limit?: number;
}

export interface GetActivityFeedQueryDTO {
  limit?: number;
}

export interface GetRecommendedProsQueryDTO {
  limit?: number;
}
