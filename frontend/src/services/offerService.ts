import { api } from './api';
import type { Offer, ClaimedOffer, ClaimResponse, ValidationResult } from '../types/offer';

class OfferService {
  async getActiveOffers(): Promise<Offer[]> {
    const response = await api.get<{ success: boolean; data: Offer[] }>('/offers');
    return response.data?.data || [];
  }

  async getOfferById(offerId: string): Promise<Offer | null> {
    const response = await api.get<{ success: boolean; data: Offer }>(`/offers/${offerId}`);
    return response.data?.data || null;
  }

  async claimOffer(offerId: string): Promise<ClaimResponse> {
    const response = await api.post<ClaimResponse>('/offers/claim', { offerId });
    return response.data || { success: false, message: 'Failed to claim offer' };
  }

  async getMyClaims(): Promise<ClaimedOffer[]> {
    const response = await api.get<{ success: boolean; data: ClaimedOffer[] }>('/offers/my/claims');
    return response.data?.data || [];
  }

  async validatePromoCode(code: string, orderAmount: number): Promise<ValidationResult> {
    const response = await api.post<ValidationResult>('/offers/validate', { code, orderAmount });
    return response.data || { valid: false, message: 'Failed to validate code' };
  }
}

export const offerService = new OfferService();
export default offerService;
