export interface ProviderMetricDefinition {
  label: string;
  description: string;
  formula?: string;
}

export const PROVIDER_METRIC_DEFINITIONS: Record<string, ProviderMetricDefinition> = {
  netRevenue: {
    label: 'Net revenue',
    description: 'Completed booking revenue after platform fees and commissions.',
    formula: 'Sum of provider payout from completed bookings in period',
  },
  grossRevenue: {
    label: 'Gross revenue',
    description: 'Total customer spend on completed bookings before platform deductions.',
    formula: 'Sum of booking totals for completed bookings in period',
  },
  bookingRequests: {
    label: 'Booking requests',
    description: 'New booking requests received during the selected period.',
    formula: 'Count of bookings created in period (all statuses)',
  },
  profileViews: {
    label: 'Profile views',
    description: 'Unique visitors who opened your provider profile.',
    formula: 'Distinct session IDs per day, summed for period',
  },
  listingImpressions: {
    label: 'Listing impressions',
    description: 'Times your listings appeared in search or browse results (unique per session).',
    formula: 'Unique listing impressions per session in period',
  },
  bookingRate: {
    label: 'Booking rate',
    description: 'Share of profile viewers who submitted a booking request.',
    formula: 'Booking requests ÷ unique profile views × 100',
  },
  confirmedRate: {
    label: 'Confirmed rate',
    description: 'Share of profile viewers whose request was confirmed by you.',
    formula: 'Confirmed bookings ÷ unique profile views × 100',
  },
  conversionFunnel: {
    label: 'Conversion funnel',
    description: 'Stage-by-stage drop-off from discovery to completed booking.',
  },
  repeatCustomerRate: {
    label: 'Repeat customer rate',
    description: 'Customers who booked more than once with you in the period.',
  },
  responseTime: {
    label: 'Response time',
    description: 'Average time to accept or respond to new booking requests.',
  },
  customerLtv: {
    label: 'Customer lifetime value',
    description: 'Average total spend per customer across all their bookings with you.',
  },
  bookingSources: {
    label: 'Booking sources',
    description: 'Where confirmed bookings originated: search, profile, ads, direct, or repeat.',
  },
  anomalyAlerts: {
    label: 'Anomaly alerts',
    description: 'Automated flags when a metric shifts significantly vs the previous period.',
  },
  experiments: {
    label: 'Experiment results',
    description: 'A/B test exposures and booking outcomes grouped by feature flag variant.',
  },
};

export type ProviderMetricKey = keyof typeof PROVIDER_METRIC_DEFINITIONS;
