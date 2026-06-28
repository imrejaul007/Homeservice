import { Request, Response } from 'express';
import mongoose, { PipelineStage } from 'mongoose';
import Stripe from 'stripe';
import Joi from 'joi';
import ProviderProfile from '../models/providerProfile.model';
import User, { IUser } from '../models/user.model';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import ServiceCategory from '../models/serviceCategory.model';
import Dispute from '../models/dispute.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { getTenantContext, TenantContext } from '../utils/tenantFilter';
import { sendProviderApproval, sendProviderRejection } from '../services/email.service';
import { getSocketServer } from '../socket';
import { NotificationService } from '../services/notification.service';
import { churnService, ChurnFilters } from '../services/churn.service';
import { churnPredictionService, RetentionAction } from '../services/churnPrediction.service';
import crypto from 'crypto';

// Initialize Stripe client - throw error if secret key is missing
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY environment variable is required but not set');
}
const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as const,
});

/**
 * Generate a cryptographically secure random password
 * @returns A random password with 16 characters
 * FIX: Uses crypto.randomBytes instead of Math.random() for security
 */
const generateSecurePassword = (): string => {
  const length = 16;
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + special;

  // Use crypto.randomBytes for cryptographically secure random numbers
  const randomBytes = crypto.randomBytes(32);
  let password = '';
  let byteIndex = 0;

  // Ensure at least one of each required character type
  const required = [
    lowercase[randomBytes[byteIndex++] % lowercase.length],
    uppercase[randomBytes[byteIndex++] % uppercase.length],
    numbers[randomBytes[byteIndex++] % numbers.length],
    special[randomBytes[byteIndex++] % special.length],
  ];

  // Fill the rest using remaining random bytes
  for (let i = 0; i < length; i++) {
    if (i < required.length) {
      password += required[i];
    } else {
      password += allChars[randomBytes[byteIndex++] % allChars.length];
    }
  }

  // Shuffle using Fisher-Yates with crypto random
  const passwordArray = password.split('');
  for (let i = passwordArray.length - 1; i > 0; i--) {
    const j = randomBytes[byteIndex++] % (i + 1);
    [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
  }

  return passwordArray.join('');
};

/**
 * Get all pending providers for verification
 * GET /api/admin/providers/pending
 * Hard page size limit added for security
 */
export const getPendingProviders = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
  const search = req.query.search as string | undefined;

  // Build tenant-scoped query
  const query: any = { 'verificationStatus.overall': 'pending' };

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }
  
  if (search && typeof search === 'string') {
    // SECURITY: Escape regex special characters to prevent ReDoS attacks
    const escapedSearch = escapeRegex(search);
    query.$or = [
      { 'businessInfo.businessName': { $regex: escapedSearch, $options: 'i' } }
    ];
  }

  const providers = await ProviderProfile.find(query)
    .populate('userId', 'email role accountStatus createdAt')
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await ProviderProfile.countDocuments(query);

  res.json({
    success: true,
    data: {
      providers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Get provider details for verification
 * GET /api/admin/providers/:id
 */
export const getProviderForVerification = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const provider = await ProviderProfile.findOne(query)
    .populate('userId', 'email role accountStatus createdAt lastLogin');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  res.json({
    success: true,
    data: { provider }
  });
});

/**
 * Approve provider
 * POST /api/admin/providers/:id/approve
 */
export const approveProvider = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { notes } = req.body;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const provider = await ProviderProfile.findOne(query).populate('userId', 'email');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'approved') {
    throw new ApiError(400, 'Provider is already approved');
  }

  // SECURITY FIX: Validate required verification documents before approval
  const requiredVerifications = ['identity', 'business', 'background'] as const;
  const missingDocs = requiredVerifications.filter(
    (v) => {
      const status = provider.verificationStatus[v as keyof typeof provider.verificationStatus];
      return status && (status as any).status !== 'approved';
    }
  );

  if (missingDocs.length > 0) {
    logger.warn('Provider approval blocked - missing verification documents', {
      providerId: id,
      missingVerifications: missingDocs,
      currentStatus: provider.verificationStatus,
      action: 'PROVIDER_APPROVAL_BLOCKED',
    });
    throw new ApiError(400, `Cannot approve: Missing ${missingDocs.join(', ')} verification documents. All required verifications must be approved first.`);
  }

  // Update provider verification status
  provider.verificationStatus.overall = 'approved';
  if (provider.verificationStatus.adminNotes !== undefined) {
    provider.verificationStatus.adminNotes = notes || 'Provider approved by admin';
  }

  // Set verified badge so it shows on provider cards
  provider.instagramStyleProfile.isVerified = true;

  // FIX: Wrap ALL operations (provider save, user update, service creations) in a single transaction
  // This prevents race conditions where partial state could be left on failure
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    // Save provider status update within transaction
    await provider.save({ session });

    // Update user account status within transaction
    if (provider.userId) {
      await User.findByIdAndUpdate(provider.userId, {
        accountStatus: 'active'
      }).session(session);
    }

    // IMPORTANT: Create Service documents for each provider service
    // OPTIMIZED: Batch query to avoid N+1, use insertMany for new services
    if (provider.services && provider.services.length > 0) {
      logger.info('Creating service documents for approved provider', {
        action: 'ADMIN_PROVIDER_APPROVAL',
        providerId: id,
        businessName: provider.businessInfo.businessName,
        serviceCount: provider.services.length
      });

      // OPTIMIZATION: Single query to get all existing service names
      const serviceNames = provider.services.map(s => s.name);
      const existingServices = await Service.find({
        providerId: provider.userId,
        name: { $in: serviceNames }
      }).select('name').session(session);

      const existingNames = new Set(existingServices.map(s => s.name));

      // Filter services that don't exist yet
      const newServices = provider.services
        .filter(service => !existingNames.has(service.name))
        .map(service => ({
          providerId: provider.userId,
          name: service.name,
          category: service.category,
          subcategory: service.subcategory,
          description: service.description,
          shortDescription: service.description?.substring(0, 100) || '',

          price: {
            amount: service.price.amount,
            currency: service.price.currency || 'AED',
            type: service.price.type || 'fixed',
            discounts: service.price.discounts || []
          },

          duration: service.duration,
          images: service.images || [],
          tags: service.tags || [],
          requirements: service.requirements || [],
          includedItems: service.includedItems || [],
          addOns: service.addOns || [],

          // Location from provider
          location: {
            address: {
              street: provider.locationInfo.primaryAddress.street,
              city: provider.locationInfo.primaryAddress.city,
              state: provider.locationInfo.primaryAddress.state,
              zipCode: provider.locationInfo.primaryAddress.zipCode,
              country: provider.locationInfo.primaryAddress.country || 'US'
            },
            coordinates: {
              type: 'Point',
              coordinates: [
                provider.locationInfo.primaryAddress.coordinates?.coordinates?.[0] || 55.2708,
                provider.locationInfo.primaryAddress.coordinates?.coordinates?.[1] || 25.2048
              ]
            },
            serviceArea: {
              type: 'radius',
              value: provider.businessInfo.serviceRadius || 25,
              maxDistance: provider.businessInfo.serviceRadius || 25
            },
            travelFee: provider.locationInfo.travelFee || {
              baseFee: 0,
              perKmFee: 0
            }
          },

          // Availability from provider
          availability: {
            schedule: provider.availability?.schedule || {
              monday: { isAvailable: true, timeSlots: [] },
              tuesday: { isAvailable: true, timeSlots: [] },
              wednesday: { isAvailable: true, timeSlots: [] },
              thursday: { isAvailable: true, timeSlots: [] },
              friday: { isAvailable: true, timeSlots: [] },
              saturday: { isAvailable: true, timeSlots: [] },
              sunday: { isAvailable: false, timeSlots: [] }
            },
            exceptions: [],
            bufferTime: provider.availability?.bufferTime || 15,
            instantBooking: provider.businessInfo.instantBooking || false,
            advanceBookingDays: provider.businessInfo.advanceBookingDays || 30
          },

          // Initial ratings
          rating: {
            average: 0,
            count: 0,
            distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          },

          // Services from provider registration should go through moderation
          status: 'pending_review',
          isActive: false,
          isFeatured: false,
          isPopular: false
        }));

      // OPTIMIZATION: Use insertMany for batch insert instead of individual saves
      if (newServices.length > 0) {
        await Service.insertMany(newServices, { session });
        logger.debug('Services bulk inserted within transaction', { count: newServices.length });
      }

      logger.debug('Service creation complete', {
        total: provider.services.length,
        created: newServices.length,
        skipped: existingNames.size
      });
    }

    // Commit transaction only after ALL operations succeed
    await session.commitTransaction();
    transactionCommitted = true;

    logger.info('Provider approval transaction committed', {
      action: 'PROVIDER_APPROVAL_TRANSACTION',
      providerId: id,
      businessName: provider.businessInfo.businessName,
      adminId: adminUser._id
    });
  } catch (error) {
    // Abort transaction on any failure - prevents partial/inconsistent state
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    logger.error('Provider approval transaction failed - rolled back', {
      action: 'PROVIDER_APPROVAL_ROLLBACK',
      providerId: id,
      error: error instanceof Error ? error.message : String(error),
      adminId: adminUser._id
    });
    throw error;
  } finally {
    session.endSession();
  }

  // Audit logging for provider approval
  logger.info('ADMIN_AUDIT: Provider approved', {
    action: 'PROVIDER_APPROVED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    providerId: id,
    providerEmail: (provider.userId as any)?.email,
    businessName: provider.businessInfo.businessName,
    timestamp: new Date().toISOString()
  });

  // Send approval notification email to provider (async, non-blocking)
  const userEmail = (provider.userId as any)?.email;
  const userFirstName = (provider.userId as any)?.firstName || provider.businessInfo.businessName;
  if (userEmail) {
    sendProviderApproval({
      email: userEmail,
      firstName: userFirstName,
      businessName: provider.businessInfo.businessName
    }).catch((err) => {
      logger.error('Failed to send provider approval email', {
        providerId: id,
        error: err instanceof Error ? err.message : String(err)
      });
    });
  }

  // Create in-app notification for provider
  try {
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipientId: (provider.userId as any)?._id || provider.userId?.toString(),
      type: 'provider_approved',
      title: 'Congratulations! Your account has been approved',
      message: 'Your provider account has been approved. You can now start accepting bookings.',
      actionText: 'View Dashboard',
      actionUrl: '/provider/dashboard',
      metadata: { providerId: id }
    });
  } catch (notifError) {
    logger.error('Failed to create in-app notification', {
      providerId: id,
      error: notifError instanceof Error ? notifError.message : String(notifError)
    });
  }

  // Emit socket event to provider
  const socketServer = getSocketServer();
  if (socketServer && provider.userId) {
    socketServer.emitProviderApproved((provider.userId as any)?._id || provider.userId.toString());
  }

  res.json({
    success: true,
    message: 'Provider approved successfully',
    data: { provider }
  });
});

/**
 * Reject provider
 * POST /api/admin/providers/:id/reject
 */
export const rejectProvider = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason, notes } = req.body;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const provider = await ProviderProfile.findOne(query).populate('userId', 'email');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'rejected') {
    throw new ApiError(400, 'Provider is already rejected');
  }

  // Update provider verification status
  provider.verificationStatus.overall = 'rejected';
  if (provider.verificationStatus.adminNotes !== undefined) {
    provider.verificationStatus.adminNotes = notes || '';
  }

  // Remove verified badge
  provider.instagramStyleProfile.isVerified = false;

  await provider.save();

  // Update user account status
  if (provider.userId) {
    await User.findByIdAndUpdate(provider.userId, {
      accountStatus: 'suspended'
    });

    // Invalidate all tokens for the suspended user
    const userToSuspend = await User.findById(provider.userId);
    if (userToSuspend) {
      await userToSuspend.invalidateAllTokens();
    }

    // Emit socket event to notify provider of suspension
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitProviderSuspended(
        (provider.userId as any)?._id || provider.userId.toString(),
        reason,
        undefined
      );
    }

    // FIX: Deactivate all provider's services when suspending to prevent new bookings
    const providerUserId = (provider.userId as any)?._id || provider.userId;
    await Service.updateMany(
      { providerId: providerUserId },
      {
        isActive: false,
        status: 'inactive'
      }
    );

    logger.info('ADMIN_AUDIT: Provider services deactivated due to suspension', {
      action: 'PROVIDER_SERVICES_DEACTIVATED',
      adminId: adminUser._id,
      providerId: id,
      providerUserId: providerUserId.toString(),
      timestamp: new Date().toISOString()
    });
  }

  // Audit logging for provider rejection
  logger.info('ADMIN_AUDIT: Provider rejected', {
    action: 'PROVIDER_REJECTED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    providerId: id,
    providerEmail: (provider.userId as any)?.email,
    businessName: provider.businessInfo.businessName,
    rejectionReason: reason,
    timestamp: new Date().toISOString()
  });

  // Send rejection notification email to provider (async, non-blocking)
  const userEmail = (provider.userId as any)?.email;
  const userFirstName = (provider.userId as any)?.firstName || provider.businessInfo.businessName;
  if (userEmail) {
    sendProviderRejection({
      email: userEmail,
      firstName: userFirstName,
      businessName: provider.businessInfo.businessName
    }, reason).catch((err) => {
      logger.error('Failed to send provider rejection email', {
        providerId: id,
        error: err instanceof Error ? err.message : String(err)
      });
    });
  }

  // Create in-app notification for provider
  try {
    const notificationService = new NotificationService();
    await notificationService.createNotification({
      recipientId: (provider.userId as any)?._id || provider.userId?.toString(),
      type: 'provider_rejected',
      title: 'Application Rejected',
      message: `Your provider application has been rejected. Reason: ${reason}`,
      actionText: 'View Details',
      actionUrl: '/provider/verification',
      metadata: { providerId: id, reason }
    });
  } catch (notifError) {
    logger.error('Failed to create in-app notification', {
      providerId: id,
      error: notifError instanceof Error ? notifError.message : String(notifError)
    });
  }

  // Emit socket event to provider
  const socketServer = getSocketServer();
  if (socketServer && provider.userId) {
    socketServer.emitProviderRejected(
      (provider.userId as any)?._id || provider.userId.toString(),
      reason,
      true // canAppeal - providers can submit again
    );
  }

  res.json({
    success: true,
    message: 'Provider rejected successfully',
    data: { provider }
  });
});

/**
 * Get verification statistics
 * GET /api/admin/providers/stats
 */
export const getVerificationStats = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Build tenant-scoped query
  const baseQuery: any = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const stats = await Promise.all([
    ProviderProfile.countDocuments({ ...baseQuery, 'verificationStatus.overall': 'pending' }),
    ProviderProfile.countDocuments({ ...baseQuery, 'verificationStatus.overall': 'approved' }),
    ProviderProfile.countDocuments({ ...baseQuery, 'verificationStatus.overall': 'rejected' }),
    ProviderProfile.countDocuments(baseQuery),
  ]);

  const [pending, approved, rejected, total] = stats;

  res.json({
    success: true,
    data: {
      stats: {
        pending,
        approved,
        rejected,
        total,
        approvalRate: total > 0 ? Math.round((approved / total) * 100) : 0
      }
    }
  });
});

/**
 * Create a test provider for testing admin approval flow
 * POST /api/admin/test/create-provider
 */
export const createTestProvider = asyncHandler(async (req: Request, res: Response) => {
  // SECURITY: This endpoint allows arbitrary user creation and must NEVER run in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'This endpoint is disabled in production environments'
    });
  }

  // Get custom data from request body or use defaults
  const {
    firstName = 'John',
    lastName = 'Smith',
    businessName = 'Smith Plumbing Services',
    email,
    phone = '+1-555-PLUMBER',
    city = 'New York',
    state = 'NY',
    zipCode = '10001',
    services = []
  } = req.body;

  // Create unique email if not provided
  const timestamp = Date.now();
  const providerEmail = email || `plumber${timestamp}@example.com`;

  // Generate secure random password
  const securePassword = generateSecurePassword();

  // Create provider user
  const testUser = new User({
    firstName,
    lastName,
    email: providerEmail,
    password: securePassword,
    phone,
    role: 'provider',
    isEmailVerified: true,
    accountStatus: 'pending_verification',
    dateOfBirth: new Date('1985-01-01')
  });

  await testUser.save();

  // Default plumbing services if none provided
  const defaultServices = services.length > 0 ? services : [
    {
      name: 'Emergency Plumbing Repair',
      category: 'Plumbing',
      description: '24/7 emergency plumbing repairs including pipe leaks, burst pipes, and clogged drains',
      duration: 120,
      price: { amount: 150, currency: 'AED', type: 'fixed' },
      tags: ['emergency', 'repair', '24-7'],
      isActive: true,
      images: []
    },
    {
      name: 'Water Heater Installation',
      category: 'Plumbing',
      description: 'Professional water heater installation and replacement services',
      duration: 240,
      price: { amount: 350, currency: 'AED', type: 'fixed' },
      tags: ['installation', 'water-heater'],
      isActive: true,
      images: []
    },
    {
      name: 'Drain Cleaning',
      category: 'Plumbing',
      description: 'Complete drain cleaning and unclogging services for all types of drains',
      duration: 90,
      price: { amount: 120, currency: 'AED', type: 'fixed' },
      tags: ['drain', 'cleaning', 'unclog'],
      isActive: true,
      images: []
    }
  ];

  // Create provider profile
  const testProviderProfile = new ProviderProfile({
    userId: testUser._id,
    businessInfo: {
      businessName,
      businessType: 'individual',
      description: `Professional plumbing services with 10+ years of experience. We provide reliable and efficient plumbing solutions for residential and commercial properties. Licensed and insured.`,
      tagline: 'Your trusted plumbing expert',
      serviceRadius: 30,
      instantBooking: false,
      advanceBookingDays: 14,
      businessHours: {
        monday: { isOpen: true, openTime: '07:00', closeTime: '19:00' },
        tuesday: { isOpen: true, openTime: '07:00', closeTime: '19:00' },
        wednesday: { isOpen: true, openTime: '07:00', closeTime: '19:00' },
        thursday: { isOpen: true, openTime: '07:00', closeTime: '19:00' },
        friday: { isOpen: true, openTime: '07:00', closeTime: '19:00' },
        saturday: { isOpen: true, openTime: '08:00', closeTime: '17:00' },
        sunday: { isOpen: true, openTime: '09:00', closeTime: '15:00' }
      }
    },
    instagramStyleProfile: {
      profilePhoto: 'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=150&h=150&fit=crop&crop=face',
      bio: 'Licensed plumber serving the community for over 10 years 🔧',
      isVerified: false,
      verificationBadges: [],
      highlights: [],
      posts: [],
      followersCount: 0,
      followingCount: 0,
      totalLikes: 0,
      engagementRate: 0
    },
    locationInfo: {
      primaryAddress: {
        street: '456 Main Street',
        city,
        state,
        zipCode,
        country: 'US',
        coordinates: {
          lat: 40.7128,
          lng: -74.0060
        }
      },
      mobileService: true,
      hasFixedLocation: true,
      serviceAreas: [{
        type: 'radius',
        center: {
          lat: 40.7128,
          lng: -74.0060
        },
        radius: 30,
        name: `${city} Metro Area`
      }]
    },
    services: defaultServices,
    verificationStatus: {
      overall: 'pending',
      identity: { status: 'pending', documents: [] },
      business: { status: 'pending', documents: [] },
      background: { status: 'pending' }
    },
    completionPercentage: 85,
    isActive: true
  });

  await testProviderProfile.save();

  return res.json({
    success: true,
    message: 'Test provider created successfully',
    data: {
      user: {
        id: testUser._id,
        email: testUser.email,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        // Note: password is shown only once for security
        password: securePassword
      },
      profile: {
        id: testProviderProfile._id,
        businessName: testProviderProfile.businessInfo.businessName,
        verificationStatus: testProviderProfile.verificationStatus.overall
      },
      securityNote: 'Store the generated password securely. It is only shown once and cannot be retrieved.'
    }
  });
});

// ========================================
// Admin Service Management
// ========================================

/**
 * Get all services with filtering and pagination for admin
 * GET /api/admin/services
 * Hard page size limit added for security
 */
