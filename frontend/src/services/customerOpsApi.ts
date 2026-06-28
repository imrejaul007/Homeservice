import { api } from './api';
import { handleApiError, ServiceError } from './errors';

// ============================================
// Type Definitions
// ============================================

/**
 * CustomerTier is a FRONTEND-ONLY risk classification derived from trustScore.
 * This is NOT the same as backend loyalty tiers (e.g., bronze/silver/gold).
 *
 * Design Intent:
 * - Backend customerOpsService calculates these tiers dynamically from metrics
 * - Tiers are derived from trustScore ranges and abuse patterns
 * - This is a RISK classification system, not a loyalty program
 *
 * Backend Tier Calculation (customerOpsService):
 * - trustScore >= 80 + no flags -> 'trusted'
 * - trustScore >= 50 + no flags -> 'regular'
 * - trustScore < 50 OR has unresolved flags -> 'flagged'
 * - isBlocked = true -> 'banned'
 * - first booking within 30 days -> 'new'
 *
 * Note: If backend returns different tier values, they are normalized here
 * before being used by frontend components.
 */
export type CustomerTier = 'new' | 'regular' | 'trusted' | 'flagged' | 'banned';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AbuseFlagType =
  | 'high_refund_rate'
  | 'chargeback'
  | 'coupon_abuse'
  | 'fake_referral'
  | 'suspicious_activity'
  | 'spam'
  | 'fake_review'
  | 'multiple_accounts'
  | 'payment_fraud';

// ============================================
// DTO Interfaces
// ============================================

export interface AbuseFlag {
  type: AbuseFlagType;
  reason: string;
  createdAt: string;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
}

