import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { providerInsightsApi } from '../../../../services/providerInsightsApi';
import type {
  ProviderInsight,
  ImpactLevel,
  RiskLevel,
  BookingCancellationPrediction,
} from '../../../../services/providerInsightsApi';
import { cn } from '../../../../lib/utils';

export const formatCurrency = (amount: number) => providerInsightsApi.formatCurrency(amount);
export const formatPercentage = (value: number) => providerInsightsApi.formatPercentage(value);

export function getRiskBadgeClass(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function getImpactBadgeClass(impact: ImpactLevel): string {
  switch (impact) {
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function InsightsStatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  icon?: React.ElementType;
}) {
  return (
    <div className="glass-nilin rounded-nilin-lg p-4 sm:p-5 hover-lift">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs sm:text-sm text-nilin-warmGray">{title}</span>
        {Icon && (
          <div className="p-1.5 bg-nilin-coral/10 rounded-nilin">
            <Icon className="h-4 w-4 text-nilin-coral" />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl sm:text-2xl font-bold text-nilin-charcoal">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-xs sm:text-sm flex items-center gap-0.5 font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600',
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {formatPercentage(Math.abs(trend.value))}
          </span>
        )}
      </div>
      {subtitle && <div className="text-[10px] sm:text-xs text-nilin-warmGray mt-1">{subtitle}</div>}
    </div>
  );
}

export function InsightCard({ insight }: { insight: ProviderInsight }) {
  return (
    <div
      className={`border rounded-lg p-3 sm:p-4 ${getImpactBadgeClass(insight.impact)}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-medium uppercase">{insight.type}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${
              insight.impact === 'high'
                ? 'bg-red-100 text-red-700 border-red-300'
                : insight.impact === 'medium'
                  ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                  : 'bg-green-100 text-green-700 border-green-300'
            }`}
          >
            {insight.impact} impact
          </span>
        </div>
      </div>
      <h4 className="font-semibold text-gray-900 text-sm sm:text-base mb-1 sm:mb-2">{insight.title}</h4>
      <p className="text-xs sm:text-sm text-gray-600 mb-2 sm:mb-3 line-clamp-2">{insight.description}</p>
      {insight.actionItems.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] sm:text-xs font-medium text-gray-500">Action Items:</span>
          <ul className="text-xs sm:text-sm text-gray-600 list-disc list-inside space-y-0.5 sm:space-y-1">
            {insight.actionItems.slice(0, 3).map((item, idx) => (
              <li key={idx} className="line-clamp-1">
                {item}
              </li>
            ))}
            {insight.actionItems.length > 3 && (
              <li className="text-gray-400">+{insight.actionItems.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RiskCard({ prediction }: { prediction: BookingCancellationPrediction }) {
  return (
    <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">
            {prediction.customerName}
          </h4>
          <p className="text-xs text-gray-500 truncate">{prediction.serviceName}</p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${getRiskBadgeClass(prediction.riskAssessment.riskLevel)}`}
        >
          {prediction.riskAssessment.riskLevel.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
        <div>
          <span className="text-gray-500">Risk Score</span>
          <div className="font-semibold text-gray-900">{prediction.riskAssessment.riskScore}%</div>
        </div>
        <div>
          <span className="text-gray-500">Booking Value</span>
          <div className="font-semibold text-gray-900">{formatCurrency(prediction.totalAmount)}</div>
        </div>
      </div>
      {prediction.riskAssessment.recommendedActions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] sm:text-xs text-gray-500">Recommended Actions:</span>
          <ul className="mt-1 text-[10px] sm:text-xs text-gray-600 list-disc list-inside">
            {prediction.riskAssessment.recommendedActions.slice(0, 2).map((action, idx) => (
              <li key={idx} className="line-clamp-1">
                {action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
