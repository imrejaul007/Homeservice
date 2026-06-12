/**
 * Price Calculator API Service
 * Handles API calls for package price calculation
 */
import { api } from './api';
import { authService } from './AuthService';

// =============================================================================
// Types
// =============================================================================

export interface AddOnSelection {
  id?: string;
  name: string;
  price: number;
  quantity?: number;
}

export interface DurationSelection {
  duration: number;
  price: number;
  label: string;
}

export interface LocationDetails {
  type: 'customer_address' | 'provider_location' | 'online';
  distance?: number;
}

export interface PriceBreakdown {
  basePrice: number;
  addOnsTotal: number;
  durationUpgrade: number;
  travelFee: number;
  subtotal: number;
  discount: number;
  discountDescription?: string;
  tax: number;
  totalAmount: number;
  currency: string;
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
    total: number;
  }>;
  durationDetails?: {
    originalDuration: number;
    selectedDuration: number;
    priceDifference: number;
  };
  loyaltyDiscount?: {
    percentage: number;
    amount: number;
  };
}

export interface PriceCalculationResult {
  success: boolean;
  data?: {
    priceBreakdown: PriceBreakdown;
    originalPrice: number;
    savings: number;
    savingsPercentage: number;
  } | null;
  error?: string;
}

export interface DiscountValidationResult {
  valid: boolean;
  error?: string;
  discount?: {
    type: string;
    value: number;
    description: string;
  };
}

export interface PackageAddOn {
  id: string;
  name: string;
  price: number;
  description?: string;
}

// =============================================================================
// API Functions
// =============================================================================

export const priceCalculatorApi = {
  /**
   * Calculate package price with selected options
   */
  calculatePrice: async (params: {
    packageId: string;
    selectedAddOns?: AddOnSelection[];
    selectedDuration?: DurationSelection;
    location?: LocationDetails;
    discountCode?: string;
  }): Promise<PriceCalculationResult> => {
    try {
      const response = await authService.post<PriceCalculationResult>('/packages/calculate-price', {
        packageId: params.packageId,
        selectedAddOns: params.selectedAddOns || [],
        selectedDuration: params.selectedDuration,
        location: params.location,
        discountCode: params.discountCode,
        isPackage: true,
      });
      return (response as unknown as PriceCalculationResult);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to calculate price',
      };
    }
  },

  /**
   * Get base price estimate for a package
   */
  getEstimate: async (packageId: string): Promise<PriceCalculationResult> => {
    try {
      const response = await api.get<PriceCalculationResult>(`/packages/${packageId}/estimate`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to get estimate',
      };
    }
  },

  /**
   * Get available add-ons for a package
   */
  getAddOns: async (packageId: string): Promise<{
    success: boolean;
    addOns?: PackageAddOn[];
    error?: string;
  }> => {
    try {
      const response = await api.get(`/packages/${packageId}/addons`);
      return (response.data as { success: boolean; addOns?: PackageAddOn[]; error?: string });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to get add-ons',
      };
    }
  },

  /**
   * Get available duration options for a package
   */
  getDurations: async (packageId: string): Promise<{
    success: boolean;
    durationOptions?: DurationSelection[];
    error?: string;
  }> => {
    try {
      const response = await api.get(`/packages/${packageId}/durations`);
      return response.data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      return {
        success: false,
        error: err.response?.data?.error || err.message || 'Failed to get durations',
      };
    }
  },

  /**
   * Validate a discount code
   */
  validateDiscount: async (
    code: string,
    packageId: string,
    subtotal: number
  ): Promise<DiscountValidationResult> => {
    try {
      const response = await authService.post<{ data?: DiscountValidationResult }>('/packages/validate-discount', {
        code,
        packageId,
        subtotal,
      });
      return (response as { data?: DiscountValidationResult }).data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string };
      return {
        valid: false,
        error: err.response?.data?.error || err.message || 'Failed to validate discount',
      };
    }
  },
};

export default priceCalculatorApi;
