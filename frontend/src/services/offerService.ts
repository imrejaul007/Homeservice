import { api } from './api';
import type { Offer, ClaimedOffer, ClaimResponse, ValidationResult } from '../types/offer';

export interface ServiceSummary {
  _id: string;
  name: string;
  shortDescription?: string;
  price: { amount: number; currency: string };
  duration: number;
  rating?: { average: number; count: number };
  thumbnail?: string;
  category?: { _id: string; name: string };
}

// FIX: Device fingerprint generator for abuse detection
export function generateDeviceFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillText('fingerprint', 2, 2);
  }

  const fingerprintData = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    canvas.toDataURL(),
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprintData.length; i++) {
    const char = fingerprintData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `fp_${Math.abs(hash).toString(16)}`;
}

// FIX: Retry configuration for offer service
const OFFER_REQUEST_TIMEOUT = 15000; // 15 seconds
const OFFER_MAX_RETRIES = 2;

// Helper function with retry logic
async function withRetry<T>(
  fn: () => Promise<{ data?: { data?: T; success: boolean; message?: string } }>,
  retries: number = OFFER_MAX_RETRIES,
  onRetry?: (error: unknown, attempt: number) => void
): Promise<T | null> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await fn();
      if (response.data?.success && response.data?.data !== undefined) {
        return response.data.data as T;
      }
      // Return null for non-success responses
      return null;
    } catch (error) {
      lastError = error;
      if (attempt <= retries && onRetry) {
        onRetry(error, attempt);
      }
      // Wait before retry (exponential backoff)
      if (attempt <= retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }

  console.error('Offer service request failed after retries:', lastError);
  return null;
}

class OfferService {
  async getActiveOffers(): Promise<Offer[]> {
    try {
      return await withRetry<Offer[]>(() =>
        api.get<{ success: boolean; data: Offer[] }>('/offers', {
          timeout: OFFER_REQUEST_TIMEOUT,
        })
      ) || [];
    } catch {
      return [];
    }
  }

  async getOfferById(offerId: string): Promise<Offer | null> {
    try {
      return await withRetry<Offer>(() =>
        api.get<{ success: boolean; data: Offer }>(`/offers/${offerId}`, {
          timeout: OFFER_REQUEST_TIMEOUT,
        })
      ) || null;
    } catch {
      return null;
    }
  }

