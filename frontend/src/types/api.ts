// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Array<{ field?: string; message: string }>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

// Generic API error response
export interface ApiError {
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

// Request config type
export interface RequestConfig {
  headers?: Record<string, string>;
  skipAuth?: boolean;
}

// Export User Data Types
export interface ExportUserData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    accountStatus: string;
    isEmailVerified: boolean;
  };
  customerProfile?: Record<string, unknown>;
  providerProfile?: Record<string, unknown>;
  bookings?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
}

// Notification Preferences
export interface NotificationPreferences {
  email: {
    bookingConfirmed: boolean;
    bookingReminder: boolean;
    bookingCancelled: boolean;
    paymentReceived: boolean;
    newReview: boolean;
    promotions: boolean;
  };
  push: {
    enabled: boolean;
    bookingUpdates: boolean;
    messages: boolean;
    promotions: boolean;
  };
  sms: {
    enabled: boolean;
    bookingUpdates: boolean;
    reminders: boolean;
  };
}

// Referral Types
export interface ReferralCode {
  code: string;
  totalUses: number;
  totalRewards: number;
  createdAt: string;
}

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingRewards: number;
  totalEarned: number;
}

export interface ReferralReward {
  id: string;
  type: 'credit' | 'discount' | 'cash';
  amount: number;
  status: 'pending' | 'completed' | 'expired';
  referredUserEmail: string;
  createdAt: string;
}