export const getAllServices = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const {
    search,
    category,
    status,
    provider,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query: any = {};

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // SECURITY FIX: Exclude soft-deleted records from results
  query.isDeleted = { $ne: true };

  if (search && typeof search === 'string') {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } }
    ];
  }

  if (category && typeof category === 'string') {
    query.category = category;
  }

  if (status && typeof status === 'string') {
    query.status = status;
  }

  if (provider && typeof provider === 'string') {
    query.providerId = provider;
  }

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;

  const services = await Service.find(query)
    .populate('providerId', 'firstName lastName email businessInfo.businessName')
    .sort(sortOptions)
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Service.countDocuments(query);

  res.json({
    success: true,
    data: {
      services,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Get services pending approval
 * GET /api/admin/services/pending
 * Hard page size limit added for security
 */
export const getPendingServices = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  // Build tenant-scoped query
  const query: any = { status: 'pending_review' };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const services = await Service.find(query)
    .populate('providerId', 'firstName lastName email businessInfo.businessName')
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Service.countDocuments(query);

  res.json({
    success: true,
    data: {
      services,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Update service status (approve/reject/activate/deactivate)
 * PATCH /api/admin/services/:id/status
 */
export const updateServiceStatus = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { status, reason, notes } = req.body;

  // Validate status - aligned with Service model enum: 'draft', 'active', 'inactive', 'pending_review', 'rejected'
  const validStatuses = ['active', 'inactive', 'pending_review', 'draft', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const service = await Service.findOne(query)
    .populate('providerId', 'firstName lastName email businessInfo.businessName');

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  // Update service status
  const previousStatus = service.status;
  service.status = status;

  // Sync isActive with status (required for search visibility)
  // Active and rejected services should NOT be active in search
  service.isActive = status === 'active';

  // Add admin notes if provided (as metadata for now)
  if (notes) {
    if (!(service as any).adminNotes) {
      (service as any).adminNotes = [];
    }
    (service as any).adminNotes.push({
      note: notes,
      createdBy: (req.user as IUser)._id,
      createdAt: new Date(),
      action: status
    });
  }

  // Handle 'rejected' status specifically
  if (status === 'rejected') {
    // Add rejection reason to adminNotes for traceability
    if (!(service as any).adminNotes) {
      (service as any).adminNotes = [];
    }
    (service as any).adminNotes.push({
      note: reason || 'Service was rejected',
      createdBy: (req.user as IUser)._id,
      createdAt: new Date(),
      action: 'rejected',
      isRejection: true
    });
    // Store standalone rejection reason for quick access
    (service as any).rejectionReason = reason || 'Service was rejected';
    (service as any).rejectedAt = new Date();
    (service as any).rejectedBy = (req.user as IUser)._id;
  }

  // Legacy handling for inactive status
  if (status === 'inactive' && reason) {
    (service as any).rejectionReason = reason;
  }

  await service.save();

  logger.info('ADMIN_AUDIT: Service status updated', {
    action: 'SERVICE_STATUS_UPDATED',
    serviceId: service._id,
    serviceName: service.name,
    previousStatus,
    newStatus: status,
    isActive: service.isActive,
    adminId: (req.user as IUser)?._id
  });

  // ========================================
  // CACHE INVALIDATION & SEARCH INDEX UPDATE
  // ========================================

  // Clear Redis cache for this service (if using Redis caching)
  try {
    const { getRedisClient } = require('../config/redis');
    const redisClient = await getRedisClient();
    if (redisClient) {
      // Delete service-specific cache keys
      const cacheKeys = [
        `service:${id}`,
        `service:${id}:details`,
        `services:provider:${service.providerId}`,
        `services:category:${service.category}`
      ];
      for (const key of cacheKeys) {
        await redisClient.del(key).catch(() => { /* Ignore if key doesn't exist */ });
      }
      logger.debug(`Cache invalidated for service ${id}`);
    }
  } catch (cacheError) {
    logger.warn('Failed to invalidate cache', { serviceId: id, error: cacheError });
  }

  // Update Meilisearch index - update isActive status for search visibility
  try {
    const { updateServiceInIndex } = require('../services/search.service');
    await updateServiceInIndex(service._id.toString(), {
      isActive: service.isActive,
      status: service.status,
      updatedAt: new Date()
    });
    logger.debug(`Meilisearch index updated for service ${id}`);
  } catch (searchError) {
    logger.warn('Failed to update Meilisearch index', { serviceId: id, error: searchError });
  }

  // ========================================
  // NOTIFICATIONS
  // ========================================

  // Get provider user ID for notifications
  const providerUserId = (service.providerId as any)?._id || service.providerId?.toString();

  // Create in-app notification for provider
  if (providerUserId) {
    try {
      const notificationService = new NotificationService();
      const isApproved = status === 'active';
      const isRejected = status === 'rejected';

      await notificationService.createNotification({
        recipientId: providerUserId,
        type: isApproved ? 'service_approved' : isRejected ? 'service_rejected' : 'service_updated',
        title: isApproved ? 'Service Approved' : isRejected ? 'Service Rejected' : 'Service Status Updated',
        message: isApproved
          ? 'Your service has been approved and is now live.'
          : isRejected
            ? `Your service has been rejected: ${reason || 'Please review the feedback and resubmit.'}`
            : `Your service status has been updated to: ${status}`,
        actionText: isApproved ? 'View Service' : 'Edit Service',
        actionUrl: `/provider/services/${service._id}/edit`,
        metadata: { serviceId: service._id.toString(), status, previousStatus, reason }
      });
    } catch (notifError) {
      logger.error('Failed to create service notification', {
        serviceId: service._id,
        error: notifError instanceof Error ? notifError.message : String(notifError)
      });
    }

    // Emit socket event to provider
    const socketServer = getSocketServer();
    if (socketServer) {
      if (status === 'active') {
        socketServer.emitServiceApproved(service._id.toString(), providerUserId, reason);
      } else if (status === 'rejected') {
        socketServer.emitServiceRejected(service._id.toString(), providerUserId, reason || 'Service was rejected');
      }
    }
  }

  res.json({
    success: true,
    message: `Service ${status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : 'status updated'} successfully`,
    data: { service }
  });
});

/**
 * Delete service (admin only)
 * DELETE /api/admin/services/:id
 */
export const adminDeleteService = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason } = req.body;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const service = await Service.findOne(query);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  await Service.findOneAndDelete(query);

  logger.info('ADMIN_AUDIT: Service deleted', {
    action: 'SERVICE_DELETED',
    serviceId: id,
    serviceName: service.name,
    reason: reason || 'No reason provided',
    adminId: (req.user as IUser)?._id
  });

  res.json({
    success: true,
    message: 'Service deleted successfully'
  });
});

/**
 * Get service analytics and statistics for admin
 * GET /api/admin/services/stats
 */
export const getServiceStats = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Build tenant-scoped query
  const baseQuery: any = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const stats = await Promise.all([
    Service.countDocuments(baseQuery),
    Service.countDocuments({ ...baseQuery, status: 'active' }),
    Service.countDocuments({ ...baseQuery, status: 'inactive' }),
    Service.countDocuments({ ...baseQuery, status: 'pending_review' }),
    Service.countDocuments({ ...baseQuery, status: 'draft' }),
  ]);

  const [total, active, inactive, pendingReview, draft] = stats;

  // Category distribution (with tenant filter for aggregation)
  const categoryStatsPipeline: PipelineStage[] = [
    { $match: baseQuery },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price.amount' }
      }
    },
    { $sort: { count: -1 } }
  ];
  const categoryStats = await Service.aggregate(categoryStatsPipeline);

  // Recent activity
  const recentServices = await Service.find(baseQuery)
    .populate('providerId', 'firstName lastName businessInfo.businessName')
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    success: true,
    data: {
      stats: {
        total,
        active,
        inactive,
        pendingReview,
        draft,
        approvalRate: total > 0 ? Math.round((active / total) * 100) : 0
      },
      categoryStats,
      recentServices
    }
  });
});

// ========================================
// Admin Service Search
// ========================================

/**
 * Quick search for services - returns top matches
 * GET /api/admin/services/search?q={query}&limit={limit}
 *
 * Searches by service name, category, and provider name.
 * Returns lightweight response with id, name, provider, category, status.
 */
export const searchServices = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Parse query params
  const query = (req.query.q as string || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

  // Require at least 2 characters for search
  if (query.length < 2) {
    res.json({
      success: true,
      data: {
        services: [],
        total: 0,
        message: 'Search query must be at least 2 characters'
      }
    });
    return;
  }

  // Build service query
  const serviceQuery: any = {
    isDeleted: { $ne: true }
  };

  // Tenant filter
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    serviceQuery.tenantId = tenantContext.tenantId;
  }

  // Search filter for service name, category, and description
  const searchRegex = { $regex: escapeRegex(query), $options: 'i' };
  serviceQuery.$or = [
    { name: searchRegex },
    { category: searchRegex },
    { description: searchRegex },
    { tags: { $in: [new RegExp(escapeRegex(query), 'i')] } }
  ];

  // First, find matching services
  const services = await Service.find(serviceQuery)
    .select('_id name category status providerId')
    .limit(limit)
    .lean();

  // Get unique provider IDs
  const providerIds = [...new Set(
    services
      .map(s => s.providerId?.toString())
      .filter(Boolean) as string[]
  )];

  // Fetch provider names
  const providers = await User.find({ _id: { $in: providerIds } })
    .select('_id firstName lastName')
    .lean();

  // Also fetch their business info from ProviderProfile
  const providerProfiles = await ProviderProfile.find({ userId: { $in: providerIds } })
    .select('userId businessInfo.businessName')
    .lean();

  const providerProfileMap = new Map(
    providerProfiles.map(p => [p.userId.toString(), p])
  );

  const providerMap = new Map(
    providers.map(p => [p._id.toString(), p])
  );

  // Build response with provider info
  const results = services.map(service => {
    const provider = providerMap.get(service.providerId?.toString());
    const providerProfile = providerProfileMap.get(service.providerId?.toString());
    let providerName = 'Unknown Provider';

    if (provider) {
      if (providerProfile?.businessInfo?.businessName) {
        providerName = providerProfile.businessInfo.businessName;
      } else {
        providerName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.email;
      }
    }

    return {
      id: service._id,
      name: service.name,
      category: service.category,
      status: service.status,
      provider: {
        id: service.providerId,
        name: providerName
      }
    };
  });

  res.json({
    success: true,
    data: {
      services: results,
      total: results.length,
      query
    }
  });
});

/**
 * Escape special regex characters for safe search
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ========================================
// Admin User Management
// ========================================

/**
 * Get all users with filtering and pagination for admin
 * GET /api/admin/users
 * Hard page size limit added for security
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const {
    search,
    role,
    status,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query: any = {};

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  if (search && typeof search === 'string') {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (role && typeof role === 'string') {
    query.role = role;
  }

  if (status && typeof status === 'string') {
    query.accountStatus = status;
  }

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;

  const users = await User.find(query)
    .select('-password -refreshTokens') // Exclude sensitive fields
    .sort(sortOptions)
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await User.countDocuments(query);

  res.json({
    success: true,
    data: {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Update user status (activate/suspend/ban)
 * PATCH /api/admin/users/:id/status
 */
export const updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['active', 'suspended', 'banned', 'pending_verification'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const user = await User.findOne(query);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent admin from changing their own status
  if ((user._id as mongoose.Types.ObjectId).toString() === (req.user as IUser)._id.toString()) {
    throw new ApiError(400, 'Cannot change your own account status');
  }

  // Update user status
  const previousStatus = user.accountStatus;
  user.accountStatus = status;

  await user.save();

  // Emit socket event to notify the user of their status change
  const socketServer = getSocketServer();
  if (socketServer) {
    socketServer.emitUserStatusChanged(
      user._id.toString(),
      status,
      status === 'suspended' ? 'Your account has been suspended by an administrator' :
      status === 'banned' ? 'Your account has been banned' :
      status === 'active' ? 'Your account has been reactivated' : undefined
    );

    // If account is locked/suspended, also emit account locked event
    if (status === 'suspended' || status === 'banned') {
      socketServer.emitUserAccountLocked(
        user._id.toString(),
        status === 'banned' ? 'Account banned by administrator' : 'Account suspended by administrator'
      );
    }
  }

  logger.info('ADMIN_AUDIT: User status updated', {
    action: 'USER_STATUS_UPDATED',
    userId: user._id,
    userEmail: user.email,
    previousStatus: user.accountStatus,
    newStatus: status,
    adminId: (req.user as IUser)?._id
  });

  res.json({
    success: true,
    message: `User status updated to ${status} successfully`,
    data: {
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus
      }
    }
  });
});

/**
 * Delete user account (admin only)
 * DELETE /api/admin/users/:id
 * FIX: Wrap all deletions in a MongoDB transaction to prevent race conditions
 */
export const adminDeleteUser = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason } = req.body;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const user = await User.findOne(query);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent admin from deleting their own account
  if ((user._id as mongoose.Types.ObjectId).toString() === (req.user as IUser)._id.toString()) {
    throw new ApiError(400, 'Cannot delete your own account');
  }

  // Start transaction for atomic deletion of user, provider profile, and services
  const session = await mongoose.startSession();
  let deletionSuccess = false;

  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    // If user is a provider, also delete provider profile and services (with tenant filter)
    if (user.role === 'provider') {
      const profileQuery: any = { userId: user._id };
      if (!tenantContext.isAdmin && tenantContext.tenantId) {
        profileQuery.tenantId = tenantContext.tenantId;
      }
      await ProviderProfile.findOneAndDelete(profileQuery).session(session);

      const serviceQuery: any = { providerId: user._id };
      if (!tenantContext.isAdmin && tenantContext.tenantId) {
        serviceQuery.tenantId = tenantContext.tenantId;
      }
      await Service.deleteMany(serviceQuery).session(session);
    }

    // Delete user account as the final step within transaction
    await User.findOneAndDelete(query).session(session);

    // Commit transaction only if all operations succeed
    await session.commitTransaction();
    deletionSuccess = true;

    logger.info('ADMIN_AUDIT: User account deleted', {
      action: 'USER_DELETED',
      userId: user._id,
      userEmail: user.email,
      userRole: user.role,
      reason: reason || 'No reason provided',
      adminId: (req.user as IUser)?._id
    });
  } catch (error) {
    // Abort transaction on any failure - prevents partial deletions
    if (!deletionSuccess) {
      await session.abortTransaction();
    }
    logger.error('Failed to delete user account', {
      action: 'USER_DELETION_FAILED',
      userId: user._id,
      error: error instanceof Error ? error.message : String(error),
      adminId: (req.user as IUser)?._id
    });
    throw error;
  } finally {
    session.endSession();
  }

  res.json({
    success: true,
    message: 'User account deleted successfully'
  });
});

/**
 * Get user statistics for admin dashboard
 * GET /api/admin/users/stats
 */
export const getUserStats = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Build tenant-scoped query
  const baseQuery: any = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const stats = await Promise.all([
    User.countDocuments(baseQuery),
    User.countDocuments({ ...baseQuery, role: 'customer' }),
    User.countDocuments({ ...baseQuery, role: 'provider' }),
    User.countDocuments({ ...baseQuery, role: 'admin' }),
    User.countDocuments({ ...baseQuery, accountStatus: 'active' }),
    User.countDocuments({ ...baseQuery, accountStatus: 'suspended' }),
    User.countDocuments({ ...baseQuery, accountStatus: 'banned' }),
  ]);

  const [total, customers, providers, admins, active, suspended, banned] = stats;

  // Recent registrations
  const recentUsers = await User.find(baseQuery)
    .select('-password -refreshTokens')
    .sort({ createdAt: -1 })
    .limit(10);

  res.json({
    success: true,
    data: {
      stats: {
        total,
        customers,
        providers,
        admins,
        active,
        suspended,
        banned,
        activeRate: total > 0 ? Math.round((active / total) * 100) : 0
      },
      recentUsers
    }
  });
});

// ========================================
// Enhanced Provider-Service Management
// ========================================

/**
 * Get providers with their services (hierarchical view)
 * GET /api/admin/providers-with-services
 * Uses cursor-based pagination for efficiency with large datasets
 */
export const getProvidersWithServices = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Pagination params with hard limits
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

  const { status, search } = req.query;

  const query: any = {};
  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }
  if (status && status !== 'all') {
    // Handle 'under_review' status mapping - maps to 'in_progress' in verificationStatus.overall
    if (status === 'under_review') {
      query['verificationStatus.overall'] = 'in_progress';
    } else {
      query['verificationStatus.overall'] = status;
    }
  }

  if (search) {
    query.$or = [
      { 'businessInfo.businessName': { $regex: search, $options: 'i' } },
      { 'userId.email': { $regex: search, $options: 'i' } }
    ];
  }

  const ProviderProfile = require('../models/providerProfile.model').default;
  const Service = require('../models/service.model').default;

  // Get total count for pagination metadata
  const total = await ProviderProfile.countDocuments(query);

  // Apply database-level pagination (skip/limit)
  const skip = (page - 1) * limit;

  // PERFORMANCE FIX: Use aggregation to fetch providers with services in a single query
  // This replaces the previous N+1 query pattern (1 for providers + N for services)
  const providerPage = await ProviderProfile.find(query)
    .select('_id userId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  if (providerPage.length === 0) {
    res.json({
      success: true,
      data: {
        providers: [],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: false,
          hasPrevPage: page > 1
        }
      }
    });
    return;
  }

  const providerProfileIds = providerPage.map((p: { _id: mongoose.Types.ObjectId }) => p._id);
  const providerUserIds = providerPage
    .map((p: { userId?: mongoose.Types.ObjectId }) => p.userId)
    .filter(Boolean);

  // Service.providerId stores User._id, not ProviderProfile._id
  const serviceQuery: any = { providerId: { $in: providerUserIds } };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    serviceQuery.tenantId = tenantContext.tenantId;
  }

  const services = await Service.find(serviceQuery)
    .select('name category price status createdAt rating isActive providerId')
    .sort({ createdAt: -1 })
    .lean();

  // Group services by providerId for efficient lookup
  const servicesByProvider = new Map();
  for (const service of services) {
    const providerId = service.providerId.toString();
    if (!servicesByProvider.has(providerId)) {
      servicesByProvider.set(providerId, []);
    }
    servicesByProvider.get(providerId).push(service);
  }

  // Fetch provider profiles with user data
  const providers = await ProviderProfile.find({ _id: { $in: providerProfileIds } })
    .populate('userId', 'firstName lastName email accountStatus')
    .sort({ createdAt: -1 })
    .lean();

  // Map services to providers
  const providersWithServices = providers.map((provider: any) => ({
    ...provider,
    services: servicesByProvider.get(provider.userId._id.toString()) || []
  }));

  const totalPages = Math.ceil(total / limit);

  res.json({
    success: true,
    data: {
      providers: providersWithServices,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  });
});


/**
 * Batch approve/reject services
 * POST /api/admin/services/batch-action
 */
export const batchServiceAction = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { serviceIds, action } = req.body; // action: 'approve' | 'reject'

  if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ApiError(400, 'Service IDs array is required');
  }

  if (!['approve', 'reject'].includes(action)) {
    throw new ApiError(400, 'Invalid action. Must be "approve" or "reject"');
  }

  const Service = require('../models/service.model').default;
  const newStatus = action === 'approve' ? 'active' : 'rejected';

  // Build tenant-scoped query
  const query: any = { _id: { $in: serviceIds }, status: 'pending_review' };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // Fetch services first to get provider IDs for socket notifications
  const servicesToUpdate = await Service.find(query).select('providerId');
  const providerIds: string[] = [
    ...new Set(
      servicesToUpdate
        .map((s: { providerId?: { toString(): string } }) => s.providerId?.toString())
        .filter(Boolean) as string[]
    ),
  ];

  const result = await Service.updateMany(
    query,
    {
      status: newStatus,
      isActive: action === 'approve',
      updatedBy: (req.user as IUser)._id,
      updatedAt: new Date()
    }
  );

  // Emit socket events to all affected providers
  if (providerIds.length > 0) {
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitServicesBatchCompleted(providerIds, serviceIds, result.modifiedCount, action);
    }
  }

  res.json({
    success: true,
    message: `Successfully ${action}d ${result.modifiedCount} services`,
    data: {
      modified: result.modifiedCount,
      action: newStatus,
      total: serviceIds.length
    }
  });
});

/**
 * Get provider with their services details
 * GET /api/admin/providers/:id/services
 */
