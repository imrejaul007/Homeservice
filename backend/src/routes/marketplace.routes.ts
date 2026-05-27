import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import { subscriptionService } from '../services/subscription.service';
import logger from '../utils/logger';

const router = Router();

// ============================================
// BOOKING ENDPOINTS
// ============================================

/**
 * @route   POST /api/bookings/:id/reschedule
 * @desc    Reschedule an existing booking
 * @access  Private (Customer)
 */
router.post('/bookings/:id/reschedule', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { newDate, newTime } = req.body;
  const userId = (req as any).user._id;

  if (!newDate || !newTime) {
    throw new ApiError(400, 'New date and time are required');
  }

  // Validate date format
  const newScheduledDate = new Date(`${newDate}T${newTime}`);
  if (isNaN(newScheduledDate.getTime())) {
    throw new ApiError(400, 'Invalid date or time format');
  }

  // Check if booking exists and belongs to user
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Verify ownership (customer must own the booking)
  if (booking.customerId?.toString() !== userId.toString()) {
    throw new ApiError(403, 'Not authorized to reschedule this booking');
  }

  // Check if booking can be rescheduled
  if (!['pending', 'confirmed'].includes(booking.status)) {
    throw new ApiError(400, 'Only pending or confirmed bookings can be rescheduled');
  }

  // Check provider settings for rescheduling
  const providerProfile = await ProviderProfile.findOne({ userId: booking.providerId });
  if (providerProfile && !providerProfile.settings.allowRescheduling) {
    throw new ApiError(400, 'Provider does not allow rescheduling');
  }

  // Check cancellation policy
  const now = new Date();
  const hoursUntilService = (newScheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursUntilService < (providerProfile?.settings.cancellationPolicy.freeUntilHours || 0)) {
    throw new ApiError(400, 'Rescheduling not allowed this close to the service time');
  }

  // Update booking
  const oldScheduledDate = booking.scheduledDate;
  booking.scheduledDate = newScheduledDate;
  booking.scheduledTime = newTime;

  // Recalculate estimated end time
  const [hours, minutes] = newTime.split(':').map(Number);
  const serviceStart = new Date(newScheduledDate);
  serviceStart.setHours(hours, minutes, 0, 0);
  booking.estimatedEndTime = new Date(serviceStart.getTime() + (booking.duration * 60 * 1000));

  // Add to status history
  booking.statusHistory.push({
    status: booking.status,
    timestamp: new Date(),
    reason: 'rescheduled',
    updatedBy: 'customer',
    notes: `Rescheduled from ${oldScheduledDate.toISOString()} to ${newScheduledDate.toISOString()}`
  });

  await booking.save();

  logger.info('Booking rescheduled', {
    bookingId: id,
    userId,
    oldDate: oldScheduledDate,
    newDate: newScheduledDate,
    action: 'BOOKING_RESCHEDULED'
  });

  res.json({
    success: true,
    message: 'Booking rescheduled successfully',
    data: {
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      oldScheduledDate,
      newScheduledDate,
      newScheduledTime: newTime
    }
  });
}));

// ============================================
// PAYMENT ENDPOINTS
// ============================================

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create a payment intent for a booking
 * @access  Private (Customer)
 */
router.post('/payments/create-intent', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, amount } = req.body;
  const userId = (req as any).user._id;

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  // Validate booking exists and belongs to user
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.customerId?.toString() !== userId.toString()) {
    throw new ApiError(403, 'Not authorized to make payment for this booking');
  }

  // Use booking amount if not provided
  const paymentAmount = amount || booking.pricing.totalAmount;

  // Import payment service
  const { createPaymentIntent } = await import('../services/payment.service');
  const result = await createPaymentIntent(bookingId);

  logger.info('Payment intent created via marketplace', {
    bookingId,
    amount: paymentAmount,
    userId,
    action: 'CREATE_PAYMENT_INTENT'
  });

  res.json({
    success: true,
    message: 'Payment intent created',
    data: {
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      amount: paymentAmount
    }
  });
}));

/**
 * @route   POST /api/payments/refund/:bookingId
 * @desc    Process refund for a booking
 * @access  Private (Admin or Provider)
 */
