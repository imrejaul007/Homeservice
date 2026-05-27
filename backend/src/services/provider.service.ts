import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import { ApiError } from '../utils/ApiError';
import { Request } from 'express';
import { addTenantFilter, getTenantId, getTenantIdOptional, isAdminOrSystem, addTenantToAggregation } from '../utils/tenantFilter';

// ============================================
// Types
// ============================================

export interface ProviderServiceInput {
  name: string;
  category: string;
  subcategory?: string;
  description?: string;
  duration: number;
  price: {
    amount: number;
    currency?: string;
    type?: string;
  };
  tags?: string[];
}

export interface UpdateServiceInput extends Partial<ProviderServiceInput> {
  isActive?: boolean;
}

// ============================================
// ProviderService Class
// ============================================

export class ProviderService {
  // ========================================
  // Profile Management
  // ========================================

  async getProviderProfile(providerId: string, req?: Request): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    // Build query with tenant isolation
    const query = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(query).populate('userId', 'firstName lastName email phone avatar');

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    return profile;
  }

  async updateProviderProfile(providerId: string, updates: any, req?: Request): Promise<any> {
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    // Build query with tenant isolation
    const query = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(query);

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    // Update allowed fields
    const allowedUpdates = [
      'businessInfo',
      'instagramStyleProfile',
      'portfolio',
      'availability',
      'locationInfo',
      'marketing',
      'settings',
    ];

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        (profile as any)[key] = updates[key];
      }
    }

    // Recalculate completion percentage
    profile.completionPercentage = this.calculateCompletionPercentage(profile);

    await profile.save();

    return profile;
  }

  async uploadProfilePhoto(providerId: string, photoUrl: string, req?: Request): Promise<any> {
    // Build query with tenant isolation
    const query = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(query);

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    profile.instagramStyleProfile.profilePhoto = photoUrl;
    await profile.save();

    return profile;
  }

  // ========================================
  // Service Management
  // ========================================

  async getProviderServices(providerId: string, req?: Request): Promise<any[]> {
    if (!mongoose.Types.ObjectId.isValid(providerId)) {
      throw new ApiError(400, 'Invalid provider ID');
    }

    // Build query with tenant isolation
    const query = addTenantFilter({ providerId }, req || {} as Request);

    const services = await Service.find(query).sort({ createdAt: -1 });
    return services;
  }

  async createService(providerId: string, serviceData: ProviderServiceInput, req?: Request): Promise<any> {
    // Get tenant ID for service creation
    const tenantId = req ? getTenantIdOptional(req) : undefined;

    // Validate category
    const category = await ServiceCategory.findOne({
      name: { $regex: new RegExp(`^${serviceData.category}$`, 'i') },
      isActive: true,
    });

    if (!category) {
      throw new ApiError(400, `Invalid category: ${serviceData.category}`);
    }

    // Validate subcategory if provided
    if (serviceData.subcategory) {
      const validSubcategory = (category.subcategories as any[]).find(
        (sub) => sub.name.toLowerCase() === serviceData.subcategory!.toLowerCase() && sub.isActive !== false
      );

      if (!validSubcategory) {
        throw new ApiError(400, `Invalid subcategory: ${serviceData.subcategory}`);
      }
    }

    // Get provider location for service
    const providerQuery = addTenantFilter({ userId: providerId }, req || {} as Request);
    const providerProfile = await ProviderProfile.findOne(providerQuery);
    // Extract coordinates from GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
    let coordinatesArray: [number, number] = [55.2708, 25.2048]; // Default: Dubai [lng, lat]
    if (providerProfile?.locationInfo?.primaryAddress?.coordinates?.coordinates) {
      coordinatesArray = providerProfile.locationInfo.primaryAddress.coordinates.coordinates as [number, number];
    }

    const serviceDataWithTenant: any = {
      providerId,
      name: serviceData.name,
      category: category.name,
      subcategory: serviceData.subcategory || '',
      description: serviceData.description,
      shortDescription: serviceData.description?.substring(0, 100) || '',
      duration: serviceData.duration,
      price: {
        amount: serviceData.price.amount,
        currency: serviceData.price.currency || 'AED',
        type: (serviceData.price.type || 'fixed') as 'fixed' | 'hourly' | 'custom',
      },
      location: {
        coordinates: {
          type: 'Point',
          coordinates: coordinatesArray, // [longitude, latitude]
        },
      },
      tags: serviceData.tags || [],
      isActive: false, // Requires approval
      status: 'pending',
      rating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      },
      searchMetadata: {
        searchCount: 0,
        clickCount: 0,
        bookingCount: 0,
        popularityScore: 0,
        searchKeywords: [serviceData.name, serviceData.category, serviceData.subcategory].filter(Boolean),
      },
    };

    // Add tenant ID for multi-tenant isolation
    if (tenantId) {
      serviceDataWithTenant.tenantId = tenantId;
    }

    const service = new Service(serviceDataWithTenant);

    await service.save();

    // Update provider profile services array
    await ProviderProfile.findOneAndUpdate(
      { userId: providerId },
      {
        $push: {
          services: {
            name: serviceData.name,
            category: serviceData.category,
            subcategory: serviceData.subcategory,
            description: serviceData.description,
            duration: serviceData.duration,
            price: serviceData.price,
            isActive: false,
          },
        },
      }
    );

    return service;
  }

  async updateService(serviceId: string, providerId: string, updates: UpdateServiceInput, req?: Request): Promise<any> {
    // Build query with tenant isolation
    const query = addTenantFilter({ _id: serviceId, providerId }, req || {} as Request);

    const service = await Service.findOne(query);

    if (!service) {
      throw new ApiError(404, 'Service not found or unauthorized');
    }

    // Update allowed fields
    if (updates.name) service.name = updates.name;
    if (updates.description) {
      service.description = updates.description;
      service.shortDescription = updates.description.substring(0, 100);
    }
    if (updates.duration) service.duration = updates.duration;
    if (updates.price) {
      service.price = {
        ...service.price,
        ...updates.price,
      } as any;
    }
    if (updates.tags) service.tags = updates.tags;
    if (updates.isActive !== undefined) service.isActive = updates.isActive;

    await service.save();

    return service;
  }

  async deleteService(serviceId: string, providerId: string, req?: Request): Promise<void> {
    // Build query with tenant isolation
    const query = addTenantFilter({ _id: serviceId, providerId }, req || {} as Request);

    const service = await Service.findOneAndDelete(query);

    if (!service) {
      throw new ApiError(404, 'Service not found or unauthorized');
    }

    // Remove from provider profile services array
    await ProviderProfile.findOneAndUpdate(
      { userId: providerId },
      {
        $pull: {
          services: { name: service.name, category: service.category },
        },
      }
    );
  }

  async toggleServiceStatus(serviceId: string, providerId: string, req?: Request): Promise<any> {
    // Build query with tenant isolation
    const query = addTenantFilter({ _id: serviceId, providerId }, req || {} as Request);

    const service = await Service.findOne(query);

    if (!service) {
      throw new ApiError(404, 'Service not found or unauthorized');
    }

    service.isActive = !service.isActive;
    await service.save();

    // Update provider profile services array
    await ProviderProfile.findOneAndUpdate(
      { userId: providerId, 'services.name': service.name },
      { $set: { 'services.$.isActive': service.isActive } }
    );

    return service;
  }

  // ========================================
  // Analytics & Stats
  // ========================================

  async getProviderStats(providerId: string, req?: Request): Promise<any> {
    // Build query with tenant isolation
    const profileQuery = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(profileQuery);

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    const servicesQuery = addTenantFilter({ providerId, status: 'approved' }, req || {} as Request);
    const services = await Service.find(servicesQuery);
    const activeServicesCount = services.filter((s) => s.isActive).length;

    return {
      profile: {
        completionPercentage: profile.completionPercentage,
        verificationStatus: profile.verificationStatus,
        averageRating: profile.reviewsData.averageRating,
        totalReviews: profile.reviewsData.totalReviews,
      },
      business: {
        totalServices: services.length,
        activeServices: activeServicesCount,
        totalEarnings: profile.analytics.revenueStats.totalEarnings,
        currentMonthEarnings: profile.analytics.revenueStats.currentMonthEarnings,
      },
      bookings: profile.analytics.bookingStats,
      customers: profile.analytics.customerMetrics,
      performance: profile.analytics.performanceMetrics,
    };
  }

  async getProviderReviews(providerId: string, req?: Request, page = 1, limit = 10): Promise<any> {
    // Build query with tenant isolation
    const profileQuery = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(profileQuery);

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    return {
      reviews: profile.reviewsData.recentReviews,
      total: profile.reviewsData.totalReviews,
      averageRating: profile.reviewsData.averageRating,
      distribution: profile.reviewsData.ratingDistribution,
      pagination: {
        page,
        limit,
        total: profile.reviewsData.totalReviews,
        pages: Math.ceil(profile.reviewsData.totalReviews / limit),
      },
    };
  }

  // ========================================
  // Verification
  // ========================================

  async submitVerification(providerId: string, verificationData: any, req?: Request): Promise<any> {
    // Build query with tenant isolation
    const profileQuery = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(profileQuery);

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    // Update verification documents
    if (verificationData.identity) {
      profile.verificationStatus.identity = {
        status: 'pending',
        documents: verificationData.identity.documents || [],
        submittedAt: new Date(),
      };
    }

    if (verificationData.business) {
      profile.verificationStatus.business = {
        status: 'pending',
        documents: verificationData.business.documents || [],
        submittedAt: new Date(),
      };
    }

    profile.verificationStatus.overall = 'pending';
    await profile.save();

    return profile;
  }

  // ========================================
  // Availability (Basic)
  // ========================================

  async updateAvailabilitySchedule(providerId: string, schedule: any, req?: Request): Promise<any> {
    // Build query with tenant isolation
    const profileQuery = addTenantFilter({ userId: providerId }, req || {} as Request);

    const profile = await ProviderProfile.findOne(profileQuery);

    if (!profile) {
      throw new ApiError(404, 'Provider profile not found');
    }

    profile.availability.schedule = schedule;
    await profile.save();

    return profile;
  }

  // ========================================
  // Helper Methods
  // ========================================

  private calculateCompletionPercentage(profile: any): number {
    const fields = [
      profile.businessInfo?.businessName,
      profile.instagramStyleProfile?.profilePhoto,
      profile.instagramStyleProfile?.bio,
      profile.locationInfo?.primaryAddress,
      profile.services?.length > 0,
      profile.portfolio?.certifications?.length > 0,
      profile.financials?.bankAccount?.isVerified,
      profile.verificationStatus?.identity?.status === 'approved',
    ];

    const completed = fields.filter(Boolean).length;
    return Math.round((completed / fields.length) * 100);
  }
}

// Export singleton instance
export const providerService = new ProviderService();