export const getProviderServices = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  const ProviderProfile = require('../models/providerProfile.model').default;
  const Service = require('../models/service.model').default;

  // Build tenant-scoped query
  const providerQuery: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    providerQuery.tenantId = tenantContext.tenantId;
  }

  const provider = await ProviderProfile.findOne(providerQuery)
    .populate('userId', 'firstName lastName email accountStatus')
    .lean();

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  const serviceQuery: any = { providerId: provider.userId._id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    serviceQuery.tenantId = tenantContext.tenantId;
  }

  const services = await Service.find(serviceQuery)
    .sort({ createdAt: -1 })
    .lean();

  res.json({
    success: true,
    data: {
      provider,
      services
    }
  });
});

// ========================================
// Admin Bookings Management
// ========================================

/**
 * Get all bookings with filtering and pagination for admin
 * GET /api/admin/bookings
 * Hard page size limit added for security
 */
export const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const {
    search,
    status,
    provider,
    customer,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query: any = {};

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // SECURITY FIX: Exclude soft-deleted records from results
  query.isDeleted = { $ne: true };

  if (search && typeof search === 'string') {
    query.$or = [
      { bookingNumber: { $regex: search, $options: 'i' } },
      { 'customerInfo.email': { $regex: search, $options: 'i' } },
      { 'customerInfo.firstName': { $regex: search, $options: 'i' } }
    ];
  }

  if (status && typeof status === 'string') {
    if (status === 'active') {
      query.status = { $in: ['pending', 'confirmed', 'in_progress'] };
    } else {
      query.status = status;
    }
  }

  if (provider && typeof provider === 'string') {
    query.providerId = provider;
  }

  if (customer && typeof customer === 'string') {
    query.customerId = customer;
  }

  if (dateFrom || dateTo) {
    query.scheduledDate = {};
    if (dateFrom) {
      (query.scheduledDate as any).$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      (query.scheduledDate as any).$lte = new Date(dateTo as string);
    }
  }

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;

  const bookings = await Booking.find(query)
    .populate('customerId', 'firstName lastName email phone')
    .populate('providerId', 'firstName lastName email')
    .populate('serviceId', 'name category')
    .sort(sortOptions)
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Booking.countDocuments(query);

  res.json({
    success: true,
    data: {
      bookings,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Search bookings for admin quick lookup
 * GET /api/admin/bookings/search?q={query}&limit={limit}
 * Searches by bookingNumber, customer name, provider name
 * Returns top matches with essential info for quick identification
 */
export const searchBookings = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  const query = (req.query.q as string || '').trim();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

  if (!query || query.length < 1) {
    throw new ApiError(400, 'Search query is required');
  }

  // Escape regex special characters for safety
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedQuery = escapeRegex(query);

  // Build base query with tenant isolation
  const baseQuery: any = { isDeleted: { $ne: true } };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  // Search filter: match bookingNumber, customer name, or provider name
  const searchOr: any[] = [
    { bookingNumber: { $regex: escapedQuery, $options: 'i' } }
  ];

  // Fetch potential customer matches
  const customerMatches = await User.find({
    $or: [
      { firstName: { $regex: escapedQuery, $options: 'i' } },
      { lastName: { $regex: escapedQuery, $options: 'i' } },
      { email: { $regex: escapedQuery, $options: 'i' } }
    ],
    role: 'customer'
  }).select('_id').limit(50).lean();

  const customerIds = customerMatches.map(c => c._id);

  // Fetch potential provider matches
  const providerMatches = await User.find({
    $or: [
      { firstName: { $regex: escapedQuery, $options: 'i' } },
      { lastName: { $regex: escapedQuery, $options: 'i' } },
      { email: { $regex: escapedQuery, $options: 'i' } }
    ],
    role: 'provider'
  }).select('_id').limit(50).lean();

  const providerIds = providerMatches.map(p => p._id);

  // Add customer/provider name matches to search
  if (customerIds.length > 0) {
    searchOr.push({ customerId: { $in: customerIds } });
  }
  if (providerIds.length > 0) {
    searchOr.push({ providerId: { $in: providerIds } });
  }

  // Also search in guest booking info
  searchOr.push({ 'guestInfo.name': { $regex: escapedQuery, $options: 'i' } });
  searchOr.push({ 'guestInfo.email': { $regex: escapedQuery, $options: 'i' } });

  // Combine with base query
  const fullQuery = {
    ...baseQuery,
    $or: searchOr
  };

  // Execute search with populated references
  const bookings = await Booking.find(fullQuery)
    .populate('customerId', 'firstName lastName email phone')
    .populate('providerId', 'firstName lastName email')
    .populate('serviceId', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  // Format response with essential fields
  const results = bookings.map(booking => {
    // Get customer name
    let customerName = 'Guest';
    if (booking.customerId) {
      const customer = booking.customerId as any;
      customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.email || 'Customer';
    } else if (booking.guestInfo?.name) {
      customerName = booking.guestInfo.name;
    }

    // Get provider name
    let providerName = 'Unknown';
    if (booking.providerId) {
      const provider = booking.providerId as any;
      providerName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || provider.email || 'Provider';
    }

    // Get service name
    const serviceName = (booking.serviceId as any)?.name || 'Unknown Service';

    return {
      _id: booking._id,
      bookingNumber: booking.bookingNumber,
      customer: {
        _id: booking.customerId?._id,
        name: customerName,
        email: (booking.customerId as any)?.email || booking.guestInfo?.email,
        phone: (booking.customerId as any)?.phone
      },
      provider: {
        _id: booking.providerId?._id,
        name: providerName
      },
      serviceName,
      status: booking.status,
      amount: booking.pricing?.totalAmount || 0,
      currency: booking.pricing?.currency || 'AED',
      scheduledDate: booking.scheduledDate,
      createdAt: booking.createdAt
    };
  });

  res.json({
    success: true,
    data: {
      results,
      query,
      count: results.length
    }
  });
});

/**
 * Get booking details for admin
 * GET /api/admin/bookings/:id
 */
export const getBookingDetails = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const booking = await Booking.findOne(query)
    .populate('customerId', 'firstName lastName email phone')
    .populate('providerId', 'firstName lastName email')
    .populate('serviceId', 'name category description price');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  res.json({
    success: true,
    data: { booking }
  });
});

/**
 * Update booking status (admin override)
 * PATCH /api/admin/bookings/:id/status
 */
export const updateBookingStatus = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { status, reason, notes } = req.body;
  const adminUser = req.user as any;

  // SECURITY FIX: RBAC - Check admin permission for booking status overrides
  const requiredPermission = 'booking:update:all';
  if (adminUser.role !== 'admin') {
    logger.warn('Unauthorized booking status update attempt', {
      action: 'UNAUTHORIZED_BOOKING_UPDATE',
      userId: adminUser._id,
      userRole: adminUser.role,
      bookingId: id,
      attemptedPermission: requiredPermission,
    });
    throw new ApiError(403, `Permission denied. Required: ${requiredPermission}`);
  }

  // SECURITY FIX: Input validation for booking ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // SECURITY FIX: Explicit booking existence check with tenant scoping
  // This prevents admin from accessing bookings outside their tenant scope
  const booking = await Booking.findOne(query);

  if (!booking) {
    // SECURITY FIX: Distinguish between "not found" and "tenant access denied"
    // A 404 without this distinction could leak information about other tenants' bookings
    const anyBookingExists = await Booking.exists({ _id: id });
    if (anyBookingExists) {
      logger.warn('Admin attempted to access booking outside tenant scope', {
        action: 'TENANT_SCOPE_VIOLATION',
        adminId: adminUser._id,
        adminTenant: tenantContext.tenantId,
        bookingId: id,
      });
    }
    throw new ApiError(404, 'Booking not found');
  }

  // SECURITY FIX: Exclude deleted bookings
  if (booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  const previousStatus = booking.status;
  booking.status = status;

  // Add to status history
  booking.statusHistory.push({
    status,
    timestamp: new Date(),
    reason,
    updatedBy: 'admin',
    notes
  });

  // Update specific timestamps based on status
  if (status === 'completed') {
    booking.completedAt = new Date();
  } else if (status === 'cancelled') {
    booking.cancelledAt = new Date();
  }

  await booking.save();

  // Emit socket events to affected users (customer and provider)
  const socketServer = getSocketServer();
  if (socketServer) {
    // Notify customer
    const customerId = (booking.customerId as any)?._id?.toString() || booking.customerId?.toString();
    if (customerId) {
      socketServer.emitBookingAdminUpdatedToCustomer(
        customerId,
        id,
        booking.bookingNumber,
        status,
        reason
      );
    }

    // Notify provider
    const providerId = (booking.providerId as any)?._id?.toString() || booking.providerId?.toString();
    if (providerId) {
      socketServer.emitBookingAdminUpdatedToProvider(
        providerId,
        id,
        booking.bookingNumber,
        status,
        reason
      );
    }
  }

  // SECURITY FIX: Enhanced audit logging for admin booking actions
  logger.info('ADMIN_BOOKING_AUDIT: Booking status updated', {
    action: 'BOOKING_STATUS_UPDATED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    adminRole: adminUser.role,
    bookingId: id,
    bookingNumber: booking.bookingNumber,
    previousStatus,
    newStatus: status,
    reason,
    permissionUsed: requiredPermission,
    timestamp: new Date().toISOString(),
    type: 'ADMIN_BOOKING_ACTION'
  });

  res.json({
    success: true,
    message: 'Booking status updated successfully',
    data: { booking }
  });
});

/**
 * Get booking statistics for admin dashboard
 * GET /api/admin/bookings/stats
 */
export const getBookingStats = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Build tenant-scoped base query
  const baseQuery: any = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const [stats, todayCount, weekCount, monthCount, revenueStats] = await Promise.all([
    Booking.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Booking.countDocuments({ ...baseQuery, scheduledDate: { $gte: startOfToday } }),
    Booking.countDocuments({ ...baseQuery, scheduledDate: { $gte: startOfWeek } }),
    Booking.countDocuments({ ...baseQuery, scheduledDate: { $gte: startOfMonth } }),
    Booking.aggregate([
      { $match: { ...baseQuery, status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$pricing.totalAmount' },
          avgBookingValue: { $avg: '$pricing.totalAmount' }
        }
      }
    ])
  ]);

  const statusCounts = {
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0
  };

  stats.forEach((s: any) => {
    statusCounts[s._id as keyof typeof statusCounts] = s.count;
  });

  const totalBookings = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  res.json({
    success: true,
    data: {
      stats: {
        ...statusCounts,
        total: totalBookings,
        activeBookings: statusCounts.pending + statusCounts.confirmed + statusCounts.in_progress
      },
      todayBookings: todayCount,
      weekBookings: weekCount,
      monthBookings: monthCount,
      revenue: {
        total: revenueStats[0]?.totalRevenue || 0,
        average: revenueStats[0]?.avgBookingValue || 0
      },
      completionRate: totalBookings > 0 ? Math.round((statusCounts.completed / totalBookings) * 100) : 0,
      cancellationRate: totalBookings > 0 ? Math.round((statusCounts.cancelled / totalBookings) * 100) : 0
    }
  });
});

/**
 * Cancel booking (admin override)
 * POST /api/admin/bookings/:id/cancel
 */
export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason, refundAmount } = req.body;
  const adminUser = req.user as any;

  // SECURITY FIX: RBAC - Check admin permission for booking cancellations
  const requiredPermission = 'booking:update:all';
  if (adminUser.role !== 'admin') {
    logger.warn('Unauthorized booking cancellation attempt', {
      action: 'UNAUTHORIZED_BOOKING_CANCEL',
      userId: adminUser._id,
      userRole: adminUser.role,
      bookingId: id,
      attemptedPermission: requiredPermission,
    });
    throw new ApiError(403, `Permission denied. Required: ${requiredPermission}`);
  }

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const booking = await Booking.findOne(query);

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (['completed', 'cancelled'].includes(booking.status)) {
    throw new ApiError(400, 'Cannot cancel a completed or already cancelled booking');
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationDetails = {
    cancelledBy: 'admin',
    cancelledAt: new Date(),
    reason: reason || 'Cancelled by admin',
    refundAmount: refundAmount || 0,
    refundStatus: refundAmount > 0 ? 'pending' : 'processed'
  };

  booking.statusHistory.push({
    status: 'cancelled',
    timestamp: new Date(),
    reason,
    updatedBy: 'admin',
    notes: `Cancelled by admin. Refund: ${refundAmount || 0}`
  });

  await booking.save();

  // FIX [MEDIUM-4]: Admin cancel should trigger settlement reversal if settlement exists
  if (booking.status === 'cancelled' && refundAmount > 0) {
    try {
      const Settlement = require('../models/settlement.model').default;

      // Find the settlement record for this booking
      const settlement = await Settlement.findOne({
        'lineItems.bookingId': booking._id
      });

      if (settlement) {
        // Add deduction to reverse the payout for this cancelled booking
        const lineItem = settlement.lineItems.find(
          (item: any) => item.bookingId?.toString() === booking._id.toString()
        );

        if (lineItem) {
          await settlement.addDeduction(
            'refund_reversal',
            lineItem.netAmount,
            `Refund for cancelled booking ${booking.bookingNumber} - Admin cancelled`,
            booking._id.toString()
          );
          await settlement.save();

          logger.info('Settlement deduction added for admin-cancelled booking', {
            action: 'SETTLEMENT_REFUND_REVERSAL',
            settlementId: settlement._id.toString(),
            settlementNumber: settlement.settlementNumber,
            bookingId: booking._id.toString(),
            bookingNumber: booking.bookingNumber,
            deductionAmount: lineItem.netAmount,
            cancelledBy: 'admin',
            refundAmount,
          });
        }
      }
    } catch (settlementError) {
      // Log but don't fail the cancellation - settlement reversal is secondary
      logger.error('Failed to add settlement deduction for cancelled booking', {
        action: 'SETTLEMENT_REVERSAL_ERROR',
        bookingId: booking._id.toString(),
        error: settlementError instanceof Error ? settlementError.message : String(settlementError),
      });
    }
  }

  // SECURITY FIX: Enhanced audit logging for admin booking cancellations
  logger.info('ADMIN_BOOKING_AUDIT: Booking cancelled', {
    action: 'BOOKING_CANCELLED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    adminRole: adminUser.role,
    bookingId: id,
    bookingNumber: booking.bookingNumber,
    reason,
    refundAmount: refundAmount || 0,
    permissionUsed: requiredPermission,
    timestamp: new Date().toISOString(),
    type: 'ADMIN_BOOKING_ACTION'
  });

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: { booking }
  });
});

// ========================================
// Admin Categories Management
// ========================================

// ========================================
// Admin Refund Analytics
// ========================================

/**
 * Get refund analytics for the admin dashboard
 * GET /api/admin/refunds/analytics
 */
export const getRefundAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

  const dateFilter: any = {};
  if (startDate) dateFilter.$gte = new Date(startDate);
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateFilter.$lte = end;
  }

  const baseMatch: any = {
    'payment.refundAmount': { $gt: 0 },
    ...(Object.keys(dateFilter).length > 0 ? { 'payment.refundedAt': dateFilter } : {})
  };

  // Aggregate refund stats
  const [refundAgg, statusBreakdown, totalBookingsCount] = await Promise.all([
    Booking.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalRefunds: { $sum: 1 },
          totalAmount: { $sum: '$payment.refundAmount' },
          avgRefundAmount: { $avg: '$payment.refundAmount' },
          highestRefund: { $max: '$payment.refundAmount' },
          lowestRefund: { $min: '$payment.refundAmount' }
        }
      }
    ]),
    Booking.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$payment.refundStatus',
          count: { $sum: 1 },
          amount: { $sum: '$payment.refundAmount' }
        }
      }
    ]),
    Booking.countDocuments({})
  ]);

  const totals = refundAgg[0] || {
    totalRefunds: 0,
    totalAmount: 0,
    avgRefundAmount: 0,
    highestRefund: 0,
    lowestRefund: 0
  };

  const pendingCount = statusBreakdown.find((s: any) => s._id === 'pending')?.count || 0;

  // Compute processing time for completed refunds
  const processingTimeAgg = await Booking.aggregate([
    {
      $match: {
        ...baseMatch,
        'payment.refundStatus': 'processed',
        'payment.refundedAt': { $exists: true },
        cancelledAt: { $exists: true }
      }
    },
    {
      $project: {
        processingTime: {
          $divide: [
            { $subtract: ['$payment.refundedAt', '$cancelledAt'] },
            1000 * 60 * 60 // ms to hours
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        avgProcessingTime: { $avg: '$processingTime' }
      }
    }
  ]);

  const avgProcessingTime = processingTimeAgg[0]?.avgProcessingTime || 0;

  // Refund rate vs total bookings
  const refundRate = totalBookingsCount > 0
    ? Number(((totals.totalRefunds / totalBookingsCount) * 100).toFixed(2))
    : 0;

  // Monthly trend (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const monthlyTrend = await Booking.aggregate([
    {
      $match: {
        'payment.refundAmount': { $gt: 0 },
        'payment.refundedAt': { $gte: sixMonthsAgo }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$payment.refundedAt' },
          month: { $month: '$payment.refundedAt' }
        },
        count: { $sum: 1 },
        amount: { $sum: '$payment.refundAmount' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedMonthlyTrend = monthlyTrend.map((m: any) => ({
    month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
    count: m.count,
    amount: m.amount,
    rate: totalBookingsCount > 0 ? Number(((m.count / totalBookingsCount) * 100).toFixed(2)) : 0
  }));

  // By status
  const statusColors: Record<string, string> = {
    pending: '#F59E0B',
    processed: '#10B981',
    failed: '#EF4444'
  };
  const statusLabels: Record<string, string> = {
    pending: 'Pending',
    processed: 'Completed',
    failed: 'Rejected'
  };
  const byStatus = statusBreakdown.map((s: any) => ({
    status: statusLabels[s._id] || s._id,
    count: s.count,
    color: statusColors[s._id] || '#6B7280'
  }));

  // Recent refund records (for the table view)
  const recentRefunds = await Booking.find(baseMatch)
    .sort({ 'payment.refundedAt': -1 })
    .limit(50)
    .populate('customerId', 'name email')
    .populate('providerId', 'name email')
    .populate('serviceId', 'name')
    .lean();

  const refunds = recentRefunds.map((b: any) => ({
    id: b._id.toString(),
    refundId: `REF-${b.bookingNumber || b._id.toString().slice(-6).toUpperCase()}`,
    bookingId: b._id.toString(),
    bookingNumber: b.bookingNumber,
    customerId: b.customerId?._id?.toString() || '',
    customerName: b.customerId?.name || 'Unknown',
    providerId: b.providerId?._id?.toString() || '',
    providerName: b.providerId?.name || 'Unknown',
    serviceName: b.serviceId?.name || 'Unknown Service',
    amount: b.pricing?.totalAmount || 0,
    refundAmount: b.payment?.refundAmount || 0,
    refundPercentage: b.pricing?.totalAmount
      ? Math.round(((b.payment?.refundAmount || 0) / b.pricing.totalAmount) * 100)
      : 0,
    reason: b.cancellationReason || b.payment?.refundReason || 'No reason provided',
    category: b.cancellationReason?.toLowerCase().includes('no show') ? 'no_show'
      : b.cancellationReason?.toLowerCase().includes('provider') ? 'provider_cancellation'
      : b.cancellationReason?.toLowerCase().includes('quality') ? 'quality_issue'
      : 'customer_request',
    status: b.payment?.refundStatus === 'processed' ? 'completed'
      : b.payment?.refundStatus === 'failed' ? 'rejected'
      : 'pending',
    requestDate: b.cancelledAt || b.createdAt,
    processedDate: b.payment?.refundedAt,
    processingTime: b.payment?.refundedAt && b.cancelledAt
      ? Math.round((new Date(b.payment.refundedAt).getTime() - new Date(b.cancelledAt).getTime()) / (1000 * 60 * 60))
      : 0,
    paymentMethod: b.payment?.method || 'Unknown'
  }));

  res.json({
    success: true,
    data: {
      refunds,
      stats: {
        totalRefunds: totals.totalRefunds,
        totalAmount: Math.round(totals.totalAmount),
        pendingCount,
        avgProcessingTime: Math.round(avgProcessingTime * 10) / 10,
        refundRate,
        approvalRate: totals.totalRefunds > 0
          ? Number((((totals.totalRefunds - pendingCount) / totals.totalRefunds) * 100).toFixed(1))
          : 0,
        rejectionRate: 0,
        monthlyTrend: formattedMonthlyTrend,
        byCategory: [],
        byStatus,
        topReasons: [],
        avgRefundAmount: Math.round(totals.avgRefundAmount || 0),
        highestRefund: totals.highestRefund || 0,
        lowestRefund: totals.lowestRefund || 0
      }
    }
  });
});

// ========================================
// Admin Dashboard Stats
// ========================================

/**
 * Get admin dashboard statistics
 * GET /api/admin/stats
 */
export const getAdminStats = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);

  // Build tenant-scoped query
  const baseQuery: any = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  // Parallel queries for performance
  const [
    totalUsersResult,
    userByRoleResult,
    activeProviders,
    todayBookings,
    pendingVerifications,
    monthlyCompletedBookings,
  ] = await Promise.all([
    // Total non-admin users
    User.countDocuments({ ...baseQuery, role: { $ne: 'admin' } }),
    // Users grouped by role
    User.aggregate([
      { $match: { ...baseQuery, role: { $ne: 'admin' } } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    // Active (approved + isActive) providers - canonical definition
    ProviderProfile.countDocuments({
      ...baseQuery,
      isDeleted: false,
      'verificationStatus.overall': 'approved',
      isActive: true,
    }),
    // Today's bookings (created today)
    Booking.countDocuments({
      ...baseQuery,
      createdAt: { $gte: today, $lt: tomorrow }
    }),
    // Pending provider verifications (pending + under review)
    ProviderProfile.countDocuments({
      ...baseQuery,
      'verificationStatus.overall': { $in: ['pending', 'in_progress'] },
    }),
    // Monthly completed bookings for revenue calculation
    Booking.find({
      ...baseQuery,
      status: 'completed',
      completedAt: { $gte: monthStart }
    }).select('pricing.totalAmount').lean(),
  ]);

  // Process user counts by role
  const userCountsByRole = {
    customer: 0,
    provider: 0,
    admin: 0,
  };
  userByRoleResult.forEach((item: { _id: string; count: number }) => {
    if (item._id in userCountsByRole) {
      userCountsByRole[item._id as keyof typeof userCountsByRole] = item.count;
    }
  });

  // Calculate monthly revenue
  const monthlyRevenue = monthlyCompletedBookings.reduce(
    (sum, booking) => sum + (booking.pricing?.totalAmount || 0),
    0
  );

  res.json({
    success: true,
    data: {
      totalUsers: totalUsersResult,
      usersByRole: userCountsByRole,
      activeProviders,
      todayBookings,
      pendingVerifications,
      monthlyRevenue,
      activeIncidents: 0,
    }
  });
});

// ========================================
// Admin Service Categories Management
// ========================================

/**
 * Get all service categories for admin
 * GET /api/admin/categories
 * Hard page size limit added for security
 */
export const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 100));

  const {
    search,
    isActive,
    isFeatured,
    sortBy = 'sortOrder',
    order = 'asc'
  } = req.query;

  // Build query
  const query: any = {};

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  if (search && typeof search === 'string') {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (isFeatured !== undefined) {
    query.isFeatured = isFeatured === 'true';
  }

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = order === 'asc' ? 1 : -1;

  const categories = await ServiceCategory.find(query)
    .sort(sortOptions)
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await ServiceCategory.countDocuments(query);

  res.json({
    success: true,
    data: {
      categories,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Get category details for admin
 * GET /api/admin/categories/:id
 */
export const getCategoryDetails = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const category = await ServiceCategory.findOne(query);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  res.json({
    success: true,
    data: { category }
  });
});

/**
 * Create new category
 * POST /api/admin/categories
 */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const {
    name,
    slug: bodySlug,
    description,
    icon,
    color,
    imageUrl,
    subcategories,
    isActive,
    isFeatured,
    sortOrder,
    comingSoon,
  } = req.body;
  const adminUser = req.user as any;

  const slug =
    typeof bodySlug === 'string' && bodySlug.trim()
      ? bodySlug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      : name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-');
  const existingQuery: any = { $or: [{ name }, { slug }] };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    existingQuery.tenantId = tenantContext.tenantId;
  }
  const existing = await ServiceCategory.findOne(existingQuery);

  if (existing) {
    throw new ApiError(400, 'Category with this name already exists');
  }

  const category = new ServiceCategory({
    name,
    slug,
    description,
    icon,
    color,
    imageUrl,
    subcategories: subcategories || [],
    isActive: isActive !== false,
    isFeatured: isFeatured || false,
    comingSoon: Boolean(comingSoon),
    sortOrder: sortOrder || 0,
    createdBy: adminUser._id,
    updatedBy: adminUser._id,
    tenantId: tenantContext.tenantId
  });

  await category.save();

  // Audit logging
  logger.info('ADMIN_AUDIT: Category created', {
    action: 'CATEGORY_CREATED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    categoryId: category._id,
    categoryName: name,
    timestamp: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: { category }
  });
});

