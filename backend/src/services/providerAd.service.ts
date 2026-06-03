import mongoose, { Types } from 'mongoose';
import ProviderAd, { IProviderAd } from '../models/providerAd.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import ServiceCategory from '../models/serviceCategory.model';
import Service from '../models/service.model';
import { getSocketServer } from '../socket';

export interface CreateAdInput {
  name: string;
  description?: string;
  budget: {
    daily?: number;
    monthly?: number;
    total: number;
  };
  bidAmount?: number;
  bidType?: 'cpc' | 'cpm' | 'fixed';
  targeting?: {
    categories?: string[];
    locations?: Array<{
      type: 'city' | 'region' | 'radius';
      value: string;
      coordinates?: { lat: number; lng: number };
      radiusKm?: number;
    }>;
    timeSchedule?: {
      daysOfWeek: number[];
      hoursStart: number;
      hoursEnd: number;
    };
    demographics?: {
      ageMin?: number;
      ageMax?: number;
    };
  };
  startDate?: Date;
  endDate?: Date;
  content: {
    title: string;
    description: string;
    imageUrl?: string;
    ctaText?: string;
    landingUrl?: string;
  };
  relatedServiceIds?: string[];
  limits?: {
    maxViewsPerDay?: number;
    maxClicksPerDay?: number;
    maxBudgetPerDay?: number;
  };
  scheduling?: {
    runContinuously?: boolean;
    scheduleType?: 'immediate' | 'scheduled' | 'recurring';
  };
  priority?: number;
}

export interface UpdateAdInput {
  name?: string;
  description?: string;
  budget?: {
    daily?: number;
    monthly?: number;
    total?: number;
  };
  bidAmount?: number;
  bidType?: 'cpc' | 'cpm' | 'fixed';
  targeting?: {
    categories?: string[];
    locations?: Array<{
      type: 'city' | 'region' | 'radius';
      value: string;
      coordinates?: { lat: number; lng: number };
      radiusKm?: number;
    }>;
    timeSchedule?: {
      daysOfWeek: number[];
      hoursStart: number;
      hoursEnd: number;
    };
    demographics?: {
      ageMin?: number;
      ageMax?: number;
    };
  };
  startDate?: Date;
  endDate?: Date;
  content?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    ctaText?: string;
    landingUrl?: string;
  };
  relatedServiceIds?: string[];
  limits?: {
    maxViewsPerDay?: number;
    maxClicksPerDay?: number;
    maxBudgetPerDay?: number;
  };
  scheduling?: {
    runContinuously?: boolean;
    scheduleType?: 'immediate' | 'scheduled' | 'recurring';
  };
  priority?: number;
}

