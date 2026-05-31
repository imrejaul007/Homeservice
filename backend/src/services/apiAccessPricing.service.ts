import mongoose, { Types } from 'mongoose';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type ApiPlanTier = 'free' | 'starter' | 'professional' | 'enterprise';
export type RateLimitType = 'per_second' | 'per_minute' | 'per_hour' | 'per_day';

export interface ApiPlan {
  _id?: Types.ObjectId;
  planId: string;
  name: string;
  description: string;
  tier: ApiPlanTier;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  features: string[];
  rateLimits: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    requestsPerHour: number;
    requestsPerDay: number;
    burstLimit?: number;
  };
  quotas: {
    monthlyRequests: number; // -1 for unlimited
    maxWebhooks: number;
    maxApiKeys: number;
    maxIntegrations: number;
  };
  capabilities: {
    webhooks: boolean;
    analytics: boolean;
    prioritySupport: boolean;
    customBranding: boolean;
    advancedFilters: boolean;
    exportData: boolean;
    slaGuarantee?: number; // Percentage
  };
  isActive: boolean;
  createdAt: Date;
}

export interface ApiSubscription {
  _id?: Types.ObjectId;
  subscriptionId: string;
  clientId: string;
  clientName: string;
  planId: Types.ObjectId;
  planTier: ApiPlanTier;
  status: 'active' | 'suspended' | 'cancelled' | 'expired' | 'trial';
  billingCycle: 'monthly' | 'yearly';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  cancelledAt?: Date;
  autoRenew: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiUsage {
  _id?: Types.ObjectId;
  clientId: string;
  date: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitedRequests: number;
  averageLatency: number; // ms
  p95Latency: number; // ms
  bandwidth: number; // bytes
  topEndpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
  }>;
  errorBreakdown: Record<string, number>;
}

export interface ApiKey {
  _id?: Types.ObjectId;
  keyId: string;
  keyPrefix: string; // First 8 chars for identification
  clientId: string;
  name: string;
  keyHash: string;
  scopes: string[];
  rateLimitOverride?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
  };
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// ============================================
// API Plan Configuration
// ============================================

