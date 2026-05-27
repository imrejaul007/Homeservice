import { cache } from '../config/redis';
import logger from '../utils/logger';

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  userSegments: string[];
  variants: { name: string; weight: number }[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserFlagContext {
  userId?: string;
  role?: string;
  tier?: string;
  region?: string;
  customAttributes?: Record<string, any>;
}

// Default flags
const DEFAULT_FLAGS: Partial<FeatureFlag>[] = [
  {
    key: 'new_onboarding_flow',
    name: 'New Onboarding Flow',
    description: 'Enable the new progressive onboarding experience',
    enabled: true,
    rolloutPercentage: 20,
    userSegments: [],
    variants: [],
  },
  {
    key: 'ai_recommendations',
    name: 'AI Recommendations',
    description: 'Enable AI-powered service recommendations',
    enabled: true,
    rolloutPercentage: 100,
    userSegments: [],
    variants: [],
  },
  {
    key: 'smart_pricing',
    name: 'Smart Pricing',
    description: 'Enable dynamic pricing based on demand',
    enabled: true,
    rolloutPercentage: 50,
    userSegments: [],
    variants: [],
  },
  {
    key: 'loyalty_tiers',
    name: 'Loyalty Tiers',
    description: 'Enable tiered loyalty system',
    enabled: true,
    rolloutPercentage: 100,
    userSegments: [],
    variants: [],
  },
  {
    key: 'referral_program',
    name: 'Referral Program',
    description: 'Enable referral rewards program',
    enabled: true,
    rolloutPercentage: 100,
    userSegments: [],
    variants: [],
  },
];

class FeatureFlagsService {
  private flags: Map<string, FeatureFlag> = new Map();
  private cachePrefix = 'feature_flags:';
  private cacheTTL = 300; // 5 minutes

  constructor() {
    this.initializeFlags();
  }

  private initializeFlags(): void {
    DEFAULT_FLAGS.forEach(flag => {
      if (flag.key) {
        this.flags.set(flag.key, {
          ...flag,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as FeatureFlag);
      }
    });
    logger.info('Feature flags initialized', { count: this.flags.size });
  }

  async getFlag(key: string): Promise<FeatureFlag | null> {
    // Check cache first
    const cached = await cache.get(`${this.cachePrefix}${key}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache, continue
      }
    }

    const flag = this.flags.get(key) || null;
    if (flag) {
      await cache.set(
        `${this.cachePrefix}${key}`,
        JSON.stringify(flag),
        this.cacheTTL
      );
    }
    return flag;
  }

  async isEnabled(key: string, context?: UserFlagContext): Promise<boolean> {
    const flag = await this.getFlag(key);
    if (!flag || !flag.enabled) return false;

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      if (!context?.userId) return false;
      const hash = this.hashUserId(key, context.userId);
      const percentage = (hash % 100) + 1;
      if (percentage > flag.rolloutPercentage) return false;
    }

    // Check user segments
    if (flag.userSegments.length > 0 && context) {
      if (context.role && !flag.userSegments.includes(context.role)) return false;
      if (context.tier && !flag.userSegments.includes(context.tier)) return false;
    }

    return true;
  }

  async getVariant(key: string, context?: UserFlagContext): Promise<string | null> {
    const flag = await this.getFlag(key);
    if (!flag || !flag.enabled || !flag.variants.length) return null;

    if (!context?.userId) return flag.variants[0]?.name || null;

    const hash = this.hashUserId(key, context.userId);
    const bucket = hash % 100;
    let cumulative = 0;

    for (const variant of flag.variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) return variant.name;
    }

    return flag.variants[0]?.name || null;
  }

  async setFlag(key: string, updates: Partial<FeatureFlag>): Promise<void> {
    const existing = this.flags.get(key);
    const flag: FeatureFlag = {
      key,
      name: updates.name || key,
      description: updates.description || '',
      enabled: updates.enabled ?? false,
      rolloutPercentage: updates.rolloutPercentage ?? 0,
      userSegments: updates.userSegments ?? [],
      variants: updates.variants ?? [],
      metadata: updates.metadata,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    this.flags.set(key, flag);

    // Invalidate cache
    await cache.del(`${this.cachePrefix}${key}`);
    logger.info('Feature flag updated', { key, enabled: flag.enabled });
  }

  async getAllFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values());
  }

  async getEnabledFlags(): Promise<FeatureFlag[]> {
    return Array.from(this.flags.values()).filter(f => f.enabled);
  }

  private hashUserId(flagKey: string, userId: string): number {
    const str = `${flagKey}:${userId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

export const featureFlagsService = new FeatureFlagsService();

// Express middleware for attaching flags to request
export const featureFlagsMiddleware = async (req: any, res: any, next: any) => {
  const context: UserFlagContext = {
    userId: req.user?._id?.toString(),
    role: req.user?.role,
    tier: req.user?.loyaltySystem?.tier,
    region: req.user?.region,
  };

  req.featureFlags = {
    isEnabled: (key: string) => featureFlagsService.isEnabled(key, context),
    getVariant: (key: string) => featureFlagsService.getVariant(key, context),
  };

  next();
};
