import type { Period } from '../../../../services/providerInsightsApi';

export type AnalyticsRange = '7d' | '30d' | '90d';

export function analyticsRangeToInsightsPeriod(range: AnalyticsRange): Period {
  switch (range) {
    case '7d':
      return 'week';
    case '30d':
      return 'month';
    case '90d':
      return 'quarter';
    default:
      return 'month';
  }
}

export function insightsPeriodToAnalyticsRange(period: Period): AnalyticsRange {
  switch (period) {
    case 'week':
      return '7d';
    case 'month':
      return '30d';
    case 'quarter':
      return '90d';
    case 'year':
      return '90d';
    default:
      return '30d';
  }
}

export const INSIGHTS_PERIOD_LABELS: Record<Period, string> = {
  week: 'Last 7 days',
  month: 'Last 30 days',
  quarter: 'Last 90 days',
  year: 'Last year',
};
