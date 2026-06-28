import { Request, Response, NextFunction } from 'express';
import { customerOpsService } from '../services/customerOps.service';
import User from '../models/user.model';
import Address from '../models/address.model';
import CustomerProfile from '../models/customerProfile.model';
import Wallet from '../models/wallet.model';
import BookingNotification from '../models/bookingNotification.model';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import Dispute from '../models/dispute.model';
import AuditLog from '../models/auditLog.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import { Types } from 'mongoose';
import { notificationService } from '../services/notification.service';

/**
 * Escape HTML special characters to prevent XSS attacks
 * @param str - String to escape
 * @returns HTML-escaped string safe for insertion into HTML
 */
const escapeHtml = (str: string): string => {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
};

// ============================================
// Validation Schemas (inline for simplicity)
// ============================================

const abuseFlagTypes = [
  'high_refund_rate',
  'chargeback',
  'coupon_abuse',
  'fake_referral',
  'suspicious_activity',
  'spam',
  'fake_review',
  'multiple_accounts',
  'payment_fraud',
];

const customerTiers = ['new', 'regular', 'trusted', 'flagged', 'banned'];

// ============================================
// Customer List & Search
// ============================================

/**
 * Get paginated list of customers with metrics
 * GET /api/admin/customers
 */
export const getCustomerList = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    search,
    tier,
    riskLevel,
    isBlocked,
    minTrustScore,
    maxTrustScore,
    hasUnresolvedFlags,
    dateFrom,
    dateTo,
    page = '1',
    limit = '20',
    sortBy = 'trustScore',
    sortOrder = 'asc',
  } = req.query;

  const filters: Record<string, unknown> = {};

  if (search) filters.search = search as string;
  if (tier) filters.tier = tier as string;
  if (riskLevel) filters.riskLevel = riskLevel as string;
  if (isBlocked !== undefined) filters.isBlocked = isBlocked === 'true';
  if (minTrustScore !== undefined) filters.minTrustScore = parseInt(minTrustScore as string);
  if (maxTrustScore !== undefined) filters.maxTrustScore = parseInt(maxTrustScore as string);
  if (hasUnresolvedFlags !== undefined) filters.hasUnresolvedFlags = hasUnresolvedFlags === 'true';
  if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
  if (dateTo) filters.dateTo = new Date(dateTo as string);

  const result = await customerOpsService.getCustomerList(
    filters as any,
    parseInt(page as string),
    parseInt(limit as string),
    sortBy as string,
    sortOrder as 'asc' | 'desc'
  );

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Search customers by name, email, or phone (quick lookup)
 * GET /api/admin/customers/search?q={query}&limit={limit}
 */
export const searchCustomers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { q, limit = '10' } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    throw new ApiError(400, 'Search query is required');
  }

  const searchQuery = q.trim();
  const limitNum = Math.min(Math.max(parseInt(limit as string) || 10, 1), 50);

  // Escape regex special characters for safety
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedQuery = escapeRegex(searchQuery);

  // Build OR query across searchable fields
  const searchRegex = new RegExp(escapedQuery, 'i');

  const customers = await User.find({
    role: 'customer',
    isDeleted: false,
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ],
  })
    .select('_id firstName lastName email avatar phone')
    .sort({ lastLogin: -1 })
    .limit(limitNum)
    .lean();

  const results = customers.map(customer => ({
    id: customer._id.toString(),
    name: `${customer.firstName} ${customer.lastName}`,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    avatar: customer.avatar,
    phone: customer.phone,
  }));

  res.status(200).json({
    success: true,
    data: {
      customers: results,
      count: results.length,
      query: searchQuery,
    },
  });
});

// ============================================
// Customer Detail
// ============================================

/**
 * Get detailed information about a customer
 * GET /api/admin/customers/:id
 */