/**
 * Update category
 * PATCH /api/admin/categories/:id
 */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const updates = req.body;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const category = await ServiceCategory.findOne(query);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Slug: use explicit slug from client, or regenerate when name changes
  if (typeof updates.slug === 'string' && updates.slug.trim()) {
    updates.slug = updates.slug
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  } else if (updates.name && updates.name !== category.name) {
    updates.slug = updates.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  if (updates.slug && updates.slug !== category.slug) {
    const existingQuery: any = { slug: updates.slug, _id: { $ne: id } };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      existingQuery.tenantId = tenantContext.tenantId;
    }
    const existing = await ServiceCategory.findOne(existingQuery);
    if (existing) {
      throw new ApiError(400, 'Category with this slug already exists');
    }
  }

  // Update fields
  Object.keys(updates).forEach(key => {
    (category as any)[key] = updates[key];
  });
  category.updatedBy = adminUser._id;

  await category.save();

  // FIX: Notify providers whose services are affected by category changes
  const oldCategoryName = category.name; // Category name after update
  const affectedServices = await Service.find({
    category: oldCategoryName,
    status: { $in: ['active', 'pending_review'] }
  }).select('_id providerId name category').lean();

  // Sanitize HTML to prevent XSS in socket events
  const sanitizeHtml = (str: string) => str.replace(/<[^>]*>/g, '');

  const socketServer = getSocketServer();
  for (const svc of affectedServices) {
    if (socketServer && updates.name && updates.name !== oldCategoryName) {
      socketServer.emitServiceCategoryChanged(
        (svc as any)._id?.toString(),
        svc.providerId?.toString(),
        svc.name,
        oldCategoryName,
        sanitizeHtml(updates.name)
      );
    }
  }

  // Audit logging
  logger.info('ADMIN_AUDIT: Category updated', {
    action: 'CATEGORY_UPDATED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    categoryId: id,
    categoryName: category.name,
    updatedFields: Object.keys(updates),
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Category updated successfully',
    data: { category }
  });
});

/**
 * Delete category
 * DELETE /api/admin/categories/:id
 */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason } = req.body;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const category = await ServiceCategory.findOne(query);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Check if category has active services (scoped to tenant)
  const serviceQuery: any = { category: category.name };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    serviceQuery.tenantId = tenantContext.tenantId;
  }
  const serviceCount = await Service.countDocuments(serviceQuery);
  if (serviceCount > 0) {
    throw new ApiError(400, `Cannot delete category with ${serviceCount} active services. Remove or reassign services first.`);
  }

  await ServiceCategory.findOneAndDelete(query);

  // Audit logging
  logger.info('ADMIN_AUDIT: Category deleted', {
    action: 'CATEGORY_DELETED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    categoryId: id,
    categoryName: category.name,
    reason: reason || 'No reason provided',
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
});

/**
 * Toggle category featured status
 * POST /api/admin/categories/:id/featured
 */
export const toggleCategoryFeatured = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const category = await ServiceCategory.findOne(query);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  category.isFeatured = !category.isFeatured;
  category.updatedBy = adminUser._id;
  await category.save();

  // Audit logging
  logger.info('ADMIN_AUDIT: Category featured toggled', {
    action: 'CATEGORY_FEATURED_TOGGLED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    categoryId: id,
    categoryName: category.name,
    isFeatured: category.isFeatured,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Category ${category.isFeatured ? 'featured' : 'unfeatured'} successfully`,
    data: { category }
  });
});

/**
 * Add subcategory to category
 * POST /api/admin/categories/:id/subcategories
 */
export const addSubcategory = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { name, slug: bodySlug, description, icon, color, imageUrl, sortOrder } = req.body;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const category = await ServiceCategory.findOne(query);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  const slug =
    typeof bodySlug === 'string' && bodySlug.trim()
      ? bodySlug
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
      : name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-');

  // Check if subcategory with same slug exists
  const existingSub = category.subcategories.find(sub => sub.slug === slug);
  if (existingSub) {
    throw new ApiError(400, 'Subcategory with this name already exists');
  }

  const maxSortOrder = category.subcategories.length > 0
    ? Math.max(...category.subcategories.map(s => s.sortOrder || 0))
    : 0;

  category.subcategories.push({
    name,
    slug,
    description,
    icon,
    color,
    imageUrl,
    isActive: true,
    sortOrder: typeof sortOrder === 'number' ? sortOrder : maxSortOrder + 1,
  });

  category.updatedBy = adminUser._id;
  await category.save();

  // Audit logging
  logger.info('ADMIN_AUDIT: Subcategory added', {
    action: 'SUBCATEGORY_ADDED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    categoryId: id,
    categoryName: category.name,
    subcategoryName: name,
    timestamp: new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: 'Subcategory added successfully',
    data: { category }
  });
});

/**
 * Get category statistics for admin dashboard
 * GET /api/admin/categories/stats
 */
export const getCategoryStats = asyncHandler(async (_req: Request, res: Response) => {
  const [totalCategories, activeCategories, featuredCategories, withSubcategories] = await Promise.all([
    ServiceCategory.countDocuments(),
    ServiceCategory.countDocuments({ isActive: true }),
    ServiceCategory.countDocuments({ isFeatured: true }),
    ServiceCategory.countDocuments({ 'subcategories.0': { $exists: true } })
  ]);

  // Get category with most services
  const topCategories = await Service.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  res.json({
    success: true,
    data: {
      stats: {
        total: totalCategories,
        active: activeCategories,
        featured: featuredCategories,
        withSubcategories,
        inactive: totalCategories - activeCategories
      },
      topCategories: topCategories.map(c => ({
        name: c._id,
        serviceCount: c.count
      }))
    }
  });
});

// ========================================
// Admin Review Moderation
// ========================================

import Review from '../models/review.model';

/**
 * Helper function to update service and provider ratings when a review is approved
 * FIX #6: Rating updates are delayed until admin moderation approval
 */
async function updateServiceRatings(review: any): Promise<void> {
  const providerId = review.revieweeId?._id || review.revieweeId;
  const serviceId = review.bookingId?.serviceId || review.serviceId;
  const rating = review.rating;

  if (!rating || rating < 1 || rating > 5) {
    return; // Invalid rating, skip update
  }

  // Update provider profile stats
  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (providerProfile) {
    const prev = providerProfile.reviewsData || {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    const newTotal = (prev.averageRating || 0) * (prev.totalReviews || 0) + rating;
    const newReviewCount = (prev.totalReviews || 0) + 1;
    const newAverage = newTotal / newReviewCount;

    const ratingKey = String(rating) as '1' | '2' | '3' | '4' | '5';
    const currentCount = prev.ratingDistribution?.[ratingKey] || 0;

    await ProviderProfile.findOneAndUpdate(
      { userId: providerId },
      {
        $set: {
          'reviewsData.averageRating': Math.round(newAverage * 10) / 10,
          'reviewsData.totalReviews': newReviewCount,
          [`reviewsData.ratingDistribution.${ratingKey}`]: currentCount + 1,
        },
      }
    );
  }

  // Update per-service rating
  if (serviceId) {
    const service = await Service.findById(serviceId);
    if (service?.rating) {
      const prev = service.rating;
      const newCount = (prev.count || 0) + 1;
      const newAverage = ((prev.average || 0) * (prev.count || 0) + rating) / newCount;
      const distKey = String(rating) as '1' | '2' | '3' | '4' | '5';
      const distribution = prev.distribution ? { ...prev.distribution } : { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      distribution[distKey] = (distribution[distKey] || 0) + 1;

      await Service.findByIdAndUpdate(serviceId, {
        $set: {
          'rating.average': Math.round(newAverage * 10) / 10,
          'rating.count': newCount,
          'rating.distribution': distribution,
        },
      });
    }
  }
}

/**
 * Get reviews pending moderation
 * GET /api/admin/reviews/pending
 */
export const getPendingReviews = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const { search } = req.query;

  // Build query for pending reviews, high report count, or auto-flagged
  const query: any = {
    $or: [
      { moderationStatus: 'pending' },
      { reportCount: { $gte: 3 } },
      { autoFlagged: true }
    ]
  };

  if (search && typeof search === 'string') {
    query.$or.push(
      { comment: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } }
    );
  }

  const reviews = await Review.find(query)
    .populate('reviewerId', 'firstName lastName email avatar')
    .populate('revieweeId', 'firstName lastName email businessInfo.businessName')
    .populate('bookingId', 'bookingNumber scheduledDate serviceId')
    .sort({ autoFlagged: -1, reportCount: -1, createdAt: -1 })  // Prioritize auto-flagged
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Review.countDocuments(query);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Get reviews with reports/flags (includes user-reported and auto-flagged reviews)
 * GET /api/admin/reviews/flagged
 */
export const getFlaggedReviews = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const { minReports, search, includeAutoFlagged } = req.query;

  // Build query for flagged reviews
  // Filter: reportCount > 0 OR autoFlagged === true
  const query: any = {
    $or: [
      { reportCount: { $gt: 0 } },
      { autoFlagged: true }
    ]
  };

  // FIX: Apply tenant isolation to prevent cross-tenant data leakage
  if (tenantContext?.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  if (minReports) {
    query.reportCount = { $gte: parseInt(minReports as string) };
  }

  if (search && typeof search === 'string') {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { comment: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } }
      ]
    });
  }

  // By default include auto-flagged, but allow filtering them out
  if (includeAutoFlagged === 'false') {
    query.autoFlagged = { $ne: true };
  }

  const reviews = await Review.find(query)
    .populate('reviewerId', 'firstName lastName email avatar')
    .populate('revieweeId', 'firstName lastName email businessInfo.businessName')
    .populate('bookingId', 'serviceId bookingNumber')
    .sort({ reportCount: -1, autoFlagged: -1, createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Review.countDocuments(query);

  // Get report breakdown stats
  const stats = await Review.aggregate([
    {
      $match: {
        $or: [
          { reportCount: { $gt: 0 } },
          { autoFlagged: true }
        ],
        ...(tenantContext?.tenantId ? { tenantId: tenantContext.tenantId } : {})
      }
    },
    {
      $group: {
        _id: null,
        totalFlagged: { $sum: 1 },
        totalReports: { $sum: '$reportCount' },
        avgReports: { $avg: '$reportCount' },
        highPriority: { $sum: { $cond: [{ $gte: ['$reportCount', 5] }, 1, 0] } },
        userReported: { $sum: { $cond: [{ $gt: ['$reportCount', 0] }, 1, 0] } },
        autoFlagged: { $sum: { $cond: ['$autoFlagged', 1, 0] } }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      stats: stats[0] || {
        totalFlagged: 0,
        totalReports: 0,
        avgReports: 0,
        highPriority: 0,
        userReported: 0,
        autoFlagged: 0
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Moderate a review (approve/reject/hide/delete)
 * PATCH /api/admin/reviews/:id/moderate
 */
export const moderateReview = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { action, reason } = req.body;
  const adminUser = req.user as any;

  // Validate action (restore is alias for approve — unhide rejected reviews)
  const normalizedAction = action === 'restore' ? 'approve' : action;
  const validActions = ['approve', 'reject', 'hide', 'delete', 'restore'];
  if (!validActions.includes(action)) {
    throw new ApiError(400, `Invalid action. Must be one of: approve, reject, hide, delete, restore`);
  }

  // Build query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const review = await Review.findOne(query)
    .populate('reviewerId', 'firstName lastName email')
    .populate('revieweeId', 'firstName lastName email businessInfo.businessName');

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // Store previous state for logging
  const previousStatus = review.moderationStatus;
  const previousHidden = review.isHidden;

  // Apply moderation action
  switch (normalizedAction) {
    case 'approve':
      review.moderationStatus = 'approved';
      review.isHidden = false;
      review.moderationReason = reason || null;

      // FIX #6: Update ratings only when review is approved
      // This ensures ratings are moderated before being displayed
      try {
        await updateServiceRatings(review);
      } catch (ratingError) {
        logger.error('Failed to update service ratings after review approval', {
          reviewId: id,
          error: ratingError instanceof Error ? ratingError.message : String(ratingError)
        });
        // Don't fail the moderation action if rating update fails
      }
      break;

    case 'reject':
      review.moderationStatus = 'rejected';
      review.isHidden = true;
      review.moderationReason = reason || 'Rejected by admin';
      break;

    case 'hide':
      review.moderationStatus = 'hidden';
      review.isHidden = true;
      review.moderationReason = reason || 'Hidden by admin';
      break;

    case 'delete':
      {
        const revieweeUserIdForDelete =
          (review.revieweeId as any)?._id?.toString?.() ||
          review.revieweeId?.toString?.();
        await Review.findByIdAndDelete(id);

        if (revieweeUserIdForDelete) {
          try {
            await ProviderProfile.recalculateReviewsData(revieweeUserIdForDelete);
          } catch (syncError) {
            logger.error('Failed to recalculate provider reviews data after delete', {
              reviewId: id,
              revieweeUserId: revieweeUserIdForDelete,
              error: syncError instanceof Error ? syncError.message : String(syncError),
            });
          }
        }

      logger.info('ADMIN_AUDIT: Review deleted', {
        action: 'REVIEW_DELETED',
        adminId: adminUser._id,
        adminEmail: adminUser.email,
        reviewId: id,
        reviewerId: (review.reviewerId as any)?._id,
        revieweeId: (review.revieweeId as any)?._id,
        previousStatus,
        reason: reason || 'No reason provided',
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Review deleted successfully'
      });
      return;
      }
  }

  // Update moderation metadata
  review.moderatedAt = new Date();
  review.moderatedBy = adminUser._id;

  await review.save();

  // Sync denormalized provider reviewsData from Review collection
  const revieweeUserId =
    (review.revieweeId as any)?._id?.toString?.() ||
    review.revieweeId?.toString?.();
  if (revieweeUserId) {
    try {
      await ProviderProfile.recalculateReviewsData(revieweeUserId);
    } catch (syncError) {
      logger.error('Failed to recalculate provider reviews data after moderation', {
        reviewId: id,
        revieweeUserId,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  // Audit logging
  logger.info('ADMIN_AUDIT: Review moderated', {
    action: 'REVIEW_MODERATED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    reviewId: id,
    reviewerId: (review.reviewerId as any)?._id,
    revieweeId: (review.revieweeId as any)?._id,
    moderationAction: action,
    previousStatus,
    previousHidden,
    newStatus: review.moderationStatus,
    newHidden: review.isHidden,
    reason: reason || 'No reason provided',
    timestamp: new Date().toISOString()
  });

  // Notify reviewer (customer who wrote the review) if rejected
  if (normalizedAction === 'reject') {
    const reviewerId = (review.reviewerId as any)?._id;
    if (reviewerId) {
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipientId: reviewerId.toString(),
          type: 'review_rejected',
          title: 'Your Review Was Not Approved',
          message: `Your review was not approved: ${reason || 'It may have violated our community guidelines.'}`,
          actionText: 'Write New Review',
          actionUrl: `/bookings`,
          metadata: { reviewId: id, action, reason }
        });
      } catch (notifError) {
        logger.error('Failed to create reviewer notification for rejected review', {
          reviewId: id,
          error: notifError instanceof Error ? notifError.message : String(notifError)
        });
      }
    }
  }

  // Notify reviewee (provider who received the review) if hidden
  if (normalizedAction === 'hide') {
    const revieweeId = (review.revieweeId as any)?._id;
    if (revieweeId) {
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipientId: revieweeId.toString(),
          type: 'review_rejected',
          title: 'Review Hidden',
          message: 'One of your received reviews has been hidden by our moderation team.',
          actionText: 'View Details',
          actionUrl: `/provider/reviews`,
          metadata: { reviewId: id, action }
        });
      } catch (notifError) {
        logger.error('Failed to create reviewee notification for hidden review', {
          reviewId: id,
          error: notifError instanceof Error ? notifError.message : String(notifError)
        });
      }
    }
  }

  // FIX: Emit socket events for review moderation
  const socketServer = getSocketServer();
  if (socketServer) {
    // Notify provider (reviewee) when review is approved or hidden
    const providerId = (review.revieweeId as any)?._id?.toString();
    if (providerId && (normalizedAction === 'approve' || normalizedAction === 'hide')) {
      socketServer.emitReviewModerated(providerId, id, normalizedAction, review.rating, reason);
    }

    // Notify customer (reviewer) when review is rejected
    const customerId = (review.reviewerId as any)?._id?.toString();
    if (customerId && normalizedAction === 'reject') {
      socketServer.emitReviewModeratedToCustomer(customerId, id, action, reason);
    }
  }

  res.json({
    success: true,
    message: `Review ${action}d successfully`,
    data: { review }
  });
});

/**
 * Bulk moderate reviews (approve/reject/hide/delete multiple at once)
 * POST /api/admin/reviews/bulk-moderate
 */
export const bulkModerateReviews = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);
  const { reviewIds, action, reason } = req.body;
  const adminUser = req.user as any;

  // Validate input
  if (!Array.isArray(reviewIds) || reviewIds.length === 0) {
    throw new ApiError(400, 'reviewIds must be a non-empty array');
  }

  if (reviewIds.length > 100) {
    throw new ApiError(400, 'Cannot moderate more than 100 reviews at once');
  }

  // Validate action
  const normalizedAction = action === 'restore' ? 'approve' : action;
  const validActions = ['approve', 'reject', 'hide', 'delete', 'restore'];
  if (!validActions.includes(action)) {
    throw new ApiError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);
  }

  // Build query with tenant isolation
  const query: any = { _id: { $in: reviewIds } };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // Get reviews to moderate
  const reviews = await Review.find(query);

  if (reviews.length === 0) {
    throw new ApiError(404, 'No reviews found matching the provided IDs');
  }

  const results = {
    total: reviews.length,
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  // Collect unique revieweeIds for recalculating stats later
  const revieweeIds = new Set<string>();

  for (const review of reviews) {
    try {
      revieweeIds.add(review.revieweeId.toString());

      switch (normalizedAction) {
        case 'approve':
          review.moderationStatus = 'approved';
          review.isHidden = false;
          review.moderationReason = reason || null;
          review.moderatedAt = new Date();
          review.moderatedBy = adminUser._id;
          await review.save();
          await updateServiceRatings(review);
          break;

        case 'reject':
          review.moderationStatus = 'rejected';
          review.isHidden = true;
          review.moderationReason = reason || 'Rejected by admin';
          review.moderatedAt = new Date();
          review.moderatedBy = adminUser._id;
          await review.save();
          break;

        case 'hide':
          review.moderationStatus = 'hidden';
          review.isHidden = true;
          review.moderationReason = reason || 'Hidden by admin';
          review.moderatedAt = new Date();
          review.moderatedBy = adminUser._id;
          await review.save();
          break;

        case 'delete':
          await Review.findByIdAndDelete(review._id);
          break;
      }

      results.successful++;
    } catch (err) {
      results.failed++;
      results.errors.push(`Review ${review._id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  // Recalculate stats for all affected providers
  for (const revieweeId of revieweeIds) {
    try {
      await ProviderProfile.recalculateReviewsData(revieweeId);
    } catch (syncError) {
      logger.error('Failed to recalculate provider reviews after bulk moderation', {
        revieweeId,
        error: syncError instanceof Error ? syncError.message : String(syncError),
      });
    }
  }

  // Audit logging
  logger.info('ADMIN_AUDIT: Bulk review moderation', {
    action: 'BULK_REVIEW_MODERATION',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    reviewIds,
    moderationAction: action,
    results,
    reason: reason || 'No reason provided',
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: `Bulk moderation completed: ${results.successful} successful, ${results.failed} failed`,
    data: { results },
  });
});

// ============================================
// Admin Review Management
// ============================================

/**
 * Get review statistics for admin dashboard
 * GET /api/admin/reviews/stats
 */
export const getReviewStats = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Build tenant-scoped base query
  const baseQuery: any = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const [total, pending, approved, rejected, hidden, flagged, autoFlagged] = await Promise.all([
    Review.countDocuments(baseQuery),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'pending' }),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'approved' }),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'rejected' }),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'hidden' }),
    Review.countDocuments({ ...baseQuery, reportCount: { $gt: 0 } }),
    Review.countDocuments({ ...baseQuery, autoFlagged: true }),
  ]);

  // Get average rating stats
  const ratingStats = await Review.aggregate([
    { $match: { ...baseQuery, moderationStatus: 'approved' } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 },
        rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } },
      }
    }
  ]);

  const distribution = ratingStats[0]
    ? {
        5: ratingStats[0].rating5,
        4: ratingStats[0].rating4,
        3: ratingStats[0].rating3,
        2: ratingStats[0].rating2,
        1: ratingStats[0].rating1,
      }
    : { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  const averageRating = ratingStats[0]
    ? Math.round((ratingStats[0].avgRating || 0) * 10) / 10
    : 0;

  res.json({
    success: true,
    data: {
      total,
      pending,
      approved,
      rejected,
      hidden,
      flagged,
      autoFlagged,
      rating: { average: averageRating, distribution },
      stats: {
        total,
        pending,
        approved,
        rejected: rejected + hidden,
        hidden,
        flagged,
        averageRating,
        ratingDistribution: distribution,
      },
    },
  });
});

