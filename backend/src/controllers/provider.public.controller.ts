import { Request, Response } from 'express';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import ServiceCategory from '../models/serviceCategory.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ===================================
// PUBLIC PROVIDER ENDPOINTS
// These endpoints are accessible without authentication
// ===================================

/**
 * Get provider by ID (public endpoint)
 * GET /api/providers/:id
 * Returns full provider profile with services from Service collection
 */
export const getProviderById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    // Get provider profile
    const providerProfile = await ProviderProfile.findOne({
      userId: id,
      isActive: true,
      isDeleted: false
    }).lean();

    if (!providerProfile) {
      throw new ApiError(404, 'Provider not found');
    }

    // Get user info
    const user = await User.findById(id).select('firstName lastName email phone').lean();

    if (!user) {
      throw new ApiError(404, 'Provider user not found');
    }

    // Get provider's ACTIVE services from Service collection (not embedded)
    const services = await Service.find({
      providerId: id,
      isActive: true,
      status: 'active'
    }).lean();

    // Format response for frontend
    const provider = {
      id: providerProfile.userId,

      // Basic Info
      firstName: user.firstName,
      lastName: user.lastName,
      businessName: providerProfile.businessInfo?.businessName || `${user.firstName} ${user.lastName}`,
      businessType: providerProfile.businessInfo?.businessType || 'individual',
      tagline: providerProfile.businessInfo?.tagline || '',
      description: providerProfile.businessInfo?.description || '',

      // Profile Images
      profilePhoto: providerProfile.instagramStyleProfile?.profilePhoto || '',
      coverPhoto: providerProfile.instagramStyleProfile?.coverPhoto || '',

      // Verification
      isVerified: providerProfile.instagramStyleProfile?.isVerified || providerProfile.verificationStatus?.overall === 'approved',
      verificationBadges: providerProfile.instagramStyleProfile?.verificationBadges?.map((badge: any) => ({
        type: badge.type,
        verifiedAt: badge.verifiedAt,
      })) || [],

      // Bio & Social
      bio: providerProfile.instagramStyleProfile?.bio || '',
      followersCount: providerProfile.instagramStyleProfile?.followersCount || 0,

      // Contact info (based on privacy settings)
      contact: {
        email: providerProfile.settings?.privacySettings?.showEmail ? user.email : null,
        phone: providerProfile.settings?.privacySettings?.showPhoneNumber ? user.phone : null,
        website: providerProfile.businessInfo?.website || null,
      },

      // Location info
      location: providerProfile.locationInfo?.primaryAddress ? {
        city: providerProfile.locationInfo.primaryAddress.city,
        state: providerProfile.locationInfo.primaryAddress.state,
        country: providerProfile.locationInfo.primaryAddress.country,
        serviceRadius: providerProfile.businessInfo?.serviceRadius || 25,
      } : null,

      // Services from Service collection
      services: services.map((service: any) => ({
        _id: service._id,
        name: service.name,
        category: service.category,
        subcategory: service.subcategory,
        description: service.description,
        shortDescription: service.shortDescription,
        duration: service.duration,
        price: {
          amount: service.price?.amount || 0,
          currency: service.price?.currency || 'AED',
          type: service.price?.type || 'fixed',
        },
        images: service.images || [],
        isPopular: service.isPopular || false,
        isFeatured: service.isFeatured || false,
        tags: service.tags || [],
        rating: {
          average: service.rating?.average || 0,
          count: service.rating?.count || 0,
        },
      })),

      // Reviews
      reviewsData: {
        averageRating: providerProfile.reviewsData?.averageRating || 0,
        totalReviews: providerProfile.reviewsData?.totalReviews || 0,
        ratingDistribution: providerProfile.reviewsData?.ratingDistribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        recentReviews: (providerProfile.reviewsData?.recentReviews || []).slice(0, 10).map((review: any) => ({
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          photos: review.photos,
          isVerified: review.isVerified,
          createdAt: review.createdAt,
          response: review.response,
        })),
        responseRate: providerProfile.reviewsData?.responseRate || 0,
      },

      // Portfolio
      portfolio: {
        featured: (providerProfile.portfolio?.featured || [])
          .filter((p: any) => p.isVisible !== false)
          .map((item: any) => ({
            _id: item._id,
            title: item.title,
            description: item.description,
            category: item.category,
            images: item.images,
            tags: item.tags,
            clientTestimonial: item.clientTestimonial,
            createdAt: item.createdAt,
          })),
        certifications: (providerProfile.portfolio?.certifications || []).map((cert: any) => ({
          name: cert.name,
          issuingOrganization: cert.issuingOrganization,
          issueDate: cert.issueDate,
          expiryDate: cert.expiryDate,
          isVerified: cert.isVerified,
        })),
        awards: providerProfile.portfolio?.awards || [],
      },

      // Availability
      availability: {
        schedule: providerProfile.availability?.schedule || {},
        instantBooking: providerProfile.businessInfo?.instantBooking || false,
        advanceBookingDays: providerProfile.businessInfo?.advanceBookingDays || 30,
        minNoticeTime: providerProfile.availability?.minNoticeTime || 24,
      },

      // Business hours
      businessHours: providerProfile.businessInfo?.businessHours || {},

      // Performance metrics (computed from actual bookings)
      stats: await (async () => {
        try {
          const bookings = await Booking.find({ providerId: id }).select('status customerId pricing').lean();
          const total = bookings.length;
          const completed = bookings.filter(b => b.status === 'completed').length;
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

          const customerIds = bookings.filter(b => b.customerId).map(b => b.customerId?.toString());
          const uniqueCustomers = new Set(customerIds).size;
          const repeatCustomers = customerIds.length - uniqueCustomers;
          const repeatCustomerRate = uniqueCustomers > 0 ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;

          return {
            completionRate,
            responseTime: providerProfile.analytics?.performanceMetrics?.responseTime || 0,
            totalBookings: total,
            repeatCustomerRate,
          };
        } catch {
          return { completionRate: 0, responseTime: 0, totalBookings: 0, repeatCustomerRate: 0 };
        }
      })(),

      // Active promotions
      promotions: (providerProfile.marketing?.promotions || [])
        .filter((p: any) => p.isActive && new Date(p.validTo) > new Date())
        .map((promo: any) => ({
          title: promo.title,
          description: promo.description,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          validFrom: promo.validFrom,
          validTo: promo.validTo,
        })),

      // Specializations from services
      specializations: [...new Set(services.map((s: any) => s.category).filter(Boolean))],

      // Timestamps
      establishedDate: providerProfile.businessInfo?.establishedDate,
      memberSince: providerProfile.createdAt,
    };

    res.json({
      success: true,
      data: { provider }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    console.error('Error getting provider by ID:', error);
    throw new ApiError(500, 'Failed to get provider details', error.message);
  }
});