export interface CustomerMetrics {
  _id: string;
  userId: string;
  trustScore: number;
  tier: CustomerTier;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  noShows: number;
  cancellationRate: number;
  refundCount: number;
  refundAmount: number;
  refundRate: number;
  chargebackCount: number;
  chargebackAmount: number;
  referralCount: number;
  loyaltyPointsEarned: number;
  loyaltyPointsUsed: number;
  suspiciousReferrals: number;
  couponUsageCount: number;
  couponAbuseCount: number;
  flags: AbuseFlag[];
  abuseCount: number;
  lastAbuseAt?: string;
  lifetimeAbuseScore: number;
  spamReports: number;
  fakeEngagementCount: number;
  isBlocked: boolean;
  blockReason?: string;
  blockedAt?: string;
  blockedBy?: string;
  firstBookingAt?: string;
  lastBookingAt?: string;
  averageBookingValue: number;
  totalSpent: number;
  reviewsWritten: number;
  reviewsReceived: number;
  reviewManipulationScore: number;
  riskLevel: RiskLevel;
  riskFactors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerUserInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  accountStatus: string;
  isEmailVerified: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface RecentBooking {
  id: string;
  bookingNumber: string;
  service: string;
  serviceId?: string;
  provider: string;
  providerId?: string;
  scheduledDate: string;
  completedDate?: string;
  status: BookingStatus;
  totalAmount: number;
  currency?: string;
  paymentStatus?: string;
  notes?: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'refunded';

export interface BookingListResponse {
  bookings: RecentBooking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface CustomerAddress {
  id: string;
  label: string;
  type: 'home' | 'work' | 'other';
  address: string;
  building?: string;
  apartment?: string;
  floor?: string;
  instructions?: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
  createdAt: string;
}

export interface MaskedPaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'wallet';
  brand?: string;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
  deviceInfo?: string;
}

export type ActivityType =
  | 'login'
  | 'logout'
  | 'booking_created'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'payment'
  | 'refund'
  | 'review_submitted'
  | 'review_received'
  | 'profile_update'
  | 'address_added'
  | 'address_removed'
  | 'payment_method_added'
  | 'coupon_used'
  | 'support_ticket'
  | 'flag_added'
  | 'flag_resolved';

export interface ActivityListResponse {
  activities: ActivityItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface Message {
  id: string;
  senderId: string;
  senderType: 'admin' | 'user';
  content: string;
  read: boolean;
  createdAt: string;
}

export interface MessageListResponse {
  messages: Message[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TrustScoreDeduction {
  category: string;
  reason: string;
  amount: number;
}

export interface TrustScoreBreakdown {
  baseScore: number;
  deductions: TrustScoreDeduction[];
  finalScore: number;
  tier: CustomerTier;
  riskLevel: RiskLevel;
  riskFactors: string[];
}

export interface CustomerSearchFilters {
  search?: string;
  tier?: CustomerTier | CustomerTier[];
  riskLevel?: RiskLevel;
  isBlocked?: boolean;
  minTrustScore?: number;
  maxTrustScore?: number;
  hasUnresolvedFlags?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface CustomerListItem {
  metrics: CustomerMetrics;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
    accountStatus: string;
  };
}

export interface CustomerListResponse {
  customers: CustomerListItem[];
  total: number;
  page: number;
  pages: number;
  stats: {
    totalCustomers: number;
    averageTrustScore: number;
    tierDistribution: Record<CustomerTier, number>;
    riskDistribution: Record<string, number>;
  };
}

export interface CustomerDetailResponse {
  metrics: CustomerMetrics;
  user: CustomerUserInfo;
  recentBookings: RecentBooking[];
  abuseHistory: AbuseFlag[];
  recommendations: string[];
}

export interface DashboardStats {
  totalCustomers: number;
  tierDistribution: Record<CustomerTier, number>;
  riskDistribution: Record<string, number>;
  averageTrustScore: number;
  recentFlags: Array<{
    type: AbuseFlagType;
    reason: string;
    createdAt: string;
    customerId: string;
    customerName: string;
  }>;
  topRiskCustomers: Array<{
    userId: string;
    name: string;
    trustScore: number;
    riskLevel: string;
    riskFactors: string[];
  }>;
  dailyFlagTrend: Array<{ date: string; count: number }>;
}

export interface AbuseScanResult {
  refund: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    refundHistory: {
      count: number;
      totalAmount: number;
      rate: number;
      recentTrend: string;
    };
  };
  loyalty: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    referralAnalysis: {
      totalReferrals: number;
      suspiciousCount: number;
      patterns: string[];
    };
  };
  coupon: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    couponAnalysis: {
      totalUsage: number;
      uniqueCoupons: number;
      accountOverlap: number;
      velocity: number;
    };
  };
  chargeback: {
    isAbuse: boolean;
    confidence: number;
    details: string;
    chargebackHistory: {
      count: number;
      totalAmount: number;
      isDisputed: boolean;
      merchantLoss: number;
    };
  };
  spam: {
    isAbuse: boolean;
    confidence: number;
    details: string;
  };
  overallRisk: RiskLevel;
  shouldFlag: boolean;
  recommendedActions: string[];
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

// ============================================
// CustomerOpsApiService Class
// ============================================

class CustomerOpsApiService {
  /**
   * Get paginated list of customers with metrics
   */
  async getCustomerList(params: {
    filters?: CustomerSearchFilters;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<CustomerListResponse> {
    const { filters = {}, page = 1, limit = 20, sortBy = 'trustScore', sortOrder = 'asc' } = params;

    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortOrder', sortOrder);

    // Add filters to query params
    if (filters.search) queryParams.append('search', filters.search);
    if (filters.tier) queryParams.append('tier', Array.isArray(filters.tier) ? filters.tier.join(',') : filters.tier);
    if (filters.riskLevel) queryParams.append('riskLevel', filters.riskLevel);
    if (filters.isBlocked !== undefined) queryParams.append('isBlocked', filters.isBlocked.toString());
    if (filters.minTrustScore !== undefined) queryParams.append('minTrustScore', filters.minTrustScore.toString());
    if (filters.maxTrustScore !== undefined) queryParams.append('maxTrustScore', filters.maxTrustScore.toString());
    if (filters.hasUnresolvedFlags !== undefined) queryParams.append('hasUnresolvedFlags', filters.hasUnresolvedFlags.toString());
    if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) queryParams.append('dateTo', filters.dateTo);

    try {
      const response = await api.get(`/admin/customers?${queryParams.toString()}`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch customer list');
    }
  }

  /**
   * Get detailed information about a customer
   */
  async getCustomerDetail(customerId: string): Promise<CustomerDetailResponse> {
    try {
      const response = await api.get(`/admin/customers/${customerId}`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch customer details');
    }
  }

  /**
   * Get trust score breakdown for a customer
   */
  async getTrustScoreBreakdown(customerId: string): Promise<TrustScoreBreakdown> {
    try {
      const response = await api.get(`/admin/customers/${customerId}/trust-score`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch trust score breakdown');
    }
  }

  /**
   * Refresh trust score for a customer
   */
  async refreshTrustScore(customerId: string): Promise<TrustScoreBreakdown> {
    try {
      const response = await api.post(`/admin/customers/${customerId}/refresh-trust-score`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'refresh trust score');
    }
  }

  /**
   * Add an abuse flag to a customer
   */
  async addAbuseFlag(
    customerId: string,
    flagType: AbuseFlagType,
    reason: string
  ): Promise<ActionResult> {
    try {
      const response = await api.post(`/admin/customers/${customerId}/flags`, {
        type: flagType,
        reason,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'add abuse flag');
    }
  }

  /**
   * Resolve an abuse flag
   */
  async resolveAbuseFlag(
    customerId: string,
    flagIndex: number,
    resolutionNotes: string
  ): Promise<ActionResult> {
    try {
      const response = await api.patch(`/admin/customers/${customerId}/flags/${flagIndex}/resolve`, {
        resolutionNotes,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'resolve abuse flag');
    }
  }

  /**
   * Block a customer
   */
  async blockCustomer(customerId: string, reason: string): Promise<ActionResult> {
    try {
      const response = await api.post(`/admin/customers/${customerId}/block`, { reason });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'block customer');
    }
  }

  /**
   * Unblock a customer
   */
  async unblockCustomer(customerId: string): Promise<ActionResult> {
    try {
      const response = await api.post(`/admin/customers/${customerId}/unblock`);
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'unblock customer');
    }
  }

  /**
   * Adjust customer tier
   */
  async adjustTier(
    customerId: string,
    newTier: CustomerTier,
    reason: string
  ): Promise<ActionResult> {
    try {
      const response = await api.patch(`/admin/customers/${customerId}/tier`, {
        tier: newTier,
        reason,
      });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'adjust customer tier');
    }
  }

  /**
   * Run abuse scan on a customer
   */
  async runAbuseScan(customerId: string): Promise<{
    scanResult: AbuseScanResult;
    metrics: CustomerMetrics;
  }> {
    try {
      const response = await api.post(`/admin/customers/${customerId}/abuse-scan`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'run abuse scan');
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await api.get('/admin/customers/stats');
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch dashboard stats');
    }
  }

  /**
   * Sync metrics for a customer from booking data
   */
  async syncMetrics(customerId: string): Promise<void> {
    try {
      const response = await api.post(`/admin/customers/${customerId}/sync-metrics`);
      if (!response.data.success) {
        throw new ServiceError(response.data.message || 'Failed to sync metrics');
      }
    } catch (error) {
      throw handleApiError(error, 'sync customer metrics');
    }
  }

  /**
   * Get customers by tier
   */
  async getCustomersByTier(
    tier: CustomerTier,
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { tier },
      page,
      limit,
    });
  }

  /**
   * Get flagged customers
   */
  async getFlaggedCustomers(
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { tier: 'flagged', hasUnresolvedFlags: true },
      page,
      limit,
    });
  }

  /**
   * Get blocked customers
   */
  async getBlockedCustomers(
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { isBlocked: true },
      page,
      limit,
    });
  }

