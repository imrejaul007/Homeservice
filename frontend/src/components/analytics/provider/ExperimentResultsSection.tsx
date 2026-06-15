import React from 'react';
import { FlaskConical, TrendingUp } from 'lucide-react';
import type { ProviderExperimentResult } from '../../../services/analyticsApi';
import { EmptyState } from '../../common/EmptyState';
import { formatPrice } from '../../../utils/currency';

interface ExperimentResultsSectionProps {
  experiments: ProviderExperimentResult[];
  periodLabel: string;
  isLoading?: boolean;
}

export const ExperimentResultsSection: React.FC<ExperimentResultsSectionProps> = ({
  experiments,
  periodLabel,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="glass-nilin rounded-nilin-lg p-6 mb-8 animate-pulse">
        <div className="h-6 w-48 bg-nilin-muted rounded mb-4" />
        <div className="h-24 bg-nilin-muted rounded" />
      </div>
    );
  }

  if (!experiments.length) {
    return (
      <div className="glass-nilin rounded-nilin-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <FlaskConical className="h-5 w-5 text-nilin-coral" />
          <h2 className="text-lg font-serif text-nilin-charcoal">Experiment results</h2>
        </div>
        <EmptyState
          icon={<FlaskConical className="h-8 w-8" />}
          title="No experiment data yet"
          description="Feature flag exposures and conversions will appear here once enough traffic is recorded."
          compact
        />
      </div>
    );
  }

  const grouped = experiments.reduce<Record<string, ProviderExperimentResult[]>>((acc, row) => {
    if (!acc[row.experimentId]) acc[row.experimentId] = [];
    acc[row.experimentId].push(row);
    return acc;
  }, {});

  return (
    <div className="glass-nilin rounded-nilin-lg p-6 mb-8 hover-lift">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-nilin-coral" />
          <h2 className="text-lg font-serif text-nilin-charcoal">Experiment results</h2>
        </div>
        <span className="text-xs text-nilin-warmGray">{periodLabel}</span>
      </div>
      <p className="text-xs text-nilin-warmGray mb-6">
        Exposures and booking outcomes by feature flag variant
      </p>

      <div className="space-y-6">
        {Object.entries(grouped).map(([experimentId, variants]) => (
          <div key={experimentId} className="border border-nilin-border/60 rounded-nilin p-4">
            <h3 className="text-sm font-semibold text-nilin-charcoal mb-3 font-mono">
              {experimentId}
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-nilin-warmGray border-b border-nilin-border/40">
                    <th className="pb-2 pr-4 font-medium">Variant</th>
                    <th className="pb-2 pr-4 font-medium">Exposures</th>
                    <th className="pb-2 pr-4 font-medium">Bookings</th>
                    <th className="pb-2 pr-4 font-medium">Revenue</th>
                    <th className="pb-2 font-medium">Conv. rate</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((variant) => (
                    <tr key={`${experimentId}-${variant.variant}`} className="border-b border-nilin-border/20 last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-nilin-charcoal">{variant.variant}</td>
                      <td className="py-2.5 pr-4">{variant.exposures.toLocaleString()}</td>
                      <td className="py-2.5 pr-4">{variant.bookings.toLocaleString()}</td>
                      <td className="py-2.5 pr-4">{formatPrice(variant.revenue)}</td>
                      <td className="py-2.5 flex items-center gap-1">
                        <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        {variant.conversionRate.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
