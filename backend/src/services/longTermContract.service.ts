import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type ContractDuration = '1_year' | '2_year' | '3_year';
export type ContractStatus = 'draft' | 'pending_signature' | 'active' | 'expired' | 'cancelled' | 'renewed';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'annually';

export interface ContractTier {
  duration: ContractDuration;
  durationMonths: number;
  discountPercent: number;
  label: string;
  description: string;
  benefits: string[];
}

export interface Contract {
  _id?: Types.ObjectId;
  contractId: string;
  contractNumber: string;
  customerId: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  providerId?: Types.ObjectId;
  providerName?: string;
  serviceIds: Types.ObjectId[];
  serviceNames: string[];
  duration: ContractDuration;
  durationMonths: number;
  status: ContractStatus;
  paymentFrequency: PaymentFrequency;
  pricing: {
    originalMonthlyAmount: number;
    discountedMonthlyAmount: number;
    discountPercent: number;
    monthlyPayment: number;
    quarterlyPayment: number;
    annualPayment: number;
    totalContractValue: number;
    totalSavings: number;
    currency: string;
  };
  contractDates: {
    startDate: Date;
    endDate: Date;
    signedDate?: Date;
    renewalDate?: Date;
  };
  paymentSchedule: Array<{
    paymentId: string;
    periodStart: Date;
    periodEnd: Date;
    amount: number;
    status: 'pending' | 'paid' | 'overdue' | 'skipped';
    paidAt?: Date;
    paymentMethod?: string;
  }>;
  terms: {
    cancellationPolicy: string;
    autoRenew: boolean;
    priceLock: boolean;
    dedicatedSupport: boolean;
    priorityScheduling: boolean;
    customServiceLevel?: string;
  };
  signature?: {
    signedBy: string;
    signedAt: Date;
    signatureUrl?: string;
    ipAddress?: string;
  };
  metadata?: {
    contractType?: string;
    industry?: string;
    notes?: string;
    referrer?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface ContractUsage {
  contractId: Types.ObjectId;
  customerId: Types.ObjectId;
  period: { start: Date; end: Date };
  bookingsCount: number;
  servicesUsed: Array<{
    serviceId: Types.ObjectId;
    serviceName: string;
    usageCount: number;
    totalValue: number;
  }>;
  totalValue: number;
  contractedValue: number;
  utilizationPercent: number;
  withinContract: boolean;
  overageCharges: number;
}

// ============================================
// Contract Tier Configuration
// ============================================

const CONTRACT_TIERS: Record<ContractDuration, ContractTier> = {
  '1_year': {
    duration: '1_year',
    durationMonths: 12,
    discountPercent: 15,
    label: '1-Year Contract',
    description: 'Commit for 12 months and save 15% on all services',
    benefits: [
      '15% discount on all bookings',
      'Priority scheduling',
      'Dedicated support channel',
      'Price lock guarantee',
    ],
  },
  '2_year': {
    duration: '2_year',
    durationMonths: 24,
    discountPercent: 25,
    label: '2-Year Contract',
    description: 'Commit for 24 months and save 25% on all services',
    benefits: [
      '25% discount on all bookings',
      'Priority scheduling',
      'Dedicated account manager',
      'Exclusive deals and early access',
      'Price lock guarantee',
      'Quarterly business reviews',
    ],
  },
  '3_year': {
    duration: '3_year',
    durationMonths: 36,
    discountPercent: 35,
    label: '3-Year Contract',
    description: 'Commit for 36 months and save 35% on all services',
    benefits: [
      '35% discount on all bookings',
      'VIP priority scheduling',
      'Dedicated account manager',
      'Exclusive deals and early access',
      'Price lock guarantee',
      'Quarterly business reviews',
      'Custom service packages',
      'On-site consultations',
    ],
  },
};

// ============================================
// Long Term Contract Service
// ============================================

export class LongTermContractService {
  /**
   * Get available contract tiers
   */
  getTiers(): ContractTier[] {
    return Object.values(CONTRACT_TIERS);
  }

  /**
   * Get tier configuration
   */
  getTierConfig(duration: ContractDuration): ContractTier | undefined {
    return CONTRACT_TIERS[duration];
  }

  /**
   * Calculate contract pricing
   */
  calculatePricing(data: {
    duration: ContractDuration;
    monthlyValue: number;
    paymentFrequency: PaymentFrequency;
  }): {
    tier: ContractTier;
    originalMonthlyAmount: number;
    discountedMonthlyAmount: number;
    discountPercent: number;
    monthlyPayment: number;
    quarterlyPayment: number;
    annualPayment: number;
    totalContractValue: number;
    totalSavings: number;
    currency: string;
  } {
    const tier = CONTRACT_TIERS[data.duration];
    const originalMonthlyAmount = data.monthlyValue;
    const discountedMonthlyAmount = Math.round(
      originalMonthlyAmount * (1 - tier.discountPercent / 100) * 100
    ) / 100;
    const discountPercent = tier.discountPercent;

    const monthlyPayment = discountedMonthlyAmount;
    const quarterlyPayment = Math.round(discountedMonthlyAmount * 3 * 100) / 100;
    const annualPayment = Math.round(discountedMonthlyAmount * 12 * 100) / 100;

    let totalContractValue: number;
    switch (data.paymentFrequency) {
      case 'monthly':
        totalContractValue = monthlyPayment * tier.durationMonths;
        break;
      case 'quarterly':
        totalContractValue = quarterlyPayment * (tier.durationMonths / 3);
        break;
      case 'annually':
        totalContractValue = annualPayment;
        break;
    }

    const totalSavings = Math.round(
      (originalMonthlyAmount * tier.durationMonths - totalContractValue) * 100
    ) / 100;

    return {
      tier,
      originalMonthlyAmount,
      discountedMonthlyAmount,
      discountPercent,
      monthlyPayment,
      quarterlyPayment,
      annualPayment,
      totalContractValue,
      totalSavings,
      currency: 'AED',
    };
  }

  /**
   * Create a new contract
   */
  async createContract(data: {
    customerId: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    providerId?: string;
    providerName?: string;
    serviceIds: string[];
    serviceNames: string[];
    duration: ContractDuration;
    paymentFrequency?: PaymentFrequency;
    monthlyValue: number;
    terms?: Partial<Contract['terms']>;
    metadata?: Contract['metadata'];
  }): Promise<{ success: boolean; contract?: Contract; error?: string }> {
    try {
      const contractId = this.generateContractId();
      const contractNumber = `LTC-${Date.now().toString(36).toUpperCase()}`;

      const paymentFrequency = data.paymentFrequency || 'monthly';
      const pricing = this.calculatePricing({
        duration: data.duration,
        monthlyValue: data.monthlyValue,
        paymentFrequency,
      });

      const now = new Date();
      const startDate = now;
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + pricing.tier.durationMonths);

      // Generate payment schedule
      const paymentSchedule = this.generatePaymentSchedule(
        contractId,
        pricing,
        paymentFrequency,
        startDate,
        endDate
      );

      const contract = {
        _id: new Types.ObjectId(),
        contractId,
        contractNumber,
        customerId: new Types.ObjectId(data.customerId),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        providerId: data.providerId ? new Types.ObjectId(data.providerId) : undefined,
        providerName: data.providerName,
        serviceIds: data.serviceIds.map(id => new Types.ObjectId(id)),
        serviceNames: data.serviceNames,
        duration: data.duration,
        durationMonths: pricing.tier.durationMonths,
        status: 'draft' as ContractStatus,
        paymentFrequency,
        pricing: {
          originalMonthlyAmount: pricing.originalMonthlyAmount,
          discountedMonthlyAmount: pricing.discountedMonthlyAmount,
          discountPercent: pricing.discountPercent,
          monthlyPayment: pricing.monthlyPayment,
          quarterlyPayment: pricing.quarterlyPayment,
          annualPayment: pricing.annualPayment,
          totalContractValue: pricing.totalContractValue,
          totalSavings: pricing.totalSavings,
          currency: pricing.currency,
        },
        contractDates: {
          startDate,
          endDate,
        },
        paymentSchedule,
        terms: {
          cancellationPolicy: '30-day written notice required. Early termination fees may apply.',
          autoRenew: true,
          priceLock: true,
          dedicatedSupport: data.duration !== '1_year',
          priorityScheduling: true,
          customServiceLevel: data.duration === '3_year' ? 'Premium' : undefined,
          ...data.terms,
        },
        metadata: data.metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      logger.info('Long-term contract created', {
        contractId,
        contractNumber,
        customerId: data.customerId,
        duration: data.duration,
        totalValue: pricing.totalContractValue,
        savings: pricing.totalSavings,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.LONG_TERM_CONTRACT_CREATED, {
        contractId,
        contractNumber,
        customerId: data.customerId,
        duration: data.duration,
        totalValue: pricing.totalContractValue,
      });

      return { success: true, contract: contract as unknown as Contract };
    } catch (error) {
      logger.error('Error creating long-term contract', {
        customerId: data.customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create contract',
      };
    }
  }

  /**
   * Sign contract
   */
  async signContract(
    contractId: string,
    signature: {
      signedBy: string;
      signatureUrl?: string;
      ipAddress?: string;
    }
  ): Promise<{ success: boolean; contract?: Contract; error?: string }> {
    try {
      // In a real implementation, this would update the contract in the database
      logger.info('Contract signed', { contractId, signedBy: signature.signedBy });

      return { success: true };
    } catch (error) {
      logger.error('Error signing contract', {
        contractId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sign contract',
      };
    }
  }

  /**
   * Activate contract
   */
  async activateContract(contractId: string): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info('Contract activated', { contractId });
      return { success: true };
    } catch (error) {
      logger.error('Error activating contract', {
        contractId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to activate contract',
      };
    }
  }

  /**
   * Calculate discount for a booking under a contract
   */
  calculateBookingDiscount(
    bookingAmount: number,
    contractDuration: ContractDuration
  ): {
    discountPercent: number;
    discountAmount: number;
    finalAmount: number;
    contractTier: ContractTier;
  } {
    const tier = CONTRACT_TIERS[contractDuration];
    const discountPercent = tier.discountPercent;
    const discountAmount = Math.round(bookingAmount * (discountPercent / 100) * 100) / 100;
    const finalAmount = bookingAmount - discountAmount;

    return {
      discountPercent,
      discountAmount,
      finalAmount,
      contractTier: tier,
    };
  }

  /**
   * Get contract usage statistics
   */
  async getContractUsage(
    customerId: string,
    options: { startDate?: Date; endDate?: Date } = {}
  ): Promise<ContractUsage | null> {
    try {
      const customerObjectId = new Types.ObjectId(customerId);

      const matchQuery: any = {
        customerId: customerObjectId,
        status: { $in: ['confirmed', 'completed'] },
      };

      if (options.startDate || options.endDate) {
        matchQuery.scheduledDate = {};
        if (options.startDate) matchQuery.scheduledDate.$gte = options.startDate;
        if (options.endDate) matchQuery.scheduledDate.$lte = options.endDate;
      }

      const bookings = await Booking.find(matchQuery)
        .populate('serviceId', 'name')
        .sort({ scheduledDate: -1 });

      const serviceMap = new Map<string, { serviceName: string; count: number; value: number }>();
      let totalValue = 0;

      for (const booking of bookings) {
        const serviceId = (booking.serviceId as Types.ObjectId)?.toString();
        const serviceName = (booking.serviceId as any)?.name || 'Unknown';
        const amount = (booking.pricing as any)?.totalAmount || 0;

        totalValue += amount;

        const existing = serviceMap.get(serviceId) || { serviceName, count: 0, value: 0 };
        existing.count++;
        existing.value += amount;
        serviceMap.set(serviceId, existing);
      }

      const servicesUsed = Array.from(serviceMap.entries()).map(([serviceId, data]) => ({
        serviceId: new Types.ObjectId(serviceId),
        serviceName: data.serviceName,
        usageCount: data.count,
        totalValue: data.value,
      }));

      return {
        contractId: new Types.ObjectId(),
        customerId: customerObjectId,
        period: {
          start: options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: options.endDate || new Date(),
        },
        bookingsCount: bookings.length,
        servicesUsed,
        totalValue,
        contractedValue: 0, // Would come from active contract
        utilizationPercent: 0,
        withinContract: true,
        overageCharges: 0,
      };
    } catch (error) {
      logger.error('Error getting contract usage', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Renew contract
   */
  async renewContract(
    contractId: string,
    newDuration?: ContractDuration
  ): Promise<{ success: boolean; contract?: Contract; error?: string }> {
    try {
      logger.info('Contract renewed', { contractId, newDuration });
      return { success: true };
    } catch (error) {
      logger.error('Error renewing contract', {
        contractId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to renew contract',
      };
    }
  }

  /**
   * Cancel contract
   */
  async cancelContract(
    contractId: string,
    reason?: string
  ): Promise<{ success: boolean; penalty?: number; error?: string }> {
    try {
      // Calculate early termination penalty if applicable
      const penalty = 0; // Would calculate based on remaining months

      logger.info('Contract cancelled', { contractId, reason, penalty });
      return { success: true, penalty };
    } catch (error) {
      logger.error('Error cancelling contract', {
        contractId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel contract',
      };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generatePaymentSchedule(
    contractId: string,
    pricing: ReturnType<typeof this.calculatePricing>,
    frequency: PaymentFrequency,
    startDate: Date,
    endDate: Date
  ): Contract['paymentSchedule'] {
    const schedule: Contract['paymentSchedule'] = [];
    let currentDate = new Date(startDate);
    let paymentNumber = 1;

    while (currentDate < endDate) {
      let periodEnd: Date;
      let amount: number;

      switch (frequency) {
        case 'monthly':
          periodEnd = new Date(currentDate);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          amount = pricing.monthlyPayment;
          currentDate = periodEnd;
          break;
        case 'quarterly':
          periodEnd = new Date(currentDate);
          periodEnd.setMonth(periodEnd.getMonth() + 3);
          amount = pricing.quarterlyPayment;
          currentDate = periodEnd;
          break;
        case 'annually':
          periodEnd = endDate;
          amount = pricing.annualPayment;
          currentDate = endDate;
          break;
      }

      schedule.push({
        paymentId: `PAY-${contractId}-${paymentNumber++}`,
        periodStart: new Date(currentDate.getTime() - (frequency === 'monthly' ? 30 : frequency === 'quarterly' ? 90 : 365) * 24 * 60 * 60 * 1000),
        periodEnd,
        amount,
        status: 'pending',
      });
    }

    return schedule;
  }

  private generateContractId(): string {
    return `LTC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const longTermContractService = new LongTermContractService();
export default longTermContractService;
