/**
 * Dashboard types matching backend DTOs
 * Data Transfer Objects for customer dashboard API responses
 */

// ============================================
// Dashboard Stats Types
// ============================================

export interface DashboardStatsDTO {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalSpent: number;
  averageRating: number;
  averageOrderValue: number;
}

// ============================================
// Loyalty Types
// ============================================

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface LoyaltyDataDTO {
  points: number;
  tier: LoyaltyTier;
  totalEarned: number;
  totalSpent: number;
  referralCode: string;
  nextTierPoints?: number;
  pointsToNextTier?: number;
}

// ============================================
// Streak Types
// ============================================

export interface StreakDataDTO {
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  totalActiveDays: number;
}

// ============================================
// Booking Types
// ============================================

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface BookingSummaryDTO {
  _id: string;
  bookingNumber: string;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  totalAmount: number;
  currency: string;
  serviceName: string;
  serviceCategory: string;
  providerName: string;
  providerId: string;
  providerAvatar?: string;
  createdAt: string;
}

// ============================================
// Dashboard Response Types
// ============================================

export interface DashboardResponseDTO {
  recentBookings: BookingSummaryDTO[];
  upcomingBookings: BookingSummaryDTO[];
  stats: DashboardStatsDTO;
  loyaltyPoints: LoyaltyDataDTO;
  currentStreak: StreakDataDTO;
}

// ============================================
// Activity Feed Types
// ============================================

export type ActivityType = 'booking' | 'payment' | 'review' | 'loyalty' | 'streak';

export interface ActivityItem {
  type: ActivityType;
  action: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityFeedResponseDTO {
  activities: ActivityItem[];
}

// ============================================
// API Response Wrappers
// ============================================

export interface DashboardStatsResponseDTO {
  success: boolean;
  data: DashboardStatsDTO;
  message?: string;
}

export interface LoyaltyDataResponseDTO {
  success: boolean;
  data: LoyaltyDataDTO;
  message?: string;
}

export interface StreakDataResponseDTO {
  success: boolean;
  data: StreakDataDTO;
  message?: string;
}

export interface ActivityFeedApiResponseDTO {
  success: boolean;
  data: ActivityFeedResponseDTO;
  message?: string;
}

export interface DashboardApiResponseDTO {
  success: boolean;
  data: DashboardResponseDTO;
  message?: string;
}
