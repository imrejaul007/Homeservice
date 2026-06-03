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

// Export User Data Types - expanded to match backend
export interface ExportUserData {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    accountStatus: string;
    isEmailVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  customerProfile?: {
    addresses?: Array<Record<string, unknown>>;
    paymentMethods?: Array<Record<string, unknown>>;
    preferences?: Record<string, unknown>;
    loyaltySystem?: {
      totalCoins: number;
      tier: string;
      pointsHistory?: Array<Record<string, unknown>>;
    };
    communicationPreferences?: {
      email: boolean;
      sms: boolean;
      push: boolean;
      telegram?: boolean;
      whatsapp?: boolean;
    };
    quietHours?: {
      enabled: boolean;
      start?: string;
      end?: string;
    };
    language?: string;
    timezone?: string;
    currency?: string;
  };
  providerProfile?: Record<string, unknown>;
  bookings?: Array<Record<string, unknown>>;
  services?: Array<Record<string, unknown>>;
}

// Notification Preferences - expanded to include all channels
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
  telegram?: {
    enabled: boolean;
    bookingUpdates: boolean;
    promotions: boolean;
  };
  whatsapp?: {
    enabled: boolean;
    bookingUpdates: boolean;
    promotions: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
  language?: string;
  timezone?: string;
  currency?: string;
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
