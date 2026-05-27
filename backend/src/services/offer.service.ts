import Coupon, { ICoupon } from '../models/coupon.model';
import { OfferClaim } from '../models/offerClaim.model';
import mongoose from 'mongoose';
import logger from '../utils/logger';

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
  isClaimed?: boolean; // Whether the current user has claimed this offer
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
  discount?: number;
  message?: string;
  couponCode?: string;
  offerId?: string;
}

export class OfferService {
  // Get active offers for homepage (public)
  async getActiveOffers(userId?: string): Promise<OfferResponse[]> {
    const now = new Date();

    const offers = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
    }).sort({ featured: -1, createdAt: -1 }).lean();

    // If userId provided, get their claimed offers
    let claimedOfferIds: Set<string> = new Set();
    if (userId) {
      const claims = await OfferClaim.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
      claimedOfferIds = new Set(claims.map(c => c.offerId.toString()));
    }

    return offers.map((offer: any) => ({
      _id: offer._id.toString(),
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
      applicableServices: offer.targetServices?.map((s: any) => s.toString()) || offer.applicableServices || [],
      applicableCategories: offer.targetCategories?.map((c: any) => c.toString()) || offer.applicableCategories || [],
      isClaimed: claimedOfferIds.has(offer._id.toString()),
    }));
  }

  // Get single offer by ID with full service details
  async getOfferById(offerId: string): Promise<any> {
    const offer = await Coupon.findById(offerId)
      .populate('targetServices', 'name shortDescription price duration images rating providerId category')
      .populate('targetCategories', 'name')
      .lean();

    if (!offer) return null;

    // Get provider details for each service
    const servicesWithProviders = await Promise.all(
      ((offer as any).targetServices || []).map(async (service: any) => {
        if (service.providerId) {
          const provider = await mongoose.model('User').findById(service.providerId)
            .select('firstName lastName avatar')
            .lean();
          service.provider = provider;
        }
        return {
          _id: service._id.toString(),
          name: service.name,
          shortDescription: service.shortDescription,
          price: service.price,
          duration: service.duration,
          images: service.images || [],
          rating: service.rating || { average: 0, count: 0 },
          category: service.category,
          provider: service.provider ? {
            _id: service.provider._id.toString(),
            firstName: service.provider.firstName,
            lastName: service.provider.lastName,
            avatar: service.provider.avatar,
          } : null,
        };
      })
    );

    return {
      _id: (offer as any)._id.toString(),
      title: (offer as any).displayTitle || (offer as any).title,
      description: (offer as any).description,
      code: (offer as any).code,
      type: (offer as any).type,
      value: (offer as any).value,
      maxDiscount: (offer as any).maxDiscount,
      minOrderValue: (offer as any).minOrderValue,
      displayTitle: (offer as any).displayTitle,
      displaySubtitle: (offer as any).displaySubtitle,
      displayGradient: (offer as any).displayGradient,
      displayBadge: (offer as any).displayBadge,
      imageUrl: (offer as any).imageUrl,
      featured: (offer as any).featured,
      validFrom: (offer as any).validFrom,
      validUntil: (offer as any).validUntil,
      applicableServices: servicesWithProviders,
      applicableCategories: ((offer as any).targetCategories || []).map((c: any) => ({
        _id: c._id.toString(),
        name: c.name,
      })),
    };
  }

  // Get offer by promo code
  async getOfferByCode(code: string): Promise<any> {
    return Coupon.findOne({ code: code.toUpperCase(), isActive: true }).lean();
  }

  // Check if offer is valid (for lean documents)
  private checkOfferValidity(offer: any): { valid: boolean; reason?: string } {
    const now = new Date();

    if (!offer.isActive) {
      return { valid: false, reason: 'Offer is inactive' };
    }

    if (new Date(offer.validFrom) > now) {
      return { valid: false, reason: 'Offer is not yet valid' };
    }

    if (new Date(offer.validUntil) < now) {
      return { valid: false, reason: 'Offer has expired' };
    }

    if (offer.currentUses >= offer.maxUses) {
      return { valid: false, reason: 'Offer usage limit reached' };
    }

    return { valid: true };
  }

  // Claim an offer
  async claimOffer(userId: string, offerId: string): Promise<ClaimResponse> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const offerObjectId = new mongoose.Types.ObjectId(offerId);

    // Get the offer
    const offer = await Coupon.findById(offerId).lean();
    if (!offer) {
      return { success: false, message: 'Offer not found' };
    }

    // Check offer validity
    const isValid = this.checkOfferValidity(offer);
    if (!isValid.valid) {
      return { success: false, message: isValid.reason || 'Offer is not valid' };
    }

    // Check global usage limit
    if ((offer as any).currentUses >= (offer as any).maxUses) {
      return { success: false, message: 'Offer has reached maximum uses' };
    }

    // Check user claim limit
    const userClaimsCount = await OfferClaim.countDocuments({
      userId: userObjectId,
      offerId: offerObjectId,
    });

    if (userClaimsCount >= ((offer as any).maxUsesPerUser || 1)) {
      return { success: false, message: 'You have already claimed this offer' };
    }

    // Check if user already has an active (non-expired) claim
    const existingClaim = await OfferClaim.findOne({
      userId: userObjectId,
      offerId: offerObjectId,
      status: { $in: ['claimed'] },
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

    // Calculate expiry date
    const claimExpiresInDays = (offer as any).claimExpiresInDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + claimExpiresInDays);

    // Create claim
    const claim = await OfferClaim.create({
      userId: userObjectId,
      offerId: offerObjectId,
      couponCode: (offer as any).code,
      status: 'claimed',
      expiresAt,
    });

    return {
      success: true,
      claimId: claim._id.toString(),
      couponCode: claim.couponCode,
      expiresAt: claim.expiresAt,
      message: 'Offer claimed successfully!',
    };
  }

  // Get user's claimed offers
  async getUserClaims(userId: string): Promise<any[]> {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const claims = await OfferClaim.find({
      userId: userObjectId,
    })
      .populate('offerId')
      .sort({ claimedAt: -1 })
      .lean();

    return claims.map((claim: any) => ({
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
        applicableServices: claim.offerId.targetServices?.map((s: any) => s.toString()) || claim.offerId.applicableServices || [],
        applicableCategories: claim.offerId.targetCategories?.map((c: any) => c.toString()) || claim.offerId.applicableCategories || [],
      } : null,
    }));
  }

  // Validate promo code at checkout
  async validatePromoCode(code: string, userId: string, orderAmount: number): Promise<ValidationResult> {
    const offer = await this.getOfferByCode(code);

    if (!offer) {
      return { valid: false, message: 'Invalid promo code' };
    }

    // Check validity
    const isValid = this.checkOfferValidity(offer);
    if (!isValid.valid) {
      return { valid: false, message: isValid.reason || 'Promo code is not valid' };
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

    // Check user claim limit
    const userClaimsCount = await OfferClaim.countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      offerId: offer._id,
    });

    if (userClaimsCount >= (offer.maxUsesPerUser || 1)) {
      return { valid: false, message: 'You have reached the limit for this promo code' };
    }

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
      discount: Math.round(discount * 100) / 100,
      couponCode: offer.code,
      offerId: offer._id.toString(),
      message: `Discount of AED ${discount.toFixed(2)} applied`,
    };
  }

  // Apply discount (mark claim as used)
  // Uses atomic findOneAndUpdate to prevent race conditions (double-use)
  async applyDiscount(claimId: string, bookingId: string): Promise<boolean> {
    const claim = await OfferClaim.findById(claimId);
    if (!claim) {
      logger.warn('Coupon claim not found for applyDiscount', {
        context: 'OfferService',
        action: 'CLAIM_NOT_FOUND',
        claimId,
      });
      return false;
    }

    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
    const userObjectId = claim.userId;

    // Get the coupon to check current/max uses
    const coupon = await Coupon.findById(claim.offerId).select('_id maxUses currentUses');
    if (!coupon) {
      logger.warn('Coupon not found for applyDiscount', {
        context: 'OfferService',
        action: 'COUPON_NOT_FOUND',
        offerId: claim.offerId.toString(),
      });
      return false;
    }

    // Atomically check and increment coupon usage
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
          },
        },
      },
      { new: true }
    );

    if (!result) {
      logger.warn('Coupon exhausted during applyDiscount', {
        context: 'OfferService',
        action: 'COUPON_EXHAUSTED',
        couponId: coupon._id.toString(),
      });
      return false;
    }

    // Update the claim status
    await OfferClaim.findByIdAndUpdate(claimId, {
      status: 'applied',
      usedAt: new Date(),
      usedInBookingId: bookingObjectId,
    });

    logger.info('Coupon applyDiscount successful', {
      context: 'OfferService',
      action: 'APPLY_DISCOUNT_SUCCESS',
      claimId,
      couponId: coupon._id.toString(),
      newCurrentUses: result.currentUses,
    });
    return true;
  }

  // Mark coupon as used by code and user
  // Uses atomic findOneAndUpdate to prevent race conditions (double-use)
  async markCouponAsUsed(couponCode: string, userId: string, bookingId: string): Promise<boolean> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
    const normalizedCode = couponCode.toUpperCase();

    const coupon = await Coupon.findOne({ code: normalizedCode }).select('_id maxUses currentUses');
    if (!coupon) {
      logger.warn('Coupon not found for markCouponAsUsed', {
        context: 'OfferService',
        action: 'COUPON_NOT_FOUND',
        couponCode: normalizedCode,
      });
      return false;
    }

    // First, atomically check and mark the coupon usage in a single operation
    // This prevents race conditions where two concurrent requests could both pass the check
    const result = await Coupon.findOneAndUpdate(
      {
        _id: coupon._id,
        currentUses: { $lt: coupon.maxUses }, // Atomic condition check
      },
      {
        $inc: { currentUses: 1 },
        $push: {
          usedBy: {
            userId: userObjectId,
            usedAt: new Date(),
            bookingId: bookingObjectId,
          },
        },
      },
      { new: true }
    );

    if (!result) {
      // Coupon exhausted (currentUses >= maxUses) or not found
      logger.warn('Coupon exhausted or concurrent use detected', {
        context: 'OfferService',
        action: 'COUPON_EXHAUSTED_OR_CONCURRENT',
        couponCode: normalizedCode,
        currentUses: coupon.currentUses,
        maxUses: coupon.maxUses,
      });
      return false;
    }

    logger.info('Coupon atomically marked as used', {
      context: 'OfferService',
      action: 'COUPON_MARKED_USED',
      couponCode: normalizedCode,
      newCurrentUses: result.currentUses,
    });

    // Now update the claim - this is safe because we've already atomically reserved the coupon usage
    const claimUpdateResult = await OfferClaim.findOneAndUpdate(
      {
        userId: userObjectId,
        offerId: coupon._id,
        status: 'claimed',
      },
      {
        $set: {
          status: 'applied',
          usedAt: new Date(),
          usedInBookingId: bookingObjectId,
        },
      }
    );

    if (!claimUpdateResult) {
      // Claim not found in 'claimed' status - rollback the coupon usage
      logger.warn('Claim not found, rolling back coupon usage', {
        context: 'OfferService',
        action: 'CLAIM_ROLLBACK',
        userId,
        couponId: coupon._id.toString(),
      });
      await Coupon.findByIdAndUpdate(coupon._id, {
        $inc: { currentUses: -1 },
        $pull: {
          usedBy: { userId: userObjectId },
        },
      });
      return false;
    }

    return true;
  }

  // Admin: Create offer
  async createOffer(offerData: any): Promise<any> {
    const offer = await Coupon.create({
      ...offerData,
      code: offerData.code?.toUpperCase(),
    });
    return offer;
  }

  // Admin: Update offer
  async updateOffer(offerId: string, updateData: any): Promise<any> {
    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      { ...updateData, updatedAt: new Date() },
      { new: true }
    );
    return offer;
  }

  // Admin: Deactivate offer
  async deactivateOffer(offerId: string): Promise<boolean> {
    const offer = await Coupon.findByIdAndUpdate(
      offerId,
      { isActive: false, updatedAt: new Date() }
    );
    return !!offer;
  }

  // Admin: Get all offers
  async getAllOffers(): Promise<any[]> {
    return Coupon.find().sort({ createdAt: -1 }).lean();
  }
}

export const offerService = new OfferService();
export default offerService;