/**
 * Get all reviews with filters and pagination for admin
 * GET /api/admin/reviews
 */
export const getAllReviews = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const {
    status,
    search,
    rating,
    minRating,
    maxRating,
    provider,
    customer,
    hasPhotos,
    isFlagged,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query: any = {};

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // Filter by moderation status
  if (status && typeof status === 'string') {
    if (status === 'flagged') {
      // User-reported flagged reviews
      query.reportCount = { $gt: 0 };
    } else if (status === 'autoFlagged') {
      // Auto-flagged by content moderation
      query.autoFlagged = true;
    } else {
      query.moderationStatus = status;
    }
  }

  // Search by review content, code, or reviewer/reviewee names
  if (search && typeof search === 'string') {
    // PERFORMANCE FIX: Use text index search instead of regex for comment/title
    // Text search is indexed and much faster than case-insensitive regex
    const searchRegex = { $regex: search, $options: 'i' };

    // First, find matching users by their names/email (limited to 100 for performance)
    const matchedUsers = await User.find({
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { 'businessInfo.businessName': searchRegex },
      ],
    })
      .select('_id')
      .limit(100)
      .lean();

    const userIds = matchedUsers.map((u) => u._id);

    // Build search conditions using text index for review content
    const searchConditions: Record<string, unknown>[] = [];

    // Use text search on comment and title (leveraging text index)
    searchConditions.push({ $text: { $search: search } });

    // Also match by user IDs if any users matched the search criteria
    if (userIds.length > 0) {
      searchConditions.push(
        { reviewerId: { $in: userIds } },
        { revieweeId: { $in: userIds } }
      );
    }

    query.$or = searchConditions;
  }

  // Filter by rating
  if (rating && typeof rating === 'string') {
    query.rating = parseInt(rating);
  }
  if (minRating || maxRating) {
    query.rating = {};
    if (minRating) (query.rating as any).$gte = parseInt(minRating as string);
    if (maxRating) (query.rating as any).$lte = parseInt(maxRating as string);
  }

  // Filter by provider (reviewee)
  if (provider && typeof provider === 'string') {
    query.revieweeId = provider;
  }

  // Filter by customer (reviewer)
  if (customer && typeof customer === 'string') {
    query.reviewerId = customer;
  }

  // Filter by photo presence
  if (hasPhotos === 'true') {
    query.photos = { $exists: true, $ne: [] };
  } else if (hasPhotos === 'false') {
    query.photos = { $size: 0 };
  }

  // Filter by flag status
  if (isFlagged === 'true') {
    query.reportCount = { $gt: 0 };
  }

  // Sort options
  const sortOptions: any = {};
  const isTextSearch = search && typeof search === 'string';

  // When using text search, sort by relevance (textScore) first, then by specified field
  // MongoDB $text search requires sorting by score for relevance ordering
  if (isTextSearch) {
    sortOptions.score = { $meta: 'textScore' };
    // Secondary sort by specified field for consistent pagination
    if (sortBy !== 'score') {
      sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;
    }
  } else {
    sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;
  }

  // Build the query with proper typing based on whether text search is used
  let reviews: any;
  if (isTextSearch) {
    // Text search: use select with textScore projection and lean() for proper typing
    reviews = await Review.find(query)
      .select({ score: { $meta: 'textScore' } })
      .populate('reviewerId', 'firstName lastName email avatar')
      .populate('revieweeId', 'firstName lastName email businessInfo.businessName')
      .populate({
        path: 'bookingId',
        select: 'bookingNumber scheduledDate serviceId providerId',
        populate: [
          { path: 'serviceId', select: 'name category' },
          { path: 'providerId', select: 'firstName lastName email' },
        ],
      })
      .sort(sortOptions)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();
  } else {
    // Non-text search: standard find without projection
    reviews = await Review.find(query)
      .populate('reviewerId', 'firstName lastName email avatar')
      .populate('revieweeId', 'firstName lastName email businessInfo.businessName')
      .populate({
        path: 'bookingId',
        select: 'bookingNumber scheduledDate serviceId providerId',
        populate: [
          { path: 'serviceId', select: 'name category' },
          { path: 'providerId', select: 'firstName lastName email' },
        ],
      })
      .sort(sortOptions)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
  }

  // For text search, countDocuments works fine with $text query
  const total = await Review.countDocuments(query);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
        hasNext: Number(page) * Number(limit) < total,
        hasPrev: Number(page) > 1
      }
    }
  });
});

// ============================================
// Withdrawal Management
// ============================================

/**
 * Get all pending withdrawals for admin review
 * GET /api/admin/withdrawals
 */
export const getPendingWithdrawals = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { page = '1', limit = '20', status, providerId, search } = req.query;

  // Enforce pagination limits
  const pageNum = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));

  // Build query for pending withdrawals
  const query: Record<string, unknown> = {};

  // Add tenant filter
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const statusParam = typeof status === 'string' ? status : 'pending';
  const txStatus =
    statusParam === 'rejected' ? 'reversed' : statusParam === 'all' ? null : statusParam;

  query['transactions.referenceType'] = 'payout';
  if (txStatus) {
    query['transactions.status'] = txStatus;
  }

  // Filter by provider
  if (providerId && typeof providerId === 'string') {
    query.userId = providerId;
  }

  // Search by provider name/email
  if (search && typeof search === 'string') {
    const providers = await User.find({
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ],
    }).select('_id');

    query.userId = { $in: providers.map(p => p._id) };
  }

  // Get withdrawals with pagination
  const Wallet = require('../models/wallet.model').default;

  // Use aggregation to find wallets with pending payout transactions
  const wallets = await Wallet.aggregate([
    { $match: query },
    { $unwind: '$transactions' },
    {
      $match: {
        'transactions.referenceType': 'payout',
        ...(txStatus ? { 'transactions.status': txStatus } : {}),
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $unwind: '$user' },
    {
      $project: {
        _id: {
          $concat: [
            { $toString: '$_id' },
            ':',
            { $ifNull: [{ $toString: '$transactions.id' }, ''] },
          ],
        },
        walletId: '$_id',
        balance: 1,
        currency: 1,
        pendingBalance: 1,
        transaction: '$transactions',
        userId: '$user._id',
        userEmail: '$user.email',
        userFirstName: '$user.firstName',
        userLastName: '$user.lastName',
        createdAt: 1,
      },
    },
    { $sort: { 'transaction.createdAt': -1 } },
    {
      $facet: {
        data: [
          { $skip: (pageNum - 1) * limitNum },
          { $limit: limitNum },
        ],
        count: [{ $count: 'total' }],
      },
    },
  ]);

  const withdrawals = wallets[0]?.data || [];
  const total = wallets[0]?.count[0]?.total || 0;

  res.json({
    success: true,
    data: {
      withdrawals,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    },
  });
});

/**
 * Get withdrawal statistics for admin dashboard
 * GET /api/admin/withdrawals/stats
 */
export const getWithdrawalStats = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  const matchStage: Record<string, unknown> = {
    'transactions.referenceType': 'payout',
  };

  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    matchStage.tenantId = tenantContext.tenantId;
  }

  const Wallet = require('../models/wallet.model').default;

  const stats = await Wallet.aggregate([
    { $match: matchStage },
    { $unwind: '$transactions' },
    { $match: { 'transactions.referenceType': 'payout' } },
    {
      $group: {
        _id: '$transactions.status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$transactions.amount' },
      },
    },
  ]);

  const result: {
    pending: { count: number; totalAmount: number };
    processing: { count: number; totalAmount: number };
    completed: { count: number; totalAmount: number };
    failed: { count: number; totalAmount: number };
    rejected: { count: number; totalAmount: number };
    totalPendingAmount: number;
    totalProcessedAmount: number;
  } = {
    pending: { count: 0, totalAmount: 0 },
    processing: { count: 0, totalAmount: 0 },
    completed: { count: 0, totalAmount: 0 },
    failed: { count: 0, totalAmount: 0 },
    rejected: { count: 0, totalAmount: 0 },
    totalPendingAmount: 0,
    totalProcessedAmount: 0,
  };

  for (const stat of stats) {
    const rawStatus = String(stat._id || '');
    const statusKey = rawStatus === 'reversed' ? 'rejected' : rawStatus;
    if (statusKey in result && statusKey !== 'totalPendingAmount' && statusKey !== 'totalProcessedAmount') {
      (result as any)[statusKey] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    }
    if (rawStatus === 'completed' || rawStatus === 'processing') {
      result.totalProcessedAmount += stat.totalAmount;
    }
    if (rawStatus === 'pending' || rawStatus === 'processing') {
      result.totalPendingAmount += stat.totalAmount;
    }
  }

  res.json({
    success: true,
    data: result,
  });
});

/**
 * Approve a withdrawal request
 * POST /api/admin/withdrawals/:id/approve
 */
export const approveWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const adminUser = req.user as any;

  // Parse the withdrawal reference from the ID (format: walletId:transactionId)
  const [walletId, transactionId] = id.split(':');

  if (!walletId || !transactionId) {
    throw new ApiError(400, 'Invalid withdrawal ID format');
  }

  const Wallet = require('../models/wallet.model').default;

  // Build query with tenant isolation
  const walletQuery: Record<string, unknown> = { _id: walletId };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    walletQuery.tenantId = tenantContext.tenantId;
  }

  const wallet = await Wallet.findOne(walletQuery);

  if (!wallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  // Find the pending withdrawal transaction
  const transaction = wallet.transactions.find(
    (t: any) => t.id === transactionId && t.referenceType === 'payout'
  );

  if (!transaction) {
    throw new ApiError(404, 'Withdrawal transaction not found');
  }

  // FIX [MEDIUM-1]: Add idempotency check - prevent double approval of already approved/rejected withdrawals
  const terminalStatuses = ['completed', 'approved', 'rejected', 'failed'];
  if (terminalStatuses.includes(transaction.status)) {
    logger.warn('Withdrawal approval attempted on already processed transaction', {
      action: 'WITHDRAWAL_IDEMPOTENCY_CHECK',
      withdrawalId: id,
      walletId,
      transactionId,
      currentStatus: transaction.status,
    });
    throw new ApiError(400, `Withdrawal has already been processed with status: ${transaction.status}`);
  }

  if (transaction.status !== 'pending') {
    throw new ApiError(400, `Cannot approve withdrawal with status: ${transaction.status}`);
  }

  // Start a MongoDB session for atomic operation
  let session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get user info for Stripe account lookup (before transaction modifications)
    const user = await User.findById(wallet.userId).session(session);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Update transaction status to processing
    await Wallet.updateOne(
      { _id: walletId, 'transactions.id': transactionId },
      {
        $set: {
          'transactions.$.status': 'processing',
          'transactions.$.updatedAt': new Date(),
        },
      },
      { session }
    );

    // Deduct the amount from wallet balance (funds are now being transferred)
    await Wallet.updateOne(
      { _id: walletId },
      {
        $inc: {
          balance: -transaction.amount,
          pendingBalance: -transaction.amount,
        },
        $set: {
          lastWithdrawalAt: new Date(),
        },
      },
      { session }
    );

    // CRITICAL FIX: Actually create Stripe payout instead of simulating
    let stripePayoutId: string | undefined;
    let stripePayoutStatus: string = 'pending';

    try {
      // Get provider's Stripe account ID (for Connect transfers)
      const stripeAccountId = user.stripeAccountId;

      if (stripeAccountId) {
        // Create payout to provider's Stripe account (Connect)
        const payout = await stripe.payouts.create(
          {
            amount: Math.round(transaction.amount * 100), // Convert to cents
            currency: (wallet.currency || 'aed').toLowerCase(),
            destination: stripeAccountId,
            metadata: {
              withdrawalId: id,
              walletId,
              transactionId,
              providerId: wallet.userId.toString(),
              providerEmail: user.email || '',
            },
            description: `Withdrawal payout for ${user.email || wallet.userId.toString()}`,
          },
          {
            idempotencyKey: `withdrawal-payout-${transactionId}` as string | undefined,
          }
        );

        stripePayoutId = payout.id;
        stripePayoutStatus = payout.status;

        logger.info('Stripe payout created successfully', {
          withdrawalId: id,
          stripePayoutId: payout.id,
          stripePayoutStatus: payout.status,
          amount: transaction.amount,
          currency: wallet.currency,
          providerId: wallet.userId.toString(),
          action: 'STRIPE_PAYOUT_CREATED',
        });

        // Update transaction with Stripe payout ID
        await Wallet.updateOne(
          { _id: walletId, 'transactions.id': transactionId },
          {
            $set: {
              'transactions.$.stripePayoutId': payout.id,
              'transactions.$.stripePayoutStatus': payout.status,
              'transactions.$.stripePayoutCreatedAt': new Date(),
              'transactions.$.status': payout.status === 'paid' ? 'completed' : 'processing',
              'transactions.$.updatedAt': new Date(),
            },
          },
          { session }
        );

        // If payout failed immediately, revert wallet changes
        if (payout.status === 'failed') {
          throw new ApiError(500, `Stripe payout failed: ${(payout as any).failure_message || 'Unknown error'}`);
        }
      } else {
        // No Stripe account - this is an error condition
        throw new ApiError(400, 'Provider does not have a Stripe account configured for payouts');
      }
    } catch (stripeError: unknown) {
      // Abort transaction if Stripe payout fails
      await session.abortTransaction();

      // Revert wallet balance since payout failed
      await Wallet.updateOne(
        { _id: walletId },
        {
          $inc: {
            balance: transaction.amount,
            pendingBalance: transaction.amount,
          },
        }
      );

      // Reset transaction status
      await Wallet.updateOne(
        { _id: walletId, 'transactions.id': transactionId },
        {
          $set: {
            'transactions.$.status': 'failed',
            'transactions.$.failureReason': stripeError instanceof Error ? stripeError.message : 'Stripe payout creation failed',
            'transactions.$.failureAt': new Date(),
            'transactions.$.updatedAt': new Date(),
          },
        }
      );

      const errorMessage = stripeError instanceof Error ? stripeError.message : 'Stripe payout creation failed';
      logger.error('Stripe payout creation failed', {
        withdrawalId: id,
        walletId,
        transactionId,
        amount: transaction.amount,
        providerId: wallet.userId.toString(),
        error: errorMessage,
        action: 'STRIPE_PAYOUT_ERROR',
      });

      throw ApiError.internal(`Failed to process withdrawal: ${errorMessage}`);
    }

    // Commit transaction only after successful Stripe payout
    await session.commitTransaction();

    logger.info('Withdrawal approved and payout initiated', {
      withdrawalId: id,
      walletId,
      transactionId,
      amount: transaction.amount,
      currency: wallet.currency,
      stripePayoutId,
      stripePayoutStatus,
      providerId: wallet.userId.toString(),
      action: 'WITHDRAWAL_APPROVED',
    });

    // FIX 3: Emit notification and withdrawal:approved socket event
    const socketServer = getSocketServer();
    if (socketServer && user) {
      // Emit specific withdrawal:approved event
      socketServer.emitWithdrawalApproved(
        wallet.userId.toString(),
        id,
        transaction.amount,
        wallet.currency
      );
      // Also emit generic notification
      socketServer.emitToUser(wallet.userId.toString(), 'notification:new', {
        id: `wd-approve-${Date.now()}`,
        type: 'system' as const,
        title: 'Withdrawal Approved',
        message: `Your withdrawal request for ${transaction.amount} ${wallet.currency} has been approved and is being processed.`,
        timestamp: new Date(),
        read: false,
      });
    }

    // Create notification via NotificationService
    try {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipientId: wallet.userId.toString(),
        type: 'withdrawal',
        title: 'Withdrawal Approved',
        message: `Your withdrawal request for ${transaction.amount} ${wallet.currency} has been approved. Funds will be transferred to your bank account within 2-3 business days.`,
        actionText: 'View Wallet',
        actionUrl: '/provider/wallet',
        metadata: {
          withdrawalId: id,
          amount: transaction.amount,
          currency: wallet.currency,
          status: 'approved',
        },
      });
    } catch (notifError) {
      logger.error('Failed to create withdrawal approval notification', {
        withdrawalId: id,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    }

    // Publish event for analytics
    const { eventBus, EVENT_TYPES } = require('../event-bus');
    await eventBus.publish(EVENT_TYPES.WITHDRAWAL_APPROVED, {
      withdrawalId: id,
      walletId,
      transactionId,
      providerId: wallet.userId.toString(),
      amount: transaction.amount,
      currency: wallet.currency,
      approvedBy: adminUser._id.toString(),
      approvedAt: new Date().toISOString(),
    });

    // Log audit trail
    logger.info('Withdrawal approved by admin', {
      withdrawalId: id,
      walletId,
      transactionId,
      providerId: wallet.userId.toString(),
      providerEmail: user?.email,
      amount: transaction.amount,
      currency: wallet.currency,
      approvedBy: adminUser._id.toString(),
      adminEmail: adminUser.email,
      action: 'ADMIN_WITHDRAWAL_APPROVED',
    });

    res.json({
      success: true,
      message: 'Withdrawal approved successfully',
      data: {
        withdrawalId: id,
        status: stripePayoutStatus === 'paid' ? 'completed' : 'processing',
        amount: transaction.amount,
        currency: wallet.currency,
        newBalance: wallet.balance - transaction.amount,
        stripePayoutId,
        estimatedCompletion: stripePayoutStatus === 'paid' ? 'Immediate' : '2-3 business days',
      },
    });
  } catch (error: unknown) {
    // Only abort if transaction is still active and hasn't been ended
    const sessionInTransaction = (session as any)?.inTransaction;
    if (session && typeof sessionInTransaction === 'function' && sessionInTransaction() && !session.hasEnded) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        logger.error('Failed to abort transaction', {
          withdrawalId: id,
          error: abortError instanceof Error ? abortError.message : String(abortError),
        });
      }
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw ApiError.internal(`Failed to approve withdrawal: ${errorMessage}`);
  } finally {
    // Only end session if it hasn't ended yet
    if (session && !session.hasEnded) {
      try {
        await session.endSession();
      } catch (endError) {
        logger.error('Failed to end session', {
          withdrawalId: id,
          error: endError instanceof Error ? endError.message : String(endError),
        });
      }
    }
  }
});