export const getCustomerDetail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const result = await customerOpsService.getCustomerDetail(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get paginated bookings for a specific user
 * GET /api/admin/users/:id/bookings
 */
export const getCustomerBookings = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const {
    page = '1',
    limit = '20',
    status,
    startDate,
    endDate,
  } = req.query;

  // Validate user ID format
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  // Validate user exists
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Validate pagination params
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, 'Invalid page number');
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, 'Limit must be between 1 and 100');
  }

  // Validate date formats if provided
  let parsedStartDate: Date | undefined;
  let parsedEndDate: Date | undefined;
  if (startDate) {
    parsedStartDate = new Date(startDate as string);
    if (isNaN(parsedStartDate.getTime())) {
      throw new ApiError(400, 'Invalid start date format');
    }
  }
  if (endDate) {
    parsedEndDate = new Date(endDate as string);
    if (isNaN(parsedEndDate.getTime())) {
      throw new ApiError(400, 'Invalid end date format');
    }
  }

  // Validate status if provided
  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'refunded', 'rejected', 'active', 'all'];
  if (status && !validStatuses.includes(status as string)) {
    throw new ApiError(400, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const result = await customerOpsService.getUserBookings(id, {
    page: pageNum,
    limit: limitNum,
    status: status as string | undefined,
    startDate: parsedStartDate,
    endDate: parsedEndDate,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Get addresses for a specific user
 * GET /api/admin/users/:id/addresses
 */
export const getUserAddresses = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  // Validate user ID format
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  // Validate user exists
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Query user's addresses from Address collection
  const addresses = await Address.find({ userId: id }).lean();

  // Format response with required fields
  // Frontend CustomerAddress interface expects: { id, label, type, address,
  //   building?, apartment?, floor?, instructions?, lat?, lng?, isDefault, createdAt }
  // We also keep the original fields (addressLine/city/area/emirates) for
  // backward compatibility with any consumer still using them.
  const formattedAddresses = addresses.map(addr => {
    const lng = addr.location?.coordinates ? addr.location.coordinates[0] : undefined;
    const lat = addr.location?.coordinates ? addr.location.coordinates[1] : undefined;
    const addressLine = addr.street || '';

    const formatted: Record<string, unknown> = {
      // Forward-compatible fields matching frontend CustomerAddress type
      id: addr._id.toString(),
      label: addr.label || addressLine,
      type: 'other', // Address model has no `type` field; default to 'other'
      address: addressLine,
      lat,
      lng,
      isDefault: !!addr.isDefault,
      createdAt: addr.createdAt,

      // Legacy fields kept for backward compatibility
      addressLine,
      city: addr.city,
      area: addr.state,
      emirates: addr.country,
      coordinates: lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null,
    };

    // Only include optional fields when the source has values, so consumers
    // can rely on `address.building === undefined` rather than `null`.
    if (addr.instructions) formatted.instructions = addr.instructions;

    return formatted;
  });

  res.status(200).json({
    success: true,
    data: {
      count: formattedAddresses.length,
      addresses: formattedAddresses,
    },
  });
});

/**
 * Get payment methods for a specific user (masked card data)
 * GET /api/admin/users/:id/payment-methods
 */
export const getUserPaymentMethods = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  // Validate user ID format
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  // Validate user exists
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Get customer profile with payment methods
  const profile = await CustomerProfile.findOne({ userId: id }).lean();

  // Get wallet info
  const wallet = await Wallet.findOne({ userId: id }).select('balance currency isFrozen').lean();

  // Format payment methods with only masked/safe fields
  const paymentMethods = (profile?.paymentMethods || []).map(method => ({
    id: method._id?.toString(),
    type: method.type,
    isDefault: method.isDefault,
    nickname: method.nickname,
    // Card-specific masked fields only (never return full card numbers)
    last4: method.last4 ? `****${method.last4}` : undefined,
    brand: method.brand,
    expiryMonth: method.expiryMonth,
    expiryYear: method.expiryYear,
    // Status
    isActive: method.isActive,
    createdAt: method.createdAt,
    lastUsed: method.lastUsed,
  }));

  res.status(200).json({
    success: true,
    data: {
      count: paymentMethods.length,
      paymentMethods,
      wallet: wallet ? {
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: !wallet.isFrozen,
      } : null,
    },
  });
});

// ============================================
// Trust Score
// ============================================

/**
 * Get trust score breakdown for a customer
 * GET /api/admin/customers/:id/trust-score
 */
