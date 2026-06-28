import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Star,
  Eye,
  AlertCircle,
  Loader2,
  BarChart3,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import ProviderHubNav from '../../components/provider/ProviderHubNav';
import { useAuthStore } from '../../stores/authStore';
import {
  providerAnalyticsApi,
  type ProviderInsightsAnalytics,
  type TrendResult,
} from '../../services/providerApi';
import type { ProviderMetricKey } from '../../constants/providerMetricDefinitions';
import { useToastActions } from '../../components/common/Toast';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../utils/currency';
import { EmptyState } from '../../components/common/EmptyState';
import { ROASDashboard } from '../../components/analytics/provider/ROASDashboard';
import { RepeatCustomerRate } from '../../components/analytics/provider/RepeatCustomerRate';
import { TravelTimeTracking } from '../../components/analytics/provider/TravelTimeTracking';
import { AnalyticsActionCenter } from '../../components/analytics/provider/AnalyticsActionCenter';
import { TopServicesSection } from '../../components/analytics/provider/TopServicesSection';
import { ConversionFunnelSection } from '../../components/analytics/provider/ConversionFunnelSection';
import { ExportAnalyticsButton } from '../../components/analytics/provider/ExportAnalyticsButton';
import { RevenueTrendChart } from '../../components/provider/RevenueTrendChart';
import {
  analyticsApi,
  type ProviderConversionFunnel,
  type ProviderDashboardDataQuality,
  type ProviderDashboardRevenueMode,
  type ProviderExperimentResult,
} from '../../services/analyticsApi';
import { ExperimentResultsSection } from '../../components/analytics/provider/ExperimentResultsSection';
import { MetricDefinitionTooltip } from '../../components/analytics/provider/MetricDefinitionTooltip';
import {
  AnalyticsSummarySections,
  type AnalyticsSummaryData,
} from '../../components/analytics/provider/summary';
import { useFeatureFlag, default as featureFlags } from '../../services/marketplace/FeatureFlags';
import { analyticsService } from '../../lib/AnalyticsService';
import {
  useProviderInsightsData,
  analyticsRangeToInsightsPeriod,
  InsightsOverviewPanel,
  InsightsSchedulePanel,
  InsightsCancellationsPanel,
} from '../../components/analytics/provider/insights-tabs';

const TREND_NONE: TrendResult = { value: null, label: 'none' };

type AnalyticsTab = 'summary' | 'insights' | 'schedule' | 'cancellations';
type AnalyticsRange = '7d' | '30d' | '90d';

const ANALYTICS_TABS: Array<{ id: AnalyticsTab; label: string; icon: React.ElementType }> = [
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'insights', label: 'Insights', icon: Sparkles },
  { id: 'schedule', label: 'Schedule', icon: Calendar },
  { id: 'cancellations', label: 'Cancellations', icon: AlertTriangle },
];

const EMPTY_SUMMARY_DATA: AnalyticsSummaryData = {
  responseTime: null,
  customerLtv: null,
  geographic: null,
  forecast: null,
  bookingSources: null,
  anomalyAlerts: [],
  serviceFunnel: [],
};

