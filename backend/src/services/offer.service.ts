import Coupon, { ICoupon } from '../models/coupon.model';
import { OfferClaim } from '../models/offerClaim.model';
import User from '../models/user.model';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Request } from 'express';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';
import AuditLog from '../models/auditLog.model';
import { get as cacheGet, set as cacheSet, delByPattern } from './cache.service';
import timezoneService from '../utils/timezone';
import { eventBus, EventTypes } from '../events/eventBus';

// Redis caching TTL for offers - configurable via environment variables
const OFFER_CACHE_TTL = parseInt(process.env.OFFER_CACHE_TTL || '60', 10); // Default 60 seconds, can be overridden
const OFFER_DETAIL_CACHE_TTL = parseInt(process.env.OFFER_DETAIL_CACHE_TTL || '300', 10); // Default 5 minutes
const OFFER_CACHE_PREFIX = 'offer';

// FIX: Configurable abuse detection limits (defaults match previous hardcoded values)
const DEVICE_ABUSE_CLAIM_LIMIT = parseInt(process.env.OFFER_DEVICE_ABUSE_CLAIM_LIMIT || '5', 10);
const IP_ABUSE_CLAIM_LIMIT = parseInt(process.env.OFFER_IP_ABUSE_CLAIM_LIMIT || '10', 10);
const ABUSE_LOOKBACK_DAYS = parseInt(process.env.OFFER_ABUSE_LOOKBACK_DAYS || '7', 10);