/**
 * Reject a withdrawal request
 * POST /api/admin/withdrawals/:id/reject
 */
export const rejectWithdrawal = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason } = req.body;
  const adminUser = req.user as any;

  // Validate rejection reason
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  // Parse the withdrawal reference from the ID (format: walletId:transactionId)
  const [walletId, transactionId] = id.split(':');

  if (!walletId || !transactionId) {
    throw new ApiError(400, 'Invalid withdrawal ID format');
  }

  const Wallet = require('../models/wallet.model').default;

  // Build query with tenant isolation
  const walletQuery: Record<string, unknown> = { _id: walletId };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    walletQuery.tenantId = tenantContext.tenantId;
  }

  const wallet = await Wallet.findOne(walletQuery);

  if (!wallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  // Find the pending withdrawal transaction
  const transaction = wallet.transactions.find(
    (t: any) => t.id === transactionId && t.referenceType === 'payout'
  );

  if (!transaction) {
    throw new ApiError(404, 'Withdrawal transaction not found');
  }

  if (transaction.status !== 'pending') {
    throw new ApiError(400, `Cannot reject withdrawal with status: ${transaction.status}`);
  }

  // Start a MongoDB session for atomic operation
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Update transaction status to rejected
    await Wallet.updateOne(
      { _id: walletId, 'transactions.id': transactionId },
      {
        $set: {
          'transactions.$.status': 'reversed',
          'transactions.$.updatedAt': new Date(),
          'transactions.$.metadata.rejectionReason': reason,
          'transactions.$.metadata.rejectedAt': new Date(),
          'transactions.$.metadata.rejectedBy': adminUser._id.toString(),
        },
      },
      { session }
    );

    // Release funds back to available balance (remove from pendingBalance only)
    await Wallet.updateOne(
      { _id: walletId },
      {
        $inc: {
          pendingBalance: -transaction.amount,
        },
      },
      { session }
    );

    await session.commitTransaction();

    // Get user info for notifications
    const user = await User.findById(wallet.userId);

    // FIX: Emit withdrawal:rejected socket event and notification
    const socketServer = getSocketServer();
    if (socketServer && user) {
      // Emit specific withdrawal:rejected event
      socketServer.emitWithdrawalRejected(
        wallet.userId.toString(),
        id,
        transaction.amount,
        wallet.currency,
        reason
      );
      // Also emit generic notification
      socketServer.emitToUser(wallet.userId.toString(), 'notification:new', {
        id: `wd-reject-${Date.now()}`,
        type: 'system' as const,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request for ${transaction.amount} ${wallet.currency} has been rejected. Reason: ${reason}`,
        timestamp: new Date(),
        read: false,
      });
    }

    // Create notification via NotificationService
    try {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipientId: wallet.userId.toString(),
        type: 'withdrawal',
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request for ${transaction.amount} ${wallet.currency} has been rejected. Reason: ${reason}`,
        actionText: 'Contact Support',
        actionUrl: '/support',
        metadata: {
          withdrawalId: id,
          amount: transaction.amount,
          currency: wallet.currency,
          status: 'rejected',
          rejectionReason: reason,
        },
      });
    } catch (notifError) {
      logger.error('Failed to create withdrawal rejection notification', {
        withdrawalId: id,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    }

    // Publish event for analytics
    const { eventBus, EVENT_TYPES } = require('../event-bus');
    await eventBus.publish(EVENT_TYPES.WITHDRAWAL_REJECTED, {
      withdrawalId: id,
      walletId,
      transactionId,
      providerId: wallet.userId.toString(),
      amount: transaction.amount,
      currency: wallet.currency,
      reason: reason,
      rejectedBy: adminUser._id.toString(),
      rejectedAt: new Date().toISOString(),
    });

    // Log audit trail
    logger.info('Withdrawal rejected by admin', {
      withdrawalId: id,
      walletId,
      transactionId,
      providerId: wallet.userId.toString(),
      providerEmail: user?.email,
      amount: transaction.amount,
      currency: wallet.currency,
      reason: reason,
      rejectedBy: adminUser._id.toString(),
      adminEmail: adminUser.email,
      action: 'ADMIN_WITHDRAWAL_REJECTED',
    });

    res.json({
      success: true,
      message: 'Withdrawal rejected. Funds have been released back to the provider\'s available balance.',
      data: {
        withdrawalId: id,
        status: 'rejected',
        amount: transaction.amount,
        currency: wallet.currency,
        reason: reason,
        availableBalance: wallet.balance,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    throw new ApiError(500, `Failed to reject withdrawal: ${error.message}`);
  } finally {
    session.endSession();
  }
});

/**
 * Get withdrawal details
 * GET /api/admin/withdrawals/:id
 */
export const getWithdrawalDetails = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  // Parse the withdrawal reference from the ID (format: walletId:transactionId)
  const [walletId, transactionId] = id.split(':');

  if (!walletId || !transactionId) {
    throw new ApiError(400, 'Invalid withdrawal ID format');
  }

  const Wallet = require('../models/wallet.model').default;

  // Build query with tenant isolation
  const walletQuery: Record<string, unknown> = { _id: walletId };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    walletQuery.tenantId = tenantContext.tenantId;
  }

  const wallet = await Wallet.findOne(walletQuery).populate('userId', 'email firstName lastName phone');

  if (!wallet) {
    throw new ApiError(404, 'Wallet not found');
  }

  // Find the withdrawal transaction
  const transaction = wallet.transactions.find(
    (t: any) => t.id === transactionId && t.referenceType === 'payout'
  );

  if (!transaction) {
    throw new ApiError(404, 'Withdrawal transaction not found');
  }

  res.json({
    success: true,
    data: {
      withdrawalId: id,
      walletId: wallet._id,
      transaction: {
        id: transaction.id,
        amount: transaction.amount,
        currency: wallet.currency,
        status: transaction.status,
        description: transaction.description,
        reference: transaction.reference,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        metadata: transaction.metadata,
      },
      provider: {
        id: (wallet.userId as any)._id,
        email: (wallet.userId as any).email,
        firstName: (wallet.userId as any).firstName,
        lastName: (wallet.userId as any).lastName,
        phone: (wallet.userId as any).phone,
      },
      wallet: {
        balance: wallet.balance,
        pendingBalance: wallet.pendingBalance,
        availableBalance: wallet.balance - wallet.pendingBalance + (transaction.status === 'pending' ? transaction.amount : 0),
      },
    },
  });
});

// ============================================
// Churn Management
// ============================================

/**
 * Get churn statistics for admin dashboard
 * GET /api/admin/churn/stats
 */
export const getChurnStats = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Parse date range from query params or use defaults (last 30 days)
  const endDate = req.query.endDate
    ? new Date(req.query.endDate as string)
    : new Date();
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Validate date range
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw ApiError.badRequest('Invalid date range provided');
  }

  if (startDate >= endDate) {
    throw ApiError.badRequest('Start date must be before end date');
  }

  try {
    // Get churn stats from churn service
    const stats = await churnService.getChurnStats({ startDate, endDate });

    // Add tenant context to response metadata
    const responseData = {
      ...stats,
      metadata: {
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        generatedAt: new Date().toISOString(),
        tenantId: tenantContext.tenantId || null,
      },
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    logger.error('Failed to get churn stats', {
      error: error instanceof Error ? error.message : String(error),
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      tenantId: tenantContext.tenantId,
    });
    throw error;
  }
});

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return parseFloat((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * Get real-time metrics for admin dashboard
 * GET /api/admin/realtime-metrics
 */
export const getRealtimeMetrics = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  const baseQuery: Record<string, unknown> = {};
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    baseQuery.tenantId = tenantContext.tenantId;
  }

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    activeUsersCount,
    yesterdayActiveUsers,
    todayBookingsCount,
    yesterdayBookingsCount,
    pendingBookingsCount,
    yesterdayPendingBookings,
    todayRevenueAgg,
    yesterdayRevenueAgg,
    activeProvidersCount,
    yesterdayActiveProviders,
    hourlyBookings,
    hourlyRevenue,
    hourlyUsers,
    hourlyProviders,
    reviewStats,
    activeDisputesCount,
    pendingProvidersCount,
    pendingServicesCount,
  ] = await Promise.all([
    User.countDocuments({ ...baseQuery, lastActive: { $gte: oneHourAgo } }),
    User.countDocuments({
      ...baseQuery,
      lastActive: { $gte: yesterdayStart, $lt: yesterdayEnd },
    }),
    Booking.countDocuments({ ...baseQuery, createdAt: { $gte: todayStart } }),
    Booking.countDocuments({
      ...baseQuery,
      createdAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
    }),
    Booking.countDocuments({ ...baseQuery, status: 'pending' }),
    Booking.countDocuments({
      ...baseQuery,
      status: 'pending',
      updatedAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
    }),
    Booking.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          completedAt: { $gte: todayStart },
        },
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    Booking.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          completedAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]),
    ProviderProfile.countDocuments({
      ...baseQuery,
      'verificationStatus.overall': 'approved',
      isActive: true,
      isDeleted: { $ne: true },
    }),
    ProviderProfile.countDocuments({
      ...baseQuery,
      'verificationStatus.overall': 'approved',
      isActive: true,
      isDeleted: { $ne: true },
      updatedAt: { $gte: yesterdayStart, $lt: yesterdayEnd },
    }),
    Booking.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: twentyFourHoursAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Booking.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          completedAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$completedAt' },
          },
          total: { $sum: '$pricing.totalAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      { $match: { ...baseQuery, lastActive: { $gte: twentyFourHoursAgo } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$lastActive' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ProviderProfile.aggregate([
      {
        $match: {
          ...baseQuery,
          'verificationStatus.overall': 'approved',
          isActive: true,
          updatedAt: { $gte: twentyFourHoursAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%dT%H:00:00.000Z', date: '$updatedAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Review.aggregate([
      { $match: { ...baseQuery, createdAt: { $gte: todayStart } } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Dispute.countDocuments({
      ...baseQuery,
      status: { $in: ['open', 'under_review'] },
    }),
    ProviderProfile.countDocuments({
      ...baseQuery,
      'verificationStatus.overall': { $in: ['pending', 'in_progress'] },
    }),
    Service.countDocuments({ ...baseQuery, status: 'pending_review' }),
  ]);

  const revenueToday = todayRevenueAgg[0]?.total || 0;
  const revenueYesterday = yesterdayRevenueAgg[0]?.total || 0;
  const averageRating = reviewStats[0]?.avg || 0;
  const totalTodayViews = await User.countDocuments({ ...baseQuery, role: 'customer' });
  const conversionRate =
    totalTodayViews > 0
      ? parseFloat(((todayBookingsCount / totalTodayViews) * 100).toFixed(1))
      : 0;

  const buildHourlyTrend = (
    rows: Array<{ _id: string; count?: number; total?: number }>,
    valueKey: 'count' | 'total'
  ): number[] => {
    const map = new Map(rows.map((r) => [r._id, valueKey === 'count' ? r.count || 0 : r.total || 0]));
    const trend: number[] = [];
    for (let i = 23; i >= 0; i -= 1) {
      const bucket = new Date(now.getTime() - i * 60 * 60 * 1000);
      bucket.setMinutes(0, 0, 0);
      const key = bucket.toISOString();
      trend.push(map.get(key) || 0);
    }
    return trend;
  };

  const bookingCountTrend = buildHourlyTrend(hourlyBookings, 'count');
  const revenueTrend = buildHourlyTrend(hourlyRevenue, 'total');
  const activeUsersTrend = buildHourlyTrend(hourlyUsers, 'count');
  const activeProvidersTrend = buildHourlyTrend(hourlyProviders, 'count');

  const historicalData = Array.from({ length: 24 }, (_, i) => {
    const hourDate = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
    return {
      time: `${hourDate.getHours().toString().padStart(2, '0')}:00`,
      bookings: bookingCountTrend[i] || 0,
      revenue: revenueTrend[i] || 0,
      providers: activeProvidersTrend[i] || 0,
      users: activeUsersTrend[i] || 0,
    };
  });

  const alerts: Array<{ id: string; type: 'info' | 'warning' | 'error'; message: string; timestamp: string }> = [];
  if (activeDisputesCount > 0) {
    alerts.push({
      id: 'disputes',
      type: 'warning',
      message: `${activeDisputesCount} active dispute${activeDisputesCount === 1 ? '' : 's'} need attention`,
      timestamp: now.toISOString(),
    });
  }
  if (pendingProvidersCount > 0) {
    alerts.push({
      id: 'providers',
      type: 'info',
      message: `${pendingProvidersCount} provider verification${pendingProvidersCount === 1 ? '' : 's'} pending`,
      timestamp: now.toISOString(),
    });
  }
  if (pendingServicesCount > 0) {
    alerts.push({
      id: 'services',
      type: 'info',
      message: `${pendingServicesCount} service${pendingServicesCount === 1 ? '' : 's'} awaiting review`,
      timestamp: now.toISOString(),
    });
  }

  res.json({
    success: true,
    data: {
      connectionStatus: 'connected',
      lastUpdated: now.toISOString(),
      activeProviders: activeProvidersCount,
      activeProvidersChange: pctChange(activeProvidersCount, yesterdayActiveProviders),
      activeProvidersTrend,
      bookingCount: todayBookingsCount,
      bookingCountChange: pctChange(todayBookingsCount, yesterdayBookingsCount),
      bookingCountTrend,
      revenueToday,
      revenueTodayChange: pctChange(revenueToday, revenueYesterday),
      revenueTrend,
      queuedJobs: pendingBookingsCount,
      queuedJobsChange: pctChange(pendingBookingsCount, yesterdayPendingBookings),
      queuedJobsTrend: bookingCountTrend.map((v) => Math.max(0, Math.round(v * 0.15))),
      activeUsers: activeUsersCount,
      activeUsersChange: pctChange(activeUsersCount, yesterdayActiveUsers),
      activeUsersTrend,
      conversionRate,
      conversionRateChange: 0,
      conversionRateTrend: bookingCountTrend.map(() => conversionRate),
      averageRating: parseFloat(averageRating.toFixed(2)),
      averageRatingChange: 0,
      averageRatingTrend: bookingCountTrend.map(() => parseFloat(averageRating.toFixed(2))),
      historicalData,
      alerts,
    },
  });
});

/**
 * GET /api/admin/churn/at-risk
 */
export const getChurnAtRiskCustomers = asyncHandler(async (req: Request, res: Response) => {
  const {
    minRiskLevel,
    minDaysInactive,
    maxDaysInactive,
    limit = '100',
    offset = '0',
  } = req.query;

  const validLevels = ['low', 'medium', 'high', 'critical'];
  if (minRiskLevel && !validLevels.includes(minRiskLevel as string)) {
    throw ApiError.badRequest(`Invalid risk level. Must be one of: ${validLevels.join(', ')}`);
  }

  const filters: ChurnFilters = {
    limit: Math.min(500, Math.max(1, parseInt(limit as string, 10) || 100)),
    offset: Math.max(0, parseInt(offset as string, 10) || 0),
  };

  if (minRiskLevel) {
    filters.minRiskLevel = minRiskLevel as ChurnFilters['minRiskLevel'];
  }
  if (minDaysInactive) {
    const minDays = parseInt(minDaysInactive as string, 10);
    if (isNaN(minDays) || minDays < 0) throw ApiError.badRequest('minDaysInactive must be a non-negative number');
    filters.minDaysInactive = minDays;
  }
  if (maxDaysInactive) {
    const maxDays = parseInt(maxDaysInactive as string, 10);
    if (isNaN(maxDays) || maxDays < 0) throw ApiError.badRequest('maxDaysInactive must be a non-negative number');
    filters.maxDaysInactive = maxDays;
  }

  const customers = await churnService.getAtRiskCustomers(filters);

  res.json({
    success: true,
    data: {
      customers,
      total: customers.length,
      pagination: { limit: filters.limit, offset: filters.offset },
    },
  });
});

/**
 * GET /api/admin/churn/overview
 */
export const getChurnOverview = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const stats = await churnService.getChurnStats({ startDate: thirtyDaysAgo, endDate: now });
  const atRiskCustomers = await churnService.getAtRiskCustomers({ minRiskLevel: 'medium', limit: 5 });

  res.json({
    success: true,
    data: {
      totalAtRisk: stats.atRiskCustomers,
      churnRate: stats.churnRate,
      byRiskLevel: stats.byRiskLevel,
      averageRiskScore: stats.averageRiskScore,
      totalLifetimeValueAtRisk: stats.totalLifetimeValueAtRisk,
      topRiskFactors: stats.topRiskFactors.slice(0, 3),
      recentAlerts: atRiskCustomers.map((c) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        riskLevel: c.riskLevel,
        riskScore: c.riskScore,
        daysSinceLastBooking: c.daysSinceLastBooking,
        recommendedAction: c.recommendedActions[0] || 'Monitor',
      })),
    },
  });
});

/**
 * GET /api/admin/churn/segments
 */
export const getChurnSegments = asyncHandler(async (_req: Request, res: Response) => {
  const segments = await churnPredictionService.getCustomerSegments();
  res.json({ success: true, data: segments });
});

/**
 * POST /api/admin/churn/refresh
 */
export const refreshChurnCache = asyncHandler(async (_req: Request, res: Response) => {
  await churnService.clearCache();
  res.json({ success: true, message: 'Churn data cache refreshed' });
});

/**
 * POST /api/admin/churn/execute/:userId
 */
export const executeChurnRetentionAction = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { action } = req.body as { action: RetentionAction };

  if (!userId) throw ApiError.badRequest('User ID is required');
  if (!action?.type) throw ApiError.badRequest('Action is required with type property');

  const result = await churnPredictionService.executeRetentionAction(userId, action);
  res.json({ success: true, data: result });
});

