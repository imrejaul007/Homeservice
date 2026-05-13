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
    title: string;
    description?: string;
    type: 'percentage' | 'fixed' | 'free_service';
    value: number;
    maxDiscount?: number;
    displayGradient?: string;
    imageUrl?: string;
  };
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
  discount?: number;
  couponCode?: string;
  offerId?: string;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}