const EMPTY_ANALYTICS: ProviderInsightsAnalytics = {
  overview: {
    totalViews: 0,
    viewsTrend: TREND_NONE,
    profileViews: 0,
    profileViewsTrend: TREND_NONE,
    bookingRequests: 0,
    bookingRequestsTrend: TREND_NONE,
    conversionRate: 0,
    conversionRateTrend: TREND_NONE,
  },
  earnings: { thisMonth: 0, lastMonth: 0, trend: TREND_NONE },
  bookings: { total: 0, completed: 0, pending: 0, cancelled: 0 },
  topServices: [],
  weeklyData: [
    { day: 'Mon', bookings: 0, revenue: 0 },
    { day: 'Tue', bookings: 0, revenue: 0 },
    { day: 'Wed', bookings: 0, revenue: 0 },
    { day: 'Thu', bookings: 0, revenue: 0 },
    { day: 'Fri', bookings: 0, revenue: 0 },
    { day: 'Sat', bookings: 0, revenue: 0 },
    { day: 'Sun', bookings: 0, revenue: 0 },
  ],
  timeSeries: [],
  ratings: {
    average: 0,
    total: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
};

const PERIOD_LABELS: Record<AnalyticsRange, { current: string; previous: string }> = {
  '7d': { current: 'Last 7 days', previous: 'Previous 7 days' },
  '30d': { current: 'Last 30 days', previous: 'Previous 30 days' },
  '90d': { current: 'Last 90 days', previous: 'Previous 90 days' },
};

const UAE_EMIRATES = [
  'All emirates',
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
] as const;

const DATA_QUALITY_RECENT_DAYS = 90;

function toRepeatCustomerPeriod(range: AnalyticsRange): '30d' | '90d' | '1y' {
  if (range === '90d') return '90d';
  return '30d';
}

function TrendBadge({ trend, hideTrend }: { trend?: TrendResult; hideTrend?: boolean }) {
  if (hideTrend || !trend || trend.label === 'none') {
    return null;
  }

  if (trend.label === 'new') {
    return <span className="text-sm font-medium text-blue-600">New</span>;
  }

  const isPositive = (trend.value ?? 0) >= 0;
  return (
    <div
      className={cn(
        'flex items-center gap-1 text-sm font-medium',
        isPositive ? 'text-green-600' : 'text-red-600',
      )}
    >
      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {Math.abs(trend.value ?? 0)}%
    </div>
  );
}

const ProviderAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isInitialized } = useAuthStore();
  const toast = useToastActions();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const loadRequestId = useRef(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const aiRecommendationsEnabled = useFeatureFlag('enable_ai_recommendations');
  const providerId = user?.id || user?._id;

  const [analytics, setAnalytics] = useState<ProviderInsightsAnalytics>(EMPTY_ANALYTICS);
  const [timeRange, setTimeRange] = useState<AnalyticsRange>('30d');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('summary');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<ProviderConversionFunnel | null>(null);
  const [summaryData, setSummaryData] = useState<AnalyticsSummaryData>(EMPTY_SUMMARY_DATA);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [comparePeriod, setComparePeriod] = useState(false);
  const [revenueMode, setRevenueMode] = useState<ProviderDashboardRevenueMode>('net');
  const [cityFilter, setCityFilter] = useState('');
  const [experiments, setExperiments] = useState<ProviderExperimentResult[]>([]);
  const [dataQuality, setDataQuality] = useState<ProviderDashboardDataQuality | null>(null);
  const [confirmedRate, setConfirmedRate] = useState(0);
  const [grossEarnings, setGrossEarnings] = useState<{ thisMonth: number; lastMonth: number } | undefined>();

  const insightsPeriod = analyticsRangeToInsightsPeriod(timeRange);
  const {
    insights,
    scheduleOptimization,
    cancellationStats,
    upcomingCancellations,
    optimizationTips,
    preventionRecommendations,
    loading: insightsLoading,
    loadError: insightsLoadError,
  } = useProviderInsightsData(insightsPeriod, providerId, {
    enablePolling: activeTab !== 'summary' && aiRecommendationsEnabled,
  });

  const visibleTabs = useMemo(
    () =>
      aiRecommendationsEnabled
        ? ANALYTICS_TABS
        : ANALYTICS_TABS.filter((tab) => tab.id === 'summary'),
    [aiRecommendationsEnabled],
  );

  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!providerId) return;
    const experimentKeys = ['new_homepage_layout', 'enable_ai_recommendations', 'dynamic_pricing'];
    experimentKeys.forEach((key) => {
      const enabled = featureFlags.isEnabled(key, providerId);
      const variant = featureFlags.getVariant(key, providerId) ?? (enabled ? 'on' : 'off');
      analyticsService.trackProviderFunnelEvent('experiment.exposure', {
        providerId,
        experimentId: key,
        variant,
        enabled,
      });
    });
  }, [providerId]);

  const buildUrlParams = useCallback(
    (overrides: Partial<{ range: AnalyticsRange; tab: AnalyticsTab; revenue: ProviderDashboardRevenueMode; city: string }> = {}) => {
      const params: Record<string, string> = {
        range: overrides.range ?? timeRange,
        tab: overrides.tab ?? activeTab,
        revenue: overrides.revenue ?? revenueMode,
      };
      const city = overrides.city ?? cityFilter;
      if (city) params.city = city;
      return params;
    },
    [timeRange, activeTab, revenueMode, cityFilter],
  );

  useEffect(() => {
    const range = searchParams.get('range');
    if (range && ['7d', '30d', '90d'].includes(range)) {
      setTimeRange(range as AnalyticsRange);
    }

    const tab = searchParams.get('tab');
    if (tab && ['summary', 'insights', 'schedule', 'cancellations'].includes(tab)) {
      setActiveTab(tab as AnalyticsTab);
    }

    const revenue = searchParams.get('revenue');
    if (revenue === 'net' || revenue === 'gross') {
      setRevenueMode(revenue);
    }

    const city = searchParams.get('city');
    if (city != null) {
      setCityFilter(city);
    }
  }, [searchParams]);

  const handleTimeRangeChange = (range: AnalyticsRange) => {
    setTimeRange(range);
    setSearchParams(buildUrlParams({ range }));
  };

  const handleTabChange = (tab: AnalyticsTab) => {
    setActiveTab(tab);
    setSearchParams(buildUrlParams({ tab }));
  };

  const handleRevenueModeChange = (mode: ProviderDashboardRevenueMode) => {
    setRevenueMode(mode);
    setSearchParams(buildUrlParams({ revenue: mode }));
  };

  const handleCityFilterChange = (city: string) => {
    setCityFilter(city);
    setSearchParams(buildUrlParams({ city }));
  };

  const loadSummaryExtras = useCallback(async (period: AnalyticsRange) => {
    const [
      responseTimeResult,
      ltvResult,
      geographicResult,
      forecastResult,
      bookingSourcesResult,
      anomalyAlertsResult,
      serviceFunnelResult,
    ] = await Promise.allSettled([
      analyticsApi.getProviderResponseTime(period),
      analyticsApi.getProviderCustomerLtv(period),
      analyticsApi.getProviderGeographicDemand(period),
      analyticsApi.getProviderRevenueForecast(period),
      analyticsApi.getProviderBookingSourceAttribution(period),
      analyticsApi.getProviderAnomalyAlerts(period),
      analyticsApi.getProviderServicesAnalytics(period, 10), // Fetch top 10 services for funnel
    ]);

    setSummaryData({
      responseTime: responseTimeResult.status === 'fulfilled' ? responseTimeResult.value : null,
      customerLtv: ltvResult.status === 'fulfilled' ? ltvResult.value : null,
      geographic: geographicResult.status === 'fulfilled' ? geographicResult.value : null,
      forecast: forecastResult.status === 'fulfilled' ? forecastResult.value : null,
      bookingSources:
        bookingSourcesResult.status === 'fulfilled' ? bookingSourcesResult.value : null,
      anomalyAlerts:
        anomalyAlertsResult.status === 'fulfilled' ? anomalyAlertsResult.value : [],
      serviceFunnel: serviceFunnelResult.status === 'fulfilled' ? serviceFunnelResult.value : [],
    });
  }, []);

  const loadAnalytics = useCallback(async () => {
    const requestId = ++loadRequestId.current;
    setIsLoading(true);
    setSummaryLoading(true);
    setError(null);

    try {
      const insightsResponse = await providerAnalyticsApi.getProviderInsights(timeRange, {
        revenue: revenueMode,
        city: cityFilter || undefined,
      });

      if (requestId !== loadRequestId.current) return;

      const insights = insightsResponse.data;

      setAnalytics({
        overview: insights.overview,
        earnings: insights.earnings,
        bookings: insights.bookings,
        topServices: insights.topServices,
        weeklyData: insights.weeklyData,
        timeSeries: insights.timeSeries ?? [],
        timeSeriesPrevious: insights.timeSeriesPrevious ?? [],
        ratings: insights.ratings,
      });
      setDataQuality(insights.overview.dataQuality ?? null);
      setConfirmedRate(
        insights.overview.conversionRateConfirmed ??
          insights.overview.confirmedBookingRate ??
          0,
      );
      setGrossEarnings(insights.earnings.grossEarnings);
      // Use experiments from dashboard response (includes booking/revenue data)
      const dashboardExperiments = insightsResponse.data?.experiments ?? [];
      setExperiments(dashboardExperiments);
      setIsLoading(false);

      void analyticsApi
        .getProviderConversionFunnel(timeRange)
        .then((funnelData) => {
          if (requestId === loadRequestId.current) {
            setFunnel(funnelData);
          }
        })
        .catch(() => {
          if (requestId === loadRequestId.current) {
            setFunnel(null);
          }
        });

      void loadSummaryExtras(timeRange).finally(() => {
        if (requestId === loadRequestId.current) {
          setSummaryLoading(false);
        }
      });
    } catch (err) {
      if (requestId !== loadRequestId.current) return;
      console.error('Failed to load provider analytics:', err);
      toastRef.current.error(
        'Failed to load analytics',
        err instanceof Error ? err.message : 'Unable to load analytics. Please try again.',
      );
      setError('Unable to load analytics. Please try again.');
      setAnalytics(EMPTY_ANALYTICS);
      setFunnel(null);
      setSummaryData(EMPTY_SUMMARY_DATA);
      setExperiments([]);
      setDataQuality(null);
      setConfirmedRate(0);
      setGrossEarnings(undefined);
      setIsLoading(false);
      setSummaryLoading(false);
    }
  }, [timeRange, revenueMode, cityFilter, loadSummaryExtras]);

  useEffect(() => {
    if (!isInitialized) return;
    if (user?.role !== 'provider') {
      setIsLoading(false);
      return;
    }
    void loadAnalytics();
  }, [isInitialized, user?.role, timeRange, revenueMode, cityFilter, loadAnalytics]);

  const periodLabels = PERIOD_LABELS[timeRange];
  const chartData = analytics.timeSeries ?? [];
  const comparisonChartData = comparePeriod ? analytics.timeSeriesPrevious ?? [] : undefined;
  const hasChartData = chartData.some((d) => d.bookings > 0 || d.revenue > 0);
  const displayRevenue =
    revenueMode === 'gross' && grossEarnings
      ? grossEarnings.thisMonth
      : analytics.earnings.thisMonth;
  const displayPreviousRevenue =
    revenueMode === 'gross' && grossEarnings
      ? grossEarnings.lastMonth
      : analytics.earnings.lastMonth;

  const showDataQualityBadge = useMemo(() => {
    if (!dataQuality) return false;
    if (dataQuality.level === 'bookings_only') return true;
    if (!dataQuality.trackingSince) return false;
    const trackingStart = new Date(dataQuality.trackingSince);
    if (Number.isNaN(trackingStart.getTime())) return false;
    const daysSinceTracking = (Date.now() - trackingStart.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceTracking <= DATA_QUALITY_RECENT_DAYS;
  }, [dataQuality]);

  const StatCard = ({
    title,
    value,
    trend,
    icon: Icon,
    suffix = '',
    hint,
    hideTrend = false,
    iconClassName = 'text-nilin-coral',
    iconBgClassName = 'bg-nilin-coral/10',
    metricKey,
  }: {
    title: string;
    value: number | string;
    trend?: TrendResult;
    icon: React.ElementType;
    suffix?: string;
    hint?: string;
    hideTrend?: boolean;
    iconClassName?: string;
    iconBgClassName?: string;
    metricKey?: ProviderMetricKey;
  }) => (
    <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <div className={cn('p-2 rounded-nilin', iconBgClassName)}>
          <Icon className={cn('h-5 w-5', iconClassName)} />
        </div>
        <TrendBadge trend={trend} hideTrend={hideTrend} />
      </div>
      <p className="text-sm text-nilin-warmGray mb-1 flex items-center gap-1.5">
        {title}
        {metricKey && <MetricDefinitionTooltip metricKey={metricKey} />}
      </p>
      <p className="text-2xl font-bold text-nilin-charcoal">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {suffix}
      </p>
      {hint && <p className="text-xs text-nilin-warmGray mt-1">{hint}</p>}
    </div>
  );

  const renderSummaryTab = () => (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
        <StatCard
          title={revenueMode === 'gross' ? 'Gross revenue' : 'Net revenue'}
          value={formatPrice(displayRevenue)}
          trend={analytics.earnings.trend}
          icon={DollarSign}
          iconClassName="text-green-600"
          iconBgClassName="bg-green-100"
          hint={`${periodLabels.previous}: ${formatPrice(displayPreviousRevenue)}`}
          metricKey={revenueMode === 'gross' ? 'grossRevenue' : 'netRevenue'}
        />
        <StatCard
          title="Booking requests"
          value={analytics.overview.bookingRequests}
          trend={analytics.overview.bookingRequestsTrend}
          icon={Calendar}
          hint={periodLabels.current}
          metricKey="bookingRequests"
        />
        <StatCard
          title="Profile views"
          value={analytics.overview.profileViews}
          trend={analytics.overview.profileViewsTrend}
          icon={Users}
          hint="Unique profile visitors"
          metricKey="profileViews"
        />
        <StatCard
          title="Confirmed rate"
          value={confirmedRate}
          trend={analytics.overview.conversionRateTrend}
          icon={TrendingUp}
          suffix="%"
          hint={`Requests rate: ${analytics.overview.conversionRate}%`}
          metricKey="confirmedRate"
        />
        <StatCard
          title="Listing impressions"
          value={analytics.overview.totalViews}
          trend={analytics.overview.viewsTrend}
          icon={Eye}
          hint={`Unique impressions · ${periodLabels.current}`}
          metricKey="listingImpressions"
        />
      </div>

      <ExperimentResultsSection
        experiments={experiments}
        periodLabel={periodLabels.current}
        isLoading={summaryLoading}
      />

      <ConversionFunnelSection
        funnel={funnel}
        isLoading={isLoading}
        periodLabel={periodLabels.current}
      />

      <AnalyticsSummarySections
        timeRange={timeRange}
        periodLabel={periodLabels.current}
        cancellationStats={cancellationStats}
        summaryData={summaryData}
        isLoading={summaryLoading}
      />

      <AnalyticsActionCenter
        providerId={providerId}
        insights={insights?.insights}
        maxVisible={3}
        className="mb-8"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
          <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
            <h2 className="text-lg font-serif text-nilin-charcoal mb-6">Daily revenue & bookings</h2>

            {!hasChartData ? (
              <EmptyState
                icon={
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                }
                title="Not enough data to chart yet"
                description="Charts appear after you complete bookings. Share your profile to attract more customers."
                action={{
                  label: 'Manage services',
                  onClick: () => navigate('/provider/services'),
                }}
                compact
              />
            ) : (
              <RevenueTrendChart
                data={chartData}
                comparisonData={comparisonChartData}
                period={
                  comparePeriod
                    ? `${periodLabels.current} vs ${periodLabels.previous}`
                    : periodLabels.current
                }
                variant="area"
                height={280}
                currency="AED"
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-yellow-100 rounded-nilin">
                <Star className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-lg font-serif text-nilin-charcoal">Rating</h2>
                <p className="text-xs text-nilin-warmGray">{analytics.ratings.total} reviews</p>
              </div>
            </div>

            {analytics.ratings.total === 0 ? (
              <EmptyState
                icon={
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                }
                title="No reviews yet"
                description="Complete your first booking to start collecting customer reviews."
                action={{
                  label: 'View bookings',
                  onClick: () => navigate('/provider/bookings'),
                }}
                compact
              />
            ) : (
              <>
                <div className="text-center mb-6">
                  <p className="text-4xl font-bold text-nilin-charcoal">
                    {analytics.ratings.average.toFixed(1)}
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'h-4 w-4',
                          star <= Math.round(analytics.ratings.average)
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300',
                        )}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {Object.entries(analytics.ratings.breakdown)
                    .sort((a, b) => Number(b[0]) - Number(a[0]))
                    .map(([rating, count]) => (
                      <div key={rating} className="flex items-center gap-3">
                        <span className="text-sm text-nilin-warmGray w-6">{rating}★</span>
                        <div className="flex-1 h-2 bg-nilin-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-500 rounded-full"
                            style={{
                              width: `${
                                analytics.ratings.total > 0
                                  ? (count / analytics.ratings.total) * 100
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-nilin-warmGray w-8 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8">
        <TopServicesSection services={analytics.topServices} revenueMode={revenueMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <ROASDashboard providerId={providerId} timeRange={timeRange} hidePeriodSelector />
        <RepeatCustomerRate
          providerId={providerId}
          timeRange={toRepeatCustomerPeriod(timeRange)}
          hidePeriodSelector
        />
      </div>

      <div className="mb-8">
        <TravelTimeTracking providerId={providerId} timeRange={timeRange} hidePeriodSelector />
      </div>

      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <h2 className="text-lg font-serif text-nilin-charcoal mb-6">Booking Overview</h2>
        <p className="text-xs text-nilin-warmGray mb-4 -mt-4">{periodLabels.current}</p>

        {analytics.bookings.total === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            }
            title="No bookings in this period"
            description="Improve visibility by completing your profile and sharing your services."
            action={{
              label: 'View dashboard',
              onClick: () => navigate('/provider/dashboard'),
            }}
            compact
          />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-nilin-muted rounded-nilin">
              <p className="text-2xl font-bold text-nilin-charcoal">{analytics.bookings.total}</p>
              <p className="text-sm text-nilin-warmGray">Total Bookings</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-nilin">
              <p className="text-2xl font-bold text-green-600">{analytics.bookings.completed}</p>
              <p className="text-sm text-green-600">Completed</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-nilin">
              <p className="text-2xl font-bold text-yellow-600">{analytics.bookings.pending}</p>
              <p className="text-sm text-yellow-600">Pending</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-nilin">
              <p className="text-2xl font-bold text-red-600">{analytics.bookings.cancelled}</p>
              <p className="text-sm text-red-600">Cancelled</p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  const renderInsightsTabPanel = () => {
    if (insightsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-nilin-coral" />
          <p className="mt-4 text-nilin-warmGray">Loading insights…</p>
        </div>
      );
    }

    if (insightsLoadError && !insights) {
      return (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="Couldn't load insights"
          description={insightsLoadError}
          action={{ label: 'View summary', onClick: () => handleTabChange('summary') }}
        />
      );
    }

    if (!insights) {
      return (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="No insights yet"
          description="Complete bookings and collect reviews to unlock AI-powered business insights."
          action={{ label: 'View bookings', onClick: () => navigate('/provider/bookings') }}
        />
      );
    }

    return (
      <InsightsOverviewPanel
        insights={insights}
        optimizationTips={optimizationTips}
        providerId={providerId}
        period={insightsPeriod}
        analyticsTimeRange={timeRange}
      />
    );
  };

  const renderScheduleTabPanel = () => {
    if (insightsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-nilin-coral" />
        </div>
      );
    }

    if (!scheduleOptimization) {
      return (
        <EmptyState
          icon={<Calendar className="h-8 w-8" />}
          title="Schedule data unavailable"
          description="Add availability and accept bookings to see schedule optimization tips."
          action={{ label: 'Manage availability', onClick: () => navigate('/provider/availability') }}
        />
      );
    }

    return <InsightsSchedulePanel scheduleOptimization={scheduleOptimization} />;
  };

  const renderCancellationsTabPanel = () => {
    if (insightsLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-nilin-coral" />
        </div>
      );
    }

    if (!cancellationStats) {
      return (
        <EmptyState
          icon={<AlertTriangle className="h-8 w-8" />}
          title="No cancellation data yet"
          description="Cancellation predictions appear once you have active or past bookings."
          action={{ label: 'View bookings', onClick: () => navigate('/provider/bookings') }}
        />
      );
    }

    return (
      <InsightsCancellationsPanel
        cancellationStats={cancellationStats}
        upcomingCancellations={upcomingCancellations}
        preventionRecommendations={preventionRecommendations}
      />
    );
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'insights':
        return renderInsightsTabPanel();
      case 'schedule':
        return renderScheduleTabPanel();
      case 'cancellations':
        return renderCancellationsTabPanel();
      case 'summary':
      default:
        return renderSummaryTab();
    }
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />
      <ProviderHubNav />

      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* Screen reader status announcer */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {isLoading ? 'Loading analytics data' : error ? `Error: ${error}` : ''}
      </div>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <main id="main-content" className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors font-sans text-sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl font-serif text-nilin-charcoal mb-2">Analytics</h1>
                <p className="text-base text-nilin-warmGray font-sans">
                  Track your performance and insights
                </p>
                {showDataQualityBadge && dataQuality && (
                  <span className="inline-flex items-center mt-2 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    {dataQuality.level === 'bookings_only'
                      ? `Discovery metrics available from ${
                          dataQuality.trackingSince
                            ? new Date(dataQuality.trackingSince).toLocaleDateString()
                            : 'tracking go-live'
                        }`
                      : 'Limited discovery history — metrics improving as tracking accumulates'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                {activeTab === 'summary' && (
                  <>
                    <select
                      value={cityFilter}
                      onChange={(e) => handleCityFilterChange(e.target.value)}
                      className="min-h-11 px-3 py-2 rounded-nilin text-sm border border-nilin-border bg-white text-nilin-charcoal w-full sm:w-auto"
                      aria-label="Filter by emirate"
                    >
                      {UAE_EMIRATES.map((emirate) => (
                        <option key={emirate} value={emirate === 'All emirates' ? '' : emirate}>
                          {emirate}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1 bg-white rounded-nilin p-1 shadow-nilin border border-nilin-border/50">
                      {(['net', 'gross'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => handleRevenueModeChange(mode)}
                          className={cn(
                            'min-h-11 px-3 py-1.5 rounded-nilin text-sm font-medium transition-colors capitalize',
                            revenueMode === mode
                              ? 'bg-nilin-coral text-white'
                              : 'text-nilin-warmGray hover:text-nilin-charcoal',
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {activeTab === 'summary' && !isLoading && (
                  <>
                    <ExportAnalyticsButton
                      analytics={analytics}
                      timeRange={timeRange}
                      revenueMode={revenueMode}
                      confirmedRate={confirmedRate}
                      grossRevenue={grossEarnings}
                    />
                    <button
                      type="button"
                      onClick={() => setComparePeriod((prev) => !prev)}
                      className={cn(
                        'min-h-11 px-3 py-2 rounded-nilin text-sm font-medium border transition-colors',
                        comparePeriod
                          ? 'bg-nilin-coral text-white border-nilin-coral'
                          : 'bg-white text-nilin-charcoal border-nilin-border hover:bg-nilin-muted',
                      )}
                    >
                      Compare period
                    </button>
                  </>
                )}

                <div className="flex items-center gap-2 bg-white rounded-nilin p-1 shadow-nilin">
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => handleTimeRangeChange(range)}
                    disabled={isLoading && activeTab === 'summary'}
                    className={cn(
                      'min-h-11 px-4 py-2 rounded-nilin text-sm font-medium transition-colors',
                      timeRange === range
                        ? 'bg-nilin-coral text-white'
                        : 'text-nilin-warmGray hover:text-nilin-charcoal',
                    )}
                  >
                    {range === '7d'
                      ? 'Last 7 days'
                      : range === '30d'
                        ? 'Last 30 days'
                        : 'Last 90 days'}
                  </button>
                ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-nilin-lg shadow-nilin border border-nilin-blush/50 mb-6 overflow-hidden">
            <div role="tablist" aria-label="Analytics sections" className="flex gap-0 overflow-x-auto">
              {visibleTabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`${tab.id}-panel`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[48px] focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2',
                      isActive
                        ? 'border-nilin-coral text-nilin-coral bg-nilin-cream/50'
                        : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-cream/30',
                    )}
                  >
                    <TabIcon className="h-4 w-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && activeTab === 'summary' && (
            <div className="mb-6 flex items-center gap-2 rounded-nilin-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button
                type="button"
                onClick={() => void loadAnalytics()}
                className="ml-auto font-medium underline"
              >
                Retry
              </button>
            </div>
          )}

          <div
            role="tabpanel"
            id={`${activeTab}-panel`}
            aria-labelledby={`${activeTab}-tab`}
          >
            {isLoading && activeTab === 'summary' ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3" role="status" aria-label="Loading analytics data">
                <Loader2 className="h-10 w-10 animate-spin text-nilin-coral" aria-hidden="true" />
                <p className="text-nilin-warmGray font-sans">Loading analytics…</p>
              </div>
            ) : (
              renderActiveTab()
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ProviderAnalyticsPage;