  /**
   * Get high risk customers
   */
  async getHighRiskCustomers(
    riskLevel: RiskLevel = 'high',
    page: number = 1,
    limit: number = 20
  ): Promise<CustomerListResponse> {
    return this.getCustomerList({
      filters: { riskLevel },
      page,
      limit,
      sortBy: 'trustScore',
      sortOrder: 'asc',
    });
  }

  /**
   * Get customer's complete booking history with pagination
   */
  async getCustomerBookings(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
      status?: BookingStatus | BookingStatus[];
      startDate?: string;
      endDate?: string;
    }
  ): Promise<BookingListResponse> {
    const { page = 1, limit = 20, status, startDate, endDate } = params || {};

    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (status) {
      queryParams.append('status', Array.isArray(status) ? status.join(',') : status);
    }
    if (startDate) queryParams.append('startDate', startDate);
    if (endDate) queryParams.append('endDate', endDate);

    try {
      const response = await api.get(`/admin/customers/${customerId}/bookings?${queryParams.toString()}`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch customer bookings');
    }
  }

  /**
   * Get customer's saved addresses
   * Backend response shape: { success, data: { count, addresses: CustomerAddress[] } }
   */
  async getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
    try {
      const response = await api.get(`/admin/users/${customerId}/addresses`);
      // Backend returns { data: { count, addresses } } - unwrap the addresses array
      const payload = response.data?.data;
      if (Array.isArray(payload)) {
        return payload as CustomerAddress[];
      }
      if (payload && Array.isArray(payload.addresses)) {
        return payload.addresses as CustomerAddress[];
      }
      return [];
    } catch (error) {
      throw handleApiError(error, 'fetch customer addresses');
    }
  }

  /**
   * Get customer's masked payment methods
   */
  async getCustomerPaymentMethods(customerId: string): Promise<MaskedPaymentMethod[]> {
    try {
      const response = await api.get(`/admin/users/${customerId}/payment-methods`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch customer payment methods');
    }
  }

  /**
   * Get customer's activity timeline
   */
  async getCustomerActivity(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
      type?: ActivityType | ActivityType[];
    }
  ): Promise<ActivityListResponse> {
    const { page = 1, limit = 20, type } = params || {};

    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());
    if (type) {
      queryParams.append('type', Array.isArray(type) ? type.join(',') : type);
    }

    try {
      const response = await api.get(`/admin/users/${customerId}/activity?${queryParams.toString()}`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch customer activity');
    }
  }

  /**
   * Send message to customer
   */
  async sendCustomerMessage(
    customerId: string,
    content: string
  ): Promise<{ success: boolean; message: Message }> {
    try {
      const response = await api.post(`/admin/users/${customerId}/messages`, { content });
      return response.data;
    } catch (error) {
      throw handleApiError(error, 'send customer message');
    }
  }

  /**
   * Get message history with customer
   */
  async getCustomerMessages(
    customerId: string,
    params?: {
      page?: number;
      limit?: number;
    }
  ): Promise<MessageListResponse> {
    const { page = 1, limit = 50 } = params || {};

    const queryParams = new URLSearchParams();
    queryParams.append('page', page.toString());
    queryParams.append('limit', limit.toString());

    try {
      const response = await api.get(`/admin/users/${customerId}/messages?${queryParams.toString()}`);
      return response.data.data;
    } catch (error) {
      throw handleApiError(error, 'fetch customer messages');
    }
  }
}

