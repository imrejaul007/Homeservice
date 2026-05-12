import { apiService } from './api';
import type { Offer, ClaimedOffer, ClaimResponse, ValidationResult } from '../types/offer';

class OfferService {
  // Get active offers for homepage
  async getActiveOffers(): Promise<Offer[]> {
    const response = await apiService.get<{ success: boolean; data: Offer[] }>('/offers');
    return response.data?.data || [];
  }

  // Get offer by ID
  async getOfferById(offerId: string): Promise<Offer | null> {
    const response = await apiService.get<{ success: boolean; data: Offer }>(`/offers/${offerId}`);
    return response.data?.data || null;
  }

  // Claim an offer
  async claimOffer(offerId: string): Promise<ClaimResponse> {
    const response = await apiService.post<ClaimResponse>('/offers/claim', { offerId });
    return response.data || { success: false, message: 'Failed to claim offer' };
  }

  // Get user's claimed offers
  async getMyClaims(): Promise<ClaimedOffer[]> {
    const response = await apiService.get<{ success: boolean; data: ClaimedOffer[] }>('/offers/my/claims');
    return response.data?.data || [];
  }

  // Validate promo code at checkout
  async validatePromoCode(code: string, orderAmount: number): Promise<ValidationResult> {
    const response = await apiService.post<ValidationResult>('/offers/validate', {
      code,
      orderAmount,
    });
    return response.data || { valid: false, message: 'Failed to validate code' };
  }
}

export const offerService = new OfferService();
export default offerService;
