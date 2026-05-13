import { Request, Response } from 'express';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import ServiceCategory from '../models/serviceCategory.model';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';

/**
 * Generate a random secure password
 * @returns A random password with 16 characters
 */
const generateSecurePassword = (): string => {
  const length = 16;
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*';
  const allChars = lowercase + uppercase + numbers + special;

  let password = '';
  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

/**
 * Get all pending providers for verification
 * GET /api/admin/providers/pending
 */
export const getPendingProviders = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  
  const query: any = { 'verificationStatus.overall': 'pending' };
  
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
  const { id } = req.params;

  const provider = await ProviderProfile.findById(id)
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
  const { id } = req.params;
  const { notes } = req.body;
  const adminUser = req.user as any;

  const provider = await ProviderProfile.findById(id).populate('userId', 'email');

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  if (provider.verificationStatus.overall === 'approved') {
    throw new ApiError(400, 'Provider is already approved');
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
    console.log(`Creating ${provider.services.length} service documents for ${provider.businessInfo.businessName}`);
    
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
          console.log(`✅ Created service: ${service.name} (${service.category})`);
        } else {
          console.log(`⚠️ Service already exists: ${service.name}`);
        }
      } catch (serviceError) {
        console.error(`Error creating service ${service.name}:`, serviceError);
        // Continue with other services even if one fails
      }
    }
  }

  // TODO: Send approval email
  console.log('Provider approved:', provider.businessInfo.businessName);

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
  const { id } = req.params;
  const { reason, notes } = req.body;
  const adminUser = req.user as any;

  if (!reason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const provider = await ProviderProfile.findById(id).populate('userId', 'email');

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
  }

  // TODO: Send rejection email
  console.log('Provider rejected:', provider.businessInfo.businessName, 'Reason:', reason);

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
export const getVerificationStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await Promise.all([
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'approved' }),
    ProviderProfile.countDocuments({ 'verificationStatus.overall': 'rejected' }),
    ProviderProfile.countDocuments(),
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
 */
export const getAllServices = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    status,
    provider,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query: any = {};

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
 */
export const getPendingServices = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const services = await Service.find({ status: 'pending_review' })
    .populate('providerId', 'firstName lastName email businessInfo.businessName')
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await Service.countDocuments({ status: 'pending_review' });

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
  const { id } = req.params;
  const { status, reason, notes } = req.body;

  // Validate status - FIX: Added 'rejected' to valid statuses
  const validStatuses = ['active', 'inactive', 'pending_review', 'draft', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const service = await Service.findById(id)
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

  console.log(`Service ${service.name} status updated to ${status} by admin`);

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
  const { id } = req.params;
  const { reason } = req.body;

  const service = await Service.findById(id);

  if (!service) {
    throw new ApiError(404, 'Service not found');
  }

  await Service.findByIdAndDelete(id);

  console.log(`Service ${service.name} deleted by admin. Reason: ${reason || 'No reason provided'}`);

  res.json({
    success: true,
    message: 'Service deleted successfully'
  });
});

/**
 * Get service analytics and statistics for admin
 * GET /api/admin/services/stats
 */
export const getServiceStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await Promise.all([
    Service.countDocuments(),
    Service.countDocuments({ status: 'active' }),
    Service.countDocuments({ status: 'inactive' }),
    Service.countDocuments({ status: 'pending_review' }),
    Service.countDocuments({ status: 'draft' }),
  ]);

  const [total, active, inactive, pendingReview, draft] = stats;

  // Category distribution
  const categoryStats = await Service.aggregate([
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPrice: { $avg: '$price.amount' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  // Recent activity
  const recentServices = await Service.find()
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
 */
export const getAllUsers = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    search,
    role,
    status,
    sortBy = 'createdAt',
    order = 'desc'
  } = req.query;

  // Build query
  const query: any = {};

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
  const { id } = req.params;
  const { status } = req.body;

  // Validate status
  const validStatuses = ['active', 'suspended', 'banned', 'pending_verification'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const user = await User.findById(id);

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

  console.log(`User ${user.email} status updated to ${status} by admin`);

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
  const { id } = req.params;
  const { reason } = req.body;

  const user = await User.findById(id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Prevent admin from deleting their own account
  if ((user._id as any).toString() === (req.user as any)._id.toString()) {
    throw new ApiError(400, 'Cannot delete your own account');
  }

  // If user is a provider, also delete provider profile and services
  if (user.role === 'provider') {
    await ProviderProfile.findOneAndDelete({ userId: user._id });
    await Service.deleteMany({ providerId: user._id });
  }

  await User.findByIdAndDelete(id);

  console.log(`User ${user.email} deleted by admin. Reason: ${reason || 'No reason provided'}`);

  res.json({
    success: true,
    message: 'User account deleted successfully'
  });
});

/**
 * Get user statistics for admin dashboard
 * GET /api/admin/users/stats
 */
export const getUserStats = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ role: 'customer' }),
    User.countDocuments({ role: 'provider' }),
    User.countDocuments({ role: 'admin' }),
    User.countDocuments({ accountStatus: 'active' }),
    User.countDocuments({ accountStatus: 'suspended' }),
    User.countDocuments({ accountStatus: 'banned' }),
  ]);

  const [total, customers, providers, admins, active, suspended, banned] = stats;

  // Recent registrations
  const recentUsers = await User.find()
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
 */