export const getTrustScoreBreakdown = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const result = await customerOpsService.getTrustScoreBreakdown(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * Refresh trust score for a customer
 * POST /api/admin/customers/:id/refresh-trust-score
 */
export const refreshTrustScore = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.refreshTrustScore(id, adminId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Abuse Flags
// ============================================

/**
 * Add an abuse flag to a customer
 * POST /api/admin/customers/:id/flags
 */
export const addAbuseFlag = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { type, reason } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  if (!type || !abuseFlagTypes.includes(type)) {
    throw new ApiError(400, `Invalid flag type. Must be one of: ${abuseFlagTypes.join(', ')}`);
  }

  if (!reason || reason.trim().length < 10) {
    throw new ApiError(400, 'Reason must be at least 10 characters');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.addAbuseFlag(id, type, reason.trim(), adminId);

  res.status(200).json(result);
});

/**
 * Resolve an abuse flag
 * PATCH /api/admin/customers/:id/flags/:flagIndex/resolve
 */
export const resolveAbuseFlag = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id, flagIndex } = req.params;
  const { resolutionNotes } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const index = parseInt(flagIndex);
  if (isNaN(index) || index < 0) {
    throw new ApiError(400, 'Invalid flag index');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.resolveAbuseFlag(id, index, resolutionNotes || '', adminId);

  res.status(200).json(result);
});

// ============================================
// Blocking/Unblocking
// ============================================

/**
 * Block a customer
 * POST /api/admin/customers/:id/block
 */
export const blockCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  if (!reason || reason.trim().length < 10) {
    throw new ApiError(400, 'Reason must be at least 10 characters');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.blockCustomer(id, reason.trim(), adminId);

  res.status(200).json(result);
});

/**
 * Unblock a customer
 * POST /api/admin/customers/:id/unblock
 */
export const unblockCustomer = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.unblockCustomer(id, adminId);

  res.status(200).json(result);
});

// ============================================
// Tier Management
// ============================================

/**
 * Adjust customer tier
 * PATCH /api/admin/customers/:id/tier
 */
export const adjustTier = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { tier, reason } = req.body;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  if (!tier || !customerTiers.includes(tier)) {
    throw new ApiError(400, `Invalid tier. Must be one of: ${customerTiers.join(', ')}`);
  }

  if (!reason || reason.trim().length < 10) {
    throw new ApiError(400, 'Reason must be at least 10 characters');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.adjustTier(id, tier, reason.trim(), adminId);

  res.status(200).json(result);
});

// ============================================
// Abuse Scan
// ============================================

/**
 * Run abuse scan on a customer
 * POST /api/admin/customers/:id/abuse-scan
 */
export const runAbuseScan = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  const adminId = req.user!._id.toString();
  const result = await customerOpsService.runAbuseScan(id, adminId);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Dashboard Stats
// ============================================

/**
 * Get dashboard statistics
 * GET /api/admin/customers/stats
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await customerOpsService.getDashboardStats();

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// Metrics Sync
// ============================================

/**
 * Sync metrics for a customer from booking data
 * POST /api/admin/customers/:id/sync-metrics
 */
export const syncCustomerMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid customer ID');
  }

  await customerOpsService.syncMetricsFromBookings(id);

  res.status(200).json({
    success: true,
    message: 'Metrics synced successfully',
  });
});

// ============================================
// Initialize Metrics
// ============================================

/**
 * Initialize metrics for all customers (admin only)
 * POST /api/admin/customers/initialize-metrics
 */
export const initializeAllMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await customerOpsService.initializeMetricsForAllCustomers();

  res.status(200).json({
    success: true,
    data: result,
  });
});

// ============================================
// User Activity Feed
// ============================================

export type ActivityType = 'login' | 'booking' | 'review' | 'refund' | 'dispute' | 'all';

interface ActivityItem {
  timestamp: Date;
  type: ActivityType;
  description: string;
  relatedEntityId?: string;
  details: Record<string, unknown>;
}

/**
 * Get aggregated user activity feed
 * GET /api/admin/users/:id/activity
 */
