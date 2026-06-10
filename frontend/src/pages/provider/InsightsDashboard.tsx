
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  providerInsightsApi,
} from '../../services/providerInsightsApi';
import type {
  Period,
  ProviderInsightsData,
  ProviderInsight,
  PerformanceMetrics,
  RevenueMetrics,
  CustomerSatisfactionMetrics,
  ScheduleOptimization,
  ProviderCancellationStats,
  BookingCancellationPrediction,
  RiskLevel,
  ImpactLevel,
  PreventionRecommendation,
  RevenueOptimizationTip,
} from '../../services/providerInsightsApi';
import { useAuthStore } from '../../stores/authStore';
import { socketService } from '../../services/socket';
import { CompetitivePosition } from '../../components/analytics/provider/CompetitivePosition';
import { ServiceProfitability } from '../../components/analytics/provider/ServiceProfitability';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import toast from 'react-hot-toast';

// Icon components
const TrendingUpIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const TrendingDownIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <ChartIcon /> },
  { id: 'performance', label: 'Performance', icon: <TrendingUpIcon /> },
  { id: 'revenue', label: 'Revenue', icon: <TrendingUpIcon /> },
  { id: 'schedule', label: 'Schedule', icon: <CalendarIcon /> },
  { id: 'cancellations', label: 'Cancellations', icon: <AlertIcon /> },
];

const InsightsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuthStore();

  // Data states
  const [insights, setInsights] = useState<ProviderInsightsData | null>(null);
  const [scheduleOptimization, setScheduleOptimization] = useState<ScheduleOptimization | null>(null);
  const [cancellationStats, setCancellationStats] = useState<ProviderCancellationStats | null>(null);
  const [upcomingCancellations, setUpcomingCancellations] = useState<BookingCancellationPrediction[]>([]);
  const [optimizationTips, setOptimizationTips] = useState<RevenueOptimizationTip[]>([]);
  const [preventionRecommendations, setPreventionRecommendations] = useState<PreventionRecommendation[]>([]);

  // Polling state
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingCountRef = useRef(0);
  const MAX_POLL_COUNT = 10; // Maximum polling cycles before pause
  const POLL_INTERVAL = 60000; // 60 seconds
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'polling' | 'paused'>('connected');

  const fetchData = async (refreshMode: 'loading' | 'refreshing' | 'silent' = 'loading') => {
    if (refreshMode === 'refreshing') setRefreshing(true);
    else if (refreshMode === 'loading') setLoading(true);
    // 'silent' mode: no loading indicators shown

    // Retry configuration
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 2000;
    let retryCount = 0;

    const attemptFetch = async (): Promise<boolean> => {
      try {
        const results = await Promise.allSettled([
          providerInsightsApi.getInsights(period),
          providerInsightsApi.getOptimalSchedule(),
          providerInsightsApi.getCancellationStats(period),
          providerInsightsApi.getUpcomingCancellations(7),
          providerInsightsApi.getOptimizationTips(),
          providerInsightsApi.getPreventionRecommendations(),
        ]);

        // Update state for successful fetches (partial data display)
        const [insightsResult, scheduleResult, cancellationResult,
               upcomingResult, tipsResult, preventionResult] = results;

        if (insightsResult.status === 'fulfilled') {
          setInsights(insightsResult.value);
        } else {
          console.warn('Failed to fetch insights:', insightsResult.reason);
        }

        if (scheduleResult.status === 'fulfilled') {
          setScheduleOptimization(scheduleResult.value);
        } else {
          console.warn('Failed to fetch schedule data:', scheduleResult.reason);
        }

        if (cancellationResult.status === 'fulfilled') {
          setCancellationStats(cancellationResult.value);
        } else {
          console.warn('Failed to fetch cancellation stats:', cancellationResult.reason);
        }

        if (upcomingResult.status === 'fulfilled') {
          setUpcomingCancellations(upcomingResult.value);
        } else {
          console.warn('Failed to fetch upcoming cancellations:', upcomingResult.reason);
        }

        if (tipsResult.status === 'fulfilled') {
          setOptimizationTips(tipsResult.value);
        } else {
          console.warn('Failed to fetch optimization tips:', tipsResult.reason);
        }

        if (preventionResult.status === 'fulfilled') {
          setPreventionRecommendations(preventionResult.value);
        } else {
          console.warn('Failed to fetch prevention recommendations:', preventionResult.reason);
        }

        // Check if at least some data was fetched
        const successCount = results.filter(r => r.status === 'fulfilled').length;
        return successCount > 0;
      } catch (error) {
        console.error('Fetch attempt failed:', error);
        return false;
      }
    };

    // Try with retries
    let success = await attemptFetch();
    while (!success && retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`Retrying fetch (${retryCount}/${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
      success = await attemptFetch();
    }

    // Reset polling count on successful fetch
    pollingCountRef.current = 0;
    setConnectionStatus('connected');
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData('loading');

    // Setup socket listeners for real-time updates
    const unsubscribers: (() => void)[] = [];

    // Listen for insights:updated events
    const unsubInsightsUpdated = socketService.onInsightsUpdated((data) => {
      console.log('Insights update triggered:', data);
      // Only refresh if the event is for the current provider
      if (data.providerId === user?._id) {
        // Silent refresh - don't show loading state
        fetchData('silent');
      }
    });
    unsubscribers.push(unsubInsightsUpdated);

    // Listen for booking status changes (including completed)
    const unsubBookingStatus = socketService.onBookingStatusChanged((data) => {
      if (data.status === 'completed') {
        console.log('Booking completed event');
        fetchData('silent');
      }
    });
    unsubscribers.push(unsubBookingStatus);

    // Listen for new review events
    const unsubReviewReceived = socketService.onReviewReceived(() => {
      console.log('New review received');
      fetchData('silent');
    });
    unsubscribers.push(unsubReviewReceived);

    // Listen for withdrawal events
    const unsubWithdrawalApproved = socketService.onWithdrawalApproved(() => {
      console.log('Withdrawal approved event');
      fetchData('silent');
    });
    unsubscribers.push(unsubWithdrawalApproved);

    // Setup polling as fallback (every 60 seconds) with limits
    pollingIntervalRef.current = setInterval(() => {
      // Check polling limit
      if (pollingCountRef.current >= MAX_POLL_COUNT) {
        console.log('Polling paused: max count reached');
        setConnectionStatus('paused');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        return;
      }

      console.log('Polling for insights update');
      setConnectionStatus('polling');
      pollingCountRef.current++;
      fetchData('silent');
    }, POLL_INTERVAL);

    return () => {
      // Cleanup socket listeners
      unsubscribers.forEach((unsub) => unsub());
      // Cleanup polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [period, user?._id]);

  const handleRefresh = () => {
    fetchData('refreshing');
  };

  const formatCurrency = (amount: number) => providerInsightsApi.formatCurrency(amount);
  const formatPercentage = (value: number) => providerInsightsApi.formatPercentage(value);

  const getRiskBadgeClass = (level: RiskLevel) => {
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
  };

  const getImpactBadgeClass = (impact: ImpactLevel) => {
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
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    subtitle?: string,
    trend?: { value: number; isPositive: boolean }
  ) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="text-xs sm:text-sm text-gray-500 mb-1">{title}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg sm:text-2xl font-bold text-gray-900">{value}</span>
        {trend && (
          <span className={`text-xs sm:text-sm flex items-center ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {trend.isPositive ? <TrendingUpIcon /> : <TrendingDownIcon />}
            {formatPercentage(Math.abs(trend.value))}
          </span>
        )}
      </div>
      {subtitle && <div className="text-[10px] sm:text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );

  const renderInsightCard = (insight: ProviderInsight) => (
    <div
      key={insight.id}
      className={`border rounded-lg p-3 sm:p-4 ${getImpactBadgeClass(insight.impact)}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] sm:text-xs font-medium uppercase">{insight.type}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium border ${
            insight.impact === 'high'
              ? 'bg-red-100 text-red-700 border-red-300'
              : insight.impact === 'medium'
              ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
              : 'bg-green-100 text-green-700 border-green-300'
          }`}>
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
              <li key={idx} className="line-clamp-1">{item}</li>
            ))}
            {insight.actionItems.length > 3 && (
              <li className="text-gray-400">+{insight.actionItems.length - 3} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );

  const renderRiskCard = (prediction: BookingCancellationPrediction) => (
    <div key={prediction.bookingId} className="border border-gray-200 rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{prediction.customerName}</h4>
          <p className="text-xs text-gray-500 truncate">{prediction.serviceName}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-[10px] sm:text-xs font-medium border flex-shrink-0 ${getRiskBadgeClass(prediction.riskAssessment.riskLevel)}`}>
          {prediction.riskAssessment.riskLevel.toUpperCase()}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
        <div>
          <span className="text-gray-500">Risk Score</span>
          <div className="font-semibold text-gray-900">
            {prediction.riskAssessment.riskScore}%
          </div>
        </div>
        <div>
          <span className="text-gray-500">Booking Value</span>
          <div className="font-semibold text-gray-900">
            {formatCurrency(prediction.totalAmount)}
          </div>
        </div>
      </div>
      {prediction.riskAssessment.recommendedActions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <span className="text-[10px] sm:text-xs text-gray-500">Recommended Actions:</span>
          <ul className="mt-1 text-[10px] sm:text-xs text-gray-600 list-disc list-inside">
            {prediction.riskAssessment.recommendedActions.slice(0, 2).map((action, idx) => (
              <li key={idx} className="line-clamp-1">{action}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderOverviewTab = () => {
    if (!insights) return null;

    const { performance, revenue, customerSatisfaction, insights: insightsList } = insights;

    return (
      <div className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderStatCard(
            'Total Revenue',
            formatCurrency(revenue.totalRevenue),
            `vs ${formatPercentage(Math.abs(revenue.revenueGrowth))} from last period`,
            { value: revenue.revenueGrowth, isPositive: revenue.revenueGrowth >= 0 }
          )}
          {renderStatCard(
            'Completed Bookings',
            performance.completedBookings,
            `${formatPercentage(performance.completionRate)} completion rate`
          )}
          {renderStatCard(
            'Average Rating',
            `${customerSatisfaction.averageRating.toFixed(1)}`,
            `${customerSatisfaction.totalReviews} reviews`,
          )}
          {renderStatCard(
            'Repeat Customers',
            formatPercentage(performance.repeatCustomerRate),
            'customer loyalty'
          )}
        </div>

        {/* Insights */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">AI-Generated Insights</h3>
          {insightsList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insightsList.slice(0, 4).map(renderInsightCard)}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
              No insights generated yet. Keep providing great service!
            </div>
          )}
        </div>

        {/* Optimization Tips */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Optimization Tips</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {optimizationTips.slice(0, 4).map((tip, idx) => (
              <div key={idx} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    tip.category === 'pricing' ? 'bg-purple-100 text-purple-600' :
                    tip.category === 'volume' ? 'bg-blue-100 text-blue-600' :
                    tip.category === 'efficiency' ? 'bg-green-100 text-green-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    <TrendingUpIcon />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{tip.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{tip.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">
                        Potential: +{tip.potentialImpact}% revenue
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        tip.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        tip.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {tip.difficulty}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitive Position & Service Profitability */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PageErrorBoundary pageName="CompetitivePosition">
            <CompetitivePosition providerId={user?._id} />
          </PageErrorBoundary>
          <PageErrorBoundary pageName="ServiceProfitability">
            <ServiceProfitability providerId={user?._id} timeRange="30d" />
          </PageErrorBoundary>
        </div>

        {/* Revenue Chart Placeholder */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <ChartIcon />
              <p className="mt-2">Revenue chart visualization</p>
              <p className="text-sm">Daily revenue over the selected period</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPerformanceTab = () => {
    if (!insights) return null;

    const { performance, customerSatisfaction } = insights;

    return (
      <div className="space-y-6">
        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {renderStatCard('Total Bookings', performance.totalBookings)}
          {renderStatCard('Completed', performance.completedBookings)}
          {renderStatCard('Cancelled', performance.cancelledBookings)}
          {renderStatCard('No Shows', performance.noShowBookings)}
          {renderStatCard('Pending', performance.pendingBookings)}
          {renderStatCard('Response Rate', formatPercentage(performance.responseRate))}
        </div>

        {/* Rating Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-gray-900">
                {customerSatisfaction.averageRating.toFixed(1)}
              </div>
              <div className="flex items-center justify-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`${star <= Math.round(customerSatisfaction.averageRating)
                      ? 'text-yellow-400'
                      : 'text-gray-300'
                    }`}
                  >
                    <StarIcon />
                  </span>
                ))}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {customerSatisfaction.totalReviews} reviews
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {Object.entries(customerSatisfaction.ratingDistribution)
                .reverse()
                .map(([rating, count]) => {
                  const total = customerSatisfaction.totalReviews || 1;
                  const percentage = (count / total) * 100;
                  return (
                    <div key={rating} className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 w-8">{rating} ★</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-yellow-400 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-500 w-12 text-right">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Customer Feedback Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Common Praise</h3>
            {customerSatisfaction.commonPraise.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customerSatisfaction.commonPraise.map((praise, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                  >
                    {praise}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No common praise identified yet</p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Common Complaints</h3>
            {customerSatisfaction.commonComplaints.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {customerSatisfaction.commonComplaints.map((complaint, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm"
                  >
                    {complaint}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No complaints to address</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderRevenueTab = () => {
    if (!insights) return null;

    const { revenue } = insights;

    return (
      <div className="space-y-6">
        {/* Revenue Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {renderStatCard(
            'Total Revenue',
            formatCurrency(revenue.totalRevenue),
            `Projected: ${formatCurrency(revenue.projectedMonthlyRevenue)}/month`,
            { value: revenue.revenueGrowth, isPositive: revenue.revenueGrowth >= 0 }
          )}
          {renderStatCard(
            'Avg. Booking Value',
            formatCurrency(revenue.averageBookingValue)
          )}
          {renderStatCard(
            'Peak Revenue Hour',
            providerInsightsApi.formatHour(revenue.peakRevenueHour)
          )}
          {renderStatCard(
            'Revenue Growth',
            formatPercentage(revenue.revenueGrowth),
            'vs previous period',
            { value: revenue.revenueGrowth, isPositive: revenue.revenueGrowth >= 0 }
          )}
        </div>

        {/* Revenue by Service */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Service</h3>
          {revenue.revenueByService.length > 0 ? (
            <div className="space-y-4">
              {revenue.revenueByService.map((service) => (
                <div key={service.serviceId} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="font-medium text-gray-900">{service.serviceName}</span>
                      <span className="text-gray-600">{formatCurrency(service.revenue)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${(service.revenue / revenue.totalRevenue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">
                    {service.count} bookings
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No revenue data available</p>
          )}
        </div>

        {/* Daily Revenue Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Revenue</h3>
          <div className="h-64 flex items-end gap-1">
            {revenue.revenueByDay.map((day, idx) => {
              const maxRevenue = Math.max(...revenue.revenueByDay.map((d) => d.amount));
              const height = maxRevenue > 0 ? (day.amount / maxRevenue) * 100 : 0;
              return (
                <div
                  key={idx}
                  className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                  style={{ height: `${Math.max(height, 5)}%` }}
                >
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {formatCurrency(day.amount)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{revenue.revenueByDay[0]?.date}</span>
            <span>{revenue.revenueByDay[revenue.revenueByDay.length - 1]?.date}</span>
          </div>
        </div>
      </div>
    );
  };

  const renderScheduleTab = () => {
    if (!scheduleOptimization) return null;

    return (
      <div className="space-y-6">
        {/* Schedule Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderStatCard(
            'Calendar Utilization',
            formatPercentage(scheduleOptimization.currentUtilization),
            scheduleOptimization.currentUtilization >= 80
              ? 'Excellent utilization'
              : scheduleOptimization.currentUtilization >= 50
              ? 'Room for improvement'
              : 'Consider adding availability'
          )}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Peak Hours</div>
            <div className="flex flex-wrap gap-1">
              {scheduleOptimization.peakDemandHours.map((hour) => (
                <span
                  key={hour}
                  className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm"
                >
                  {providerInsightsApi.formatHour(hour)}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">Off-Peak Hours</div>
            <div className="flex flex-wrap gap-1">
              {scheduleOptimization.offPeakHours.map((hour) => (
                <span
                  key={hour}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                >
                  {providerInsightsApi.formatHour(hour)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Optimal Slots */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Optimal Booking Slots</h3>
          {scheduleOptimization.optimalSlots.length > 0 ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-gray-500 border-b">
                    <th className="pb-2 px-2">Time</th>
                    <th className="pb-2 px-2">Demand</th>
                    <th className="pb-2 px-2">Fill Rate</th>
                    <th className="pb-2 px-2">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleOptimization.optimalSlots.map((slot, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="py-2 sm:py-3 px-2 font-medium text-sm">{slot.time}</td>
                      <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm">{slot.demand}</td>
                      <td className="py-2 sm:py-3 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 sm:w-20 h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                slot.fillRate >= 80
                                  ? 'bg-green-500'
                                  : slot.fillRate >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-400'
                              }`}
                              style={{ width: `${Math.min(slot.fillRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs sm:text-sm">{formatPercentage(slot.fillRate)}</span>
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm text-gray-600">{slot.recommendation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No optimal slots identified yet</p>
          )}
        </div>

        {/* Weekly Pattern */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Weekly Pattern</h3>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {scheduleOptimization.weeklyPattern.map((day) => (
              <div
                key={day.dayOfWeek}
                className={`text-center p-2 sm:p-3 rounded-lg ${
                  day.isPeakDay
                    ? 'bg-red-50 border-2 border-red-200'
                    : day.demandLevel === 'high'
                    ? 'bg-orange-50 border border-orange-200'
                    : 'bg-gray-50'
                }`}
              >
                <div className="text-[10px] sm:text-xs text-gray-500">{day.dayName}</div>
                <div className="text-base sm:text-lg font-bold text-gray-900">{day.totalBookings}</div>
                <div className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">bookings</div>
                {day.isPeakDay && (
                  <span className="text-[10px] sm:text-xs text-red-600 font-medium">Peak</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        {scheduleOptimization.suggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3">Schedule Suggestions</h3>
            <ul className="space-y-2">
              {scheduleOptimization.suggestions.map((suggestion, idx) => (
                <li key={idx} className="flex items-start gap-2 text-blue-800">
                  <span className="mt-1">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderCancellationsTab = () => {
    if (!cancellationStats) return null;

    return (
      <div className="space-y-6">
        {/* Cancellation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {renderStatCard(
            'Cancellation Rate',
            formatPercentage(cancellationStats.cancellationRate),
            cancellationStats.cancellationRate <= 10
              ? 'Excellent'
              : cancellationStats.cancellationRate <= 20
              ? 'Acceptable'
              : 'Needs attention',
            {
              value: cancellationStats.cancellationRate,
              isPositive: cancellationStats.cancellationRate <= 15,
            }
          )}
          {renderStatCard(
            'Total Cancelled',
            cancellationStats.cancelledBookings,
            `${cancellationStats.totalBookings} total bookings`
          )}
          {renderStatCard(
            'Customer-Initiated',
            cancellationStats.customerInitiatedCancellations,
            `${formatPercentage(
              cancellationStats.cancelledBookings > 0
                ? (cancellationStats.customerInitiatedCancellations / cancellationStats.cancelledBookings) * 100
                : 0
            )} of cancellations`
          )}
          {renderStatCard(
            'Trend',
            cancellationStats.trend === 'improving'
              ? 'Improving'
              : cancellationStats.trend === 'worsening'
              ? 'Worsening'
              : 'Stable',
            cancellationStats.trend === 'improving'
              ? 'Cancellation rate decreasing'
              : cancellationStats.trend === 'worsening'
              ? 'Cancellation rate increasing'
              : 'No significant change'
          )}
        </div>

        {/* High Risk Bookings */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            High-Risk Cancellations
            {upcomingCancellations.filter((c) => c.riskAssessment.riskLevel !== 'low').length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-sm">
                {
                  upcomingCancellations.filter(
                    (c) => c.riskAssessment.riskLevel !== 'low'
                  ).length
                }{' '}
                at risk
              </span>
            )}
          </h3>
          {upcomingCancellations.filter((c) => c.riskAssessment.riskLevel !== 'low').length >
          0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcomingCancellations
                .filter((c) => c.riskAssessment.riskLevel !== 'low')
                .slice(0, 6)
                .map(renderRiskCard)}
            </div>
          ) : (
            <p className="text-gray-500">
              No high-risk cancellations predicted. Great job!
            </p>
          )}
        </div>

        {/* Common Cancellation Reasons */}
        {cancellationStats.commonReasons.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Common Cancellation Reasons
            </h3>
            <div className="space-y-3">
              {cancellationStats.commonReasons.map((reason, idx) => (
                <div key={idx}>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-700">{reason.reason}</span>
                    <span className="text-gray-500">
                      {reason.count} ({formatPercentage(reason.percentage)})
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-400 rounded-full"
                      style={{ width: `${reason.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prevention Recommendations */}
        {preventionRecommendations.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-green-900 mb-3">
              Prevention Recommendations
            </h3>
            <div className="space-y-3">
              {preventionRecommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      rec.type === 'reminder'
                        ? 'bg-blue-100 text-blue-600'
                        : rec.type === 'confirmation'
                        ? 'bg-purple-100 text-purple-600'
                        : rec.type === 'deposit'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-green-100 text-green-600'
                    }`}
                  >
                    <AlertIcon />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{rec.message}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        rec.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : rec.priority === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rec.priority}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      Estimated impact: -{rec.estimatedImpact}% cancellations
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Provider Insights</h1>
              <p className="mt-1 text-sm text-gray-500">
                AI-powered insights to help you grow your business
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="quarter">Last 90 days</option>
                <option value="year">Last year</option>
              </select>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshIcon />
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition-colors min-h-[44px] ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="flex-shrink-0">{tab.icon}</span>
                <span className="hidden xs:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'performance' && renderPerformanceTab()}
        {activeTab === 'revenue' && renderRevenueTab()}
        {activeTab === 'schedule' && renderScheduleTab()}
        {activeTab === 'cancellations' && renderCancellationsTab()}
      </div>
    </div>
  );
};

export default InsightsDashboard;
