export interface Offer {
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
  validFrom: string;
  validUntil: string;
  applicableServices?: string[];
  applicableCategories?: string[];
  isClaimed?: boolean;
  hasActiveClaim?: boolean;
  isFullyRedeemed?: boolean;
  remainingUses?: number;
  maxUsesPerUser?: number;
  appliedCount?: number;
  claimExpiresInDays?: number;

  // NEW: Target type for audience restrictions
  targetType?: 'all' | 'new_users' | 'specific_users' | 'specific_services' | 'first_booking' | 'specific_providers';

  // NEW: Provider-specific offers
  targetProviders?: string[];

  // NEW: Day/time restrictions
  validDays?: string[]; // ['monday', 'tuesday', ...]
  validTimeStart?: string; // '09:00' in HH:mm format
  validTimeEnd?: string; // '18:00' in HH:mm format
}

export interface ClaimedOffer {
  _id: string;
  couponCode: string;
  status: 'claimed' | 'applied' | 'expired';
  claimedAt: string;
  usedAt?: string;
  expiresAt: string;
  isExpired: boolean;
  offerId?: string;
  offer?: {
    _id: string;
    code: string;
    title: string;
    description?: string;
    type: 'percentage' | 'fixed' | 'free_service';
    value: number;
    maxDiscount?: number;
    minOrderValue?: number;
    displayGradient?: string;
    displayBadge?: string;
    imageUrl?: string;
    applicableServices?: string[];
    applicableCategories?: string[];
  };
}

/** Resolved offer details from a claim (API populates `offer`, not `offerId`). */
export function getClaimOffer(claim: ClaimedOffer) {
  return claim.offer ?? null;
}

export interface ClaimResponse {
  success: boolean;
  claimId?: string;
  couponCode?: string;
  expiresAt?: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  discountAmount?: number;  // FIX: Changed from 'discount' to match CouponCodeInput expectations
  discountType?: 'fixed' | 'percentage'; // Type of discount for display
  couponCode?: string;
  offerId?: string;
  message?: string;
  // Additional info from backend
  minOrderValue?: number;
  maxDiscount?: number;
  title?: string;
  expiresAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