export const getUserActivity = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const {
    page = '1',
    limit = '20',
    type = 'all',
  } = req.query;

  // Validate user ID format
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  // Validate user exists
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Validate pagination params
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, 'Invalid page number');
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, 'Limit must be between 1 and 100');
  }

  // Validate activity type
  const validTypes = ['login', 'booking', 'review', 'refund', 'dispute', 'all'];
  if (!validTypes.includes(type as string)) {
    throw new ApiError(400, `Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  const userObjectId = new Types.ObjectId(id);
  const activities: ActivityItem[] = [];

  // Fetch activities based on type filter
  const activityType = type as ActivityType;

  // 1. Login history (from sessions or audit logs)
  if (activityType === 'all' || activityType === 'login') {
    // Get sessions as login activity
    const userDoc = await User.findById(id).select('sessions lastLogin').lean();
    if (userDoc?.sessions) {
      for (const session of userDoc.sessions) {
        activities.push({
          timestamp: session.createdAt,
          type: 'login',
          description: `Login from ${session.device || 'Unknown device'} ${session.location ? `in ${session.location}` : ''}`,
          details: {
            device: session.device,
            browser: session.browser,
            os: session.os,
            ip: session.ip,
            location: session.location,
            isCurrent: session.isCurrent,
          },
        });
      }
    }

    // Also get login-related audit logs
    const loginAuditLogs = await AuditLog.find({
      userId: userObjectId,
      action: { $in: ['LOGIN', 'LOGOUT', 'LOGIN_SUCCESS', 'LOGIN_FAILED'] },
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    for (const log of loginAuditLogs) {
      activities.push({
        timestamp: log.createdAt,
        type: 'login',
        description: log.action === 'LOGIN' || log.action === 'LOGIN_SUCCESS'
          ? 'Successful login'
          : log.action === 'LOGIN_FAILED'
            ? `Failed login attempt: ${log.errorMessage || 'Unknown error'}`
            : 'Logout',
        relatedEntityId: log._id.toString(),
        details: {
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          status: log.status,
          errorMessage: log.errorMessage,
        },
      });
    }
  }

  // 2. Bookings (from Booking collection)
  if (activityType === 'all' || activityType === 'booking') {
    const bookings = await Booking.find({ customerId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('service', 'name')
      .populate('provider', 'firstName lastName')
      .lean();

    for (const booking of bookings) {
      const provider = booking.provider as any;
      const service = booking.service as any;
      activities.push({
        timestamp: booking.createdAt,
        type: 'booking',
        description: `Booking created: ${service?.name || 'Unknown Service'} with ${provider?.firstName || ''} ${provider?.lastName || ''}`,
        relatedEntityId: booking._id.toString(),
        details: {
          bookingNumber: booking.bookingNumber,
          serviceName: service?.name,
          providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          status: booking.status,
          totalAmount: booking.pricing?.totalAmount,
          currency: booking.pricing?.currency,
          locationType: booking.locationType,
        },
      });
    }
  }

  // 3. Reviews (from Review collection)
  if (activityType === 'all' || activityType === 'review') {
    const reviews = await Review.find({ reviewerId: userObjectId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('bookingId', 'bookingNumber')
      .populate('revieweeId', 'firstName lastName')
      .lean();

    for (const review of reviews) {
      const reviewee = review.revieweeId as any;
      activities.push({
        timestamp: review.createdAt,
        type: 'review',
        description: `Review given: ${review.rating}/5 stars for ${reviewee?.firstName || ''} ${reviewee?.lastName || ''}`,
        relatedEntityId: review._id.toString(),
        details: {
          bookingNumber: (review.bookingId as any)?.bookingNumber,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          isVerified: review.isVerified,
          moderationStatus: review.moderationStatus,
          helpfulVotes: review.helpfulVotes,
        },
      });
    }
  }

  // 4. Refunds (from bookings with refunds)
  if (activityType === 'all' || activityType === 'refund') {
    const refundedBookings = await Booking.find({
      customerId: userObjectId,
      'cancellationDetails.refundAmount': { $gt: 0 },
    })
      .sort({ 'cancellationDetails.cancelledAt': -1 })
      .limit(50)
      .lean();

    for (const booking of refundedBookings) {
      if (booking.cancellationDetails?.refundAmount) {
        activities.push({
          timestamp: booking.cancellationDetails.cancelledAt || booking.updatedAt,
          type: 'refund',
          description: `Refund requested: ${booking.cancellationDetails.refundAmount} ${booking.pricing?.currency || 'AED'} for booking ${booking.bookingNumber}`,
          relatedEntityId: booking._id.toString(),
          details: {
            bookingNumber: booking.bookingNumber,
            refundAmount: booking.cancellationDetails.refundAmount,
            refundStatus: booking.cancellationDetails.refundStatus,
            cancelledBy: booking.cancellationDetails.cancelledBy,
            reason: booking.cancellationDetails.reason,
            currency: booking.pricing?.currency,
          },
        });
      }
    }
  }

  // 5. Disputes (from Dispute collection)
  if (activityType === 'all' || activityType === 'dispute') {
    const disputes = await Dispute.find({
      $or: [
        { 'initiator.userId': userObjectId },
        { 'respondent.userId': userObjectId },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    for (const dispute of disputes) {
      // Determine if user is initiator or respondent
      const isInitiator = dispute.initiator.userId.toString() === id;
      const role = isInitiator ? 'initiator' : 'respondent';

      activities.push({
        timestamp: dispute.createdAt,
        type: 'dispute',
        description: `Dispute ${role}: ${dispute.reason} - Status: ${dispute.status}`,
        relatedEntityId: dispute._id.toString(),
        details: {
          disputeNumber: dispute.disputeNumber,
          bookingNumber: dispute.bookingReference?.bookingNumber,
          category: dispute.category,
          status: dispute.status,
          priority: dispute.priority,
          reason: dispute.reason,
          description: dispute.description,
          resolution: dispute.resolution ? {
            type: dispute.resolution.type,
            amount: dispute.resolution.amount,
            reason: dispute.resolution.reason,
          } : null,
          isInitiator,
        },
      });
    }
  }

  // Sort all activities by timestamp descending (newest first)
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate pagination
  const total = activities.length;
  const pages = Math.ceil(total / limitNum);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedActivities = activities.slice(startIndex, endIndex);

  res.status(200).json({
    success: true,
    data: {
      activities: paginatedActivities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages,
        hasNext: pageNum < pages,
        hasPrev: pageNum > 1,
        nextPage: pageNum < pages ? pageNum + 1 : null,
        prevPage: pageNum > 1 ? pageNum - 1 : null,
      },
      user: {
        id: user._id.toString(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    },
  });
});

// ============================================
// Admin User Messaging
// ============================================

type MessagePriority = 'info' | 'warning' | 'urgent';
type MessageChannel = 'in_app' | 'email' | 'sms';

/**
 * Send a message to a user (admin notification)
 * POST /api/admin/users/:id/messages
 */
export const sendUserMessage = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const { message, type = 'info', channel = 'in_app' } = req.body;

  // Validate user ID format
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw new ApiError(400, 'Message is required and cannot be empty');
  }

  if (message.length > 2000) {
    throw new ApiError(400, 'Message cannot exceed 2000 characters');
  }

  // Validate type
  const validTypes: MessagePriority[] = ['info', 'warning', 'urgent'];
  if (!validTypes.includes(type)) {
    throw new ApiError(400, `Invalid message type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate channel
  const validChannels: MessageChannel[] = ['in_app', 'email', 'sms'];
  const channelsToSend = Array.isArray(channel) ? channel : [channel];
  for (const ch of channelsToSend) {
    if (!validChannels.includes(ch)) {
      throw new ApiError(400, `Invalid channel. Must be one of: ${validChannels.join(', ')}`);
    }
  }

  // Validate user exists
  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  const adminId = req.user!._id.toString();
  const channels: MessageChannel[] = channelsToSend;

  // Generate title based on type
  const titlePrefix = type === 'urgent' ? 'Urgent: ' : type === 'warning' ? 'Warning: ' : '';
  const title = `${titlePrefix}Message from Support`;

  // Create in-app notification
  let notification = null;
  if (channels.includes('in_app')) {
    notification = await notificationService.createInAppNotification({
      recipientId: id,
      type: 'promotion', // Using promotion type for admin messages
      title,
      message: message.trim(),
      metadata: {
        sentBy: adminId,
        sentByAdmin: true,
        messageType: type,
        channelsSent: channels,
      },
    });
  }

  // Send email if requested and user has email
  const channelResults: { channel: string; success: boolean; error?: string }[] = [];
  if (channels.includes('email') && targetUser.email) {
    try {
      // Escape HTML to prevent XSS attacks
      const escapedTitle = escapeHtml(title);
      const escapedMessage = escapeHtml(message.trim());
      await notificationService.sendEmail({
        to: targetUser.email,
        subject: escapedTitle,
        template: `<p><strong>${escapedTitle}</strong></p><p>${escapedMessage.replace(/\n/g, '<br>')}</p>`,
        data: { title: escapedTitle, message: escapedMessage },
      });
      channelResults.push({ channel: 'email', success: true });
    } catch (emailError) {
      const errorMsg = emailError instanceof Error ? emailError.message : 'Failed to send email';
      channelResults.push({ channel: 'email', success: false, error: errorMsg });
      logger.error('Failed to send admin message via email', {
        context: 'CustomerOps',
        action: 'ADMIN_EMAIL_FAILED',
        userId: id,
        adminId,
        error: errorMsg,
      });
    }
  }

  // Send SMS if requested and user has phone
  if (channels.includes('sms') && targetUser.phone) {
    try {
      const smsSuccess = await notificationService.sendSms(
        targetUser.phone,
        `${title}: ${message.trim().substring(0, 160)}`
      );
      channelResults.push({ channel: 'sms', success: smsSuccess, error: smsSuccess ? undefined : 'SMS failed to send' });
    } catch (smsError) {
      const errorMsg = smsError instanceof Error ? smsError.message : 'Failed to send SMS';
      channelResults.push({ channel: 'sms', success: false, error: errorMsg });
      logger.error('Failed to send admin message via SMS', {
        context: 'CustomerOps',
        action: 'ADMIN_SMS_FAILED',
        userId: id,
        adminId,
        error: errorMsg,
      });
    }
  }

  // Log the admin action
  logger.info('Admin sent message to user', {
    context: 'CustomerOps',
    action: 'ADMIN_MESSAGE_SENT',
    userId: id,
    adminId,
    messageType: type,
    channels,
    messageLength: message.trim().length,
    notificationId: notification?._id?.toString(),
    channelResults,
  });

  res.status(200).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      notificationId: notification?._id?.toString(),
      channels: {
        in_app: !!notification,
        email: channelResults.find(r => r.channel === 'email')?.success ?? false,
        sms: channelResults.find(r => r.channel === 'sms')?.success ?? false,
      },
    },
  });
});