/**
 * Get providers by category slug
 * GET /api/providers/category/:slug
 */
export const getProvidersByCategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { slug } = req.params;
  const {
    page = 1,
    limit = 20,
    sortBy = 'rating',
    minRating
  } = req.query;

  try {
    // Get the category to get the proper name
    const category = await ServiceCategory.findOne({
      slug,
      isActive: true
    }).lean();

    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    // Find services in this category to get provider IDs
    const servicesInCategory = await Service.find({
      category: { $regex: new RegExp(`^${category.name}$`, 'i') },
      isActive: true,
      status: 'active'
    }).lean();

    // Get unique provider IDs
    const providerIds = [...new Set(servicesInCategory.map((s: any) => s.providerId))];

    if (providerIds.length === 0) {
      res.json({
        success: true,
        data: {
          category: {
            _id: category._id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            icon: category.icon,
            color: category.color,
          },
          providers: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false,
          }
        }
      });
      return;
    }

    // Build query for provider profiles
    const query: any = {
      userId: { $in: providerIds },
      isActive: true,
      isDeleted: false
    };

    // Filter by minimum rating
    if (minRating) {
      query['reviewsData.averageRating'] = { $gte: Number(minRating) };
    }

    // Build sort object
    let sort: any = {};
    switch (sortBy) {
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'popularity':
        sort['instagramStyleProfile.followersCount'] = -1;
        break;
      case 'rating':
      default:
        sort['reviewsData.averageRating'] = -1;
        sort['reviewsData.totalReviews'] = -1;
        break;
    }

    // Execute query with pagination
    const skip = (Number(page) - 1) * Number(limit);

    const [providers, totalCount] = await Promise.all([
      ProviderProfile.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ProviderProfile.countDocuments(query)
    ]);

    // Get user info for all providers
    const userIds = providers.map((p: any) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // Format providers for frontend (simplified card view)
    const formattedProviders = providers.map((provider: any) => {
      const user = userMap.get(provider.userId.toString());

      // Get services for this category from this provider
      const categoryServices = servicesInCategory.filter(
        (s: any) => s.providerId.toString() === provider.userId.toString()
      );

      return {
        id: provider.userId,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        businessName: provider.businessInfo?.businessName || `${user?.firstName || ''} ${user?.lastName || ''}`,
        tagline: provider.businessInfo?.tagline || '',
        profilePhoto: provider.instagramStyleProfile?.profilePhoto || '',
        isVerified: provider.instagramStyleProfile?.isVerified || provider.verificationStatus?.overall === 'approved',
        location: provider.locationInfo?.primaryAddress ? {
          city: provider.locationInfo.primaryAddress.city,
          state: provider.locationInfo.primaryAddress.state,
        } : null,
        rating: provider.reviewsData?.averageRating || 0,
        reviewCount: provider.reviewsData?.totalReviews || 0,
        startingPrice: categoryServices.length > 0
          ? Math.min(...categoryServices.map((s: any) => s.price?.amount || 0))
          : null,
        servicesCount: categoryServices.length,
        // Include services relevant to this category
        services: categoryServices.slice(0, 3).map((s: any) => ({
          _id: s._id,
          name: s.name,
          subcategory: s.subcategory,
          price: s.price?.amount || 0,
          duration: s.duration,
        })),
        completionRate: provider.analytics?.performanceMetrics?.completionRate || 0,
      };
    });

    res.json({
      success: true,
      data: {
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          icon: category.icon,
          color: category.color,
        },
        providers: formattedProviders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit)),
          hasNext: Number(page) < Math.ceil(totalCount / Number(limit)),
          hasPrev: Number(page) > 1,
        }
      }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    console.error('Error getting providers by category:', error);
    throw new ApiError(500, 'Failed to get providers by category', error.message);
  }
});