const API_PLANS: ApiPlan[] = [
  {
    planId: 'PLAN-FREE',
    name: 'Free',
    description: 'Basic API access for hobby projects',
    tier: 'free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'AED',
    features: [
      'Basic API access',
      '1,000 requests/month',
      '1 API key',
      'Community support',
    ],
    rateLimits: {
      requestsPerSecond: 1,
      requestsPerMinute: 20,
      requestsPerHour: 500,
      requestsPerDay: 1000,
    },
    quotas: {
      monthlyRequests: 1000,
      maxWebhooks: 0,
      maxApiKeys: 1,
      maxIntegrations: 1,
    },
    capabilities: {
      webhooks: false,
      analytics: false,
      prioritySupport: false,
      customBranding: false,
      advancedFilters: false,
      exportData: false,
    },
    isActive: true,
    createdAt: new Date(),
  },
  {
    planId: 'PLAN-STARTER',
    name: 'Starter',
    description: 'For small businesses and startups',
    tier: 'starter',
    monthlyPrice: 99,
    yearlyPrice: 990,
    currency: 'AED',
    features: [
      'Full API access',
      '10,000 requests/month',
      '3 API keys',
      'Basic analytics',
      'Email support',
      'Standard rate limits',
    ],
    rateLimits: {
      requestsPerSecond: 5,
      requestsPerMinute: 100,
      requestsPerHour: 2000,
      requestsPerDay: 10000,
    },
    quotas: {
      monthlyRequests: 10000,
      maxWebhooks: 2,
      maxApiKeys: 3,
      maxIntegrations: 3,
    },
    capabilities: {
      webhooks: true,
      analytics: true,
      prioritySupport: false,
      customBranding: false,
      advancedFilters: false,
      exportData: false,
    },
    isActive: true,
    createdAt: new Date(),
  },
  {
    planId: 'PLAN-PROFESSIONAL',
    name: 'Professional',
    description: 'For growing businesses with advanced needs',
    tier: 'professional',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    currency: 'AED',
    features: [
      'Full API access',
      '100,000 requests/month',
      '10 API keys',
      'Advanced analytics',
      'Priority support',
      'Higher rate limits',
      'Advanced filtering',
      'Data export',
    ],
    rateLimits: {
      requestsPerSecond: 20,
      requestsPerMinute: 500,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
      burstLimit: 50,
    },
    quotas: {
      monthlyRequests: 100000,
      maxWebhooks: 10,
      maxApiKeys: 10,
      maxIntegrations: 10,
    },
    capabilities: {
      webhooks: true,
      analytics: true,
      prioritySupport: true,
      customBranding: false,
      advancedFilters: true,
      exportData: true,
    },
    isActive: true,
    createdAt: new Date(),
  },
  {
    planId: 'PLAN-ENTERPRISE',
    name: 'Enterprise',
    description: 'For large organizations with mission-critical needs',
    tier: 'enterprise',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    currency: 'AED',
    features: [
      'Full API access',
      'Unlimited requests',
      'Unlimited API keys',
      'Real-time analytics',
      'Dedicated support',
      'Custom rate limits',
      'Custom branding',
      'SLA guarantee',
      'Data export',
      'Advanced security',
    ],
    rateLimits: {
      requestsPerSecond: 100,
      requestsPerMinute: 5000,
      requestsPerHour: 100000,
      requestsPerDay: -1, // Unlimited
      burstLimit: 200,
    },
    quotas: {
      monthlyRequests: -1, // Unlimited
      maxWebhooks: -1,
      maxApiKeys: -1,
      maxIntegrations: -1,
    },
    capabilities: {
      webhooks: true,
      analytics: true,
      prioritySupport: true,
      customBranding: true,
      advancedFilters: true,
      exportData: true,
      slaGuarantee: 99.9,
    },
    isActive: true,
    createdAt: new Date(),
  },
];

// ============================================
// API Access Pricing Service
// ============================================