/**
 * Get message history for a user (admin view)
 * GET /api/admin/users/:id/messages
 */
export const getUserMessages = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.params;
  const {
    page = '1',
    limit = '20',
    type,
    startDate,
    endDate,
  } = req.query;

  // Validate user ID format
  if (!Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid user ID');
  }

  // Validate user exists
  const targetUser = await User.findById(id);
  if (!targetUser) {
    throw new ApiError(404, 'User not found');
  }

  // Validate pagination params
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, 'Invalid page number');
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, 'Limit must be between 1 and 100');
  }

  // Build query for admin-sent messages
  const query: Record<string, any> = {
    recipientId: id,
    'metadata.sentByAdmin': true,
  };

  // Filter by message type
  if (type) {
    const validTypes: MessagePriority[] = ['info', 'warning', 'urgent'];
    if (!validTypes.includes(type as MessagePriority)) {
      throw new ApiError(400, `Invalid message type. Must be one of: ${validTypes.join(', ')}`);
    }
    query['metadata.messageType'] = type;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      const parsedStart = new Date(startDate as string);
      if (isNaN(parsedStart.getTime())) {
        throw new ApiError(400, 'Invalid start date format');
      }
      query.createdAt.$gte = parsedStart;
    }
    if (endDate) {
      const parsedEnd = new Date(endDate as string);
      if (isNaN(parsedEnd.getTime())) {
        throw new ApiError(400, 'Invalid end date format');
      }
      query.createdAt.$lte = parsedEnd;
    }
  }

  const skip = (pageNum - 1) * limitNum;

  const [messages, total] = await Promise.all([
    BookingNotification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    BookingNotification.countDocuments(query),
  ]);

  // Format messages for admin view
  const formattedMessages = messages.map(msg => ({
    id: msg._id.toString(),
    title: msg.title,
    message: msg.message,
    type: msg.metadata?.messageType || 'info',
    channels: msg.metadata?.channelsSent || ['in_app'],
    sentBy: msg.metadata?.sentBy,
    isRead: msg.channels?.inApp?.read || false,
    readAt: msg.channels?.inApp?.readAt,
    createdAt: msg.createdAt,
  }));

  res.status(200).json({
    success: true,
    data: {
      messages: formattedMessages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: skip + messages.length < total,
        hasPrev: pageNum > 1,
      },
    },
  });
});