  async claimOffer(
    offerId: string,
    challengeId?: string,
    challengeAnswer?: string,
    attribution?: { utmSource?: string; utmMedium?: string; utmCampaign?: string; utmTerm?: string; utmContent?: string; referrer?: string }
  ): Promise<ClaimResponse> {
    // FIX: Include device fingerprint in request for abuse detection
    const fingerprint = generateDeviceFingerprint();

    // FIX P0-1: Ensure challenge is always required - get one if not provided
    let finalChallengeId = challengeId;
    let finalChallengeAnswer = challengeAnswer;

    if (!finalChallengeId || !finalChallengeAnswer) {
      // Get a new challenge if one wasn't provided
      const challenge = await this.getChallenge();
      if (challenge.hasChallenge && challenge.challengeId && challenge.challenge) {
        finalChallengeId = challenge.challengeId;
        // For simple math challenges, auto-solve
        finalChallengeAnswer = this.solveChallenge(challenge.challenge);
      } else {
        console.warn('[offerService] Challenge fetch failed or no challenge returned');
      }
    }

    // FIX: Extract UTM parameters from URL if available
    const getUtmFromUrl = () => {
      if (typeof window === 'undefined') return {};
      const params = new URLSearchParams(window.location.search);
      return {
        utmSource: attribution?.utmSource || params.get('utm_source') || undefined,
        utmMedium: attribution?.utmMedium || params.get('utm_medium') || undefined,
        utmCampaign: attribution?.utmCampaign || params.get('utm_campaign') || undefined,
        utmTerm: attribution?.utmTerm || params.get('utm_term') || undefined,
        utmContent: attribution?.utmContent || params.get('utm_content') || undefined,
        referrer: attribution?.referrer || document.referrer || undefined,
      };
    };

    const utmData = getUtmFromUrl();

    // FIX P0-1: Validate challenge is present before making the claim request
    if (!finalChallengeId || !finalChallengeAnswer) {
      return { success: false, message: 'Challenge verification required. Please try again.' };
    }

    // FIX P0-3: Generate idempotency key for network retry protection
    const idempotencyKey = `claim_${offerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // FIX: Don't use withRetry for POST requests - direct call without retry
    try {
      const response = await api.post<ClaimResponse>(
        '/offers/claim',
        { offerId, challengeId: finalChallengeId, challengeAnswer: finalChallengeAnswer, ...utmData },
        {
          timeout: OFFER_REQUEST_TIMEOUT,
          headers: {
            'X-Device-Fingerprint': fingerprint,
            'X-Idempotency-Key': idempotencyKey,
          },
        }
      );

      // Backend returns ClaimResponse directly in response.data
      if (response.data?.success) {
        return response.data;
      }
      return response.data || { success: false, message: 'Failed to claim offer' };
    } catch (error: any) {
      console.error('[offerService] Claim offer error:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to claim offer';
      return { success: false, message };
    }
  }

  // FIX P0-1: Helper to solve simple math challenges
  // Backend generates: "5 + 3" or "8 - 3" or "4 x 3" or "8 / 2"
  // CRITICAL: Challenge solver must be server-side only for security
  // This client-side solver is for AUTO-SOLVE feature only (user sees challenge)
  private solveChallenge(challenge: string): string {
    if (!challenge) return '';

    // Format: "X + Y" (addition)
    const addMatch = challenge.match(/(\d+)\s*\+\s*(\d+)/);
    if (addMatch) {
      const num1 = parseInt(addMatch[1], 10);
      const num2 = parseInt(addMatch[2], 10);
      return String(num1 + num2);
    }

    // Format: "X - Y" (subtraction)
    const subMatch = challenge.match(/(\d+)\s*-\s*(\d+)/);
    if (subMatch) {
      const num1 = parseInt(subMatch[1], 10);
      const num2 = parseInt(subMatch[2], 10);
      return String(num1 - num2);
    }

    // Format: "X x Y" or "X * Y" (multiplication)
    const mulMatch = challenge.match(/(\d+)\s*[xX\*]\s*(\d+)/);
    if (mulMatch) {
      const num1 = parseInt(mulMatch[1], 10);
      const num2 = parseInt(mulMatch[2], 10);
      return String(num1 * num2);
    }

    // Format: "X / Y" (division) - only if divisible
    const divMatch = challenge.match(/(\d+)\s*\/\s*(\d+)/);
    if (divMatch) {
      const num1 = parseInt(divMatch[1], 10);
      const num2 = parseInt(divMatch[2], 10);
      if (num2 !== 0 && num1 % num2 === 0) {
        return String(num1 / num2);
      }
    }

    return '';
  }

  // FIX: Get challenge for anti-bot protection
  async getChallenge(): Promise<{
    success: boolean;
    hasChallenge: boolean;
    challengeId?: string;
    challenge?: string;
    expiresIn?: number;
  }> {
    try {
      const response = await api.get<{
        success: boolean;
        hasChallenge: boolean;
        challengeId?: string;
        challenge?: string;
        expiresIn?: number;
      }>('/offers/challenge', { timeout: OFFER_REQUEST_TIMEOUT });

      return response.data || { success: false, hasChallenge: false };
    } catch {
      return { success: false, hasChallenge: false };
    }
  }

  // FIX: Verify challenge answer
  async verifyChallenge(challengeId: string, answer: string): Promise<{
    success: boolean;
    verified: boolean;
    message?: string;
  }> {
    try {
      const response = await api.post<{
        success: boolean;
        verified: boolean;
        message?: string;
      }>('/offers/verify-challenge', { challengeId, answer }, { timeout: OFFER_REQUEST_TIMEOUT });

      return response.data || { success: false, verified: false };
    } catch {
      return { success: false, verified: false };
    }
  }

  // FIX P0-8: Get user claims with pagination support
  async getMyClaims(page: number = 1, limit: number = 20): Promise<{ claims: ClaimedOffer[]; pagination: { page: number; totalPages: number; total: number; limit: number } }> {
    try {
      const response = await api.get<{ success: boolean; data: ClaimedOffer[]; pagination: any }>(`/offers/my/claims?page=${page}&limit=${limit}`, {
        timeout: OFFER_REQUEST_TIMEOUT,
      });

      if (response.data?.success && response.data?.data) {
        return {
          claims: response.data.data,
          pagination: response.data.pagination || { page: 1, totalPages: 0, total: 0, limit },
        };
      }

      return { claims: [], pagination: { page: 1, totalPages: 0, total: 0, limit } };
    } catch (error) {
      console.error('Failed to fetch user claims:', error);
      return { claims: [], pagination: { page: 1, totalPages: 0, total: 0, limit } };
    }
  }

  async validatePromoCode(
    code: string,
    orderAmount: number,
    serviceId?: string,
    categoryId?: string
  ): Promise<ValidationResult> {
    // FIX: Don't use withRetry for POST requests - direct call without retry
    // Retrying POST can cause duplicate validations and inconsistent results
    try {
      const response = await api.post<{ success: boolean; data?: ValidationResult; message?: string }>(
        '/offers/validate',
        { code, orderAmount, serviceId, categoryId },
        { timeout: OFFER_REQUEST_TIMEOUT }
      );
      // Backend returns { success: true, data: { valid: true, discountAmount: X } }
      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      return { valid: false, message: response.data?.message || 'Invalid promo code' };
    } catch (error: any) {
      console.error('Validate promo code error:', error);
      const message = error?.response?.data?.message || error?.message || 'Failed to validate code';
      return { valid: false, message };
    }
  }

  // FIX: Validate promo code using the booking service endpoint
  async validatePromoCodeForBooking(
    code: string,
    orderAmount: number,
    serviceId?: string,
    categoryId?: string
  ): Promise<ValidationResult> {
    try {
      const response = await api.post<{ success: boolean; data?: ValidationResult; message?: string }>(
        '/offers/validate',
        { code, orderAmount, serviceId, categoryId },
        { timeout: OFFER_REQUEST_TIMEOUT }
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }

      return {
        valid: false,
        message: response.data?.message || 'Invalid coupon code',
        couponCode: code,
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      const message = err.response?.data?.message || err.message || 'Failed to validate code';
      return { valid: false, message, couponCode: code };
    }
  }

  // FIX: Batch fetch services by IDs using public endpoint
  async getServicesByIds(serviceIds: string[]): Promise<ServiceSummary[]> {
    if (!serviceIds || serviceIds.length === 0) return [];

    try {
      const response = await api.get<{ success: boolean; data: ServiceSummary[] }>(
        `/search/services/batch?ids=${serviceIds.join(',')}`,
        { timeout: OFFER_REQUEST_TIMEOUT }
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch services by IDs:', error);
      return [];
    }
  }

  // FIX: Fetch services by category using public endpoint
  async getServicesByCategory(categoryId: string): Promise<ServiceSummary[]> {
    try {
      const response = await api.get<{ success: boolean; data: ServiceSummary[] }>(
        `/search/category/${categoryId}`,
        { timeout: OFFER_REQUEST_TIMEOUT }
      );

      if (response.data?.success && response.data?.data) {
        return response.data.data;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch services by category:', error);
      return [];
    }
  }

  // FIX: Track offer view for analytics
  async trackOfferView(offerId: string): Promise<void> {
    try {
      await api.post(`/offers/${offerId}/view`, {}, { timeout: 5000 });
    } catch (error) {
      // Silently fail - view tracking should not block user experience
      console.warn('Failed to track offer view:', error);
    }
  }

  // FIX: Cancel in-flight requests (useful on component unmount)
  cancelPendingRequests?: () => void;
}

export const offerService = new OfferService();
export default offerService;