export class ApiAccessPricingService {
  private subscriptionModel: any;
  private usageModel: any;
  private keyModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    this.subscriptionModel = this.createSubscriptionSchema();
    this.usageModel = this.createUsageSchema();
    this.keyModel = this.createKeySchema();
  }

  private createSubscriptionSchema(): any {
    const SubscriptionSchema = new mongoose.Schema({
      subscriptionId: { type: String, required: true, unique: true },
      clientId: { type: String, required: true, unique: true },
      clientName: { type: String, required: true },
      planId: { type: mongoose.Schema.Types.ObjectId, required: true },
      planTier: { type: String, enum: ['free', 'starter', 'professional', 'enterprise'], required: true },
      status: { type: String, enum: ['active', 'suspended', 'cancelled', 'expired', 'trial'], default: 'trial' },
      billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
      currentPeriodStart: { type: Date, required: true },
      currentPeriodEnd: { type: Date, required: true },
      trialEndsAt: Date,
      cancelledAt: Date,
      autoRenew: { type: Boolean, default: true },
    }, { timestamps: true });

    SubscriptionSchema.index({ subscriptionId: 1 }, { unique: true });
    SubscriptionSchema.index({ clientId: 1 }, { unique: true });
    SubscriptionSchema.index({ status: 1, currentPeriodEnd: 1 });

    return mongoose.model('ApiSubscription', SubscriptionSchema);
  }

  private createUsageSchema(): any {
    const UsageSchema = new mongoose.Schema({
      clientId: { type: String, required: true },
      date: { type: Date, required: true },
      totalRequests: { type: Number, default: 0 },
      successfulRequests: { type: Number, default: 0 },
      failedRequests: { type: Number, default: 0 },
      rateLimitedRequests: { type: Number, default: 0 },
      averageLatency: { type: Number, default: 0 },
      p95Latency: { type: Number, default: 0 },
      bandwidth: { type: Number, default: 0 },
      topEndpoints: [{
        endpoint: String,
        method: String,
        count: Number,
      }],
      errorBreakdown: { type: Map, of: Number, default: {} },
    }, { timestamps: true });

    UsageSchema.index({ clientId: 1, date: 1 }, { unique: true });

    return mongoose.model('ApiUsage', UsageSchema);
  }

  private createKeySchema(): any {
    const KeySchema = new mongoose.Schema({
      keyId: { type: String, required: true, unique: true },
      keyPrefix: { type: String, required: true },
      clientId: { type: String, required: true },
      name: { type: String, required: true },
      keyHash: { type: String, required: true },
      scopes: { type: [String], default: ['read'] },
      rateLimitOverride: {
        requestsPerSecond: Number,
        requestsPerMinute: Number,
      },
      isActive: { type: Boolean, default: true },
      lastUsedAt: Date,
      expiresAt: Date,
    }, { timestamps: true });

    KeySchema.index({ keyId: 1 }, { unique: true });
    KeySchema.index({ clientId: 1, isActive: 1 });

    return mongoose.model('ApiKey', KeySchema);
  }

  /**
   * Get all available API plans
   */
  getPlans(): ApiPlan[] {
    return API_PLANS.filter(p => p.isActive);
  }

  /**
   * Get plan by tier
   */
  getPlanByTier(tier: ApiPlanTier): ApiPlan | undefined {
    return API_PLANS.find(p => p.tier === tier && p.isActive);
  }

  /**
   * Get plan by ID
   */
  getPlanById(planId: string): ApiPlan | undefined {
    return API_PLANS.find(p => p.planId === planId && p.isActive);
  }

  /**
   * Subscribe to a plan
   */
  async subscribe(
    clientId: string,
    clientName: string,
    planTier: ApiPlanTier,
    options: {
      billingCycle?: 'monthly' | 'yearly';
      trialDays?: number;
    } = {}
  ): Promise<{ success: boolean; subscription?: ApiSubscription; error?: string }> {
    try {
      // Check for existing subscription
      const existing = await this.subscriptionModel.findOne({ clientId });
      if (existing) {
        return { success: false, error: 'Client already has a subscription' };
      }

      const plan = this.getPlanByTier(planTier);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      const subscriptionId = this.generateSubscriptionId();
      const now = new Date();
      const trialDays = options.trialDays ?? (plan.tier === 'free' ? 0 : 14);
      const billingCycle = options.billingCycle || 'monthly';

      const currentPeriodStart = now;
      const currentPeriodEnd = new Date(now);
      if (billingCycle === 'monthly') {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      } else {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      }

      const trialEndsAt = trialDays > 0
        ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
        : undefined;

      const subscription = new this.subscriptionModel({
        subscriptionId,
        clientId,
        clientName,
        planId: plan._id || new Types.ObjectId(),
        planTier,
        status: trialDays > 0 ? 'trial' : 'active',
        billingCycle,
        currentPeriodStart,
        currentPeriodEnd,
        trialEndsAt,
        autoRenew: true,
      });

      await (subscription as mongoose.Document & ApiSubscription).save();

      logger.info('API subscription created', {
        subscriptionId,
        clientId,
        planTier,
        status: subscription.status,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.API_SUBSCRIPTION_CREATED, {
        subscriptionId,
        clientId,
        planTier,
        billingCycle,
      });

      return { success: true, subscription };
    } catch (error) {
      logger.error('Error creating API subscription', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create subscription',
      };
    }
  }

  /**
   * Get client's subscription
   */
  async getSubscription(clientId: string): Promise<ApiSubscription | null> {
    return this.subscriptionModel.findOne({ clientId });
  }

  /**
   * Track API usage
   */
  async trackUsage(
    clientId: string,
    data: {
      totalRequests?: number;
      successfulRequests?: number;
      failedRequests?: number;
      rateLimitedRequests?: number;
      latency?: number;
      bandwidth?: number;
      endpoint?: string;
      method?: string;
      errorCode?: string;
    }
  ): Promise<{ success: boolean; overQuota?: boolean }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const existingUsage = await this.usageModel.findOne({
        clientId,
        date: today,
      });

      if (existingUsage) {
        // Update existing record
        if (data.totalRequests !== undefined) {
          existingUsage.totalRequests += data.totalRequests;
        }
        if (data.successfulRequests !== undefined) {
          existingUsage.successfulRequests += data.successfulRequests;
        }
        if (data.failedRequests !== undefined) {
          existingUsage.failedRequests += data.failedRequests;
        }
        if (data.rateLimitedRequests !== undefined) {
          existingUsage.rateLimitedRequests += data.rateLimitedRequests;
        }
        if (data.latency !== undefined) {
          existingUsage.averageLatency = (
            existingUsage.averageLatency * (existingUsage.totalRequests - 1) + data.latency
          ) / existingUsage.totalRequests;
        }
        if (data.bandwidth !== undefined) {
          existingUsage.bandwidth += data.bandwidth;
        }

        // Update endpoint tracking
        if (data.endpoint && data.method) {
          const existingEndpoint = existingUsage.topEndpoints.find(
            (e: { endpoint: string; method: string; count: number }) => e.endpoint === data.endpoint && e.method === data.method
          );
          if (existingEndpoint) {
            existingEndpoint.count++;
          } else {
            existingUsage.topEndpoints.push({
              endpoint: data.endpoint,
              method: data.method,
              count: 1,
            });
            // Keep only top 10
            existingUsage.topEndpoints.sort((a: { count: number }, b: { count: number }) => b.count - a.count);
            existingUsage.topEndpoints = existingUsage.topEndpoints.slice(0, 10);
          }
        }

        // Track errors
        if (data.errorCode) {
          const currentCount = existingUsage.errorBreakdown.get(data.errorCode) || 0;
          existingUsage.errorBreakdown.set(data.errorCode, currentCount + 1);
        }

        await existingUsage.save();
      } else {
        // Create new record
        const newUsage = new this.usageModel({
          clientId,
          date: today,
          totalRequests: data.totalRequests || 0,
          successfulRequests: data.successfulRequests || 0,
          failedRequests: data.failedRequests || 0,
          rateLimitedRequests: data.rateLimitedRequests || 0,
          averageLatency: data.latency || 0,
          bandwidth: data.bandwidth || 0,
          topEndpoints: data.endpoint && data.method
            ? [{ endpoint: data.endpoint, method: data.method, count: 1 }]
            : [],
        });

        if (data.errorCode) {
          newUsage.errorBreakdown.set(data.errorCode, 1);
        }

        await newUsage.save();
      }

      // Check quota
      const subscription = await this.getSubscription(clientId);
      if (subscription && subscription.planTier !== 'enterprise') {
        const plan = this.getPlanByTier(subscription.planTier);
        if (plan && plan.quotas.monthlyRequests !== -1) {
          const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
          const monthUsage = await this.getUsageTotal(clientId, monthStart, today);
          if (monthUsage.totalRequests >= plan.quotas.monthlyRequests) {
            return { success: true, overQuota: true };
          }
        }
      }

      return { success: true };
    } catch (error) {
      logger.error('Error tracking API usage', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false };
    }
  }

  /**
   * Get usage total for a period
   */
  async getUsageTotal(
    clientId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalRequests: number; successfulRequests: number; failedRequests: number }> {
    const usage = await this.usageModel.aggregate([
      {
        $match: {
          clientId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: '$totalRequests' },
          successfulRequests: { $sum: '$successfulRequests' },
          failedRequests: { $sum: '$failedRequests' },
        },
      },
    ]);

    return usage[0] || { totalRequests: 0, successfulRequests: 0, failedRequests: 0 };
  }

  /**
   * Check rate limit for client
   */
  async checkRateLimit(
    clientId: string,
    keyId?: string
  ): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    resetAt?: Date;
  }> {
    try {
      const subscription = await this.getSubscription(clientId);
      if (!subscription || subscription.status !== 'active') {
        return { allowed: false, current: 0, limit: 0 };
      }

      const plan = this.getPlanByTier(subscription.planTier);
      if (!plan) {
        return { allowed: false, current: 0, limit: 0 };
      }

      // Get key-specific limits if provided
      let rateLimit = plan.rateLimits;
      if (keyId) {
        const key = await this.keyModel.findOne({ keyId, clientId });
        if (key?.rateLimitOverride) {
          rateLimit = { ...rateLimit, ...key.rateLimitOverride };
        }
      }

      // Get current usage (last minute)
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const usage = await this.usageModel.findOne({
        clientId,
        date: { $gte: oneMinuteAgo },
      });

      const currentRequests = usage?.totalRequests || 0;
      const limit = rateLimit.requestsPerMinute;

      if (currentRequests >= limit) {
        const resetAt = new Date(oneMinuteAgo.getTime() + 60000);
        return { allowed: false, current: currentRequests, limit, resetAt };
      }

      return { allowed: true, current: currentRequests, limit };
    } catch (error) {
      logger.error('Error checking rate limit', {
        clientId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { allowed: false, current: 0, limit: 0 };
    }
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(
    clientId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      granularity?: 'hour' | 'day' | 'week' | 'month';
    } = {}
  ): Promise<{
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    quotaUsed: number;
    quotaLimit: number;
    dailyUsage: Array<{ date: Date; requests: number }>;
  }> {
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = options.endDate || new Date();

    const usage = await this.usageModel.find({
      clientId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    let totalRequests = 0;
    let successfulRequests = 0;
    let failedRequests = 0;
    let latencySum = 0;
    let latencyCount = 0;
    const dailyUsage: Array<{ date: Date; requests: number }> = [];

    for (const record of usage) {
      totalRequests += record.totalRequests;
      successfulRequests += record.successfulRequests;
      failedRequests += record.failedRequests;
      if (record.averageLatency > 0) {
        latencySum += record.averageLatency;
        latencyCount++;
      }
      dailyUsage.push({ date: record.date, requests: record.totalRequests });
    }

    // Get quota info
    const subscription = await this.getSubscription(clientId);
    const plan = subscription ? this.getPlanByTier(subscription.planTier) : this.getPlanByTier('free');
    const quotaLimit = plan?.quotas.monthlyRequests || 0;
    const quotaUsed = totalRequests;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageLatency: latencyCount > 0 ? latencySum / latencyCount : 0,
      quotaUsed,
      quotaLimit,
      dailyUsage,
    };
  }

  /**
   * Upgrade/downgrade subscription
   */
  async changePlan(
    clientId: string,
    newPlanTier: ApiPlanTier,
    effectiveDate: 'immediate' | 'end_of_period' = 'immediate'
  ): Promise<{ success: boolean; subscription?: ApiSubscription; error?: string }> {
    try {
      const subscription = await this.getSubscription(clientId);
      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      const newPlan = this.getPlanByTier(newPlanTier);
      if (!newPlan) {
        return { success: false, error: 'Plan not found' };
      }

      subscription.planId = newPlan._id || new Types.ObjectId();
      subscription.planTier = newPlanTier;

      if (effectiveDate === 'immediate') {
        // Recalculate period
        const now = new Date();
        subscription.currentPeriodStart = now;
        subscription.currentPeriodEnd = new Date(now);
        if (subscription.billingCycle === 'monthly') {
          subscription.currentPeriodEnd.setMonth(subscription.currentPeriodEnd.getMonth() + 1);
        } else {
          subscription.currentPeriodEnd.setFullYear(subscription.currentPeriodEnd.getFullYear() + 1);
        }
      }

      await (subscription as mongoose.Document & ApiSubscription).save();

      logger.info('API subscription plan changed', {
        subscriptionId: subscription.subscriptionId,
        newPlanTier,
        effectiveDate,
      });

      return { success: true, subscription };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to change plan',
      };
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateSubscriptionId(): string {
    return `SUB-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const apiAccessPricingService = new ApiAccessPricingService();
export default apiAccessPricingService;