router.post('/payments/refund/:bookingId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.params;
  const { amount } = req.body;
  const user = req as any;

  // Only admin or provider can issue refunds
  if (user.role !== 'admin' && user.role !== 'provider') {
    throw new ApiError(403, 'Not authorized to issue refunds');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Provider can only refund their own bookings
  if (user.role === 'provider') {
    const providerProfile = await ProviderProfile.findOne({ userId: user._id });
    if (!providerProfile || booking.providerId.toString() !== user._id.toString()) {
      throw new ApiError(403, 'Not authorized to refund this booking');
    }
  }

  // Import refund from payment service
  const { createRefund } = await import('../services/payment.service');
  const result = await createRefund(bookingId, amount);

  logger.info('Refund processed via marketplace', {
    bookingId,
    amount: result.amount,
    userId: user._id,
    userRole: user.role,
    action: 'REFUND_PROCESSED'
  });

  res.json({
    success: result.success,
    message: result.message,
    data: {
      refundId: result.refundId,
      amount: result.amount
    }
  });
}));

/**
 * @route   GET /api/payments/methods
 * @desc    Get user's saved payment methods
 * @access  Private
 */
router.get('/payments/methods', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  // Get customer profile for saved payment methods
  const CustomerProfile = (await import('../models/customerProfile.model')).default;
  const customerProfile = await CustomerProfile.findOne({ userId });

  res.json({
    success: true,
    data: {
      paymentMethods: customerProfile?.paymentMethods || [],
      defaultMethod: customerProfile?.paymentMethods?.find((m: any) => m.isDefault)
    }
  });
}));

/**
 * @route   POST /api/payments/methods
 * @desc    Add a new payment method
 * @access  Private
 */
router.post('/payments/methods', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { type, token, isDefault } = req.body;
  const userId = (req as any).user._id;

  if (!type || !token) {
    throw new ApiError(400, 'Payment method type and token are required');
  }

  const CustomerProfile = (await import('../models/customerProfile.model')).default;
  let customerProfile = await CustomerProfile.findOne({ userId });

  if (!customerProfile) {
    customerProfile = new CustomerProfile({ userId });
  }

  // Add new payment method
  const newMethod = {
    type,
    token,
    last4: req.body.last4 || '****',
    brand: req.body.brand || type,
    expiryMonth: req.body.expiryMonth,
    expiryYear: req.body.expiryYear,
    isDefault: isDefault || customerProfile.paymentMethods.length === 0,
    isActive: true,
    createdAt: new Date()
  };

  // If setting as default, unset others
  if (isDefault) {
    customerProfile.paymentMethods.forEach(m => m.isDefault = false);
  }

  customerProfile.paymentMethods.push(newMethod);
  await customerProfile.save();

  res.json({
    success: true,
    message: 'Payment method added',
    data: {
      methodId: customerProfile.paymentMethods[customerProfile.paymentMethods.length - 1]._id
    }
  });
}));

// ============================================
// SUBSCRIPTION ENDPOINTS
// ============================================

/**
 * @route   GET /api/subscription/current
 * @desc    Get current user's subscription
 * @access  Private
 */
router.get('/subscription/current', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  const subscription = await subscriptionService.getSubscriptionByUserId(userId);

  if (!subscription) {
    // Return free tier subscription
    return res.json({
      success: true,
      data: {
        tier: 'free',
        status: 'active',
        features: ['Basic booking', 'Limited providers'],
        limits: {
          bookingsPerMonth: 2,
          featuredListings: 0
        }
      }
    });
  }

  return res.json({
    success: true,
    data: {
      id: subscription._id,
      tier: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      price: subscription.price,
      currency: subscription.currency,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      features: getPlanFeatures(subscription.plan),
      usage: subscription.usage
    }
  });
}));

/**
 * @route   POST /api/subscription/create
 * @desc    Create a new subscription
 * @access  Private
 */
router.post('/subscription/create', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { tier, billingCycle, paymentMethodId } = req.body;
  const userId = (req as any).user._id;

  if (!tier) {
    throw new ApiError(400, 'Subscription tier is required');
  }

  const validTiers = ['free', 'basic', 'premium', 'enterprise'];
  if (!validTiers.includes(tier)) {
    throw new ApiError(400, `Invalid tier. Must be one of: ${validTiers.join(', ')}`);
  }

  if (tier !== 'free' && !paymentMethodId) {
    throw new ApiError(400, 'Payment method required for paid plans');
  }

  const subscription = await subscriptionService.createSubscription({
    userId: userId.toString(),
    plan: tier as any,
    billingCycle: billingCycle || 'monthly',
    paymentMethodId
  });

  logger.info('Subscription created via marketplace', {
    userId,
    tier,
    billingCycle,
    action: 'SUBSCRIPTION_CREATED'
  });

  res.json({
    success: true,
    message: 'Subscription created successfully',
    data: {
      id: subscription._id,
      tier: subscription.plan,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodEnd: subscription.currentPeriodEnd
    }
  });
}));

