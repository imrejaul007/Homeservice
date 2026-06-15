export interface MetricDefinition {
  key: string;
  label: string;
  description: string;
  unit: 'count' | 'percent' | 'currency' | 'minutes' | 'ratio' | 'date';
  source: string;
  dateField?: string;
}

export const METRIC_DEFINITIONS: Record<string, MetricDefinition> = {
  totalViews: {
    key: 'totalViews',
    label: 'Listing impressions',
    description: 'Unique listing impressions in the selected period (falls back to raw impressions when unique data is unavailable).',
    unit: 'count',
    source: 'providerProfile.analytics.listingImpressions',
    dateField: 'dailyBuckets',
  },
  profileViews: {
    key: 'profileViews',
    label: 'Profile views',
    description: 'Unique provider profile views in the selected period.',
    unit: 'count',
    source: 'providerProfile.analytics.profileViews',
    dateField: 'uniqueViews',
  },
  bookingRequests: {
    key: 'bookingRequests',
    label: 'Booking requests',
    description: 'All booking requests created in the selected period.',
    unit: 'count',
    source: 'bookings',
    dateField: 'createdAt',
  },
  conversionRate: {
    key: 'conversionRate',
    label: 'Request conversion rate',
    description: 'Booking requests divided by unique profile views.',
    unit: 'percent',
    source: 'derived',
  },
  confirmedBookingRate: {
    key: 'confirmedBookingRate',
    label: 'Confirmed booking rate',
    description: 'Confirmed bookings divided by unique profile views.',
    unit: 'percent',
    source: 'derived',
  },
  conversionRateConfirmed: {
    key: 'conversionRateConfirmed',
    label: 'Confirmed conversion rate',
    description: 'Confirmed bookings divided by unique profile views (same numerator/denominator as confirmed booking rate).',
    unit: 'percent',
    source: 'derived',
  },
  netRevenue: {
    key: 'netRevenue',
    label: 'Net revenue',
    description: 'Completed booking revenue after platform commission and fees, net of refunds.',
    unit: 'currency',
    source: 'bookings',
    dateField: 'completedAt',
  },
  grossRevenue: {
    key: 'grossRevenue',
    label: 'Gross revenue',
    description: 'Completed booking revenue before deductions, net of refunds.',
    unit: 'currency',
    source: 'bookings',
    dateField: 'completedAt',
  },
  cancellationRate: {
    key: 'cancellationRate',
    label: 'Cancellation rate',
    description: 'Share of bookings cancelled in the selected period.',
    unit: 'percent',
    source: 'bookings',
    dateField: 'createdAt',
  },
  responseTime: {
    key: 'responseTime',
    label: 'Average response time',
    description: 'Average minutes between booking request and provider response.',
    unit: 'minutes',
    source: 'bookings',
    dateField: 'createdAt',
  },
  repeatCustomerRate: {
    key: 'repeatCustomerRate',
    label: 'Repeat customer rate',
    description: 'Share of customers with more than one completed booking.',
    unit: 'percent',
    source: 'bookings',
    dateField: 'completedAt',
  },
  customerLtv: {
    key: 'customerLtv',
    label: 'Customer lifetime value',
    description: 'Average gross revenue per unique customer in the selected period.',
    unit: 'currency',
    source: 'bookings',
    dateField: 'completedAt',
  },
  funnelOverallConversion: {
    key: 'funnelOverallConversion',
    label: 'Funnel conversion',
    description: 'Completed bookings divided by the first non-zero funnel stage.',
    unit: 'percent',
    source: 'derived',
  },
  dataQuality: {
    key: 'dataQuality',
    label: 'Tracking coverage',
    description: 'Indicates whether impression/profile tracking is available or bookings-only metrics are shown.',
    unit: 'ratio',
    source: 'providerProfile.analytics',
  },
};

export default METRIC_DEFINITIONS;