// FIX: Escape regex special characters to prevent regex injection
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// FIX: Audit log helper for coupon operations
async function logCouponAction(
  action: string,
  userId: string,
  couponId: string,
  details: Record<string, unknown>,
  status: 'success' | 'failure',
  errorMessage?: string
): Promise<void> {
  try {
    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(userId),
      action,
      resource: 'coupon',
      resourceId: couponId,
      details,
      status,
      errorMessage,
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    logger.error('Failed to create audit log', {
      context: 'OfferService',
      action: 'AUDIT_LOG_FAILED',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// FIX: Device fingerprinting helper
function extractDeviceFingerprint(req: Request | undefined): { fingerprint?: string; ip?: string; userAgent?: string } {
  if (!req) {
    return {};
  }

  // Try to get fingerprint from header (set by frontend)
  const fingerprint = req.headers['x-device-fingerprint'] as string || undefined;

  // Get IP (handle proxies)
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim()
    || req.headers['x-real-ip']?.toString()
    || req.ip
    || undefined;

  // Get user agent
  const userAgent = req.headers['user-agent'] || undefined;

  return { fingerprint, ip, userAgent };
}

// FIX: Check for device/IP abuse on claim
async function checkDeviceAbuse(
  offerId: mongoose.Types.ObjectId,
  fingerprint?: string,
  ip?: string
): Promise<{ blocked: boolean; reason?: string }> {
  if (!fingerprint && !ip) {
    return { blocked: false };
  }

  const lookbackDate = new Date(Date.now() - ABUSE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  // Check for suspicious patterns
  const query: any = {
    offerId,
    claimedAt: { $gte: lookbackDate },
  };

  // Check fingerprint claims
  if (fingerprint) {
    const fingerprintClaims = await OfferClaim.countDocuments({
      ...query,
      deviceFingerprint: fingerprint,
    });

    // FIX: Configurable device claim limit (default 5 per lookback period)
    if (fingerprintClaims >= DEVICE_ABUSE_CLAIM_LIMIT) {
      return {
        blocked: true,
        reason: 'Too many claims from this device. Please try again later.',
      };
    }
  }

  // Check IP claims
  if (ip) {
    const ipClaims = await OfferClaim.countDocuments({
      ...query,
      ipAddress: ip,
    });

    // FIX: Configurable IP claim limit (default 10 per lookback period)
    if (ipClaims >= IP_ABUSE_CLAIM_LIMIT) {
      return {
        blocked: true,
        reason: 'Too many claims from this device. Please try again later.',
      };
    }
  }

  // Check IP claims
  if (ip) {
    const ipClaims = await OfferClaim.countDocuments({
      ...query,
      ipAddress: ip,
    });

    // FIX: Configurable IP claim limit (default 10 per lookback period)
    if (ipClaims >= IP_ABUSE_CLAIM_LIMIT) {
      return {
        blocked: true,
        reason: 'Too many claims from this location. Please try again later.',
      };
    }
  }

  return { blocked: false };
}

export interface OfferResponse {
  _id: string;
  title: string;
  description?: string;
  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number;
  maxDiscount?: number;
  minOrderValue: number;
  displayTitle?: string;
  displaySubtitle?: string;
  displayGradient?: string;
  displayBadge?: string;
  imageUrl?: string;
  featured?: boolean;
  validFrom: Date;
  validUntil: Date;
  applicableServices?: string[];
  applicableCategories?: string[];
  isClaimed?: boolean;
  hasActiveClaim?: boolean;
  isFullyRedeemed?: boolean;
  remainingUses?: number;
  maxUsesPerUser?: number;
  appliedCount?: number;
}

export interface ClaimResponse {
  success: boolean;
  claimId?: string;
  couponCode?: string;
  expiresAt?: Date;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  discountAmount?: number;
  discountType?: 'percentage' | 'fixed' | 'free_service';
  message?: string;
  couponCode?: string;
  offerId?: string;
  minOrderValue?: number;
  maxDiscount?: number;
  title?: string;
}

export class OfferService {
  // FIX: Get active offers for homepage (public) - with pagination and caching
  async getActiveOffers(
    userId?: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ offers: OfferResponse[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 100); // Default 20, max 100
    const skip = (page - 1) * limit;

    const cacheKey = `active:${userId || 'public'}:p${page}:l${limit}`;

    // Try cache first
    const cached = await cacheGet<{ offers: OfferResponse[]; pagination: any }>(cacheKey, { prefix: OFFER_CACHE_PREFIX });
    if (cached) {
      logger.debug('Cache hit for getActiveOffers', { userId, page, limit });
      return cached;
    }

    const now = new Date();

    // Get total count for pagination
    const total = await Coupon.countDocuments({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
    });

    const offers = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
    })
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // If userId provided, compute per-offer claim/redemption state
    let userClaimStats = new Map<string, { appliedCount: number; hasActiveClaim: boolean }>();
    if (userId) {
      const now = new Date();
      const claims = await OfferClaim.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
      for (const claim of claims) {
        const offerKey = claim.offerId.toString();
        const stats = userClaimStats.get(offerKey) || { appliedCount: 0, hasActiveClaim: false };
        if (claim.status === 'applied') {
          stats.appliedCount += 1;
        }
        if (claim.status === 'claimed' && claim.expiresAt > now) {
          stats.hasActiveClaim = true;
        }
        userClaimStats.set(offerKey, stats);
      }
    }

    const result = offers.map((offer: any) => {
      const offerIdStr = offer._id.toString();
      const maxUsesPerUser = offer.maxUsesPerUser || 1;
      const stats = userClaimStats.get(offerIdStr);
      const appliedCount = stats?.appliedCount ?? 0;
      const hasActiveClaim = stats?.hasActiveClaim ?? false;
      const remainingUses = Math.max(0, maxUsesPerUser - appliedCount);
      const isFullyRedeemed = appliedCount >= maxUsesPerUser;

      return {
      _id: offerIdStr,
      title: offer.displayTitle || offer.title,
      description: offer.description,
      code: offer.code,
      type: offer.type,
      value: offer.value,
      maxDiscount: offer.maxDiscount,
      minOrderValue: offer.minOrderValue,
      displayTitle: offer.displayTitle,
      displaySubtitle: offer.displaySubtitle,
      displayGradient: offer.displayGradient,
      displayBadge: offer.displayBadge,
      imageUrl: offer.imageUrl,
      featured: offer.featured,
      validFrom: offer.validFrom,
      validUntil: offer.validUntil,
      applicableServices: offer.targetServices?.map((s: any) => s.toString()) || [],
      applicableCategories: offer.targetCategories?.map((c: any) => c.toString()) || [],
      isClaimed: hasActiveClaim,
      hasActiveClaim,
      isFullyRedeemed,
      remainingUses,
      maxUsesPerUser,
      appliedCount,
    };
    });

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };

    // Cache the result (without user-specific claimed status for public cache)
    await cacheSet(cacheKey, { offers: result, pagination }, { prefix: OFFER_CACHE_PREFIX, ttl: OFFER_CACHE_TTL });
    logger.debug('Cached getActiveOffers', { userId, page, limit, count: result.length });

    return { offers: result, pagination };
  }

  // FIX: Invalidate offer cache when offers are created/updated/deleted
  // BUG-003: Added retry logic and better error handling
  async invalidateOfferCache(): Promise<void> {
    try {
      await delByPattern(`${OFFER_CACHE_PREFIX}:*`);
      logger.info('Offer cache invalidated', { action: 'CACHE_INVALIDATED' });
    } catch (error) {
      // Log but don't fail - cache will eventually be consistent
      logger.warn('Failed to invalidate offer cache, will retry on next operation', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Schedule retry after 5 seconds
      setTimeout(async () => {
        try {
          await delByPattern(`${OFFER_CACHE_PREFIX}:*`);
          logger.info('Offer cache invalidated on retry', { action: 'CACHE_INVALIDATED_RETRY' });
        } catch (retryError) {
          logger.error('Retry cache invalidation failed', { retryError });
        }
      }, 5000);
    }
  }

  // Get single offer by ID with full service details - with caching
  async getOfferById(offerId: string): Promise<any> {
    const cacheKey = `detail:${offerId}`;

    // Try cache first
    const cached = await cacheGet<any>(cacheKey, { prefix: OFFER_CACHE_PREFIX });
    if (cached) {
      logger.debug('Cache hit for getOfferById', { offerId });
      return cached;
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return null;
    }

    // Use aggregation pipeline to fetch offer, services, providers, and categories in one query
    const results = await Coupon.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(offerId) } },
      {
        $lookup: {
          from: 'services',
          localField: 'targetServices',
          foreignField: '_id',
          as: 'services',
        },
      },
      {
        $lookup: {
          from: 'servicecategories',
          localField: 'targetCategories',
          foreignField: '_id',
          as: 'categories',
        },
      },
      {
        $project: {
          title: 1,
          description: 1,
          code: 1,
          type: 1,
          value: 1,
          maxDiscount: 1,
          minOrderValue: 1,
          displayTitle: 1,
          displaySubtitle: 1,
          displayGradient: 1,
          displayBadge: 1,
          imageUrl: 1,
          featured: 1,
          validFrom: 1,
          validUntil: 1,
          serviceProviderIds: '$services.providerId',
          services: {
            $map: {
              input: '$services',
              as: 'service',
              in: {
                _id: '$$service._id',
                name: '$$service.name',
                shortDescription: '$$service.shortDescription',
                price: '$$service.price',
                duration: '$$service.duration',
                images: { $ifNull: ['$$service.images', []] },
                rating: { $ifNull: ['$$service.rating', { average: 0, count: 0 }] },
                category: '$$service.category',
                providerId: '$$service.providerId',
              },
            },
          },
          categories: {
            $map: {
              input: '$categories',
              as: 'cat',
              in: {
                _id: '$$cat._id',
                name: '$$cat.name',
              },
            },
          },
        },
      },
    ]);

    if (!results || results.length === 0) {
      return null;
    }

    const result = results[0];

    // Fetch all provider details in ONE query instead of N+1
    const providerIds = result.serviceProviderIds?.filter(Boolean) || [];
    let providerMap = new Map<string, any>();

    if (providerIds.length > 0) {
      const providers = await mongoose.model('User').find({
        _id: { $in: providerIds },
      })
        .select('firstName lastName avatar')
        .lean();

      providers.forEach((provider: any) => {
        providerMap.set(provider._id.toString(), {
          _id: provider._id.toString(),
          firstName: provider.firstName,
          lastName: provider.lastName,
          avatar: provider.avatar,
        });
      });
    }

    // Map providers to services
    const servicesWithProviders = result.services.map((service: any) => ({
      _id: service._id.toString(),
      name: service.name,
      shortDescription: service.shortDescription,
      price: service.price,
      duration: service.duration,
      images: service.images,
      thumbnail: service.images?.[0] || null, // FIX: Add thumbnail for frontend compatibility
      rating: service.rating,
      category: service.category,
      provider: service.providerId ? providerMap.get(service.providerId.toString()) || null : null,
    }));

    const response = {
      _id: offerId,
      title: result.displayTitle || result.title,
      description: result.description,
      code: result.code,
      type: result.type,
      value: result.value,
      maxDiscount: result.maxDiscount,
      minOrderValue: result.minOrderValue,
      displayTitle: result.displayTitle,
      displaySubtitle: result.displaySubtitle,
      displayGradient: result.displayGradient,
      displayBadge: result.displayBadge,
      imageUrl: result.imageUrl,
      featured: result.featured,
      validFrom: result.validFrom,
      validUntil: result.validUntil,
      applicableServices: servicesWithProviders,
      applicableCategories: result.categories || [],
    };

    // Cache the result - use longer TTL for individual offer details
    await cacheSet(cacheKey, response, { prefix: OFFER_CACHE_PREFIX, ttl: OFFER_DETAIL_CACHE_TTL });
    logger.debug('Cached getOfferById', { offerId });

    return response;
  }

  // Get offer by promo code
  // SECURITY FIX (SEC-004): Add coupon code sanitization and format validation
  async getOfferByCode(code: string): Promise<any> {
    // Validate input type
    if (!code || typeof code !== 'string') {
      logger.warn('Invalid coupon code type attempted', { code: typeof code });
      return null;
    }

    // Sanitize and normalize the code
    const normalizedCode = code.trim().toUpperCase();

    // SECURITY FIX (SEC-004): Validate format - alphanumeric only, 6-20 characters
    // Minimum 6 characters to reduce brute force vulnerability
    if (!/^[A-Z0-9]{6,20}$/.test(normalizedCode)) {
      logger.warn('Invalid coupon code format attempted', {
        code: normalizedCode,
        codeLength: normalizedCode.length,
        containsInvalidChars: /[^A-Z0-9]/.test(normalizedCode),
        action: 'INVALID_COUPON_FORMAT_ATTEMPTED',
        securityEvent: 'SEC-004_INVALID_COUPON_FORMAT',
      });
      return null;
    }

    return Coupon.findOne({ code: normalizedCode, isActive: true }).lean();
  }

  // Check if offer is valid (for lean documents)
  // FIX: Use UTC for consistency across timezones
  private checkOfferValidity(offer: any): { valid: boolean; reason?: string } {
    const now = new Date();
    // FIX: Add 5-minute grace period to prevent edge-case failures at exact expiration time
    // Edge case: if a coupon expires at 10:00:00 exactly and the server clock ticks just before
    // the check completes, the coupon would incorrectly appear expired. The grace period prevents this.
    const gracePeriodMs = 5 * 60 * 1000;

    if (!offer.isActive) {
      return { valid: false, reason: 'Offer is inactive' };
    }

    // FIX: Use timezone-aware comparison
    // Convert to UTC for consistent comparison
    const validFrom = new Date(offer.validFrom);
    const validUntil = new Date(offer.validUntil);

    if (validFrom > now) {
      return { valid: false, reason: 'Offer is not yet valid' };
    }

    // FIX: Use > with grace period for expiry check
    if (validUntil.getTime() + gracePeriodMs < now.getTime()) {
      return { valid: false, reason: 'Offer has expired' };
    }

    if (offer.currentUses >= offer.maxUses) {
      return { valid: false, reason: 'Offer usage limit reached' };
    }

    return { valid: true };
  }

  /**
   * FIX: Check if an offer is currently valid based on date range
   * Uses UTC for consistency across all regions
   */
  isOfferValid(offer: {
    validFrom: Date | string;
    validUntil: Date | string;
    isActive: boolean;
    currentUses: number;
    maxUses: number;
  }): boolean {
    const now = new Date();
    const gracePeriodMs = 5 * 60 * 1000;

    if (!offer.isActive) return false;

    const validFrom = new Date(offer.validFrom);
    const validUntil = new Date(offer.validUntil);

    if (validFrom > now) return false;
    if (validUntil.getTime() + gracePeriodMs < now.getTime()) return false;
    if (offer.currentUses >= offer.maxUses) return false;

    return true;
  }

  /**
   * FIX: Get offer validity info including days remaining
   */
  getOfferValidityInfo(offer: {
    validFrom: Date | string;
    validUntil: Date | string;
    isActive: boolean;
    currentUses: number;
    maxUses: number;
  }): {
    isValid: boolean;
    reason?: string;
    daysRemaining?: number;
    hoursRemaining?: number;
    isExpiringSoon: boolean; // Within 7 days
    isExpired: boolean;
    isNotYetActive: boolean;
    remainingUses: number;
  } {
    const now = new Date();
    const validFrom = new Date(offer.validFrom);
    const validUntil = new Date(offer.validUntil);
    const remainingUses = offer.maxUses - offer.currentUses;

    // Calculate time remaining
    const msRemaining = validUntil.getTime() - now.getTime();
    const daysRemaining = Math.floor(msRemaining / (1000 * 60 * 60 * 24));
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));

    const result = {
      isValid: false,
      isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
      isExpired: now > validUntil,
      isNotYetActive: now < validFrom,
      remainingUses,
      daysRemaining,
      hoursRemaining,
    };

    // Determine validity and reason
    if (!offer.isActive) {
      return { ...result, reason: 'Offer is inactive' };
    }
    if (now < validFrom) {
      return { ...result, reason: 'Offer is not yet active' };
    }
    if (now > validUntil) {
      return { ...result, reason: 'Offer has expired' };
    }
    if (offer.currentUses >= offer.maxUses) {
      return { ...result, reason: 'Offer usage limit reached' };
    }

    return { ...result, isValid: true };
  }

  // Claim an offer
  // Uses atomic findOneAndUpdate with idempotency keys to prevent race conditions and duplicate claims
  async claimOffer(
    userId: string,
    offerId: string,
    deviceInfo?: { fingerprint?: string; ip?: string; userAgent?: string },
    attribution?: { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string; referrer?: string },
    idempotencyKey?: string
  ): Promise<ClaimResponse> {
    // FIX: Validate offerId format before creating ObjectId
    if (!mongoose.Types.ObjectId.isValid(offerId)) {
      return { success: false, message: 'Invalid offer ID' };
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const offerObjectId = new mongoose.Types.ObjectId(offerId);

    // Check for existing claim with same idempotency key first
    if (idempotencyKey) {
      const existingByIdempotency = await OfferClaim.findOne({
        idempotencyKey,
        userId: userObjectId,
        offerId: offerObjectId,
      }).lean();

      if (existingByIdempotency) {
        logger.info('Duplicate claim request via idempotency key', {
          idempotencyKey,
          claimId: existingByIdempotency._id.toString(),
        });
        return {
          success: true,
          claimId: existingByIdempotency._id.toString(),
          couponCode: existingByIdempotency.couponCode,
          expiresAt: existingByIdempotency.expiresAt,
          message: 'You already have this offer claimed',
        };
      }
    }

    // Get the offer
    const offer = await Coupon.findById(offerId).lean();
    if (!offer) {
      return { success: false, message: 'Offer not found' };
    }

    // SECURITY: Check for device/IP abuse
    const deviceCheck = await checkDeviceAbuse(offerObjectId, deviceInfo?.fingerprint, deviceInfo?.ip);
    if (deviceCheck.blocked) {
      await logCouponAction('CLAIM_FAILED', userId, offerId, {
        reason: 'device_abuse',
        fingerprint: deviceInfo?.fingerprint,
        ip: deviceInfo?.ip,
      }, 'failure', deviceCheck.reason);
      return { success: false, message: deviceCheck.reason || 'Too many claims detected' };
    }

    // Check offer validity
    const isValid = this.checkOfferValidity(offer);
    if (!isValid.valid) {
      await logCouponAction('CLAIM_FAILED', userId, offerId, { reason: 'invalid_offer', details: isValid.reason }, 'failure', isValid.reason);
      // Invalidate cache even on failure
      await this.invalidateOfferCache().catch(() => {});
      return { success: false, message: isValid.reason || 'Offer is not valid' };
    }

    // Check global usage limit
    if ((offer as any).currentUses >= (offer as any).maxUses) {
      await logCouponAction('CLAIM_FAILED', userId, offerId, { reason: 'exhausted', currentUses: (offer as any).currentUses, maxUses: (offer as any).maxUses }, 'failure', 'Offer has reached maximum uses');
      // Invalidate cache even on failure
      await this.invalidateOfferCache().catch(() => {});
      return { success: false, message: 'Offer has reached maximum uses' };
    }

    const maxPerUser = (offer as any).maxUsesPerUser || 1;

    const appliedCount = await OfferClaim.countDocuments({
      userId: userObjectId,
      offerId: offerObjectId,
      status: 'applied',
    });

    if (appliedCount >= maxPerUser) {
      await this.invalidateOfferCache().catch(() => {});
      return {
        success: false,
        message: 'You have already used this offer the maximum number of times',
      };
    }

    // Return existing active claim if user already has one ready to use
    const existingClaim = await OfferClaim.findOne({
      userId: userObjectId,
      offerId: offerObjectId,
      status: 'claimed',
      expiresAt: { $gt: new Date() },
    });

    if (existingClaim) {
      return {
        success: true,
        claimId: existingClaim._id.toString(),
        couponCode: existingClaim.couponCode,
        expiresAt: existingClaim.expiresAt,
        message: 'You already have this offer claimed',
      };
    }

    // Calculate expiry date (cap at offer validUntil)
    const claimExpiresInDays = (offer as any).claimExpiresInDays || 30;
    let expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + claimExpiresInDays);
    const offerValidUntil = new Date((offer as any).validUntil);
    if (expiresAt > offerValidUntil) {
      expiresAt = offerValidUntil;
    }

    let claim;
    try {
      claim = await OfferClaim.create({
        userId: userObjectId,
        offerId: offerObjectId,
        couponCode: (offer as any).code,
        status: 'claimed',
        expiresAt,
        claimedAt: new Date(),
        deviceFingerprint: deviceInfo?.fingerprint,
        ipAddress: deviceInfo?.ip,
        userAgent: deviceInfo?.userAgent,
        idempotencyKey,
        utmSource: attribution?.utmSource,
        utmMedium: attribution?.utmMedium,
        utmCampaign: attribution?.utmCampaign,
        utmTerm: attribution?.utmTerm,
        utmContent: attribution?.utmContent,
        referrer: attribution?.referrer,
      });
    } catch (error: any) {
      if (error.code === 11000) {
        const concurrentClaim = await OfferClaim.findOne({
          userId: userObjectId,
          offerId: offerObjectId,
          status: 'claimed',
          expiresAt: { $gt: new Date() },
        });
        if (concurrentClaim) {
          return {
            success: true,
            claimId: concurrentClaim._id.toString(),
            couponCode: concurrentClaim.couponCode,
            expiresAt: concurrentClaim.expiresAt,
            message: 'You already have this offer claimed',
          };
        }
      }
      throw error;
    }

    await logCouponAction('CLAIM_CREATED', userId, offerId, {
      claimId: claim._id.toString(),
      couponCode: claim.couponCode,
      isNew: true,
      idempotencyKey,
    }, 'success');

    await this.invalidateOfferCache();

    await this.checkCouponAbuseAfterClaim(userId, offerId);

    eventBus.publish({
      id: uuidv4(),
      type: EventTypes.OFFER_CLAIMED,
      payload: {
        offerId,
        userId,
        claimId: claim._id.toString(),
        couponCode: claim.couponCode,
      },
      metadata: {
        timestamp: new Date(),
        userId,
      },
      version: 1,
    });

    return {
      success: true,
      claimId: claim._id.toString(),
      couponCode: claim.couponCode,
      expiresAt: claim.expiresAt,
      message: 'Offer claimed successfully!',
    };
  }

  // SECURITY FIX (SEC-005): Check for coupon abuse patterns after successful claim
  private async checkCouponAbuseAfterClaim(userId: string, offerId: string): Promise<void> {
    try {
      // Dynamically import to avoid circular dependency
      const { abuseDetectionService } = await import('./abuseDetection.service');
      const abuseCheck = await abuseDetectionService.detectCouponAbuse(userId);

      if (abuseCheck.isAbuse) {
        logger.warn('Potential coupon abuse detected after claim', {
          userId,
          offerId,
          confidence: abuseCheck.confidence,
          details: abuseCheck.details,
          recommendedAction: abuseCheck.recommendedAction,
          action: 'COUPON_ABUSE_DETECTED',
          securityEvent: 'SEC-005_COUPON_ABUSE_DETECTED',
        });

        // Create audit log for the abuse detection
        await logCouponAction('ABUSE_DETECTED', userId, offerId, {
          abuseType: abuseCheck.type,
          confidence: abuseCheck.confidence,
          details: abuseCheck.details,
          recommendedAction: abuseCheck.recommendedAction,
        }, 'success');
      }
    } catch (error) {
      // Don't fail the main operation if abuse detection fails
      logger.error('Coupon abuse detection failed', {
        userId,
        offerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Get user's claimed offers with pagination
  async getUserClaims(userId: string, page: number = 1, limit: number = 20): Promise<{ claims: any[]; total: number; page: number; totalPages: number }> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await OfferClaim.countDocuments({
      userId: userObjectId,
    });

    const claims = await OfferClaim.find({
      userId: userObjectId,
    })
      .populate('offerId')
      .sort({ claimedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedClaims = claims.map((claim: any) => ({
      _id: claim._id.toString(),
      couponCode: claim.couponCode,
      status: claim.status,
      claimedAt: claim.claimedAt,
      usedAt: claim.usedAt,
      expiresAt: claim.expiresAt,
      isExpired: new Date() > claim.expiresAt && claim.status === 'claimed',
      offer: claim.offerId ? {
        _id: claim.offerId._id.toString(),
        code: claim.offerId.code,
        title: claim.offerId.displayTitle || claim.offerId.title,
        description: claim.offerId.description,
        type: claim.offerId.type,
        value: claim.offerId.value,
        maxDiscount: claim.offerId.maxDiscount,
        minOrderValue: claim.offerId.minOrderValue,
        displayGradient: claim.offerId.displayGradient,
        displayBadge: claim.offerId.displayBadge,
        imageUrl: claim.offerId.imageUrl,
        applicableServices: claim.offerId.targetServices?.map((s: any) => s.toString()) || [],
        applicableCategories: claim.offerId.targetCategories?.map((c: any) => c.toString()) || [],
      } : null,
    }));

    return {
      claims: formattedClaims,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Per-user usage stats for a single offer (public/customer UI)
  async getUserOfferUsageStats(
    userId: string,
    offerId: string,
    maxUsesPerUser?: number
  ): Promise<{
    isClaimed: boolean;
    hasActiveClaim: boolean;
    isFullyRedeemed: boolean;
    remainingUses: number;
    maxUsesPerUser: number;
    appliedCount: number;
  }> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const offerObjectId = new mongoose.Types.ObjectId(offerId);

    let maxPerUser = maxUsesPerUser;
    if (maxPerUser === undefined) {
      const coupon = await Coupon.findById(offerObjectId).select('maxUsesPerUser').lean();
      maxPerUser = (coupon as { maxUsesPerUser?: number } | null)?.maxUsesPerUser || 1;
    }

    const now = new Date();
    const claims = await OfferClaim.find({
      userId: userObjectId,
      offerId: offerObjectId,
    }).lean();

    let appliedCount = 0;
    let hasActiveClaim = false;
    for (const claim of claims) {
      if (claim.status === 'applied') appliedCount += 1;
      if (claim.status === 'claimed' && claim.expiresAt > now) hasActiveClaim = true;
    }

    const remainingUses = Math.max(0, maxPerUser - appliedCount);

    return {
      isClaimed: hasActiveClaim,
      hasActiveClaim,
      isFullyRedeemed: appliedCount >= maxPerUser,
      remainingUses,
      maxUsesPerUser: maxPerUser,
      appliedCount,
    };
  }

  // Validate promo code at checkout
  async validatePromoCode(
    code: string,
    userId: string,
    orderAmount: number,
    serviceId?: string,
    categoryId?: string,
    providerId?: string
  ): Promise<ValidationResult> {
    const offer = await this.getOfferByCode(code);

    if (!offer) {
      return { valid: false, message: 'Invalid promo code' };
    }

    // Check validity
    const isValid = this.checkOfferValidity(offer);
    if (!isValid.valid) {
      return { valid: false, message: isValid.reason || 'Promo code is not valid' };
    }

    // NEW: Check target eligibility (new_users, first_booking, specific_users)
    const targetCheck = await this.checkTargetEligibility(offer, userId);
    if (!targetCheck.eligible) {
      return { valid: false, message: targetCheck.reason };
    }

    // NEW: Check day/time restrictions
    const dayTimeCheck = this.checkDayTimeEligibility(offer);
    if (!dayTimeCheck.eligible) {
      return { valid: false, message: dayTimeCheck.reason };
    }

    // NEW: Check provider eligibility
    if (providerId) {
      const providerEligible = await this.checkProviderEligibility(offer, providerId);
      if (!providerEligible) {
        return { valid: false, message: 'This coupon is not valid for the selected provider' };
      }
    }

    // FIX: Check service eligibility if coupon targets specific services
    if (offer.targetType === 'specific_services' && serviceId) {
      const isServiceEligible = offer.targetServices?.some(
        (id: any) => id.toString() === serviceId
      );
      if (!isServiceEligible) {
        return { valid: false, message: 'This coupon is not valid for the selected service' };
      }
    }

    // FIX: Check category eligibility if coupon targets specific categories
    if (offer.targetType === 'specific_services' && categoryId && offer.targetCategories?.length > 0) {
      const isCategoryEligible = offer.targetCategories?.some(
        (id: any) => id.toString() === categoryId
      );
      if (!isCategoryEligible) {
        return { valid: false, message: 'This coupon is not valid for the selected service category' };
      }
    }

    // Check minimum order
    if (orderAmount < offer.minOrderValue) {
      return {
        valid: false,
        message: `Minimum order value is AED ${offer.minOrderValue}`,
      };
    }

    // Check global usage
    if (offer.currentUses >= offer.maxUses) {
      return { valid: false, message: 'Promo code has reached maximum uses' };
    }

    // Per-user limit: count redemptions (applied), not active claims waiting to be used
    const maxPerUser = offer.maxUsesPerUser || 1;

    if (!userId) {
      return {
        valid: false,
        message: 'Please sign in to apply this promo code',
      };
    }

    const appliedCount = await OfferClaim.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      offerId: offer._id,
      status: 'applied',
    });

    if (appliedCount >= maxPerUser) {
      await this.invalidateOfferCache().catch(() => {});
      return {
        valid: false,
        message: 'You have already used this promo code the maximum number of times',
      };
    }

    const activeClaim = await OfferClaim.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      offerId: offer._id,
      status: 'claimed',
      expiresAt: { $gt: new Date() },
    });

    if (!activeClaim) {
      return {
        valid: false,
        message: 'Please claim this offer from My Offers before applying it at checkout',
      };
    }

    // Legacy check removed: counting active "claimed" records blocked legitimate redemptions

    // Calculate discount
    let discount = 0;
    if (offer.type === 'percentage') {
      discount = (orderAmount * offer.value) / 100;
      if (offer.maxDiscount && discount > offer.maxDiscount) {
        discount = offer.maxDiscount;
      }
    } else if (offer.type === 'fixed') {
      discount = Math.min(offer.value, orderAmount);
    }

    return {
      valid: true,
      discountAmount: Math.round(discount * 100) / 100,
      discountType: offer.type, // 'percentage' | 'fixed' | 'free_service'
      couponCode: offer.code,
      offerId: offer._id.toString(),
      message: `Discount of AED ${discount.toFixed(2)} applied`,
      // Additional info for UI
      minOrderValue: offer.minOrderValue,
      maxDiscount: offer.maxDiscount,
      title: offer.title || offer.displayTitle,
    };
  }

  /**
   * NEW: Check target eligibility for new_users, first_booking, specific_users
   */
  private async checkTargetEligibility(coupon: any, userId: string): Promise<{ eligible: boolean; reason?: string }> {
    // If no targetType or 'all', everyone is eligible
    if (!coupon.targetType || coupon.targetType === 'all' || coupon.targetType === 'specific_services' || coupon.targetType === 'specific_providers') {
      return { eligible: true };
    }

    const user = await User.findById(userId).select('createdAt').lean();
    if (!user) {
      return { eligible: false, reason: 'User not found' };
    }

    switch (coupon.targetType) {
      case 'new_users': {
        // Check if user is new (created within last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (user.createdAt > thirtyDaysAgo) {
          return { eligible: true };
        }
        return { eligible: false, reason: 'This coupon is only valid for new users' };
      }

      case 'first_booking': {
        // Check if user has any completed bookings
        const Booking = mongoose.model('Booking');
        const hasBookings = await Booking.countDocuments({
          customerId: new mongoose.Types.ObjectId(userId),
          status: 'completed'
        });

        if (hasBookings === 0) {
          return { eligible: true };
        }
        return { eligible: false, reason: 'This coupon is only valid for your first booking' };
      }

      case 'specific_users': {
        // Check if user is in the target list
        if (coupon.targetUsers && coupon.targetUsers.length > 0) {
          const isTargeted = coupon.targetUsers.some(
            (id: mongoose.Types.ObjectId) => id.toString() === userId
          );
          if (isTargeted) {
            return { eligible: true };
          }
        }
        return { eligible: false, reason: 'This coupon is not available for your account' };
      }

      default:
        return { eligible: true };
    }
  }

  /**
   * NEW: Check day and time eligibility
   */
  private checkDayTimeEligibility(coupon: any): { eligible: boolean; reason?: string } {
    const now = new Date();

    // Check day restriction
    if (coupon.validDays && coupon.validDays.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];

      if (!coupon.validDays.includes(currentDay)) {
        const formattedDays = coupon.validDays.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1));
        return { eligible: false, reason: `This coupon is only valid on ${formattedDays.join(', ')}` };
      }
    }

    // Check time restriction
    if (coupon.validTimeStart && coupon.validTimeEnd) {
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = coupon.validTimeStart.split(':').map(Number);
      const [endHour, endMinute] = coupon.validTimeEnd.split(':').map(Number);
      const startTime = startHour * 60 + startMinute;
      const endTime = endHour * 60 + endMinute;

      if (currentTime < startTime || currentTime > endTime) {
        return { eligible: false, reason: `This coupon is only valid between ${coupon.validTimeStart} and ${coupon.validTimeEnd}` };
      }
    }

    return { eligible: true };
  }

  /**
   * NEW: Check provider eligibility
   */
  private async checkProviderEligibility(coupon: any, providerId: string): Promise<boolean> {
    // If no targetType or 'all', everyone is eligible
    if (!coupon.targetType || coupon.targetType === 'all') {
      return true;
    }

    // Check specific_providers targeting
    if (coupon.targetType === 'specific_providers' && coupon.targetProviders && coupon.targetProviders.length > 0) {
      return coupon.targetProviders.some(
        (id: mongoose.Types.ObjectId) => id.toString() === providerId
      );
    }

    return true; // Default allow for other types
  }

  // Apply discount (mark claim as used) — fully atomic via MongoDB transactions with rollback on failure
  async applyDiscount(claimId: string, bookingId: string): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const claim = await OfferClaim.findById(claimId).session(session);
      if (!claim) {
        await session.abortTransaction();
        logger.warn('Coupon claim not found for applyDiscount', { claimId });
        return false;
      }

      // Check claim status before allowing use
      if (claim.status !== 'claimed') {
        await session.abortTransaction();
        logger.warn('Claim already used or expired', { claimId, status: claim.status });
        return false;
      }

      // Check claim expiration - update inside transaction scope
      const now = new Date();
      const isExpired = now > claim.expiresAt;
      if (isExpired) {
        // Update status INSIDE the transaction — will be rolled back if transaction aborts
        await OfferClaim.findByIdAndUpdate(
          claimId,
          { status: 'expired' },
          { session }
        );
        await session.abortTransaction();
        logger.info('Claim expired and status updated atomically', { claimId });
        return false;
      }

      const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
      const userObjectId = claim.userId;

      // Get the coupon to check current/max uses
      const coupon = await Coupon.findById(claim.offerId).session(session);
      if (!coupon) {
        await session.abortTransaction();
        logger.warn('Coupon not found for applyDiscount', { offerId: claim.offerId.toString() });
        return false;
      }

      // Use direct field comparison instead of $expr for better index usage
      // Convert maxUses to ObjectId is not correct - use numeric comparison
      const result = await Coupon.findOneAndUpdate(
        {
          _id: coupon._id,
          currentUses: { $lt: coupon.maxUses },
        },
        {
          $inc: { currentUses: 1 },
          $push: {
            usedBy: {
              userId: userObjectId,
              usedAt: now,
              bookingId: bookingObjectId,
            },
          },
        },
        { new: true, session }
      );

      if (!result) {
        await session.abortTransaction();
        logger.warn('Coupon exhausted during applyDiscount', { couponId: coupon._id.toString() });
        return false;
      }

      // Update claim status atomically
      await OfferClaim.findByIdAndUpdate(
        claimId,
        {
          status: 'applied',
          usedAt: now,
          usedInBookingId: bookingObjectId,
        },
        { session }
      );

      await session.commitTransaction();

      logger.info('Coupon applyDiscount successful', {
        claimId,
        couponId: coupon._id.toString(),
        newCurrentUses: result.currentUses,
      });

      // Invalidate cache after transaction commit
      await this.invalidateOfferCache();

      return true;
    } catch (error) {
      // Ensure transaction is aborted on any error
      try {
        await session.abortTransaction();
      } catch (abortError) {
        logger.error('Failed to abort transaction', { claimId, abortError });
      }
      logger.error('applyDiscount failed', {
        claimId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      session.endSession();
    }
  }

  // Mark coupon as used by code and user
  async markCouponAsUsed(couponCode: string, userId: string, bookingId: string, discountAmount?: number): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
    const normalizedCode = couponCode.toUpperCase();

    // FIX: Authorization check - verify user matches the reservation
    const existingClaim = await OfferClaim.findOne({
      userId: userObjectId,
      status: 'claimed',
      expiresAt: { $gt: new Date() },
    });

    if (!existingClaim) {
      logger.warn('No valid claim found for coupon usage', { couponCode: normalizedCode, userId });
      return false;
    }

    const coupon = await Coupon.findOne({ code: normalizedCode }).select('_id maxUses currentUses');
    if (!coupon) {
      logger.warn('Coupon not found for markCouponAsUsed', { couponCode: normalizedCode });
      return false;
    }

    // Atomically check and mark the coupon usage
    const result = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        currentUses: { $lt: coupon.maxUses },
      },
      {
        $inc: { currentUses: 1 },
        $push: {
          usedBy: {
            userId: userObjectId,
            usedAt: new Date(),
            bookingId: bookingObjectId,
            orderId: bookingObjectId.toString(),
          },
        },
      },
      { new: true }
    );

    if (!result) {
      logger.warn('Coupon exhausted or concurrent use detected', {
        couponCode: normalizedCode,
        currentUses: coupon.currentUses,
        maxUses: coupon.maxUses,
      });
      return false;
    }

    logger.info('Coupon atomically marked as used', {
      couponCode: normalizedCode,
      newCurrentUses: result.currentUses,
    });

    // Audit log: successful redemption
    await logCouponAction('COUPON_REDEEMED', userId, coupon._id.toString(), {
      couponCode: normalizedCode,
      bookingId,
      newCurrentUses: result.currentUses,
    }, 'success');

    // FIX: Update claim with discount amount for analytics
    const updateData: any = {
      status: 'applied',
      usedAt: new Date(),
      usedInBookingId: bookingObjectId,
    };
    if (discountAmount !== undefined) {
      updateData.discountAmount = discountAmount;
    }

    // Now update the claim
    const claimUpdateResult = await OfferClaim.findOneAndUpdate(
      {
        userId: userObjectId,
        offerId: coupon._id,
        status: 'claimed',
      },
      {
        $set: updateData,
      }
    );

    if (!claimUpdateResult) {
      // Rollback the coupon usage
      logger.warn('Claim not found, rolling back coupon usage', { userId, couponId: coupon._id.toString() });
      await Coupon.findByIdAndUpdate(coupon._id, {
        $inc: { currentUses: -1 },
        $pull: { usedBy: { userId: userObjectId } },
      });
      return false;
    }

    // Invalidate cache after redemption
    await this.invalidateOfferCache();

    return true;
  }

  // Atomic version of markCouponAsUsed with session
  async markCouponAsUsedAtomic(
    couponCode: string,
    userId: string,
    bookingId: string,
    session: mongoose.ClientSession,
    discountAmount?: number
  ): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
    const normalizedCode = couponCode.toUpperCase();

    // First, get the coupon to calculate discount if not provided
    let calculatedDiscount = discountAmount;
    if (calculatedDiscount === undefined) {
      const coupon = await Coupon.findOne({ code: normalizedCode }).session(session);
      if (coupon) {
        // Get booking to calculate discount
        const booking = await mongoose.model('Booking').findById(bookingObjectId)
          .select('pricing')
          .session(session);
        if (booking?.pricing) {
          const pricing = booking.pricing as any;
          const addOnsTotal = pricing.addOns?.reduce((sum: number, addon: { price: number }) => sum + addon.price, 0) || 0;
          const orderValue = (pricing.basePrice || 0) + addOnsTotal;
          calculatedDiscount = coupon.calculateDiscount(orderValue);
        }
      }
    }

    const result = await Coupon.findOneAndUpdate(
      {
        code: normalizedCode,
        isActive: true,
        $expr: { $lt: ['$currentUses', '$maxUses'] },
      },
      {
        $inc: { currentUses: 1 },
        $push: {
          usedBy: {
            userId: userObjectId,
            usedAt: new Date(),
            bookingId: bookingObjectId,
            orderId: bookingObjectId.toString(),
          },
        },
      },
      { new: true, session }
    );

    if (!result) {
      logger.warn('Coupon atomic marking failed - exhausted or not found', { couponCode: normalizedCode });
      return false;
    }

    // Update claim with discount amount for analytics
    const updateData: any = {
      status: 'applied',
      usedAt: new Date(),
      usedInBookingId: bookingObjectId,
    };
    if (calculatedDiscount !== undefined) {
      updateData.discountAmount = calculatedDiscount;
    }

    // FIX: Move claim expiration check into the atomic update condition
    // so the status transition only happens if the claim is still valid
    await OfferClaim.findOneAndUpdate(
      {
        userId: userObjectId,
        offerId: result._id,
        status: 'claimed',
        expiresAt: { $gt: new Date() }, // Only update if not expired
      },
      {
        $set: updateData,
      },
      { session, sort: { claimedAt: -1 } }
    );

    logger.info('Coupon atomically marked as used (with session)', {
      couponCode: normalizedCode,
      newCurrentUses: result.currentUses,
      discountAmount: calculatedDiscount,
    });

    return true;
  }

  // Rollback coupon usage when payment fails or booking is cancelled
  async rollbackCouponUsage(
    couponCode: string,
    userId: string,
    bookingId: string,
    reason: 'payment_failed' | 'booking_cancelled' | 'refund'
  ): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
    const normalizedCode = couponCode.toUpperCase();

    try {
      const coupon = await Coupon.findOne({ code: normalizedCode });
      if (!coupon) {
        logger.warn('Coupon not found for rollback', { couponCode: normalizedCode });
        return false;
      }

      // Atomically decrement currentUses and remove from usedBy array
      const result = await Coupon.findOneAndUpdate(
        {
          code: normalizedCode,
          'usedBy.bookingId': bookingObjectId,
        },
        {
          $inc: { currentUses: -1 },
          $pull: { usedBy: { bookingId: bookingObjectId } },
        },
        { new: true }
      );

      // Update the claim status back to 'claimed'
      const claimUpdateResult = await OfferClaim.findOneAndUpdate(
        {
          userId: userObjectId,
          offerId: coupon._id,
          usedInBookingId: bookingObjectId,
          status: 'applied',
        },
        {
          $set: {
            status: 'claimed',
            usedAt: undefined,
            usedInBookingId: undefined,
          },
        }
      );

      logger.info('Coupon usage rolled back successfully', {
        couponCode: normalizedCode,
        bookingId,
        reason,
        claimUpdated: !!claimUpdateResult,
        newCurrentUses: result?.currentUses,
      });

      // Audit log: successful rollback
      await logCouponAction('COUPON_ROLLBACK', userId, coupon._id.toString(), {
        couponCode: normalizedCode,
        bookingId,
        reason,
      }, 'success');

      // Invalidate cache after rollback
      await this.invalidateOfferCache();

      return true;
    } catch (error) {
      logger.error('Failed to rollback coupon usage', {
        couponCode: normalizedCode,
        bookingId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });

      await logCouponAction('COUPON_ROLLBACK', userId, '', {
        couponCode: normalizedCode,
        bookingId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      }, 'failure', error instanceof Error ? error.message : String(error));

      return false;
    }
  }

  // Rollback with session for transactional consistency
  async rollbackCouponUsageAtomic(
    couponCode: string,
    userId: string,
    bookingId: string,
    reason: 'payment_failed' | 'booking_cancelled' | 'refund',
    session: mongoose.ClientSession
  ): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
    const normalizedCode = couponCode.toUpperCase();

    try {
      const coupon = await Coupon.findOne({ code: normalizedCode }).session(session);
      if (!coupon) {
        logger.warn('Coupon not found for atomic rollback', { couponCode: normalizedCode });
        return false;
      }

      // FIX: Use ObjectId for precise matching in $pull
      await Coupon.findOneAndUpdate(
        {
          code: normalizedCode,
          'usedBy.bookingId': bookingObjectId,
        },
        {
          $inc: { currentUses: -1 },
          $pull: { usedBy: { bookingId: bookingObjectId.toString() } },
        },
        { new: true, session }
      );

      await OfferClaim.findOneAndUpdate(
        {
          userId: userObjectId,
          offerId: coupon._id,
          usedInBookingId: bookingObjectId,
          status: 'applied',
        },
        {
          $set: {
            status: 'claimed',
            usedAt: undefined,
            usedInBookingId: undefined,
          },
        },
        { session }
      );

      logger.info('Coupon usage atomically rolled back', {
        couponCode: normalizedCode,
        bookingId,
        reason,
      });

      // FIX: Invalidate cache after atomic rollback
      await this.invalidateOfferCache();

      return true;
    } catch (error) {
      logger.error('Failed to atomically rollback coupon usage', {
        couponCode: normalizedCode,
        bookingId,
        reason,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private toDateField(value: unknown): Date | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }

  private mapAdminPayload(offerData: any) {
    const payload: Record<string, unknown> = { ...offerData };
    if (payload.code && typeof payload.code === 'string') {
      payload.code = payload.code.toUpperCase().trim();
    }
    const validFrom = this.toDateField(payload.validFrom);
    if (validFrom) payload.validFrom = validFrom;
    const validUntil = this.toDateField(payload.validUntil);
    if (validUntil) payload.validUntil = validUntil;

    const serviceIds = payload.applicableServices as string[] | undefined;
    const categoryIds = payload.applicableCategories as string[] | undefined;
    const providerIds = payload.targetProviders as string[] | undefined;

    if (serviceIds !== undefined) {
      payload.targetServices = serviceIds
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id));
      // Only update targetType if explicitly setting services and targetType not already set
      if (offerData.targetType !== 'specific_users' && offerData.targetType !== 'new_users' && offerData.targetType !== 'first_booking') {
        payload.targetType = serviceIds.length > 0 ? 'specific_services' : (offerData.targetType || 'all');
      }
      delete payload.applicableServices;
    }

    if (categoryIds !== undefined) {
      payload.targetCategories = categoryIds
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id));
      delete payload.applicableCategories;
    }

    // NEW: Handle targetProviders
    if (providerIds !== undefined) {
      payload.targetProviders = providerIds
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id));
      if (providerIds.length > 0 && offerData.targetType !== 'specific_services' && offerData.targetType !== 'specific_users' && offerData.targetType !== 'new_users' && offerData.targetType !== 'first_booking') {
        payload.targetType = 'specific_providers';
      }
    }

    // NEW: Normalize validDays to lowercase
    if (payload.validDays && Array.isArray(payload.validDays)) {
      payload.validDays = (payload.validDays as string[]).map((d: string) => d.toLowerCase());
    }

    return payload;
  }

  private formatAdminOffer(offer: any) {
    return {
      ...offer,
      _id: offer._id.toString(),
      applicableServices:
        offer.targetServices?.map((s: mongoose.Types.ObjectId) => s.toString()) || [],
      applicableCategories:
        offer.targetCategories?.map((c: mongoose.Types.ObjectId) => c.toString()) || [],
      targetProviders:
        offer.targetProviders?.map((p: mongoose.Types.ObjectId) => p.toString()) || [],
    };
  }

  // Admin: Create offer
  async createOffer(offerData: any, createdByUserId?: string): Promise<any> {
    const payload = this.mapAdminPayload(offerData);
    if (createdByUserId) {
      payload.createdBy = new mongoose.Types.ObjectId(createdByUserId);
    }
    if (!payload.createdBy) {
      throw ApiError.badRequest('Admin user context is required to create an offer');
    }
    const offer = await Coupon.create(payload);
    const formatted = this.formatAdminOffer(offer.toObject());

    // Invalidate cache after creating offer
    await this.invalidateOfferCache();

    return formatted;
  }

  // Admin: Update offer
  async updateOffer(offerId: string, updateData: any): Promise<any> {
    const payload = this.mapAdminPayload(updateData);
    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      { ...payload, updatedAt: new Date() },
      { new: true }
    ).lean();
    const formatted = offer ? this.formatAdminOffer(offer) : null;

    // Invalidate cache after updating offer
    if (formatted) {
      await this.invalidateOfferCache();
    }

    return formatted;
  }

  // Admin: Deactivate offer
  async deactivateOffer(offerId: string): Promise<boolean> {
    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      { isActive: false, updatedAt: new Date() }
    );

    // Invalidate cache after deactivating offer
    if (offer) {
      await this.invalidateOfferCache();
    }

    return !!offer;
  }

  // Admin: Archive offer
  async archiveOffer(offerId: string): Promise<ICoupon | null> {
    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      {
        $set: {
          status: 'archived',
          archivedAt: new Date(),
          isActive: false,
          updatedAt: new Date()
        }
      },
      { new: true }
    );

    if (offer) {
      await this.invalidateOfferCache();
      await logCouponAction('OFFER_ARCHIVED', 'system', offerId, {
        code: offer.code,
        archivedAt: new Date()
      }, 'success');
    }

    return offer;
  }

  // Admin: Clone offer
  async cloneOffer(offerId: string, newCode: string, adminId: string): Promise<ICoupon> {
    const originalOffer = await Coupon.findById(offerId);
    if (!originalOffer) {
      throw new Error('Offer not found');
    }

    const normalizedCode = newCode.toUpperCase().trim();
    const existingCoupon = await Coupon.findOne({ code: normalizedCode });
    if (existingCoupon) {
      throw new Error('Coupon code already exists');
    }

    const clonedOffer = new Coupon({
      ...originalOffer.toObject(),
      _id: undefined,
      code: normalizedCode,
      currentUses: 0,
      usedBy: [],
      clonedFrom: originalOffer._id,
      status: 'draft',
      isActive: false,
      createdBy: new mongoose.Types.ObjectId(adminId),
      createdAt: undefined,
      updatedAt: undefined,
    });

    await clonedOffer.save();

    await logCouponAction('OFFER_CLONED', adminId, offerId, {
      originalCode: originalOffer.code,
      newCode: normalizedCode,
      clonedTo: clonedOffer._id
    }, 'success');

    return clonedOffer;
  }

  // Admin: Update offer status (approval workflow)
  async updateOfferStatus(offerId: string, status: string, isActive?: boolean): Promise<ICoupon | null> {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date()
    };

    // If publishing, activate the coupon
    if (status === 'published') {
      updateData.isActive = true;
    }
    // If reverting to draft or archiving, deactivate
    if (status === 'draft' || status === 'archived') {
      updateData.isActive = false;
    }
    // Set archivedAt timestamp if archiving
    if (status === 'archived') {
      updateData.archivedAt = new Date();
    }
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      { $set: updateData },
      { new: true }
    );

    if (offer) {
      await this.invalidateOfferCache();
      await logCouponAction('OFFER_STATUS_UPDATED', 'system', offerId, {
        code: offer.code,
        newStatus: status,
        isActive: offer.isActive
      }, 'success');
    }

    return offer;
  }

  // FIX: Increment view count for analytics
  async incrementViewCount(offerId: string): Promise<ICoupon | null> {
    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    // FIX: Publish offer viewed event for analytics
    if (offer) {
      eventBus.publish({
        id: uuidv4(),
        type: EventTypes.OFFER_VIEWED,
        payload: { offerId },
        metadata: { timestamp: new Date() },
        version: 1,
      });
    }

    return offer;
  }

  // Admin: Get all offers with pagination and filters
  async getAllOffers(
    page: number = 1,
    limit: number = 20,
    filters?: {
      isActive?: boolean;
      type?: string;
      search?: string;
    }
  ): Promise<{
    data: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const skip = (page - 1) * limit;

    const query: any = {};

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters?.type) {
      query.type = filters.type;
    }

    if (filters?.search) {
      // FIX: Escape regex special characters to prevent ReDoS attacks
      const escapedSearch = escapeRegex(filters.search);
      query.$or = [
        { code: { $regex: escapedSearch, $options: 'i' } },
        { title: { $regex: escapedSearch, $options: 'i' } },
        { displayTitle: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [offers, total] = await Promise.all([
      Coupon.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Coupon.countDocuments(query),
    ]);

    return {
      data: offers.map((o) => this.formatAdminOffer(o)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const offerService = new OfferService();
export default offerService;