// Feature Flags & Remote Config Service
// Operational infrastructure for controlling features without deploys

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  rolloutPercentage?: number; // 0-100
  variant?: string; // For A/B tests
  metadata?: Record<string, any>;
}

export interface RemoteConfig {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'json';
}

interface FeatureFlagsState {
  flags: Record<string, FeatureFlag>;
  config: Record<string, RemoteConfig>;
  userId?: string;

  // Actions
  setFlag: (key: string, flag: FeatureFlag) => void;
  setConfig: (key: string, config: RemoteConfig) => void;
  loadFlags: (flags: Record<string, FeatureFlag>) => void;
  loadConfig: (config: Record<string, RemoteConfig>) => void;
  isEnabled: (key: string, userId?: string) => boolean;
  getVariant: (key: string) => string | undefined;
  getConfig: <T>(key: string, defaultValue: T) => T;
}

class FeatureFlagsService {
  private flags: Record<string, FeatureFlag> = {};
  private config: Record<string, RemoteConfig> = {};
  private listeners: Set<() => void> = new Set();

  // Initialize with default flags
  private defaultFlags: Record<string, FeatureFlag> = {
    // UI Features
    'new_onboarding_flow': { key: 'new_onboarding_flow', enabled: true, rolloutPercentage: 100 },
    'show_trust_badges': { key: 'show_trust_badges', enabled: true },
    'show_referral_section': { key: 'show_referral_section', enabled: true },
    'enable_ai_recommendations': { key: 'enable_ai_recommendations', enabled: true },
    'show_milestones': { key: 'show_milestones', enabled: true },

    // Booking Features
    'instant_booking': { key: 'instant_booking', enabled: true },
    'reschedule_enabled': { key: 'reschedule_enabled', enabled: true },
    'cancel_within_hour': { key: 'cancel_within_hour', enabled: true },
    'partial_refund': { key: 'partial_refund', enabled: true },

    // Provider Features
    'provider_tiers': { key: 'provider_tiers', enabled: true },
    'dynamic_pricing': { key: 'dynamic_pricing', enabled: false },
    'provider_analytics': { key: 'provider_analytics', enabled: true },

    // Monetization
    'show_promotions': { key: 'show_promotions', enabled: true },
    'wallet_enabled': { key: 'wallet_enabled', enabled: true },
    'subscription_tiers': { key: 'subscription_tiers', enabled: false },

    // Growth
    'referral_enabled': { key: 'referral_enabled', enabled: true },
    'push_notifications': { key: 'push_notifications', enabled: true },
    'review_reminders': { key: 'review_reminders', enabled: true },

    // Experiments
    'new_homepage_layout': { key: 'new_homepage_layout', enabled: false, rolloutPercentage: 20 },
  };

  private defaultConfig: Record<string, RemoteConfig> = {
    'min_booking_amount': { key: 'min_booking_amount', value: 99, type: 'number' },
    'max_booking_days': { key: 'max_booking_days', value: 30, type: 'number' },
    'cancellation_window_hours': { key: 'cancellation_window_hours', value: 4, type: 'number' },
    'referral_credit_amount': { key: 'referral_credit_amount', value: 100, type: 'number' },
    'welcome_credit_amount': { key: 'welcome_credit_amount', value: 200, type: 'number' },
    'max_referral_credits': { key: 'max_referral_credits', value: 1000, type: 'number' },
    'support_phone': { key: 'support_phone', value: '+91-9876543210', type: 'string' },
    'support_email': { key: 'support_email', value: 'support@nilin.app', type: 'string' },
    'promo_banner_message': { key: 'promo_banner_message', value: 'Get ₹200 off your first booking!', type: 'string' },
    'rating_review_threshold': { key: 'rating_review_threshold', value: 4.5, type: 'number' },
    'top_rated_threshold': { key: 'top_rated_threshold', value: 4.8, type: 'number' },
  };

  constructor() {
    this.flags = { ...this.defaultFlags };
    this.config = { ...this.defaultConfig };
  }

  // Check if feature is enabled
  isEnabled(key: string, userId?: string): boolean {
    const flag = this.flags[key];
    if (!flag || !flag.enabled) return false;

    // Check rollout percentage
    if (flag.rolloutPercentage !== undefined && flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(userId || 'anonymous');
      return hash < flag.rolloutPercentage;
    }

    return true;
  }

  // Get A/B test variant
  getVariant(key: string, userId?: string): string | undefined {
    const flag = this.flags[key];
    return flag?.variant;
  }

  // Get remote config value
  getConfig<T>(key: string, defaultValue: T): T {
    const config = this.config[key];
    if (!config) return defaultValue;
    return config.value as T;
  }

  // Set flag (for local testing)
  setFlag(key: string, enabled: boolean, rolloutPercentage?: number) {
    this.flags[key] = {
      key,
      enabled,
      rolloutPercentage,
    };
    this.notifyListeners();
  }

  // Load flags from server
  async loadFromServer(userId?: string): Promise<void> {
    try {
      const { api } = await import('../api');
      const response = await api.get('/feature-flags/client', {
        params: userId ? { userId } : undefined,
      });
      const serverFlags = response.data?.data?.flags as Record<string, boolean> | undefined;

      if (serverFlags) {
        Object.entries(serverFlags).forEach(([key, enabled]) => {
          this.flags[key] = {
            key,
            enabled: Boolean(enabled),
            rolloutPercentage: 100,
          };
        });
      }

      this.notifyListeners();
    } catch (error) {
      console.error('[FeatureFlags] Failed to load from server:', error);
    }
  }

  // Get all flags (for admin/debugging)
  getAllFlags(): Record<string, FeatureFlag> {
    return { ...this.flags };
  }

  // Subscribe to flag changes
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  // Deterministic hash for rollout percentage
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  // Force refresh flags
  async refresh(userId?: string): Promise<void> {
    await this.loadFromServer(userId);
  }
}

export const featureFlags = new FeatureFlagsService();

// React hook
import { useState, useEffect } from 'react';

export function useFeatureFlag(key: string): boolean {
  const [enabled, setEnabled] = useState(() => featureFlags.isEnabled(key));

  useEffect(() => {
    setEnabled(featureFlags.isEnabled(key));

    const unsubscribe = featureFlags.subscribe(() => {
      setEnabled(featureFlags.isEnabled(key));
    });

    return unsubscribe;
  }, [key]);

  return enabled;
}

export function useRemoteConfig<T>(key: string, defaultValue: T): T {
  const [value, setValue] = useState<T>(() => featureFlags.getConfig(key, defaultValue));

  useEffect(() => {
    setValue(featureFlags.getConfig(key, defaultValue));

    const unsubscribe = featureFlags.subscribe(() => {
      setValue(featureFlags.getConfig(key, defaultValue));
    });

    return unsubscribe;
  }, [key, defaultValue]);

  return value;
}

export default featureFlags;