/**
 * Get providers by subcategory
 * GET /api/providers/subcategory/:categorySlug/:subcategorySlug
 */
export const getProvidersBySubcategory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { categorySlug, subcategorySlug } = req.params;
  const {
    page = 1,
    limit = 20,
    sortBy = 'rating'
  } = req.query;

  try {
    // Get the category
    const category = await ServiceCategory.findOne({
      slug: categorySlug,
      isActive: true
    }).lean();

    if (!category) {
      throw new ApiError(404, 'Category not found');
    }

    // Find the subcategory
    const subcategory = (category.subcategories || []).find(
      (sub: any) => sub.slug === subcategorySlug && sub.isActive !== false
    );

    if (!subcategory) {
      throw new ApiError(404, 'Subcategory not found');
    }

    // Find services in this subcategory
    const servicesInSubcategory = await Service.find({
      category: { $regex: new RegExp(`^${category.name}$`, 'i') },
      subcategory: { $regex: new RegExp(`^${subcategory.name}$`, 'i') },
      isActive: true,
      status: 'active'
    }).lean();

    // Get unique provider IDs
    const providerIds = [...new Set(servicesInSubcategory.map((s: any) => s.providerId))];

    if (providerIds.length === 0) {
      res.json({
        success: true,
        data: {
          category: {
            _id: category._id,
            name: category.name,
            slug: category.slug,
          },
          subcategory: {
            name: subcategory.name,
            slug: subcategory.slug,
            description: subcategory.description,
            icon: subcategory.icon,
          },
          providers: [],
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false,
          }
        }
      });
      return;
    }

    // Build query
    const query: any = {
      userId: { $in: providerIds },
      isActive: true,
      isDeleted: false
    };

    // Build sort
    let sort: any = {};
    switch (sortBy) {
      case 'price':
        // Will sort after fetching since price is in services
        sort['reviewsData.averageRating'] = -1;
        break;
      case 'rating':
      default:
        sort['reviewsData.averageRating'] = -1;
        sort['reviewsData.totalReviews'] = -1;
        break;
    }

    // Execute query
    const skip = (Number(page) - 1) * Number(limit);

    const [providers, totalCount] = await Promise.all([
      ProviderProfile.find(query)
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      ProviderProfile.countDocuments(query)
    ]);

    // Get user info
    const userIds = providers.map((p: any) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // Format providers
    const formattedProviders = providers.map((provider: any) => {
      const user = userMap.get(provider.userId.toString());

      // Get services for this subcategory from this provider
      const subcategoryServices = servicesInSubcategory.filter(
        (s: any) => s.providerId.toString() === provider.userId.toString()
      );

      return {
        id: provider.userId,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        businessName: provider.businessInfo?.businessName || `${user?.firstName || ''} ${user?.lastName || ''}`,
        tagline: provider.businessInfo?.tagline || '',
        profilePhoto: provider.instagramStyleProfile?.profilePhoto || '',
        isVerified: provider.instagramStyleProfile?.isVerified || provider.verificationStatus?.overall === 'approved',
        location: provider.locationInfo?.primaryAddress ? {
          city: provider.locationInfo.primaryAddress.city,
          state: provider.locationInfo.primaryAddress.state,
        } : null,
        rating: provider.reviewsData?.averageRating || 0,
        reviewCount: provider.reviewsData?.totalReviews || 0,
        startingPrice: subcategoryServices.length > 0
          ? Math.min(...subcategoryServices.map((s: any) => s.price?.amount || 0))
          : null,
        servicesCount: subcategoryServices.length,
        services: subcategoryServices.slice(0, 3).map((s: any) => ({
          _id: s._id,
          name: s.name,
          price: s.price?.amount || 0,
          duration: s.duration,
        })),
        completionRate: provider.analytics?.performanceMetrics?.completionRate || 0,
      };
    });

    // Sort by price if requested
    if (sortBy === 'price') {
      formattedProviders.sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0));
    }

    res.json({
      success: true,
      data: {
        category: {
          _id: category._id,
          name: category.name,
          slug: category.slug,
        },
        subcategory: {
          name: subcategory.name,
          slug: subcategory.slug,
          description: subcategory.description,
          icon: subcategory.icon,
        },
        providers: formattedProviders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / Number(limit)),
          hasNext: Number(page) < Math.ceil(totalCount / Number(limit)),
          hasPrev: Number(page) > 1,
        }
      }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    console.error('Error getting providers by subcategory:', error);
    throw new ApiError(500, 'Failed to get providers by subcategory', error.message);
  }
});