/**
 * Suspend provider
 * POST /api/admin/providers/:id/suspend
 */
export const suspendProvider = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { reason, type = 'temporary', endDate } = req.body;
  const adminUser = req.user as any;

  if (!reason) {
    throw new ApiError(400, 'Suspension reason is required');
  }

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const provider = await ProviderProfile.findOne(query).populate('userId', 'email firstName lastName');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'suspended') {
    throw new ApiError(400, 'Provider is already suspended');
  }

  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    // Update provider verification status
    provider.verificationStatus.overall = 'suspended';
    if (provider.verificationStatus.adminNotes !== undefined) {
      provider.verificationStatus.adminNotes = `Suspended: ${reason}`;
    }

    // Store suspension details
    (provider as any).suspensionDetails = {
      reason,
      type,
      suspendedAt: new Date(),
      suspendedBy: adminUser._id,
      endDate: endDate ? new Date(endDate) : null,
      isPermanent: type === 'permanent'
    };

    await provider.save({ session });

    // Update user account status
    if (provider.userId) {
      await User.findByIdAndUpdate(provider.userId, {
        accountStatus: 'suspended'
      }).session(session);

      // Invalidate all tokens
      const userToSuspend = await User.findById(provider.userId).session(session);
      if (userToSuspend) {
        await userToSuspend.invalidateAllTokens();
      }

      // Deactivate all provider services
      const providerUserId = (provider.userId as any)?._id || provider.userId;
      await Service.updateMany(
        { providerId: providerUserId },
        { isActive: false, status: 'inactive' }
      ).session(session);
    }

    await session.commitTransaction();
    transactionCommitted = true;

    // Emit socket event
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitProviderSuspended(
        (provider.userId as any)?._id || provider.userId?.toString() || '',
        reason,
        endDate ? new Date(endDate) : undefined
      );
    }

    logger.info('ADMIN_AUDIT: Provider suspended', {
      action: 'PROVIDER_SUSPENDED',
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      providerId: id,
      providerEmail: (provider.userId as any)?.email,
      businessName: provider.businessInfo.businessName,
      reason,
      type,
      timestamp: new Date().toISOString()
    });

    // Create notification
    try {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipientId: (provider.userId as any)?._id?.toString() || provider.userId?.toString(),
        type: 'provider_suspended',
        title: 'Account Suspended',
        message: `Your provider account has been suspended. Reason: ${reason}`,
        actionText: 'Contact Support',
        actionUrl: '/support',
        metadata: { providerId: id, reason }
      });
    } catch (notifError) {
      logger.error('Failed to create suspension notification', {
        providerId: id,
        error: notifError instanceof Error ? notifError.message : String(notifError)
      });
    }

    res.json({
      success: true,
      message: 'Provider suspended successfully',
      data: { provider }
    });
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Reactivate provider
 * POST /api/admin/providers/:id/reactivate
 */
export const reactivateProvider = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;
  const { notes } = req.body;
  const adminUser = req.user as any;

  // Build tenant-scoped query
  const query: any = { _id: id };
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  const provider = await ProviderProfile.findOne(query).populate('userId', 'email firstName lastName');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall !== 'suspended') {
    throw new ApiError(400, 'Provider is not suspended');
  }

  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    // Restore verification status to approved
    provider.verificationStatus.overall = 'approved';
    if (provider.verificationStatus.adminNotes !== undefined) {
      provider.verificationStatus.adminNotes = notes ? `Reactivated: ${notes}` : 'Reactivated by admin';
    }

    // Clear suspension details
    delete (provider as any).suspensionDetails;

    await provider.save({ session });

    // Restore user account status
    if (provider.userId) {
      await User.findByIdAndUpdate(provider.userId, {
        accountStatus: 'active'
      }).session(session);

      // Reactivate provider services
      const providerUserId = (provider.userId as any)?._id || provider.userId;
      await Service.updateMany(
        { providerId: providerUserId },
        { isActive: true, status: 'active' }
      ).session(session);
    }

    await session.commitTransaction();
    transactionCommitted = true;

    // Emit socket event
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitProviderApproved(
        (provider.userId as any)?._id || provider.userId?.toString() || ''
      );
    }

    logger.info('ADMIN_AUDIT: Provider reactivated', {
      action: 'PROVIDER_REACTIVATED',
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      providerId: id,
      providerEmail: (provider.userId as any)?.email,
      businessName: provider.businessInfo.businessName,
      timestamp: new Date().toISOString()
    });

    // Create notification
    try {
      const notificationService = new NotificationService();
      await notificationService.createNotification({
        recipientId: (provider.userId as any)?._id?.toString() || provider.userId?.toString(),
        type: 'provider_approved',
        title: 'Account Reactivated',
        message: 'Your provider account has been reactivated. You can now accept bookings again.',
        actionText: 'View Dashboard',
        actionUrl: '/provider/dashboard',
        metadata: { providerId: id }
      });
    } catch (notifError) {
      logger.error('Failed to create reactivation notification', {
        providerId: id,
        error: notifError instanceof Error ? notifError.message : String(notifError)
      });
    }

    res.json({
      success: true,
      message: 'Provider reactivated successfully',
      data: { provider }
    });
  } catch (error) {
    if (!transactionCommitted) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * Advanced provider search with filters
 * GET /api/admin/providers/search
 */
export const searchProviders = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const {
    search,
    status,
    verificationStatus,
    city,
    minQualityScore,
    maxQualityScore,
    minRating,
    hasFraudFlags,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    page = 1,
    limit = 25,
  } = req.query;

  // Build complex query
  const query: any = {};

  // Tenant filter
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // Search query (name, email, business name)
  if (search && typeof search === 'string') {
    const searchRegex = { $regex: search, $options: 'i' };
    query.$or = [
      { 'businessInfo.businessName': searchRegex },
      { 'businessInfo.description': searchRegex },
    ];

    // Also search by user email/phone/name
    const User = require('../models/user.model').default;
    const matchedUsers = await User.find({
      $or: [
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex },
        { phone: searchRegex },
      ],
    }).select('_id').limit(100);

    if (matchedUsers.length > 0) {
      query.$or.push({ userId: { $in: matchedUsers.map((u: any) => u._id) } });
    }
  }

  // Status filters
  if (status && typeof status === 'string') {
    if (status === 'active') {
      query.$or = query.$or || [];
      query.$or.push({ 'verificationStatus.overall': 'approved' });
      query.$or.push({ 'verificationStatus.overall': 'verified' });
    } else if (status !== 'all') {
      query['verificationStatus.overall'] = status;
    }
  }

  // Verification status filter
  if (verificationStatus && typeof verificationStatus === 'string') {
    if (verificationStatus === 'verified') {
      query['instagramStyleProfile.isVerified'] = true;
    } else if (verificationStatus === 'unverified') {
      query['instagramStyleProfile.isVerified'] = false;
    } else if (verificationStatus === 'pending') {
      query['verificationStatus.overall'] = 'pending';
    }
  }

  // City filter
  if (city && typeof city === 'string') {
    query['locationInfo.primaryAddress.city'] = { $regex: city, $options: 'i' };
  }

  // Quality score range
  if (minQualityScore || maxQualityScore) {
    query['analytics.performanceMetrics.qualityScore'] = {};
    if (minQualityScore) {
      (query['analytics.performanceMetrics.qualityScore'] as any).$gte = Number(minQualityScore);
    }
    if (maxQualityScore) {
      (query['analytics.performanceMetrics.qualityScore'] as any).$lte = Number(maxQualityScore);
    }
  }

  // Minimum rating filter
  if (minRating) {
    query['reviewsData.averageRating'] = { $gte: Number(minRating) };
  }

  // Date range filter
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) {
      (query.createdAt as any).$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      (query.createdAt as any).$lte = new Date(dateTo as string);
    }
  }

  // Pagination with limits
  const pageNum = Math.max(1, parseInt(page as string) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 25));

  // Sort options
  const sortOptions: any = {};
  sortOptions[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with population
  const providers = await ProviderProfile.find(query)
    .populate('userId', 'firstName lastName email phone accountStatus createdAt')
    .sort(sortOptions)
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  const total = await ProviderProfile.countDocuments(query);

  logger.info('ADMIN: Advanced provider search executed', {
    action: 'PROVIDER_ADVANCED_SEARCH',
    adminId: (req.user as any)?._id,
    filters: {
      search,
      status,
      verificationStatus,
      city,
      minQualityScore,
      maxQualityScore,
      minRating,
    },
    resultsCount: providers.length,
    totalMatches: total
  });

  res.json({
    success: true,
    data: {
      providers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1
      }
    }
  });
});

/**
 * Batch provider operations
 * POST /api/admin/providers/batch
 */
