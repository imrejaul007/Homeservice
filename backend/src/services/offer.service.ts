import Coupon, { ICoupon } from '../models/coupon.model';
import { OfferClaim } from '../models/offerClaim.model';
import mongoose from 'mongoose';

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
  async getActiveOffers(): Promise<OfferResponse[]> {
    const now = new Date();

    const offers = await Coupon.find({
      isActive: true,
      validFrom: { $lte: now },
      validUntil: { $gte: now },
      $expr: { $lt: ['$currentUses', '$maxUses'] },
    }).sort({ featured: -1, createdAt: -1 }).lean();

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
    }));
  }

  // Get single offer by ID
  async getOfferById(offerId: string): Promise<OfferResponse | null> {
    const offer = await Coupon.findById(offerId).lean();
    if (!offer) return null;

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
        title: claim.offerId.displayTitle || claim.offerId.title,
        description: claim.offerId.description,
        type: claim.offerId.type,
        value: claim.offerId.value,
        maxDiscount: claim.offerId.maxDiscount,
        displayGradient: claim.offerId.displayGradient,
        imageUrl: claim.offerId.imageUrl,
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
  async applyDiscount(claimId: string, bookingId: string): Promise<boolean> {
    const claim = await OfferClaim.findById(claimId);
    if (!claim) return false;

    claim.status = 'applied';
    claim.usedAt = new Date();
    claim.usedInBookingId = new mongoose.Types.ObjectId(bookingId);
    await claim.save();

    // Increment coupon usage
    await Coupon.findByIdAndUpdate(claim.offerId, {
      $inc: { currentUses: 1 },
      $push: {
        usedBy: {
          userId: claim.userId,
          usedAt: new Date(),
          orderId: bookingId,
        },
      },
    });

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