/**
 * Get featured providers
 * GET /api/providers/featured
 */
export const getFeaturedProviders = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { limit = 10 } = req.query;

  try {
    // Get providers with good ratings
    const providers = await ProviderProfile.find({
      isActive: true,
      isDeleted: false,
      'reviewsData.totalReviews': { $gte: 1 },
      'reviewsData.averageRating': { $gte: 3.5 }
    })
    .sort({
      'reviewsData.averageRating': -1,
      'reviewsData.totalReviews': -1,
      'instagramStyleProfile.followersCount': -1
    })
    .limit(Number(limit))
    .lean();

    // Get user info
    const userIds = providers.map((p: any) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));

    // Get services for each provider
    const providerServices = await Service.find({
      providerId: { $in: userIds },
      isActive: true,
      status: 'active'
    }).lean();

    const servicesByProvider = new Map();
    providerServices.forEach((s: any) => {
      const pid = s.providerId.toString();
      if (!servicesByProvider.has(pid)) {
        servicesByProvider.set(pid, []);
      }
      servicesByProvider.get(pid).push(s);
    });

    const formattedProviders = providers.map((provider: any) => {
      const user = userMap.get(provider.userId.toString());
      const services = servicesByProvider.get(provider.userId.toString()) || [];

      return {
        id: provider.userId,
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        businessName: provider.businessInfo?.businessName || `${user?.firstName || ''} ${user?.lastName || ''}`,
        tagline: provider.businessInfo?.tagline || '',
        profilePhoto: provider.instagramStyleProfile?.profilePhoto || '',
        coverPhoto: provider.instagramStyleProfile?.coverPhoto || '',
        isVerified: provider.instagramStyleProfile?.isVerified || provider.verificationStatus?.overall === 'approved',
        location: provider.locationInfo?.primaryAddress ? {
          city: provider.locationInfo.primaryAddress.city,
          state: provider.locationInfo.primaryAddress.state,
        } : null,
        rating: provider.reviewsData?.averageRating || 0,
        reviewCount: provider.reviewsData?.totalReviews || 0,
        specializations: [...new Set(services.slice(0, 3).map((s: any) => s.category))],
        servicesCount: services.length,
      };
    });

    res.json({
      success: true,
      data: { providers: formattedProviders }
    });
  } catch (error: any) {
    console.error('Error getting featured providers:', error);
    throw new ApiError(500, 'Failed to get featured providers', error.message);
  }
});

export default {
  getProviderById,
  getProvidersByCategory,
  getProvidersBySubcategory,
  getFeaturedProviders
};