// ============================================
// Bulk Operations
// ============================================

export type BulkUserAction = 'activate' | 'deactivate' | 'suspend';

export interface BulkActionResult {
  success: boolean;
  updated: number;
  failed: string[];
  skippedOwnAccount?: number;
  totalRequested?: number;
}

/**
 * Perform bulk action on multiple users
 */
export async function bulkUserActionApi(
  action: BulkUserAction,
  userIds: string[]
): Promise<BulkActionResult> {
  const response = await api.post('/admin/users/bulk-action', {
    action,
    userIds,
  });
  return response.data as BulkActionResult;
}

/**
 * Export users to CSV file
 */
export async function exportUsersApi(params?: {
  status?: string;
  role?: string;
}): Promise<void> {
  const queryParams = new URLSearchParams();
  queryParams.append('format', 'csv');

  if (params?.status) {
    queryParams.append('status', params.status);
  }
  if (params?.role) {
    queryParams.append('role', params.role);
  }

  const response = await api.get(`/admin/users/export?${queryParams.toString()}`, {
    responseType: 'blob',
  });

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers['content-disposition'];
  let filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
  if (contentDisposition) {
    const matches = contentDisposition.match(/filename="(.+)"/);
    if (matches) {
      filename = matches[1];
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

// ============================================
// Export singleton instance
// ============================================

export const customerOpsApi = new CustomerOpsApiService();
export default customerOpsApi;

// ============================================
// Helper utilities
// ============================================

export const getTierColor = (tier: CustomerTier): string => {
  const colors: Record<CustomerTier, string> = {
    new: 'bg-gray-100 text-gray-700',
    regular: 'bg-blue-100 text-blue-700',
    trusted: 'bg-green-100 text-green-700',
    flagged: 'bg-amber-100 text-amber-700',
    banned: 'bg-red-100 text-red-700',
  };
  return colors[tier] || colors.new;
};

export const getTierLabel = (tier: CustomerTier): string => {
  const labels: Record<CustomerTier, string> = {
    new: 'New',
    regular: 'Regular',
    trusted: 'Trusted',
    flagged: 'Flagged',
    banned: 'Banned',
  };
  return labels[tier] || tier;
};

export const getRiskColor = (riskLevel: RiskLevel): string => {
  const colors: Record<RiskLevel, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };
  return colors[riskLevel] || colors.low;
};

export const getRiskLabel = (riskLevel: RiskLevel): string => {
  const labels: Record<RiskLevel, string> = {
    low: 'Low Risk',
    medium: 'Medium Risk',
    high: 'High Risk',
    critical: 'Critical Risk',
  };
  return labels[riskLevel] || riskLevel;
};

export const getTrustScoreColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  if (score >= 20) return 'text-orange-600';
  return 'text-red-600';
};

export const getTrustScoreBgColor = (score: number): string => {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-yellow-100';
  if (score >= 20) return 'bg-orange-100';
  return 'bg-red-100';
};

export const formatFlagType = (type: AbuseFlagType): string => {
  const labels: Record<AbuseFlagType, string> = {
    high_refund_rate: 'High Refund Rate',
    chargeback: 'Chargeback',
    coupon_abuse: 'Coupon Abuse',
    fake_referral: 'Fake Referral',
    suspicious_activity: 'Suspicious Activity',
    spam: 'Spam',
    fake_review: 'Fake Review',
    multiple_accounts: 'Multiple Accounts',
    payment_fraud: 'Payment Fraud',
  };
  return labels[type] || type;
};

// ============================================
// New Helper Utilities
// ============================================

export const formatBookingStatus = (status: BookingStatus): string => {
  const labels: Record<BookingStatus, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
    refunded: 'Refunded',
  };
  return labels[status] || status;
};

