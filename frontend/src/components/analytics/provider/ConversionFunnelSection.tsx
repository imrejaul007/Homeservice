import React from 'react';
import { Target, Loader2 } from 'lucide-react';
import { EmptyState } from '../../common/EmptyState';
import type { ProviderConversionFunnel } from '../../../services/analyticsApi';
import { cn } from '../../../lib/utils';

const STAGE_COLORS = [
  'bg-nilin-coral',
  'bg-blue-500',
  'bg-amber-500',
  'bg-green-500',
];

interface ConversionFunnelSectionProps {
  funnel: ProviderConversionFunnel | null;
  isLoading?: boolean;
  periodLabel?: string;
}

export const ConversionFunnelSection: React.FC<ConversionFunnelSectionProps> = ({
  funnel,
  isLoading = false,
  periodLabel,
}) => {
  const maxCount = funnel ? Math.max(...funnel.stages.map((s) => s.count), 1) : 1;
  const hasData = funnel?.stages.some((s) => s.count > 0) ?? false;

  return (
    <div className="glass-nilin rounded-nilin-lg p-6 hover-lift mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
            <Target className="h-5 w-5 text-nilin-coral" />
            Conversion funnel
          </h2>
          {periodLabel && <p className="text-xs text-nilin-warmGray mt-1">{periodLabel}</p>}
        </div>
        {funnel && hasData && (
          <div className="text-right">
            <p className="text-xs text-nilin-warmGray">Overall conversion</p>
            <p className="text-lg font-semibold text-nilin-charcoal">
              {funnel.overallConversionRate}%
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-nilin-coral" />
        </div>
      ) : !funnel || !hasData ? (
        <EmptyState
          icon={<Target className="h-8 w-8" />}
          title="No funnel data yet"
          description="Impressions, profile views, and bookings will appear here as customers discover your services."
          compact
        />
      ) : (
        <div className="space-y-4">
          {funnel.stages.map((stage, index) => {
            const widthPct = Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 8 : 2);
            return (
              <div key={stage.id}>
                <div className="flex items-center justify-between mb-1.5 gap-3">
                  <span className="text-sm font-medium text-nilin-charcoal">{stage.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-nilin-charcoal">
                      {stage.count.toLocaleString()}
                    </span>
                    {stage.rateFromPrevious !== null && index > 0 && (
                      <span className="text-xs text-nilin-warmGray">
                        ({stage.rateFromPrevious}% of prev.)
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-3 bg-nilin-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', STAGE_COLORS[index % STAGE_COLORS.length])}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