export const getProvidersWithServices = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, status, search } = req.query;

  const query: any = {};
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

  const providers = await ProviderProfile.find(query)
    .populate('userId', 'firstName lastName email accountStatus')
    .sort({ createdAt: -1 })
    .lean();

  // Get services for each provider
  const providersWithServices = await Promise.all(
    providers.map(async (provider: any) => {
      const services = await Service.find({ providerId: provider.userId._id })
        .select('name category price status createdAt rating isActive')
        .sort({ createdAt: -1 })
        .lean();

      return {
        ...provider,
        services: services || []
      };
    })
  );

  // Apply pagination
  const skip = (Number(page) - 1) * Number(limit);
  const paginatedProviders = providersWithServices.slice(skip, skip + Number(limit));

  res.json({
    success: true,
    data: {
      providers: paginatedProviders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: providersWithServices.length,
        pages: Math.ceil(providersWithServices.length / Number(limit))
      }
    }
  });
});


/**
 * Batch approve/reject services
 * POST /api/admin/services/batch-action
 */
export const batchServiceAction = asyncHandler(async (req: Request, res: Response) => {
  const { serviceIds, action } = req.body; // action: 'approve' | 'reject'

  if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
    throw new ApiError(400, 'Service IDs array is required');
  }

  if (!['approve', 'reject'].includes(action)) {
    throw new ApiError(400, 'Invalid action. Must be "approve" or "reject"');
  }

  const Service = require('../models/service.model').default;
  const newStatus = action === 'approve' ? 'active' : 'rejected';

  const result = await Service.updateMany(
    { _id: { $in: serviceIds }, status: 'pending_review' },
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
  const { id } = req.params;

  const ProviderProfile = require('../models/providerProfile.model').default;
  const Service = require('../models/service.model').default;

  const provider = await ProviderProfile.findById(id)
    .populate('userId', 'firstName lastName email accountStatus')
    .lean();

  if (!provider) {
    throw new ApiError(404, 'Provider not found');
  }

  const services = await Service.find({ providerId: provider.userId._id })
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
 */
export const getAllBookings = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
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
  const { id } = req.params;

  const booking = await Booking.findById(id)
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
  const { id } = req.params;
  const { status, reason, notes } = req.body;
  const adminUser = req.user as any;

  const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const booking = await Booking.findById(id);

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

  // Audit logging
  logger.info('ADMIN_AUDIT: Booking status updated', {
    action: 'BOOKING_STATUS_UPDATED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    bookingId: id,
    bookingNumber: booking.bookingNumber,
    previousStatus,
    newStatus: status,
    reason,
    timestamp: new Date().toISOString()
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
export const getBookingStats = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [stats, todayCount, weekCount, monthCount, revenueStats] = await Promise.all([
    Booking.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    Booking.countDocuments({ scheduledDate: { $gte: startOfToday } }),
    Booking.countDocuments({ scheduledDate: { $gte: startOfWeek } }),
    Booking.countDocuments({ scheduledDate: { $gte: startOfMonth } }),
    Booking.aggregate([
      { $match: { status: 'completed' } },
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
  const { id } = req.params;
  const { reason, refundAmount } = req.body;
  const adminUser = req.user as any;

  const booking = await Booking.findById(id);

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

  // Audit logging
  logger.info('ADMIN_AUDIT: Booking cancelled', {
    action: 'BOOKING_CANCELLED',
    adminId: adminUser._id,
    adminEmail: adminUser.email,
    bookingId: id,
    bookingNumber: booking.bookingNumber,
    reason,
    refundAmount: refundAmount || 0,
    timestamp: new Date().toISOString()
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

/**
 * Get all service categories for admin
 * GET /api/admin/categories
 */
export const getAllCategories = asyncHandler(async (req: Request, res: Response) => {
  const {
    page = 1,
    limit = 20,
    search,
    isActive,
    isFeatured,
    sortBy = 'sortOrder',
    order = 'asc'
  } = req.query;

  // Build query
  const query: any = {};

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
  const { id } = req.params;

  const category = await ServiceCategory.findById(id);

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
  const { name, description, icon, color, imageUrl, subcategories, isActive, isFeatured, sortOrder } = req.body;
  const adminUser = req.user as any;

  // Check if category with same name or slug exists
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
  const existing = await ServiceCategory.findOne({
    $or: [{ name }, { slug }]
  });

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
    updatedBy: adminUser._id
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
  const { id } = req.params;
  const updates = req.body;
  const adminUser = req.user as any;

  const category = await ServiceCategory.findById(id);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // If name is being updated, regenerate slug
  if (updates.name && updates.name !== category.name) {
    updates.slug = updates.name.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');

    // Check if new slug conflicts
    const existing = await ServiceCategory.findOne({ slug: updates.slug, _id: { $ne: id } });
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
  const { id } = req.params;
  const { reason } = req.body;
  const adminUser = req.user as any;

  const category = await ServiceCategory.findById(id);

  if (!category) {
    throw new ApiError(404, 'Category not found');
  }

  // Check if category has active services
  const serviceCount = await Service.countDocuments({ category: category.name });
  if (serviceCount > 0) {
    throw new ApiError(400, `Cannot delete category with ${serviceCount} active services. Remove or reassign services first.`);
  }

  await ServiceCategory.findByIdAndDelete(id);

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
  const { id } = req.params;
  const adminUser = req.user as any;

  const category = await ServiceCategory.findById(id);

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
  const { id } = req.params;
  const { name, description, icon, color, imageUrl } = req.body;
  const adminUser = req.user as any;

  const category = await ServiceCategory.findById(id);

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