/**
 * @route   POST /api/subscription/cancel
 * @desc    Cancel current subscription
 * @access  Private
 */
router.post('/subscription/cancel', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { immediate, reason } = req.body;
  const userId = (req as any).user._id;

  try {
    const subscription = await subscriptionService.cancelSubscription(userId.toString(), {
      immediate: immediate || false,
      reason: reason || 'User requested cancellation'
    });

    logger.info('Subscription cancelled via marketplace', {
      userId,
      immediate,
      action: 'SUBSCRIPTION_CANCELLED'
    });

    res.json({
      success: true,
      message: immediate ? 'Subscription cancelled immediately' : 'Subscription will be cancelled at period end',
      data: {
        tier: subscription.plan,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new ApiError(404, 'No active subscription found');
    }
    throw error;
  }
}));

/**
 * @route   POST /api/subscription/upgrade
 * @desc    Upgrade subscription tier
 * @access  Private
 */
router.post('/subscription/upgrade', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { tier, billingCycle } = req.body;
  const userId = (req as any).user._id;

  if (!tier) {
    throw new ApiError(400, 'Target tier is required');
  }

  try {
    const subscription = await subscriptionService.changePlan(userId.toString(), tier as any, {
      billingCycle,
      immediate: true,
      reason: 'User requested upgrade'
    });

    logger.info('Subscription upgraded via marketplace', {
      userId,
      newTier: tier,
      action: 'SUBSCRIPTION_UPGRADED'
    });

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      data: {
        tier: subscription.plan,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        price: subscription.price
      }
    });
  } catch (error: any) {
    if (error.message?.includes('not found')) {
      throw new ApiError(404, 'No active subscription found');
    }
    throw error;
  }
}));

/**
 * @route   GET /api/subscription/plans
 * @desc    Get available subscription plans
 * @access  Public
 */
router.get('/subscription/plans', asyncHandler(async (_req: Request, res: Response) => {
  const plans = {
    free: {
      name: 'Free',
      price: 0,
      billingCycle: null,
      features: [
        'Browse and search providers',
        'Book up to 2 services per month',
        'Standard support',
        'Basic provider profiles'
      ],
      limits: {
        bookingsPerMonth: 2,
        featuredListings: 0,
        prioritySupport: false,
        analytics: false
      }
    },
    basic: {
      name: 'Basic',
      price: 29,
      billingCycle: 'monthly',
      features: [
        'Everything in Free',
        'Book up to 10 services per month',
        'Priority support',
        'Full provider profiles',
        'Basic analytics'
      ],
      limits: {
        bookingsPerMonth: 10,
        featuredListings: 1,
        prioritySupport: true,
        analytics: true
      }
    },
    premium: {
      name: 'Premium',
      price: 79,
      billingCycle: 'monthly',
      features: [
        'Everything in Basic',
        'Unlimited bookings',
        'Featured provider listings',
        'Advanced analytics',
        'Exclusive deals and offers',
        'Early access to new features'
      ],
      limits: {
        bookingsPerMonth: -1, // unlimited
        featuredListings: 5,
        prioritySupport: true,
        analytics: true
      }
    },
    enterprise: {
      name: 'Enterprise',
      price: 199,
      billingCycle: 'monthly',
      features: [
        'Everything in Premium',
        'Dedicated account manager',
        'Custom integrations',
        'API access',
        'Volume discounts',
        'White-label options'
      ],
      limits: {
        bookingsPerMonth: -1,
        featuredListings: -1,
        prioritySupport: true,
        analytics: true,
        apiAccess: true,
        whiteLabel: true
      }
    }
  };

  res.json({
    success: true,
    data: plans
  });
}));

/**
 * @route   GET /api/subscription/usage
 * @desc    Get current subscription usage
 * @access  Private
 */
router.get('/subscription/usage', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user._id;

  const usage = await subscriptionService.getUsageStats(userId.toString());

  res.json({
    success: true,
    data: usage
  });
}));

// ============================================
// ADMIN PROVIDER MANAGEMENT
// ============================================

/**
 * @route   GET /api/admin/providers/pending
 * @desc    Get list of pending providers
 * @access  Admin
 */
