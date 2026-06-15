import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AITipsAlerts, type AITip } from '../../provider/AITipsAlerts';
import { providerInsightsApi } from '../../../services/providerInsightsApi';
import type { ProviderInsight } from '../../../services/providerInsightsApi';
import { useFeatureFlag } from '../../../services/marketplace/FeatureFlags';

interface AnalyticsActionCenterProps {
  providerId?: string;
  insights?: ProviderInsight[];
  maxVisible?: number;
  className?: string;
}

function insightToTip(insight: ProviderInsight): AITip {
  return {
    id: `insight-${insight.id}`,
    title: insight.title,
    description: insight.description,
    priority: insight.impact === 'high' ? 'high' : insight.impact === 'medium' ? 'medium' : 'low',
    category: 'general',
    actionLabel: insight.actionItems[0] || 'View details',
    actionRoute: '/provider/analytics?tab=insights',
    confidence: 75,
  };
}

export const AnalyticsActionCenter: React.FC<AnalyticsActionCenterProps> = ({
  providerId,
  insights = [],
  maxVisible = 3,
  className,
}) => {
  const navigate = useNavigate();
  const aiRecommendationsEnabled = useFeatureFlag('enable_ai_recommendations');
  const [tips, setTips] = useState<AITip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aiRecommendationsEnabled || !providerId) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const loadTips = async () => {
      setIsLoading(true);
      try {
        const result = await providerInsightsApi.getAllTipsAsAITips(providerId);
        if (cancelled) return;

        let merged = [...result.tips];
        if (merged.length < maxVisible && insights.length > 0) {
          const insightTips = insights.slice(0, maxVisible - merged.length).map(insightToTip);
          merged = [...merged, ...insightTips];
        }

        setTips(merged.slice(0, maxVisible));
        setError(result.error);
      } catch (err) {
        if (!cancelled) {
          setTips([]);
          setError(err instanceof Error ? err.message : 'Failed to load recommendations');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadTips();
    return () => {
      cancelled = true;
    };
  }, [providerId, aiRecommendationsEnabled, insights, maxVisible]);

  if (!aiRecommendationsEnabled) {
    return null;
  }

  const handleTipAction = (tip: AITip) => {
    if (tip.actionRoute) {
      navigate(tip.actionRoute);
    }
  };

  if (!isLoading && tips.length === 0 && !error) {
    return (
      <div className={`glass-nilin rounded-nilin-lg p-6 mb-8 ${className ?? ''}`}>
        <h2 className="text-lg font-serif text-nilin-charcoal mb-2">Recommended actions</h2>
        <p className="text-sm text-nilin-warmGray">
          No recommendations yet — complete bookings to unlock personalized tips.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <AITipsAlerts
        tips={tips}
        isLoading={isLoading}
        maxVisible={maxVisible}
        onTipAction={handleTipAction}
        viewAllHref="/provider/analytics?tab=insights"
      />
      {error && tips.length > 0 && (
        <p className="text-xs text-amber-700 mt-2">{error}</p>
      )}
    </div>
  );
};
