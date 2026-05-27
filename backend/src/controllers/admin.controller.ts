import { Request, Response } from 'express';
import { PipelineStage } from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import ServiceCategory from '../models/serviceCategory.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { getTenantContext, TenantContext } from '../utils/tenantFilter';
import { sendProviderApproval, sendProviderRejection } from '../services/email.service';
import { getSocketServer } from '../socket';
import { NotificationService } from '../services/notification.service';
import { churnService } from '../services/churn.service';
import crypto from 'crypto';

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
    query.$or = [
      { 'businessInfo.businessName': { $regex: search, $options: 'i' } }
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

  await provider.save();

  // Update user account status
  if (provider.userId) {
    await User.findByIdAndUpdate(provider.userId, {
      accountStatus: 'active'
    });
  }

  // IMPORTANT: Create Service documents for each provider service
  // This makes them searchable in the Services collection
  if (provider.services && provider.services.length > 0) {
    logger.info('Creating service documents for approved provider', {
      action: 'ADMIN_PROVIDER_APPROVAL',
      providerId: id,
      businessName: provider.businessInfo.businessName,
      serviceCount: provider.services.length
    });

    for (const service of provider.services) {
      try {
        // Check if service already exists (avoid duplicates)
        const existingService = await Service.findOne({
          providerId: provider.userId,
          name: service.name
        });

        if (!existingService) {
          // Create new Service document with proper structure
          const newService = new Service({
            providerId: provider.userId,
            name: service.name,
            category: service.category,
            subcategory: service.subcategory,
            description: service.description,
            shortDescription: service.description.substring(0, 100),

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
                  // GeoJSON format: [longitude, latitude]
                  provider.locationInfo.primaryAddress.coordinates?.coordinates?.[0] || -74.006,
                  provider.locationInfo.primaryAddress.coordinates?.coordinates?.[1] || 40.7128
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

            isActive: service.isActive !== false,
            isFeatured: false,
            isPopular: false
          });

          await newService.save();
          logger.debug('Service created', { serviceId: newService._id, serviceName: service.name });
        } else {
          logger.debug('Service already exists, skipping', { serviceName: service.name });
        }
      } catch (serviceError) {
        logger.error('Error creating service', {
          serviceName: service.name,
          providerId: id,
          error: (serviceError as Error).message
        });
        // Continue with other services even if one fails
      }
    }
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

  res.json({
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

  // Validate status - aligned with Service model enum: 'draft', 'active', 'inactive', 'pending_review'
  const validStatuses = ['active', 'inactive', 'pending_review', 'draft'];
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
  service.status = status;

  // Sync isActive with status (required for search visibility)
  service.isActive = status === 'active';

  // Add admin notes if provided (as metadata for now)
  if (notes) {
    if (!(service as any).adminNotes) {
      (service as any).adminNotes = [];
    }
    (service as any).adminNotes.push({
      note: notes,
      createdBy: (req.user as any)._id,
      createdAt: new Date(),
      action: status
    });
  }

  // If rejecting, add reason (as metadata for now)
  if (status === 'inactive' && reason) {
    (service as any).rejectionReason = reason;
  }

  await service.save();

  logger.info('ADMIN_AUDIT: Service status updated', {
    action: 'SERVICE_STATUS_UPDATED',
    serviceId: service._id,
    serviceName: service.name,
    newStatus: status,
    adminId: (req.user as any)?._id
  });

  // Get provider user ID for notifications
  const providerUserId = (service.providerId as any)?._id || service.providerId?.toString();

  // Create in-app notification for provider
  if (providerUserId) {
    try {
      const notificationService = new NotificationService();
      const isApproved = status === 'active';
      await notificationService.createNotification({
        recipientId: providerUserId,
        type: isApproved ? 'service_approved' : 'service_rejected',
        title: isApproved ? 'Service Approved' : 'Service Update Required',
        message: isApproved
          ? 'Your service has been approved and is now live.'
          : `Your service requires updates: ${reason || 'Please review and resubmit.'}`,
        actionText: isApproved ? 'View Service' : 'Edit Service',
        actionUrl: `/provider/services/${service._id}/edit`,
        metadata: { serviceId: service._id.toString(), status }
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
        // FIX: Correct parameter order - providerId first, serviceId second
        socketServer.emitServiceApproved(providerUserId, service._id.toString());
      } else if (reason) {
        socketServer.emitServiceRejected(service._id.toString(), providerUserId, reason);
      }
    }
  }

  res.json({
    success: true,
    message: `Service ${status === 'active' ? 'approved' : 'status updated'} successfully`,
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
    adminId: (req.user as any)?._id
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
  if ((user._id as any).toString() === (req.user as any)._id.toString()) {
    throw new ApiError(400, 'Cannot change your own account status');
  }

  // Update user status
  user.accountStatus = status;

  await user.save();

  logger.info('ADMIN_AUDIT: User status updated', {
    action: 'USER_STATUS_UPDATED',
    userId: user._id,
    userEmail: user.email,
    previousStatus: user.accountStatus,
    newStatus: status,
    adminId: (req.user as any)?._id
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
  if ((user._id as any).toString() === (req.user as any)._id.toString()) {
    throw new ApiError(400, 'Cannot delete your own account');
  }

  // If user is a provider, also delete provider profile and services (with tenant filter)
  if (user.role === 'provider') {
    const profileQuery: any = { userId: user._id };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      profileQuery.tenantId = tenantContext.tenantId;
    }
    await ProviderProfile.findOneAndDelete(profileQuery);
    const serviceQuery: any = { providerId: user._id };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      serviceQuery.tenantId = tenantContext.tenantId;
    }
    await Service.deleteMany(serviceQuery);
  }

  await User.findOneAndDelete(query);

  logger.info('ADMIN_AUDIT: User account deleted', {
    action: 'USER_DELETED',
    userId: user._id,
    userEmail: user.email,
    userRole: user.role,
    reason: reason || 'No reason provided',
    adminId: (req.user as any)?._id
  });

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
    query['verificationStatus.overall'] = status;
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
  const providers = await ProviderProfile.find(query)
    .populate('userId', 'firstName lastName email accountStatus')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Get services for each paginated provider
  const providersWithServices = await Promise.all(
    providers.map(async (provider: any) => {
      const serviceQuery: any = { providerId: provider.userId._id };
      if (!tenantContext.isAdmin && tenantContext.tenantId) {
        serviceQuery.tenantId = tenantContext.tenantId;
      }
      const services = await Service.find(serviceQuery)
        .select('name category price status createdAt rating isActive')
        .sort({ createdAt: -1 })
        .lean();

      return {
        ...provider,
        services: services || []
      };
    })
  );

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

  const result = await Service.updateMany(
    query,
    {
      status: newStatus,
      isActive: action === 'approve',
      updatedBy: (req.user as any)._id,
      updatedAt: new Date()
    }
  );

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

  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
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
    // Active (approved) providers
    ProviderProfile.countDocuments({ ...baseQuery, 'verificationStatus.overall': 'approved' }),
    // Today's bookings (created today)
    Booking.countDocuments({
      ...baseQuery,
      createdAt: { $gte: today, $lt: tomorrow }
    }),
    // Pending provider verifications
    ProviderProfile.countDocuments({ ...baseQuery, 'verificationStatus.overall': 'pending' }),
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
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

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
  const { name, description, icon, color, imageUrl, subcategories, isActive, isFeatured, sortOrder } = req.body;
  const adminUser = req.user as any;

  // Check if category with same name or slug exists (scoped to tenant)
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
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

  // If name is being updated, regenerate slug
  if (updates.name && updates.name !== category.name) {
    updates.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    // Check if new slug conflicts (scoped to tenant)
    const existingQuery: any = { slug: updates.slug, _id: { $ne: id } };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      existingQuery.tenantId = tenantContext.tenantId;
    }
    const existing = await ServiceCategory.findOne(existingQuery);
    if (existing) {
      throw new ApiError(400, 'Category with this name already exists');
    }
  }

  // Update fields
  Object.keys(updates).forEach(key => {
    (category as any)[key] = updates[key];
  });
  category.updatedBy = adminUser._id;

  await category.save();

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
  const { name, description, icon, color, imageUrl } = req.body;
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

  const slug = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

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
    sortOrder: maxSortOrder + 1
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

  // Build query for pending reviews or high report count
  const query: any = {
    $or: [
      { moderationStatus: 'pending' },
      { reportCount: { $gte: 3 } }
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
    .sort({ reportCount: -1, createdAt: -1 })
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
 * Get reviews with reports/flags
 * GET /api/admin/reviews/flagged
 */
export const getFlaggedReviews = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context
  const tenantContext: TenantContext = getTenantContext(req);

  // Enforce hard limits on pagination params
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));

  const { minReports, search } = req.query;

  // Build query for flagged reviews
  const query: any = {
    reportCount: { $gt: 0 }
  };

  if (minReports) {
    query.reportCount = { $gte: parseInt(minReports as string) };
  }

  if (search && typeof search === 'string') {
    query.$or = [
      { comment: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } }
    ];
  }

  const reviews = await Review.find(query)
    .populate('reviewerId', 'firstName lastName email avatar')
    .populate('revieweeId', 'firstName lastName email businessInfo.businessName')
    .sort({ reportCount: -1, createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Review.countDocuments(query);

  // Get report breakdown stats
  const stats = await Review.aggregate([
    { $match: { reportCount: { $gt: 0 } } },
    {
      $group: {
        _id: null,
        totalFlagged: { $sum: 1 },
        totalReports: { $sum: '$reportCount' },
        avgReports: { $avg: '$reportCount' },
        highPriority: { $sum: { $cond: [{ $gte: ['$reportCount', 5] }, 1, 0] } }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      reviews,
      stats: stats[0] || { totalFlagged: 0, totalReports: 0, avgReports: 0, highPriority: 0 },
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

  // Validate action
  const validActions = ['approve', 'reject', 'hide', 'delete'];
  if (!validActions.includes(action)) {
    throw new ApiError(400, `Invalid action. Must be one of: ${validActions.join(', ')}`);
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
  switch (action) {
    case 'approve':
      review.moderationStatus = 'approved';
      review.isHidden = false;
      review.moderationReason = reason || null;
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
      await Review.findByIdAndDelete(id);

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

  // Update moderation metadata
  review.moderatedAt = new Date();
  review.moderatedBy = adminUser._id;

  await review.save();

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

  // Notify provider if rejected (for visibility issues)
  if (action === 'reject' || action === 'hide') {
    const revieweeId = (review.revieweeId as any)?._id;
    if (revieweeId) {
      try {
        const notificationService = new NotificationService();
        await notificationService.createNotification({
          recipientId: revieweeId.toString(),
          type: 'system' as any, // review_moderation mapped to system type
          title: 'Review Moderation Notice',
          message: action === 'reject'
            ? 'One of your reviews has been rejected due to policy violations.'
            : 'One of your received reviews has been hidden by our moderation team.',
          actionText: 'View Details',
          actionUrl: `/provider/reviews`,
          metadata: { reviewId: id, action }
        });
      } catch (notifError) {
        logger.error('Failed to create moderation notification', {
          reviewId: id,
          error: notifError instanceof Error ? notifError.message : String(notifError)
        });
      }
    }
  }

  res.json({
    success: true,
    message: `Review ${action}d successfully`,
    data: { review }
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

  const [total, pending, approved, rejected, hidden, flagged] = await Promise.all([
    Review.countDocuments(baseQuery),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'pending' }),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'approved' }),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'rejected' }),
    Review.countDocuments({ ...baseQuery, moderationStatus: 'hidden' }),
    Review.countDocuments({ ...baseQuery, reportCount: { $gt: 0 } }),
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

  res.json({
    success: true,
    data: {
      total,
      pending,
      approved,
      rejected,
      hidden,
      flagged,
      rating: ratingStats[0] ? {
        average: Math.round((ratingStats[0].avgRating || 0) * 10) / 10,
        distribution: {
          5: ratingStats[0].rating5,
          4: ratingStats[0].rating4,
          3: ratingStats[0].rating3,
          2: ratingStats[0].rating2,
          1: ratingStats[0].rating1,
        }
      } : {
        average: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      }
    }
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
      query.reportCount = { $gt: 0 };
    } else {
      query.moderationStatus = status;
    }
  }

  // Search by review content
  if (search && typeof search === 'string') {
    query.$or = [
      { comment: { $regex: search, $options: 'i' } },
      { title: { $regex: search, $options: 'i' } }
    ];
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
  sortOptions[sortBy as string] = order === 'desc' ? -1 : 1;

  const reviews = await Review.find(query)
    .populate('reviewerId', 'firstName lastName email avatar')
    .populate('revieweeId', 'firstName lastName email businessInfo.businessName')
    .populate('bookingId', 'bookingNumber scheduledDate serviceId')
    .sort(sortOptions)
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

  // Filter by status
  if (status && typeof status === 'string') {
    query['transactions.referenceType'] = 'payout';
    query['transactions.status'] = status;
  } else {
    // Default: show pending withdrawals
    query['transactions.referenceType'] = 'payout';
    query['transactions.status'] = 'pending';
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
        'transactions.status': status ? status : 'pending',
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
        _id: 1,
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
    const status = stat._id as keyof typeof result;
    if (status in result) {
      (result as any)[status] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    }
    if (status === 'completed' || status === 'processing') {
      result.totalProcessedAmount += stat.totalAmount;
    }
    if (status === 'pending' || status === 'processing') {
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

  if (transaction.status !== 'pending') {
    throw new ApiError(400, `Cannot approve withdrawal with status: ${transaction.status}`);
  }

  // Start a MongoDB session for atomic operation
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
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
      },
      { session }
    );

    await session.commitTransaction();

    // Get user info for notifications
    const user = await User.findById(wallet.userId);

    // Process Stripe payout (simulated for now)
    logger.info('Processing withdrawal approval', {
      withdrawalId: id,
      walletId,
      transactionId,
      amount: transaction.amount,
      providerId: wallet.userId.toString(),
      action: 'WITHDRAWAL_APPROVED',
    });

    // Emit socket event to provider
    const socketServer = getSocketServer();
    if (socketServer && user) {
      socketServer.emitToUser(wallet.userId.toString(), 'notification:new', {
        id: `wd-approve-${Date.now()}`,
        type: 'system' as const,
        title: 'Withdrawal Approved',
        message: `Your withdrawal request for ${transaction.amount} ${wallet.currency} has been approved and is being processed.`,
        timestamp: new Date(),
        read: false,
      });

      // Emit withdrawal specific event
      (socketServer as any).emitToUser?.(wallet.userId.toString(), 'withdrawal:approved', {
        withdrawalId: id,
        amount: transaction.amount,
        currency: wallet.currency,
        status: 'processing',
        processedAt: new Date().toISOString(),
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
        status: 'processing',
        amount: transaction.amount,
        currency: wallet.currency,
        newBalance: wallet.balance - transaction.amount,
        estimatedCompletion: '2-3 business days',
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    throw new ApiError(500, `Failed to approve withdrawal: ${error.message}`);
  } finally {
    session.endSession();
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

    // Emit socket event to provider
    const socketServer = getSocketServer();
    if (socketServer && user) {
      socketServer.emitToUser(wallet.userId.toString(), 'notification:new', {
        id: `wd-reject-${Date.now()}`,
        type: 'system' as const,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal request for ${transaction.amount} ${wallet.currency} has been rejected. Reason: ${reason}`,
        timestamp: new Date(),
        read: false,
      });

      // Emit withdrawal specific event
      (socketServer as any).emitToUser?.(wallet.userId.toString(), 'withdrawal:rejected', {
        withdrawalId: id,
        amount: transaction.amount,
        currency: wallet.currency,
        status: 'rejected',
        reason: reason,
        rejectedAt: new Date().toISOString(),
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

// Default export
export default {
  // Provider Management
  getPendingProviders,
  getProviderForVerification,
  approveProvider,
  rejectProvider,
  getVerificationStats,
  createTestProvider,
  // Service Management
  getAllServices,
  getPendingServices,
  updateServiceStatus,
  adminDeleteService,
  getServiceStats,
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
  // Withdrawal Management
  getPendingWithdrawals,
  getWithdrawalStats,
  getWithdrawalDetails,
  approveWithdrawal,
  rejectWithdrawal,
  // Churn Management
  getChurnStats,
};