export const getBookingStatusColor = (status: BookingStatus): string => {
  const colors: Record<BookingStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-purple-100 text-purple-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-700',
    no_show: 'bg-orange-100 text-orange-700',
    refunded: 'bg-red-100 text-red-700',
  };
  return colors[status] || 'bg-gray-100 text-gray-700';
};

export const formatPaymentMethod = (method: MaskedPaymentMethod): string => {
  if (method.type === 'card' && method.brand) {
    return `${method.brand} ****${method.last4}`;
  }
  if (method.type === 'bank_account') {
    return `Bank ****${method.last4}`;
  }
  if (method.type === 'wallet') {
    return `Wallet ${method.last4 ? '****' + method.last4 : ''}`;
  }
  return `${method.type} ${method.last4 ? '****' + method.last4 : ''}`;
};

export const formatPaymentMethodExpiry = (method: MaskedPaymentMethod): string | null => {
  if (method.expiryMonth && method.expiryYear) {
    return `${method.expiryMonth.toString().padStart(2, '0')}/${method.expiryYear.toString().slice(-2)}`;
  }
  return null;
};

export const formatActivityType = (type: ActivityType): string => {
  const labels: Record<ActivityType, string> = {
    login: 'Login',
    logout: 'Logout',
    booking_created: 'Booking Created',
    booking_completed: 'Booking Completed',
    booking_cancelled: 'Booking Cancelled',
    payment: 'Payment',
    refund: 'Refund',
    review_submitted: 'Review Submitted',
    review_received: 'Review Received',
    profile_update: 'Profile Updated',
    address_added: 'Address Added',
    address_removed: 'Address Removed',
    payment_method_added: 'Payment Method Added',
    coupon_used: 'Coupon Used',
    support_ticket: 'Support Ticket',
    flag_added: 'Flag Added',
    flag_resolved: 'Flag Resolved',
  };
  return labels[type] || type;
};

export const getActivityIcon = (type: ActivityType): string => {
  // Return icon name for use with lucide-react
  const icons: Record<ActivityType, string> = {
    login: 'LogIn',
    logout: 'LogOut',
    booking_created: 'CalendarPlus',
    booking_completed: 'CalendarCheck',
    booking_cancelled: 'CalendarX',
    payment: 'CreditCard',
    refund: 'RotateCcw',
    review_submitted: 'Star',
    review_received: 'Star',
    profile_update: 'User',
    address_added: 'MapPin',
    address_removed: 'MapPinOff',
    payment_method_added: 'CreditCard',
    coupon_used: 'Tag',
    support_ticket: 'MessageCircle',
    flag_added: 'Flag',
    flag_resolved: 'CheckCircle',
  };
  return icons[type] || 'Activity';
};

export const formatAddress = (address: CustomerAddress): string => {
  const parts: string[] = [];
  if (address.building) parts.push(`Building ${address.building}`);
  if (address.apartment) parts.push(`Apt ${address.apartment}`);
  if (address.floor) parts.push(`Floor ${address.floor}`);
  parts.push(address.address);
  return parts.join(', ');
};

export const getAddressTypeLabel = (type: CustomerAddress['type']): string => {
  const labels: Record<CustomerAddress['type'], string> = {
    home: 'Home',
    work: 'Work',
    other: 'Other',
  };
  return labels[type] || 'Other';
};