export const batchProviderAction = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);
  const { providerIds, action, reason } = req.body;
  const adminUser = req.user as any;

  if (!providerIds || !Array.isArray(providerIds) || providerIds.length === 0) {
    throw new ApiError(400, 'Provider IDs array is required');
  }

  if (!['suspend', 'activate', 'verify', 'reject'].includes(action)) {
    throw new ApiError(400, 'Invalid action. Must be one of: suspend, activate, verify, reject');
  }

  // Limit batch size
  if (providerIds.length > 50) {
    throw new ApiError(400, 'Cannot process more than 50 providers at once');
  }

  const results = {
    total: providerIds.length,
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const providerId of providerIds) {
    try {
      const query: any = { _id: providerId };
      if (!tenantContext.isAdmin && tenantContext.tenantId) {
        query.tenantId = tenantContext.tenantId;
      }

      const provider = await ProviderProfile.findOne(query).populate('userId', 'email');

      if (!provider) {
        results.failed++;
        results.errors.push(`Provider ${providerId}: Not found`);
        continue;
      }

      switch (action) {
        case 'suspend':
          provider.verificationStatus.overall = 'suspended';
          if (provider.verificationStatus.adminNotes !== undefined) {
            provider.verificationStatus.adminNotes = `Batch suspended: ${reason || 'No reason provided'}`;
          }
          if (provider.userId) {
            await User.findByIdAndUpdate(provider.userId, { accountStatus: 'suspended' });
          }
          break;

        case 'activate':
        case 'verify':
          provider.verificationStatus.overall = 'approved';
          provider.instagramStyleProfile.isVerified = true;
          if (provider.userId) {
            await User.findByIdAndUpdate(provider.userId, { accountStatus: 'active' });
          }
          break;

        case 'reject':
          provider.verificationStatus.overall = 'rejected';
          provider.instagramStyleProfile.isVerified = false;
          if (provider.userId) {
            await User.findByIdAndUpdate(provider.userId, { accountStatus: 'suspended' });
          }
          break;
      }

      await provider.save();
      results.successful++;
    } catch (err) {
      results.failed++;
      results.errors.push(`Provider ${providerId}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  logger.info('ADMIN_AUDIT: Batch provider action', {
    action: 'BATCH_PROVIDER_ACTION',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    batchAction: action,
    providerIds,
    results,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: `Batch action completed: ${results.successful} successful, ${results.failed} failed`,
    data: results
  });
});

// ========================================
// Provider Bookings Management (Admin)
// ========================================

/**
 * Validation schema for provider bookings query
 */
const providerBookingsQuerySchema = Joi.object({
  page: Joi.number().min(1).default(1),
  limit: Joi.number().min(1).max(100).default(20),
  status: Joi.string()
    .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, confirmed, in_progress, completed, cancelled, no_show'
    }),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  sortBy: Joi.string().valid('createdAt', 'scheduledDate', 'status', 'pricing.totalAmount').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
}).options({ stripUnknown: true });

/**
 * Get all bookings for a specific provider (admin view)
 * GET /api/admin/providers/:id/bookings
 */
export const getProviderBookings = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  // Validate provider ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid provider ID format');
  }

  // Validate query parameters
  const { error, value } = providerBookingsQuerySchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  // Verify provider exists
  const provider = await User.findOne({
    _id: id,
    role: 'provider'
  });

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  // Build query
  const query: any = { providerId: id };

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
  }

  // Status filter
  if (value.status) {
    query.status = value.status;
  }

  // Date range filter
  if (value.startDate || value.endDate) {
    query.scheduledDate = {};
    if (value.startDate) {
      query.scheduledDate.$gte = new Date(value.startDate);
    }
    if (value.endDate) {
      const endDate = new Date(value.endDate);
      endDate.setHours(23, 59, 59, 999);
      query.scheduledDate.$lte = endDate;
    }
  }

  // Calculate pagination
  const page = Number(value.page);
  const limit = Math.min(Number(value.limit), 100);
  const skip = (page - 1) * limit;

  // Build sort options
  const sortOptions: Record<string, 1 | -1> = {};
  sortOptions[value.sortBy || 'createdAt'] = value.sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('customerId', 'firstName lastName email phone')
      .populate('serviceId', 'name category duration images')
      .populate('customerReview', 'rating comment createdAt')
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean(),
    Booking.countDocuments(query)
  ]);

  // Transform bookings for response
  const items = bookings.map(booking => ({
    _id: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status,
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    duration: booking.duration,
    location: booking.location,
    pricing: {
      basePrice: booking.pricing.basePrice,
      addOns: booking.pricing.addOns,
      discounts: booking.pricing.discounts,
      couponDiscount: booking.pricing.couponDiscount,
      subtotal: booking.pricing.subtotal,
      tax: booking.pricing.tax,
      totalAmount: booking.pricing.totalAmount,
      currency: booking.pricing.currency,
    },
    customer: booking.customerId ? {
      _id: (booking.customerId as any)._id,
      firstName: (booking.customerId as any).firstName,
      lastName: (booking.customerId as any).lastName,
      email: (booking.customerId as any).email,
      phone: (booking.customerId as any).phone,
    } : null,
    service: booking.serviceId ? {
      _id: (booking.serviceId as any)._id,
      name: (booking.serviceId as any).name,
      category: (booking.serviceId as any).category,
      duration: (booking.serviceId as any).duration,
      image: (booking.serviceId as any).images?.[0] || null,
    } : null,
    customerInfo: booking.customerInfo,
    isGuestBooking: booking.isGuestBooking,
    guestInfo: booking.isGuestBooking ? booking.guestInfo : undefined,
    providerResponse: booking.providerResponse,
    payment: booking.payment,
    cancellationDetails: booking.cancellationDetails,
    hasReview: !!booking.customerReview,
    review: booking.customerReview ? {
      rating: (booking.customerReview as any).rating,
      comment: (booking.customerReview as any).comment,
      createdAt: (booking.customerReview as any).createdAt,
    } : undefined,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
    completedAt: booking.completedAt,
    cancelledAt: booking.cancelledAt,
  }));

  // Calculate pagination metadata
  const totalPages = Math.ceil(total / limit);

  // Get status breakdown for this provider
  const statusBreakdown = await Booking.aggregate([
    { $match: { providerId: new mongoose.Types.ObjectId(id) } },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  const statusCounts = statusBreakdown.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {} as Record<string, number>);

  // Audit logging
  logger.info('ADMIN_AUDIT: Provider bookings accessed', {
    action: 'ADMIN_GET_PROVIDER_BOOKINGS',
    adminId: (req.user as IUser)?._id,
    adminEmail: (req.user as IUser)?.email,
    providerId: id,
    providerEmail: provider.email,
    filters: {
      status: value.status,
      startDate: value.startDate,
      endDate: value.endDate,
      page,
      limit,
    },
    resultCount: bookings.length,
    totalCount: total,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    data: {
      items,
      pagination: {
        page,
        limit,
        total,
        pages: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        nextPage: page < totalPages ? page + 1 : null,
        prevPage: page > 1 ? page - 1 : null,
      },
      statusBreakdown,
    }
  });
});

// Default export - functions batchRefund and getUserProviderRelationship are defined later in the file
// and are referenced here via their hoisted declarations
export default {
  // Provider Management
  getPendingProviders,
  getProviderForVerification,
  approveProvider,
  rejectProvider,
  suspendProvider,
  reactivateProvider,
  searchProviders,
  batchProviderAction,
  getVerificationStats,
  createTestProvider,
  // Service Management
  getAllServices,
  getPendingServices,
  updateServiceStatus,
  adminDeleteService,
  getServiceStats,
  searchServices,
  getProviderServices,
  getProvidersWithServices,
  batchServiceAction,
  // User Management
  getAllUsers,
  updateUserStatus,
  adminDeleteUser,
  getUserStats,
  // Booking Management
  getAllBookings,
  searchBookings,
  getBookingDetails,
  updateBookingStatus,
  getBookingStats,
  // Category Management
  getAllCategories,
  getCategoryDetails,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryFeatured,
  addSubcategory,
  getCategoryStats,
  // Review Moderation
  getReviewStats,
  getAllReviews,
  getPendingReviews,
  getFlaggedReviews,
  moderateReview,
  bulkModerateReviews,
  // Withdrawal Management
  getPendingWithdrawals,
  getWithdrawalStats,
  getWithdrawalDetails,
  approveWithdrawal,
  rejectWithdrawal,
  // Churn Management
  getChurnStats,
  getChurnAtRiskCustomers,
  getChurnOverview,
  getChurnSegments,
  refreshChurnCache,
  executeChurnRetentionAction,
  // Real-time metrics
  getRealtimeMetrics,
  // Provider Bookings Management
  getProviderBookings,
} as const;

// ========================================
// User-Provider Relationship Endpoint
// ========================================

/**
 * Get comprehensive relationship data between a customer and provider
 * GET /api/admin/relationships/user-provider?customerId=xxx&providerId=xxx
 *
 * Returns bookings, reviews, disputes, and calculated metrics
 */
export const getUserProviderRelationship = asyncHandler(async (req: Request, res: Response) => {
  const { customerId, providerId } = req.query;

  // Validate required parameters
  if (!customerId || !providerId) {
    throw new ApiError(400, 'Both customerId and providerId are required');
  }

  // Validate ObjectId formats
  if (!mongoose.Types.ObjectId.isValid(customerId as string)) {
    throw new ApiError(400, 'Invalid customerId format');
  }
  if (!mongoose.Types.ObjectId.isValid(providerId as string)) {
    throw new ApiError(400, 'Invalid providerId format');
  }

  const customerObjectId = new mongoose.Types.ObjectId(customerId as string);
  const providerObjectId = new mongoose.Types.ObjectId(providerId as string);

  // Fetch data in parallel for performance
  const [
    // Bookings between customer and provider
    bookings,
    bookingStats,
    // Reviews between customer and provider
    reviews,
    reviewStats,
    // Disputes between customer and provider
    disputes,
    disputeStats,
  ] = await Promise.all([
    // Bookings - get all bookings between customer and provider
    Booking.find({
      customerId: customerObjectId,
      providerId: providerObjectId,
      isDeleted: { $ne: true }
    })
      .populate('serviceId', 'name category')
      .sort({ createdAt: -1 })
      .lean(),

    // Booking aggregation stats
    Booking.aggregate([
      {
        $match: {
          customerId: customerObjectId,
          providerId: providerObjectId,
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalSpend: {
            $sum: {
              $cond: [
                { $eq: ['$status', 'completed'] },
                { $ifNull: ['$pricing.totalAmount', 0] },
                0
              ]
            }
          },
          firstBookingDate: { $min: '$createdAt' },
          lastBookingDate: { $max: '$scheduledDate' }
        }
      }
    ]),

    // Reviews from customer to provider (customer reviewing provider)
    Review.find({
      reviewerId: customerObjectId,
      revieweeId: providerObjectId
    })
      .populate('bookingId', 'bookingNumber')
      .sort({ createdAt: -1 })
      .lean(),

    // Review aggregation stats (customer to provider)
    Review.aggregate([
      {
        $match: {
          reviewerId: customerObjectId,
          revieweeId: providerObjectId,
          isHidden: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          avgRating: { $avg: '$rating' }
        }
      }
    ]),

    // Disputes involving both customer and provider (either party)
    Dispute.find({
      isDeleted: false,
      $or: [
        // Customer is initiator
        {
          'initiator.userId': customerObjectId,
          'respondent.userId': providerObjectId
        },
        // Provider is initiator
        {
          'initiator.userId': providerObjectId,
          'respondent.userId': customerObjectId
        }
      ]
    })
      .sort({ createdAt: -1 })
      .lean(),

    // Dispute aggregation stats
    Dispute.aggregate([
      {
        $match: {
          isDeleted: false,
          $or: [
            {
              'initiator.userId': customerObjectId,
              'respondent.userId': providerObjectId
            },
            {
              'initiator.userId': providerObjectId,
              'respondent.userId': customerObjectId
            }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          underReview: {
            $sum: { $cond: [{ $eq: ['$status', 'under_review'] }, 1, 0] }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          },
          escalated: {
            $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] }
          },
          closed: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          }
        }
      }
    ])
  ]);

  // Extract stats from aggregation results
  const bookingMetrics = bookingStats[0] || {
    total: 0,
    completed: 0,
    cancelled: 0,
    totalSpend: 0,
    firstBookingDate: null,
    lastBookingDate: null
  };

  const reviewMetrics = reviewStats[0] || {
    total: 0,
    avgRating: 0
  };

  const disputeMetrics = disputeStats[0] || {
    total: 0,
    open: 0,
    underReview: 0,
    resolved: 0,
    escalated: 0,
    closed: 0
  };

  // Calculate derived metrics
  const totalBookings = bookingMetrics.total;
  const completedBookings = bookingMetrics.completed;
  const repeatBookings = Math.max(0, completedBookings - 1); // First booking is not "repeat"

  // Calculate repeat rate (completed bookings only)
  const repeatRate = completedBookings > 0
    ? Math.round((repeatBookings / completedBookings) * 100)
    : 0;

  // Calculate dispute rate (disputes / total bookings)
  const disputeRate = totalBookings > 0
    ? Math.round((disputeMetrics.total / totalBookings) * 100)
    : 0;

  // Return comprehensive relationship data
  res.json({
    success: true,
    data: {
      customerId: customerId as string,
      providerId: providerId as string,
      bookings: {
        items: bookings,
        total: bookingMetrics.total,
        completed: bookingMetrics.completed,
        cancelled: bookingMetrics.cancelled,
        totalSpend: bookingMetrics.totalSpend
      },
      reviews: {
        items: reviews,
        total: reviewMetrics.total,
        avgRating: reviewMetrics.avgRating ? Math.round(reviewMetrics.avgRating * 10) / 10 : 0
      },
      disputes: {
        items: disputes,
        total: disputeMetrics.total,
        open: disputeMetrics.open + disputeMetrics.underReview + disputeMetrics.escalated,
        resolved: disputeMetrics.resolved + disputeMetrics.closed
      },
      metrics: {
        repeatRate,
        disputeRate,
        avgRating: reviewMetrics.avgRating ? Math.round(reviewMetrics.avgRating * 10) / 10 : 0,
        totalSpend: bookingMetrics.totalSpend,
        firstBookingDate: bookingMetrics.firstBookingDate,
        lastBookingDate: bookingMetrics.lastBookingDate
      }
    }
  });
});

// ============================================
// BATCH REFUND ENDPOINT
// ============================================

/**
 * Validation schema for batch refund
 */
const batchRefundSchema = Joi.object({
  bookingIds: Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).optional(),
  providerId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).optional(),
  status: Joi.array().items(Joi.string().valid(
    'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'
  )).optional(),
  reason: Joi.string().required().min(5).max(500).messages({
    'string.min': 'Refund reason must be at least 5 characters',
    'string.max': 'Refund reason cannot exceed 500 characters',
    'any.required': 'Refund reason is required'
  }),
  refundPolicy: Joi.string().valid('full', 'partial', 'no_refund').required().messages({
    'any.only': 'Refund policy must be one of: full, partial, no_refund',
    'any.required': 'Refund policy is required'
  }),
  partialPercentage: Joi.number().min(0).max(100).optional().when('refundPolicy', {
    is: 'partial',
    then: Joi.number().required().min(1).max(100).messages({
      'any.required': 'Partial percentage is required when using partial refund policy'
    })
  }),
  dryRun: Joi.boolean().default(false)
});

/**
 * POST /api/admin/bookings/batch-refund
 * Process batch refunds for multiple bookings
 */
export const batchRefund = asyncHandler(async (req: Request, res: Response) => {
  const adminUser = (req as any).user;
  const adminId = adminUser._id?.toString() || adminUser.id?.toString();

  // Validate request body
  const { error, value } = batchRefundSchema.validate(req.body, { abortEarly: false });
  if (error) {
    throw ApiError.badRequest(
      error.details.map(d => d.message).join('; '),
      error.details.map(d => ({ field: d.path.join('.'), message: d.message }))
    );
  }

  // Must specify either bookingIds or providerId
  if (!value.bookingIds?.length && !value.providerId) {
    throw ApiError.badRequest('Either bookingIds or providerId must be provided');
  }

  // Build query to find matching bookings
  // Standardize on isDeleted pattern (matching the rest of the codebase)
  const query: any = {
    isDeleted: { $ne: true }
  };

  if (value.bookingIds?.length) {
    query._id = { $in: value.bookingIds.map((id: string) => new mongoose.Types.ObjectId(id)) };
  }

  if (value.providerId) {
    query.providerId = new mongoose.Types.ObjectId(value.providerId);
  }

  if (value.status?.length) {
    query.status = { $in: value.status };
  }

  // Only process bookings with completed payments that haven't been fully refunded
  query['payment.status'] = 'completed';

  // FIX: Add hard limit to prevent unlimited batch processing
  const MAX_BATCH_REFUND = 100;

  // Fetch matching bookings with limit
  const bookings = await Booking.find(query)
    .limit(MAX_BATCH_REFUND)
    .populate('customerId', 'firstName lastName email')
    .populate('providerId', 'firstName lastName email')
    .populate('serviceId', 'name')
    .lean();

  if (bookings.length === 0) {
    res.json({
      success: true,
      message: 'No eligible bookings found for refund',
      data: {
        summary: {
          totalFound: 0,
          eligibleForRefund: 0,
          skipped: 0,
          processed: 0,
          failed: 0,
          totalRefundAmount: 0
        },
        results: []
      }
    });
    return;
  }

  // Calculate refunds for each booking
  const refundCalculations = bookings.map((booking: any) => {
    const totalAmount = booking.pricing?.totalAmount || 0;
    const alreadyRefunded = booking.payment?.totalRefunded || 0;
    const maxRefundable = totalAmount - alreadyRefunded;

    let refundAmount = 0;
    let refundPercentage = 100;

    switch (value.refundPolicy) {
      case 'full':
        refundAmount = maxRefundable;
        refundPercentage = 100;
        break;
      case 'partial':
        refundAmount = Math.round((maxRefundable * (value.partialPercentage || 50)) / 100 * 100) / 100;
        refundPercentage = value.partialPercentage || 50;
        break;
      case 'no_refund':
        refundAmount = 0;
        refundPercentage = 0;
        break;
    }

    return {
      bookingId: booking._id.toString(),
      bookingNumber: booking.bookingNumber,
      status: booking.status,
      customer: booking.customerId ? {
        _id: booking.customerId._id?.toString(),
        name: `${booking.customerId.firstName || ''} ${booking.customerId.lastName || ''}`.trim(),
        email: booking.customerId.email
      } : null,
      provider: booking.providerId ? {
        _id: booking.providerId._id?.toString(),
        name: `${booking.providerId.firstName || ''} ${booking.providerId.lastName || ''}`.trim(),
        email: booking.providerId.email
      } : null,
      service: booking.serviceId?.name || 'Unknown',
      totalAmount,
      alreadyRefunded,
      maxRefundable,
      refundAmount,
      refundPercentage,
      isEligible: maxRefundable > 0 && booking.payment?.transactionId
    };
  });

  // If dry run, return calculations without processing
  if (value.dryRun) {
    const eligible = refundCalculations.filter(r => r.isEligible);
    const dryRunTotalAmount = eligible.reduce((sum, r) => sum + r.refundAmount, 0);

    res.json({
      success: true,
      message: 'Dry run complete - no refunds processed',
      data: {
        summary: {
          totalFound: bookings.length,
          eligibleForRefund: eligible.length,
          skipped: bookings.length - eligible.length,
          processed: 0,
          failed: 0,
          totalRefundAmount: dryRunTotalAmount
        },
        results: refundCalculations
      }
    });
    return;
  }

  // Process refunds
  const results: any[] = [];
  let processed = 0;
  let failed = 0;
  let totalRefundAmount = 0;

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    for (const calc of refundCalculations) {
      if (!calc.isEligible) {
        results.push({
          bookingId: calc.bookingId,
          bookingNumber: calc.bookingNumber,
          status: 'skipped',
          reason: calc.maxRefundable <= 0 ? 'Already fully refunded or no payment' : 'No transaction ID',
          refundAmount: 0
        });
        continue;
      }

      try {
        // Get the booking with session
        const booking = await Booking.findById(calc.bookingId).session(session);

        if (!booking) {
          results.push({
            bookingId: calc.bookingId,
            bookingNumber: calc.bookingNumber,
            status: 'failed',
            reason: 'Booking not found',
            refundAmount: 0
          });
          failed++;
          continue;
        }

        // Verify booking still qualifies
        if (booking.payment?.status !== 'completed' || !booking.payment?.transactionId) {
          results.push({
            bookingId: calc.bookingId,
            bookingNumber: calc.bookingNumber,
            status: 'skipped',
            reason: 'Payment status changed or no transaction ID',
            refundAmount: 0
          });
          continue;
        }

        // Process Stripe refund if there's an amount to refund
        let stripeRefundId: string | undefined;

        if (calc.refundAmount > 0) {
          try {
            // Calculate amount in cents
            const amountInCents = Math.round(calc.refundAmount * 100);

            const stripeRefund = await stripe.refunds.create({
              charge: booking.payment.transactionId,
              amount: amountInCents,
              reason: 'requested_by_customer',
              metadata: {
                adminRefund: 'true',
                adminId: adminId,
                refundReason: value.reason,
                refundPolicy: value.refundPolicy,
                bookingNumber: booking.bookingNumber
              }
            });

            stripeRefundId = stripeRefund.id;
          } catch (stripeError: any) {
            logger.error('Stripe refund failed for batch operation', {
              context: 'BatchRefund',
              bookingId: calc.bookingId,
              bookingNumber: calc.bookingNumber,
              error: stripeError.message
            });

            results.push({
              bookingId: calc.bookingId,
              bookingNumber: calc.bookingNumber,
              status: 'failed',
              reason: `Stripe error: ${stripeError.message}`,
              refundAmount: 0
            });
            failed++;
            continue;
          }
        }

        // Update booking with refund details
        booking.payment = booking.payment || {};
        booking.payment.refundedAt = new Date();
        booking.payment.totalRefunded = (booking.payment.totalRefunded || 0) + calc.refundAmount;

        // Check if fully refunded
        if (booking.payment.totalRefunded >= booking.pricing?.totalAmount) {
          booking.payment.status = 'refunded';
        }

        // Add cancellation/refund details
        booking.cancellationDetails = {
          cancelledBy: 'admin',
          cancelledAt: new Date(),
          reason: value.reason,
          refundAmount: calc.refundAmount,
          refundStatus: calc.refundAmount > 0 ? 'processed' : 'pending'
        };

        // Add to status history
        booking.statusHistory.push({
          status: 'refunded',
          timestamp: new Date(),
          reason: value.reason,
          updatedBy: 'admin' as const,
          notes: `Batch refund: ${value.refundPolicy} policy, ${calc.refundPercentage}% of ${calc.maxRefundable} ${booking.pricing?.currency || 'AED'}`
        });

        await booking.save({ session });

        // Log audit trail
        logger.info('Batch refund processed', {
          context: 'BatchRefund',
          action: 'BATCH_REFUND_PROCESSED',
          adminId: adminId,
          bookingId: calc.bookingId,
          bookingNumber: calc.bookingNumber,
          refundAmount: calc.refundAmount,
          refundPolicy: value.refundPolicy,
          reason: value.reason,
          stripeRefundId
        });

        results.push({
          bookingId: calc.bookingId,
          bookingNumber: calc.bookingNumber,
          status: 'success',
          reason: value.reason,
          refundAmount: calc.refundAmount,
          refundPercentage: calc.refundPercentage,
          stripeRefundId,
          newPaymentStatus: booking.payment.status
        });

        processed++;
        totalRefundAmount += calc.refundAmount;

      } catch (error: any) {
        logger.error('Batch refund processing error', {
          context: 'BatchRefund',
          bookingId: calc.bookingId,
          error: error.message
        });

        results.push({
          bookingId: calc.bookingId,
          bookingNumber: calc.bookingNumber,
          status: 'failed',
          reason: error.message,
          refundAmount: 0
        });
        failed++;
      }
    }

    await session.commitTransaction();

  } catch (error: any) {
    await session.abortTransaction();

    logger.error('Batch refund transaction failed', {
      context: 'BatchRefund',
      adminId: adminId,
      error: error.message
    });

    throw error;
  } finally {
    session.endSession();
  }

  // Return summary
  res.json({
    success: true,
    message: `Batch refund completed: ${processed} succeeded, ${failed} failed, ${bookings.length - processed - failed} skipped`,
    data: {
      summary: {
        totalFound: bookings.length,
        eligibleForRefund: results.filter(r => r.status !== 'skipped').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        processed,
        failed,
        totalRefundAmount: Math.round(totalRefundAmount * 100) / 100,
        refundPolicy: value.refundPolicy,
        reason: value.reason
      },
      results
    }
  });
});

/**
 * Admin Search Reindex Endpoint
 * POST /api/admin/search/reindex
 *
 * Manually triggers search index rebuild for all content types
 */
export const reindexSearch = asyncHandler(async (req: Request, res: Response) => {
  // Verify admin role
  if (req.user?.role !== 'admin') {
    throw ApiError.forbidden('Admin access required');
  }

  const adminUser = req.user as any;
  const { indexType = 'all' } = req.body;

  const validIndexTypes = ['all', 'services', 'providers', 'categories'];
  if (!validIndexTypes.includes(indexType)) {
    throw ApiError.badRequest(`Invalid index type. Must be one of: ${validIndexTypes.join(', ')}`);
  }

  logger.info('Search reindex triggered', {
    context: 'AdminController',
    action: 'SEARCH_REINDEX_STARTED',
    adminId: adminUser._id.toString(),
    indexType,
  });

  const startTime = Date.now();
  const results: Record<string, any> = {};

  try {
    // Dynamically import meilisearch service to avoid circular deps
    const { getMeiliClient, INDEXES } = await import('../config/meilisearch');
    const meiliClient = await getMeiliClient();

    if (!meiliClient) {
      throw new ApiError(503, 'Meilisearch is not configured');
    }

    // Ensure indexes exist
    if (indexType === 'all' || indexType === 'services') {
      await meiliClient.createIndex(INDEXES.SERVICES, { primaryKey: 'id' }).catch(() => {
        // Index may already exist, ignore error
      });
      results.services = { status: 'processing' };
    }

    if (indexType === 'all' || indexType === 'providers') {
      await meiliClient.createIndex(INDEXES.PROVIDERS, { primaryKey: 'id' }).catch(() => {});
      results.providers = { status: 'processing' };
    }

    if (indexType === 'all' || indexType === 'categories') {
      await meiliClient.createIndex(INDEXES.CATEGORIES, { primaryKey: 'id' }).catch(() => {});
      results.categories = { status: 'processing' };
    }

    // Reindex services
    if (indexType === 'all' || indexType === 'services') {
      const services = await Service.find({ isDeleted: false })
        .populate('providerId', 'firstName lastName businessInfo trustScore')
        .lean();

      const serviceDocs = services.map(s => ({
        id: s._id.toString(),
        title: s.name,
        description: s.description || '',
        category: s.category || '',
        subcategory: s.subcategory,
        tags: s.tags || [],
        pricing: s.price || { basePrice: 0, currency: 'AED' },
        rating: s.rating || { average: 0, count: 0 },
        provider: {
          id: (s.providerId as any)?._id?.toString() || '',
          name: (s.providerId as any)?.businessInfo?.businessName ||
            `${(s.providerId as any)?.firstName || ''} ${(s.providerId as any)?.lastName || ''}`.trim() || 'Unknown',
          trustScore: (s.providerId as any)?.trustScore || 0,
        },
        totalBookings: (s as any).analytics?.totalBookings || 0,
        isActive: s.status === 'active',
        createdAt: s.createdAt?.getTime() || Date.now(),
        updatedAt: s.updatedAt?.getTime() || Date.now(),
      }));

      if (serviceDocs.length > 0) {
        await meiliClient.index(INDEXES.SERVICES).addDocuments(serviceDocs);
      }
      results.services = { status: 'completed', count: serviceDocs.length };
    }

    // Reindex providers
    if (indexType === 'all' || indexType === 'providers') {
      const providers = await ProviderProfile.find({ isDeleted: false })
        .populate('userId', 'firstName lastName email phone')
        .lean();

      const providerDocs = providers.map(p => ({
        id: p._id.toString(),
        firstName: (p.userId as any)?.firstName || '',
        lastName: (p.userId as any)?.lastName || '',
        businessName: p.businessInfo?.businessName,
        email: (p.userId as any)?.email || '',
        phone: (p.userId as any)?.phone || '',
        city: p.locationInfo?.primaryAddress?.city || '',
        state: p.locationInfo?.primaryAddress?.state || '',
        trustScore: (p as any).trustScore || 0,
        rating: p.reviewsData?.averageRating ? { average: p.reviewsData.averageRating, count: p.reviewsData.totalReviews || 0 } : { average: 0, count: 0 },
        totalServices: (p as any).analytics?.serviceStats?.activeServices || 0,
        totalBookings: p.analytics?.bookingStats?.totalBookings || 0,
        isVerified: p.verificationStatus?.overall === 'verified',
        isActive: (p as any).accountStatus === 'active',
        createdAt: p.createdAt?.getTime() || Date.now(),
      }));

      if (providerDocs.length > 0) {
        await meiliClient.index(INDEXES.PROVIDERS).addDocuments(providerDocs);
      }
      results.providers = { status: 'completed', count: providerDocs.length };
    }

    // Reindex categories
    if (indexType === 'all' || indexType === 'categories') {
      const categories = await ServiceCategory.find({ isActive: true }).lean();

      const categoryDocs = categories.map(c => ({
        id: c._id.toString(),
        name: c.name,
        description: c.description || '',
        parentId: (c as any).parent?.toString(),
        icon: c.icon,
        serviceCount: (c as any).serviceCount || 0,
        isActive: c.isActive,
      }));

      if (categoryDocs.length > 0) {
        await meiliClient.index(INDEXES.CATEGORIES).addDocuments(categoryDocs);
      }
      results.categories = { status: 'completed', count: categoryDocs.length };
    }

    const duration = Date.now() - startTime;

    logger.info('Search reindex completed', {
      context: 'AdminController',
      action: 'SEARCH_REINDEX_COMPLETED',
      adminId: adminUser._id.toString(),
      indexType,
      durationMs: duration,
      results,
    });

    res.json({
      success: true,
      message: `Search reindex completed for ${indexType}`,
      data: {
        indexType,
        durationMs: duration,
        results,
        completedAt: new Date().toISOString(),
      }
    });

  } catch (error: any) {
    logger.error('Search reindex failed', {
      context: 'AdminController',
      action: 'SEARCH_REINDEX_ERROR',
      adminId: adminUser._id.toString(),
      indexType,
      error: error.message,
    });

    throw new ApiError(500, `Reindex failed: ${error.message}`);
  }
});