router.get('/admin/providers/pending', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [providers, total] = await Promise.all([
    ProviderProfile.find({ 'verificationStatus.overall': 'pending' })
      .populate('userId', 'firstName lastName email phone createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' })
  ]);

  res.json({
    success: true,
    data: {
      providers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
}));

/**
 * @route   POST /api/admin/providers/:id/approve
 * @desc    Approve a provider
 * @access  Admin
 */
router.post('/admin/providers/:id/approve', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { notes } = req.body;

  const provider = await ProviderProfile.findById(id);
  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'approved') {
    throw new ApiError(400, 'Provider is already approved');
  }

  provider.verificationStatus.overall = 'approved';
  provider.verificationStatus.adminNotes = notes || 'Approved by admin';
  await provider.save();

  // Update user account status
  await User.findByIdAndUpdate(provider.userId, { accountStatus: 'active' });

  logger.info('Provider approved via marketplace admin', {
    providerId: id,
    adminId: (req as any).user._id,
    action: 'PROVIDER_APPROVED'
  });

  res.json({
    success: true,
    message: 'Provider approved successfully',
    data: {
      providerId: provider._id,
      status: provider.verificationStatus.overall,
      approvedAt: new Date()
    }
  });
}));

/**
 * @route   POST /api/admin/providers/:id/reject
 * @desc    Reject a provider
 * @access  Admin
 */
router.post('/admin/providers/:id/reject', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, notes } = req.body;

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const provider = await ProviderProfile.findById(id);
  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'rejected') {
    throw new ApiError(400, 'Provider is already rejected');
  }

  provider.verificationStatus.overall = 'rejected';
  provider.verificationStatus.adminNotes = notes || `Rejected: ${reason}`;
  await provider.save();

  // Update user account status
  await User.findByIdAndUpdate(provider.userId, { accountStatus: 'suspended' });

  logger.info('Provider rejected via marketplace admin', {
    providerId: id,
    reason,
    adminId: (req as any).user._id,
    action: 'PROVIDER_REJECTED'
  });

  res.json({
    success: true,
    message: 'Provider rejected',
    data: {
      providerId: provider._id,
      status: provider.verificationStatus.overall,
      reason,
      rejectedAt: new Date()
    }
  });
}));

/**
 * @route   GET /api/admin/providers/stats
 * @desc    Get provider verification stats
 * @access  Admin
 */
router.get('/admin/providers/stats', authenticate, requireRole('admin'), asyncHandler(async (_req: Request, res: Response) => {
  const [pending, approved, rejected, total] = await Promise.all([
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'approved' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'rejected' }),
    ProviderProfile.countDocuments()
  ]);

  // Get recent activity
  const recentSubmissions = await ProviderProfile.find({
    'verificationStatus.overall': 'pending'
  })
    .populate('userId', 'firstName lastName email')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      stats: {
        pending,
        approved,
        rejected,
        total,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
      },
      recentSubmissions: recentSubmissions.map(p => ({
        providerId: p._id,
        businessName: p.businessInfo.businessName,
        submittedAt: p.createdAt,
        user: p.userId
      }))
    }
  });
}));

// ============================================
// ANALYTICS ENDPOINTS
// ============================================

/**
 * @route   GET /api/analytics/funnel
 * @desc    Get booking funnel analytics
 * @access  Admin
 */
router.get('/analytics/funnel', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const { period = '30d' } = req.query;

  let startDate: Date;
  const now = new Date();

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Calculate funnel metrics
  const [
    totalViews,
    searches,
    bookingStarts,
    bookings,
    completions
  ] = await Promise.all([
    // Track views (from analytics or search)
    Booking.countDocuments({
      createdAt: { $gte: startDate },
      metadata: { $exists: true }
    }),
    Booking.countDocuments({
      createdAt: { $gte: startDate }
    }),
    Booking.countDocuments({
      createdAt: { $gte: startDate },
      status: { $in: ['pending', 'confirmed', 'in_progress', 'completed'] }
    }),
    Booking.countDocuments({
      createdAt: { $gte: startDate },
      status: { $ne: 'cancelled' }
    }),
    Booking.countDocuments({
      createdAt: { $gte: startDate },
      status: 'completed'
    })
  ]);

  const conversionRate = searches > 0 ? Math.round((bookings / searches) * 10000) / 100 : 0;
  const completionRate = bookings > 0 ? Math.round((completions / bookings) * 10000) / 100 : 0;

  res.json({
    success: true,
    data: {
      period,
      funnel: {
        views: totalViews,
        searches,
        bookingStarts,
        bookings,
        completions,
        conversion: conversionRate,
        completionRate
      },
      dateRange: {
        start: startDate,
        end: now
      }
    }
  });
}));

