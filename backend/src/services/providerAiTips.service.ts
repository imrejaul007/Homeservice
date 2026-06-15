import {
  getRevenueOptimizationTips,
  RevenueOptimizationTip,
} from './providerInsights.service';
import {
  getCancellationPreventionRecommendations,
  PreventionRecommendation,
} from './cancellationPrediction.service';
import {
  getInsightTipPreferences,
  updateInsightTipPreferences,
  InsightTipPreferences,
} from './providerInsightPreferences.service';

export interface ProviderAITip {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'revenue' | 'efficiency' | 'rating' | 'bookings' | 'general';
  potentialImpact?: string;
  actionLabel: string;
  actionRoute: string;
  confidence: number;
  isRead: boolean;
  isDismissed: boolean;
  source: 'revenue' | 'prevention';
}

const REVENUE_ROUTES: Record<RevenueOptimizationTip['category'], string> = {
  pricing: '/provider/services',
  volume: '/provider/availability',
  efficiency: '/provider/bookings',
  retention: '/provider/services',
};

const PREVENTION_ROUTES: Record<PreventionRecommendation['type'], string> = {
  reminder: '/provider/settings',
  confirmation: '/provider/settings',
  deposit: '/provider/settings',
  follow_up: '/provider/bookings',
};

const PREVENTION_LABELS: Record<PreventionRecommendation['type'], string> = {
  reminder: 'Configure booking reminders',
  confirmation: 'Enable booking confirmations',
  deposit: 'Set up deposit requirements',
  follow_up: 'View upcoming bookings',
};

const PRIORITY_MAP: Record<RevenueOptimizationTip['difficulty'], ProviderAITip['priority']> = {
  easy: 'low',
  medium: 'medium',
  hard: 'high',
};

const CATEGORY_MAP: Record<RevenueOptimizationTip['category'], ProviderAITip['category']> = {
  pricing: 'revenue',
  volume: 'bookings',
  efficiency: 'efficiency',
  retention: 'rating',
};

function transformRevenueTip(tip: RevenueOptimizationTip): ProviderAITip {
  return {
    id: `rev-${tip.category}`,
    title: tip.title,
    description: tip.description,
    priority: PRIORITY_MAP[tip.difficulty] || 'medium',
    category: CATEGORY_MAP[tip.category] || 'general',
    potentialImpact: `+${tip.potentialImpact}% revenue`,
    actionLabel: tip.actionItems[0] || 'Take action',
    actionRoute: REVENUE_ROUTES[tip.category] || '/provider/insights',
    confidence: tip.confidence,
    isRead: false,
    isDismissed: false,
    source: 'revenue',
  };
}

function transformPreventionTip(tip: PreventionRecommendation): ProviderAITip {
  const titles: Record<PreventionRecommendation['type'], string> = {
    reminder: 'Send Booking Reminders',
    confirmation: 'Request Booking Confirmation',
    deposit: 'Require Deposit for Risky Bookings',
    follow_up: 'Follow Up with At-Risk Customers',
  };

  return {
    id: `prev-${tip.type}`,
    title: titles[tip.type] || 'Improve Booking Management',
    description: tip.message,
    priority: tip.priority,
    category: 'bookings',
    potentialImpact: `-${tip.estimatedImpact}% cancellations`,
    actionLabel: PREVENTION_LABELS[tip.type] || 'View bookings',
    actionRoute: PREVENTION_ROUTES[tip.type] || '/provider/bookings',
    confidence: tip.confidence,
    isRead: false,
    isDismissed: false,
    source: 'prevention',
  };
}

function applyPreferences(tips: ProviderAITip[], prefs: InsightTipPreferences): ProviderAITip[] {
  const dismissed = new Set(prefs.dismissed);
  const read = new Set(prefs.read);

  return tips.map((tip) => ({
    ...tip,
    isRead: read.has(tip.id),
    isDismissed: dismissed.has(tip.id),
  }));
}

export async function getProviderAITips(providerId: string): Promise<{
  tips: ProviderAITip[];
  preferences: InsightTipPreferences;
}> {
  const [optimizationResult, preventionResult, preferences] = await Promise.all([
    getRevenueOptimizationTips(providerId),
    getCancellationPreventionRecommendations(providerId),
    getInsightTipPreferences(providerId),
  ]);

  const tips: ProviderAITip[] = [];

  optimizationResult.forEach((tip) => {
    tips.push(transformRevenueTip(tip));
  });

  preventionResult.forEach((tip) => {
    tips.push(transformPreventionTip(tip));
  });

  const priorityOrder: Record<ProviderAITip['priority'], number> = { high: 0, medium: 1, low: 2 };
  tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    tips: applyPreferences(tips, preferences),
    preferences,
  };
}

export async function syncAiTipPreferences(
  providerId: string,
  incoming: { dismissed?: string[]; read?: string[] }
): Promise<InsightTipPreferences> {
  return updateInsightTipPreferences(providerId, {
    dismissed: incoming.dismissed,
    read: incoming.read,
  });
}