export interface AdFilters {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

function touchDailyStats(
  ad: IProviderAd,
  updates: { views?: number; clicks?: number; conversions?: number; spent?: number },
): void {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let entry = ad.statistics.dailyStats.find((d) => {
    const day = new Date(d.date);
    day.setHours(0, 0, 0, 0);
    return day.getTime() === today.getTime();
  });

  if (!entry) {
    entry = { date: today, views: 0, clicks: 0, conversions: 0, spent: 0 };
    ad.statistics.dailyStats.push(entry);
  }

  if (updates.views) entry.views += updates.views;
  if (updates.clicks) entry.clicks += updates.clicks;
  if (updates.conversions) entry.conversions += updates.conversions;
  if (updates.spent) entry.spent += updates.spent;
}

class ProviderAdService {
  /**
   * Active ads eligible for public display
   * FIX: Enforce time schedule and targeting filters
   */
  async getActivePublicAds(options: {
    limit?: number;
    category?: string;
    userLocation?: { lat: number; lng: number };
    userDemographics?: { age?: number };
  }): Promise<IProviderAd[]> {
    const query: Record<string, unknown> = {
      status: 'active',
      isActive: true,
      approvalStatus: 'approved', // Only show ads that have been approved by admin
      'budget.remaining': { $gt: 0 },
    };

    if (options.category) {
      query['targeting.categories'] = new Types.ObjectId(options.category);
    }

    const ads = await ProviderAd.find(query)
      .sort({ priority: -1, 'statistics.ctr': -1, createdAt: -1 })
      .limit(options.limit || 5)
      .select('name content providerId statistics budget status targeting startDate endDate')
      .lean();

    // FIX: Filter by time schedule and targeting in application code
    const now = new Date();
    const currentDayOfWeek = now.getDay();
    const currentHour = now.getHours();

    return (ads as unknown as IProviderAd[]).filter((ad) => {
      // Check date range (startDate and endDate)
      if (ad.startDate && new Date(ad.startDate) > now) {
        return false;
      }
      if (ad.endDate && new Date(ad.endDate) < now) {
        return false;
      }

      // Check time schedule targeting
      if (ad.targeting?.timeSchedule) {
        const { daysOfWeek, hoursStart, hoursEnd } = ad.targeting.timeSchedule;

        // Check if current day is in the allowed days
        if (daysOfWeek && daysOfWeek.length > 0 && !daysOfWeek.includes(currentDayOfWeek)) {
          return false;
        }

        // Check if current hour is within the allowed range
        if (typeof hoursStart === 'number' && typeof hoursEnd === 'number') {
          if (hoursEnd > hoursStart) {
            // Normal range (e.g., 9 AM to 5 PM)
            if (currentHour < hoursStart || currentHour >= hoursEnd) {
              return false;
            }
          } else {
            // Overnight range (e.g., 10 PM to 6 AM)
            if (currentHour < hoursStart && currentHour >= hoursEnd) {
              return false;
            }
          }
        }
      }

      // FIX: Check demographic targeting
      if (ad.targeting?.demographics && options.userDemographics) {
        const { ageMin, ageMax } = ad.targeting.demographics;
        const userAge = options.userDemographics.age;

        if (userAge !== undefined) {
          if (ageMin !== undefined && userAge < ageMin) {
            return false;
          }
          if (ageMax !== undefined && userAge > ageMax) {
            return false;
          }
        }
      }

      // FIX: Check location targeting (radius-based)
      if (
        ad.targeting?.locations &&
        ad.targeting.locations.length > 0 &&
        options.userLocation
      ) {
        const hasMatchingLocation = ad.targeting.locations.some((loc) => {
          if (loc.type === 'radius' && loc.coordinates && loc.radiusKm) {
            const distance = this.calculateDistance(
              options.userLocation!.lat,
              options.userLocation!.lng,
              loc.coordinates.lat,
              loc.coordinates.lng
            );
            return distance <= loc.radiusKm;
          }
          // For city/region types, would need to geocode user location
          // For now, if there's a radius targeting, require user location
          return loc.type !== 'radius';
        });

        if (!hasMatchingLocation) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calculate distance between two coordinates in km (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Create a new ad campaign
   */
  async createAd(providerId: string, userId: string, input: CreateAdInput): Promise<IProviderAd> {
    try {
      logger.debug('Creating provider ad', {
        context: 'ProviderAdService',
        action: 'CREATE_AD',
        providerId,
      });

      // Validate categories if provided
      let categoryIds: Types.ObjectId[] | undefined;
      if (input.targeting?.categories && input.targeting.categories.length > 0) {
        const validCategories = await ServiceCategory.find({
          _id: { $in: input.targeting.categories },
          isActive: true,
        }).select('_id');

        if (validCategories.length !== input.targeting.categories.length) {
          throw new ApiError(400, 'One or more selected categories are invalid or inactive');
        }
        categoryIds = validCategories.map(c => c._id as Types.ObjectId);
      }

      // Validate related services if provided
      let serviceIds: Types.ObjectId[] | undefined;
      if (input.relatedServiceIds && input.relatedServiceIds.length > 0) {
        const validServices = await Service.find({
          _id: { $in: input.relatedServiceIds },
          providerId: providerId,
        }).select('_id');

        if (validServices.length !== input.relatedServiceIds.length) {
          throw new ApiError(400, 'One or more selected services are invalid or do not belong to you');
        }
        serviceIds = validServices.map(s => s._id as Types.ObjectId);
      }

      const adData: Partial<IProviderAd> = {
        name: input.name,
        description: input.description,
        providerId: new Types.ObjectId(providerId),
        status: 'draft',
        isActive: false,
        budget: {
          total: input.budget.total,
          spent: 0,
          remaining: input.budget.total,
          daily: input.budget.daily,
          monthly: input.budget.monthly,
        },
        bidAmount: input.bidAmount,
        bidType: input.bidType || 'cpc',
        targeting: {
          categories: categoryIds,
          locations: input.targeting?.locations || [],
          timeSchedule: input.targeting?.timeSchedule,
          demographics: input.targeting?.demographics,
        },
        startDate: input.startDate || new Date(),
        endDate: input.endDate,
        content: {
          title: input.content.title,
          description: input.content.description,
          imageUrl: input.content.imageUrl,
          ctaText: input.content.ctaText || 'Book Now',
          landingUrl: input.content.landingUrl,
        },
        relatedServiceIds: serviceIds,
        limits: input.limits,
        scheduling: {
          runContinuously: input.scheduling?.runContinuously ?? true,
          scheduleType: input.scheduling?.scheduleType || 'immediate',
        },
        priority: input.priority || 0,
        statistics: {
          views: 0,
          clicks: 0,
          conversions: 0,
          ctr: 0,
          conversionRate: 0,
          totalSpent: 0,
          costPerClick: 0,
          costPerConversion: 0,
          dailyStats: [],
        },
        performance: {
          roas: 0,
          impressionShare: 0,
          avgPosition: 0,
        },
        approvalStatus: 'pending',
        createdBy: new Types.ObjectId(userId),
        updatedBy: new Types.ObjectId(userId),
      };

      const ad = new ProviderAd(adData);
      await ad.save();

      logger.info('Provider ad created successfully', {
        context: 'ProviderAdService',
        action: 'AD_CREATED',
        adId: ad._id.toString(),
        providerId,
      });

      return ad;
    } catch (error: any) {
      logger.error('Error creating provider ad', {
        context: 'ProviderAdService',
        action: 'CREATE_AD_ERROR',
        providerId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get ads for a provider with pagination and filters
   */
  async getAdsByProvider(
    providerId: string,
    filters: AdFilters
  ): Promise<{ ads: IProviderAd[]; total: number; pagination: any }> {
    try {
      const query: any = { providerId: new Types.ObjectId(providerId) };

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.search) {
        query.$or = [
          { name: { $regex: new RegExp(filters.search, 'i') } },
          { 'content.title': { $regex: new RegExp(filters.search, 'i') } },
          { 'content.description': { $regex: new RegExp(filters.search, 'i') } },
        ];
      }

      if (filters.startDate || filters.endDate) {
        query.startDate = {};
        if (filters.startDate) {
          query.startDate.$gte = filters.startDate;
        }
        if (filters.endDate) {
          query.startDate.$lte = filters.endDate;
        }
      }

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const sortOrder = filters.order === 'asc' ? 1 : -1;
      const sortObj: any = {};
      sortObj[filters.sortBy || 'createdAt'] = sortOrder;

      const [ads, total] = await Promise.all([
        ProviderAd.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        ProviderAd.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        ads: ads as unknown as IProviderAd[],
        total,
        pagination: {
          page,
          limit,
          total,
          pages: totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error: any) {
      logger.error('Error fetching provider ads', {
        context: 'ProviderAdService',
        action: 'GET_ADS_ERROR',
        providerId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to fetch ads', error.message);
    }
  }

  /**
   * Get a single ad by ID
   */
  async getAdById(adId: string, providerId: string): Promise<IProviderAd | null> {
    try {
      const ad = await ProviderAd.findOne({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      }).lean();

      return ad as IProviderAd | null;
    } catch (error: any) {
      logger.error('Error fetching ad by ID', {
        context: 'ProviderAdService',
        action: 'GET_AD_BY_ID_ERROR',
        adId,
        error: error.message,
      });
      throw new ApiError(500, 'Failed to fetch ad', error.message);
    }
  }

  /**
   * Update an existing ad
   */
  async updateAd(
    adId: string,
    providerId: string,
    userId: string,
    input: UpdateAdInput
  ): Promise<IProviderAd | null> {
    try {
      const ad = await ProviderAd.findOne({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!ad) {
        throw new ApiError(404, 'Ad not found or access denied');
      }

      if (['active', 'completed', 'cancelled'].includes(ad.status)) {
        throw new ApiError(
          400,
          'Pause or duplicate this campaign before editing. Active and completed ads cannot be edited in place.',
        );
      }

      // Update fields
      if (input.name !== undefined) ad.name = input.name;
      if (input.description !== undefined) ad.description = input.description;
      if (input.budget !== undefined) {
        ad.budget = {
          ...ad.budget,
          ...input.budget,
          remaining: (input.budget.total || ad.budget.total) - ad.budget.spent,
        };
      }
      if (input.bidAmount !== undefined) ad.bidAmount = input.bidAmount;
      if (input.bidType !== undefined) ad.bidType = input.bidType;
      if (input.targeting !== undefined) {
        // Validate and sanitize category IDs before casting to ObjectId
        const validatedCategories = input.targeting.categories?.map(id => {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new ApiError(400, `Invalid category ID: ${id}`);
          }
          return new Types.ObjectId(id);
        });
        ad.targeting = {
          categories: validatedCategories,
          locations: input.targeting.locations || [],
          timeSchedule: input.targeting.timeSchedule,
          demographics: input.targeting.demographics,
        };
      }
      if (input.startDate !== undefined) ad.startDate = input.startDate;
      if (input.endDate !== undefined) ad.endDate = input.endDate;
      if (input.content !== undefined) {
        ad.content = { ...ad.content, ...input.content };
      }
      if (input.limits !== undefined) ad.limits = input.limits;
      if (input.scheduling !== undefined) {
        ad.scheduling = {
          ...ad.scheduling,
          ...input.scheduling,
        };
      }
      if (input.priority !== undefined) ad.priority = input.priority;

      ad.updatedBy = new Types.ObjectId(userId);
      ad.approvalStatus = 'pending'; // Re-require approval after edit

      await ad.save();

      logger.info('Provider ad updated successfully', {
        context: 'ProviderAdService',
        action: 'AD_UPDATED',
        adId,
        providerId,
      });

      return ad;
    } catch (error: any) {
      logger.error('Error updating provider ad', {
        context: 'ProviderAdService',
        action: 'UPDATE_AD_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete an ad
   */
  async deleteAd(adId: string, providerId: string): Promise<void> {
    try {
      const ad = await ProviderAd.findOneAndDelete({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!ad) {
        throw new ApiError(404, 'Ad not found or access denied');
      }

      logger.info('Provider ad deleted successfully', {
        context: 'ProviderAdService',
        action: 'AD_DELETED',
        adId,
        providerId,
      });
    } catch (error: any) {
      logger.error('Error deleting provider ad', {
        context: 'ProviderAdService',
        action: 'DELETE_AD_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Pause an ad
   */
  async pauseAd(adId: string, providerId: string): Promise<IProviderAd> {
    try {
      const ad = await ProviderAd.findOne({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!ad) {
        throw new ApiError(404, 'Ad not found or access denied');
      }

      if (ad.status === 'paused') {
        throw new ApiError(400, 'Ad is already paused');
      }

      ad.status = 'paused';
      ad.isActive = false;
      await ad.save();

      logger.info('Provider ad paused', {
        context: 'ProviderAdService',
        action: 'AD_PAUSED',
        adId,
        providerId,
      });

      return ad;
    } catch (error: any) {
      logger.error('Error pausing provider ad', {
        context: 'ProviderAdService',
        action: 'PAUSE_AD_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Resume a paused ad
   */
  async resumeAd(adId: string, providerId: string): Promise<IProviderAd> {
    try {
      const ad = await ProviderAd.findOne({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!ad) {
        throw new ApiError(404, 'Ad not found or access denied');
      }

      if (ad.status !== 'paused') {
        throw new ApiError(400, 'Ad is not paused');
      }

      if (ad.budget.remaining <= 0) {
        throw new ApiError(400, 'Ad has no remaining budget');
      }

      ad.status = 'active';
      ad.isActive = true;
      await ad.save();

      logger.info('Provider ad resumed', {
        context: 'ProviderAdService',
        action: 'AD_RESUMED',
        adId,
        providerId,
      });

      return ad;
    } catch (error: any) {
      logger.error('Error resuming provider ad', {
        context: 'ProviderAdService',
        action: 'RESUME_AD_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Launch/activate an ad (move from draft to active)
   */
  async launchAd(adId: string, providerId: string): Promise<IProviderAd> {
    try {
      const ad = await ProviderAd.findOne({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      });

      if (!ad) {
        throw new ApiError(404, 'Ad not found or access denied');
      }

      if (ad.status !== 'draft') {
        throw new ApiError(400, 'Only draft ads can be launched');
      }

      if (ad.budget.total <= 0) {
        throw new ApiError(400, 'Ad must have a positive budget');
      }

      ad.status = 'active';
      ad.isActive = true;
      ad.approvalStatus = 'pending_review'; // FIX: Require admin review before going live
      // approvedAt will be set when admin approves
      if (!ad.startDate || ad.startDate > new Date()) {
        ad.startDate = new Date();
      }
      await ad.save();

      // FIX: Emit socket events for real-time updates
      const socketServer = getSocketServer();
      if (socketServer) {
        // Emit status changed to provider
        socketServer.emitAdStatusChanged(adId, providerId, ad.name, 'draft', 'pending_review');
        // Emit to admins that a new ad needs review
        socketServer.emitNewAdPending(adId, providerId, `Provider ${providerId}`, ad.name);
      }

      logger.info('Provider ad launched', {
        context: 'ProviderAdService',
        action: 'AD_LAUNCHED',
        adId,
        providerId,
      });

      return ad;
    } catch (error: any) {
      logger.error('Error launching provider ad', {
        context: 'ProviderAdService',
        action: 'LAUNCH_AD_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Record a view for an ad (impression)
   */
  async recordView(adId: string): Promise<void> {
    try {
      const ad = await ProviderAd.findById(adId);
      if (!ad || ad.status !== 'active' || !ad.isActive || ad.approvalStatus !== 'approved') {
        return;
      }

      // Check daily budget before recording view
      if (ad.budget.daily && ad.budget.daily > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todaySpent = ad.statistics.dailyStats
          .filter(s => {
            const statDate = new Date(s.date).toISOString().split('T')[0];
            return statDate === today;
          })
          .reduce((sum, s) => sum + s.spent, 0);

        const charge = ad.bidType === 'cpm' && ad.bidAmount ? ad.bidAmount / 1000 : 0;

        if (todaySpent + charge > ad.budget.daily) {
          // Don't record the view, ad is within daily budget limit
          return;
        }
      }

      if (ad.budget.remaining <= 0) {
        ad.status = 'completed';
        ad.isActive = false;
        await ad.save();

        // FIX: Emit socket event for budget exhaustion
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.emitAdBudgetExhausted(adId, ad.providerId.toString(), ad.name, 'total');
        }
        return;
      }

      ad.statistics.views += 1;
      touchDailyStats(ad, { views: 1 });

      const charge =
        ad.bidType === 'cpm' && ad.bidAmount
          ? ad.bidAmount / 1000
          : 0;

      if (charge > 0) {
        ad.statistics.totalSpent += charge;
        ad.budget.spent += charge;
        touchDailyStats(ad, { spent: charge });
      }

      ad.budget.remaining = Math.max(0, ad.budget.total - ad.budget.spent);
      if (ad.budget.remaining <= 0) {
        ad.status = 'completed';
        ad.isActive = false;
        // FIX: Emit socket event for budget exhaustion
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.emitAdBudgetExhausted(adId, ad.providerId.toString(), ad.name, 'total');
        }
      }

      await ad.save();
    } catch (error: any) {
      logger.error('Error recording ad view', {
        context: 'ProviderAdService',
        action: 'RECORD_VIEW_ERROR',
        adId,
        error: error.message,
      });
    }
  }

  /**
   * Record a click for an ad
   */
  async recordClick(adId: string): Promise<{ ad: IProviderAd | null; clickTimestamp: Date }> {
    const clickTimestamp = new Date();
    try {
      const ad = await ProviderAd.findById(adId);
      if (!ad || ad.status !== 'active' || !ad.isActive || ad.approvalStatus !== 'approved') {
        return { ad: null, clickTimestamp };
      }

      // Check daily budget before recording click
      if (ad.budget.daily && ad.budget.daily > 0) {
        const today = new Date().toISOString().split('T')[0];
        const todaySpent = ad.statistics.dailyStats
          .filter(s => {
            const statDate = new Date(s.date).toISOString().split('T')[0];
            return statDate === today;
          })
          .reduce((sum, s) => sum + s.spent, 0);

        const charge =
          ad.bidType === 'cpc' && ad.bidAmount
            ? ad.bidAmount
            : ad.bidType === 'fixed' && ad.bidAmount
              ? ad.bidAmount
              : 0;

        if (todaySpent + charge > ad.budget.daily) {
          throw new ApiError(400, 'Daily budget exceeded');
        }
      }

      if (ad.budget.remaining <= 0) {
        ad.status = 'completed';
        ad.isActive = false;
        await ad.save();

        // FIX: Emit socket event for budget exhaustion
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.emitAdBudgetExhausted(adId, ad.providerId.toString(), ad.name, 'total');
        }
        return { ad, clickTimestamp };
      }

      const charge =
        ad.bidType === 'cpc' && ad.bidAmount
          ? ad.bidAmount
          : ad.bidType === 'fixed' && ad.bidAmount
            ? ad.bidAmount
            : 0;

      ad.statistics.clicks += 1;
      touchDailyStats(ad, { clicks: 1 });

      if (charge > 0) {
        ad.statistics.totalSpent += charge;
        ad.budget.spent += charge;
        touchDailyStats(ad, { spent: charge });
      }

      ad.budget.remaining = Math.max(0, ad.budget.total - ad.budget.spent);
      if (ad.budget.remaining <= 0) {
        ad.status = 'completed';
        ad.isActive = false;

        // FIX: Emit socket event for budget exhaustion
        const socketServer = getSocketServer();
        if (socketServer) {
          socketServer.emitAdBudgetExhausted(adId, ad.providerId.toString(), ad.name, 'total');
        }
      }

      await ad.save();
      return { ad, clickTimestamp };
    } catch (error: any) {
      logger.error('Error recording ad click', {
        context: 'ProviderAdService',
        action: 'RECORD_CLICK_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Record a conversion for an ad
   * FIX: Link conversion to booking for proper attribution and ROAS calculation
   */
  async recordConversion(
    adId: string,
    bookingId: string,
    clickTimestamp: Date,
    revenue: number
  ): Promise<void> {
    try {
      await ProviderAd.findByIdAndUpdate(adId, {
        $inc: { 'statistics.conversions': 1 },
        $push: {
          conversionAttributions: {
            bookingId: new Types.ObjectId(bookingId),
            clickTimestamp,
            conversionTimestamp: new Date(),
            revenue,
          },
        },
      });

      // Recalculate ROAS based on attributed revenue
      const ad = await ProviderAd.findById(adId);
      if (ad) {
        const totalRevenue = ad.conversionAttributions.reduce((sum, attr) => sum + attr.revenue, 0);
        const totalSpent = ad.statistics.totalSpent;
        if (totalSpent > 0) {
          ad.performance.roas = Number((totalRevenue / totalSpent).toFixed(2));
          await ad.save();
        }
      }
    } catch (error: any) {
      logger.error('Error recording ad conversion', {
        context: 'ProviderAdService',
        action: 'RECORD_CONVERSION_ERROR',
        adId,
        bookingId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get ad statistics for a provider
   */
  async getProviderAdStats(providerId: string): Promise<any> {
    try {
      const stats = await (ProviderAd as any).getProviderAdStats(providerId);

      // Get top performing ads
      const topAds = await ProviderAd.find({ providerId: new Types.ObjectId(providerId) })
        .sort({ 'statistics.conversions': -1 })
        .limit(5)
        .select('name status statistics')
        .lean();

      // Get daily stats for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentAds = await ProviderAd.find({
        providerId: new Types.ObjectId(providerId),
        'statistics.dailyStats.date': { $gte: thirtyDaysAgo },
      })
        .select('statistics.dailyStats name')
        .lean();

      // Aggregate daily stats
      const dailyAggregated: Record<string, { views: number; clicks: number; conversions: number; spent: number }> = {};
      for (const ad of recentAds) {
        for (const day of ad.statistics.dailyStats) {
          const dateKey = new Date(day.date).toISOString().split('T')[0];
          if (!dailyAggregated[dateKey]) {
            dailyAggregated[dateKey] = { views: 0, clicks: 0, conversions: 0, spent: 0 };
          }
          dailyAggregated[dateKey].views += day.views;
          dailyAggregated[dateKey].clicks += day.clicks;
          dailyAggregated[dateKey].conversions += day.conversions;
          dailyAggregated[dateKey].spent += day.spent;
        }
      }

      return {
        ...stats,
        topPerformingAds: topAds,
        last30Days: Object.entries(dailyAggregated).map(([date, stats]) => ({
          date,
          ...stats,
        })),
      };
    } catch (error: any) {
      // Return empty stats instead of throwing error
      logger.warn('Returning empty ad stats (no ads or error)', {
        context: 'ProviderAdService',
        action: 'GET_STATS_FALLBACK',
        providerId,
        error: error.message,
      });
      return {
        totalAds: 0,
        activeAds: 0,
        pausedAds: 0,
        draftAds: 0,
        totalViews: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalSpent: 0,
        averageCtr: 0,
        averageConversionRate: 0,
        topPerformingAds: [],
        last30Days: [],
      };
    }
  }

  /**
   * Get detailed analytics for a specific ad
   */
  async getAdAnalytics(adId: string, providerId: string): Promise<any> {
    try {
      const ad = await ProviderAd.findOne({
        _id: new Types.ObjectId(adId),
        providerId: new Types.ObjectId(providerId),
      }).lean();

      if (!ad) {
        throw new ApiError(404, 'Ad not found or access denied');
      }

      const { statistics, performance } = ad;
      const spent = Math.max(ad.budget?.spent || 0, statistics.totalSpent || 0);
      const views = statistics.views || 0;
      const clicks = statistics.clicks || 0;
      const ctr = views > 0 ? (clicks / views) * 100 : 0;
      const conversionRate =
        clicks > 0 ? ((statistics.conversions || 0) / clicks) * 100 : 0;

      return {
        adId: ad._id,
        name: ad.name,
        status: ad.status,
        approvalStatus: ad.approvalStatus,
        budget: {
          ...ad.budget,
          spent,
          remaining: Math.max(0, (ad.budget?.total || 0) - spent),
        },
        statistics: {
          ...statistics,
          ctr: Number(ctr.toFixed(2)),
          conversionRate: Number(conversionRate.toFixed(2)),
          totalSpent: spent,
          costPerClick: clicks > 0 ? Number((spent / clicks).toFixed(2)) : 0,
          costPerConversion:
            statistics.conversions > 0
              ? Number((spent / statistics.conversions).toFixed(2))
              : 0,
        },
        performance: {
          roas: performance?.roas || 0,
          impressionShare: performance?.impressionShare || 0,
          avgPosition: performance?.avgPosition || 0,
          effectiveCpm: views > 0 ? Number(((spent / views) * 1000).toFixed(2)) : 0,
          effectiveCpc: clicks > 0 ? Number((spent / clicks).toFixed(2)) : 0,
        },
        dailyStats: statistics.dailyStats,
        targeting: ad.targeting,
        content: ad.content,
        createdAt: ad.createdAt,
        startDate: ad.startDate,
        endDate: ad.endDate,
      };
    } catch (error: any) {
      logger.error('Error fetching ad analytics', {
        context: 'ProviderAdService',
        action: 'GET_AD_ANALYTICS_ERROR',
        adId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get available categories for ad targeting
   */
  async getTargetingCategories(): Promise<any[]> {
    try {
      const categories = await ServiceCategory.find({ isActive: true })
        .select('name slug icon subcategories')
        .sort({ name: 1 })
        .lean();

      return categories;
    } catch (error: any) {
      logger.error('Error fetching targeting categories', {
        context: 'ProviderAdService',
        action: 'GET_CATEGORIES_ERROR',
        error: error.message,
      });
      throw new ApiError(500, 'Failed to fetch categories', error.message);
    }
  }
}

// Export singleton instance
export const providerAdService = new ProviderAdService();
export default providerAdService;