/**
 * @route   GET /api/analytics/revenue
 * @desc    Get revenue analytics
 * @access  Admin
 */
router.get('/analytics/revenue', authenticate, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get revenue from completed bookings
  const [thisMonthBookings, lastMonthBookings, allTimeBookings] = await Promise.all([
    Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
          count: { $sum: 1 },
          avgValue: { $avg: '$pricing.totalAmount' }
        }
      }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]),
    Booking.aggregate([
      {
        $match: {
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pricing.totalAmount' },
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const thisMonthTotal = thisMonthBookings[0]?.total || 0;
  const lastMonthTotal = lastMonthBookings[0]?.total || 0;
  const total = allTimeBookings[0]?.total || 0;

  const growth = lastMonthTotal > 0
    ? Math.round(((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 10000) / 100
    : 0;

  // Daily revenue for this month
  const dailyRevenue = await Booking.aggregate([
    {
      $match: {
        status: 'completed',
        createdAt: { $gte: startOfMonth }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$pricing.totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      summary: {
        total,
        thisMonth: thisMonthTotal,
        lastMonth: lastMonthTotal,
        growth,
        thisMonthBookings: thisMonthBookings[0]?.count || 0,
        avgBookingValue: thisMonthBookings[0]?.avgValue || 0
      },
      dailyRevenue,
      currency: 'AED'
    }
  });
}));

/**
 * @route   GET /api/analytics/provider/:providerId
 * @desc    Get analytics for specific provider
 * @access  Admin or Provider (own)
 */
router.get('/analytics/provider/:providerId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const user = req as any;

  // Check authorization
  if (user.role !== 'admin' && user._id.toString() !== providerId) {
    throw new ApiError(403, 'Not authorized to view these analytics');
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  const [
    providerBookings,
    lastMonthBookings,
    providerProfile
  ] = await Promise.all([
    Booking.find({
      providerId,
      createdAt: { $gte: startOfMonth }
    }).populate('customerId', 'firstName lastName'),
    Booking.countDocuments({
      providerId,
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    }),
    ProviderProfile.findOne({ userId: providerId })
  ]);

  const completedBookings = providerBookings.filter(b => b.status === 'completed');
  const cancelledBookings = providerBookings.filter(b => b.status === 'cancelled');

  const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
  const lastMonthRevenue = await Booking.aggregate([
    {
      $match: {
        providerId: providerProfile?._id,
        status: 'completed',
        createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$pricing.totalAmount' }
      }
    }
  ]);

  const revenue = lastMonthRevenue[0]?.total || 0;
  const growth = revenue > 0
    ? Math.round(((totalRevenue - revenue) / revenue) * 10000) / 100
    : 0;

  res.json({
    success: true,
    data: {
      providerId,
      period: 'this_month',
      stats: {
        totalBookings: providerBookings.length,
        completedBookings: completedBookings.length,
        cancelledBookings: cancelledBookings.length,
        pendingBookings: providerBookings.filter(b => b.status === 'pending').length,
        totalRevenue,
        avgBookingValue: completedBookings.length > 0
          ? totalRevenue / completedBookings.length
          : 0,
        growth
      },
      rating: providerProfile?.reviewsData?.averageRating || 0,
      totalReviews: providerProfile?.reviewsData?.totalReviews || 0,
      recentBookings: providerBookings.slice(0, 10).map(b => ({
        id: b._id,
        bookingNumber: b.bookingNumber,
        status: b.status,
        customer: b.customerId,
        totalAmount: b.pricing?.totalAmount,
        scheduledDate: b.scheduledDate,
        createdAt: b.createdAt
      }))
    }
  });
}));

// ============================================
// HELPER FUNCTIONS
// ============================================

function getPlanFeatures(plan: string): string[] {
  const features: Record<string, string[]> = {
    free: [
      'Basic booking',
      'Limited providers',
      'Standard support'
    ],
    basic: [
      'Everything in Free',
      'Up to 10 bookings/month',
      'Priority support',
      'Full profiles'
    ],
    premium: [
      'Everything in Basic',
      'Unlimited bookings',
      'Featured listings',
      'Advanced analytics',
      'Exclusive deals'
    ],
    enterprise: [
      'Everything in Premium',
      'Dedicated manager',
      'Custom integrations',
      'API access',
      'Volume discounts'
    ]
  };

  return features[plan] || features.free;
}

export default router;
