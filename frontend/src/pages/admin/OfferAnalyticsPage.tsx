import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import AdminPageShell from '../../components/admin/AdminPageShell';
import {
  TrendingUp,
  TrendingDown,
  Tag,
  Gift,
  Users,
  DollarSign,
  BarChart3,
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Clock,
  Percent,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import {
  offerAnalyticsApi,
  type GlobalOfferAnalytics,
  type OfferTrend,
  type AdminOfferDashboard,
  type OffersRequiringAttention,
} from '../../services/offerAnalyticsApi';

// ============================================
// Types
// ============================================

interface DateRange {
  label: string;
  value: string;
  days: number;
}

// ============================================
// Component
// ============================================

const OfferAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // State
  const [analytics, setAnalytics] = useState<GlobalOfferAnalytics | null>(null);
  const [dashboard, setDashboard] = useState<AdminOfferDashboard | null>(null);
  const [attention, setAttention] = useState<OffersRequiringAttention | null>(null);
  const [trends, setTrends] = useState<OfferTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ label: 'Last 30 Days', value: '30d', days: 30 });
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'attention'>('overview');
  const [isExporting, setIsExporting] = useState(false);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/admin/offers-analytics' } });
      return;
    }

    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }

    fetchData();
  }, [isAuthenticated, user]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all analytics data in parallel
      const [analyticsRes, dashboardRes, attentionRes, trendsRes] = await Promise.allSettled([
        offerAnalyticsApi.getGlobalAnalytics(),
        offerAnalyticsApi.getAdminDashboard(),
        offerAnalyticsApi.getOffersRequiringAttention(),
        offerAnalyticsApi.getTrends('day', dateRange.days),
      ]);

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data);
      }

      if (dashboardRes.status === 'fulfilled') {
        setDashboard(dashboardRes.value.data);
      }

      if (attentionRes.status === 'fulfilled') {
        setAttention(attentionRes.value.data);
      }

      if (trendsRes.status === 'fulfilled') {
        setTrends(trendsRes.value.data);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.message || 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  // Date range options
  const dateRanges: DateRange[] = [
    { label: 'Last 7 Days', value: '7d', days: 7 },
    { label: 'Last 30 Days', value: '30d', days: 30 },
    { label: 'Last 90 Days', value: '90d', days: 90 },
  ];

  // ============================================
  // Render Helpers
  // ============================================

  const renderStatCard = (
    title: string,
    value: string | number,
    subtitle?: string,
    trend?: { value: number; isPositive: boolean },
    icon?: React.ReactNode,
    color?: string
  ) => (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${color || 'text-gray-900'}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.isPositive ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : (
                <ArrowDownRight className="w-4 h-4" />
              )}
              <span>{Math.abs(trend.value).toFixed(1)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-gray-100 rounded-lg">
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  const renderTrendChart = () => {
    if (!trends.length) {
      return (
        <div className="h-64 flex items-center justify-center text-gray-500">
          No trend data available
        </div>
      );
    }

    const maxValue = Math.max(...trends.map(t => t.claims), 1);
    const chartHeight = 200;

    return (
      <div className="relative h-64">
        <div className="flex items-end justify-between h-full gap-1">
          {trends.slice(-14).map((trend, index) => {
            const height = (trend.claims / maxValue) * chartHeight;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-purple-500 to-purple-300 rounded-t transition-all hover:from-purple-600 hover:to-purple-400"
                  style={{ height: `${Math.max(height, 4)}px` }}
                  title={`${trend.date}: ${trend.claims} claims`}
                />
                <span className="text-xs text-gray-400 mt-1 transform -rotate-45 origin-center">
                  {trend.date.slice(-5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================
  // Render
  // ============================================

  if (isLoading) {
    return (
      <ErrorBoundary>
        <AdminPageShell
          title="Offer Analytics"
          subtitle="Track performance of your offers and promotions"
          wideLayout
        >
          <div className="flex items-center justify-center min-h-96">
            <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
          </div>
        </AdminPageShell>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Offer Analytics"
        subtitle="Track performance of your offers and promotions"
        wideLayout
      >
        {/* Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>

        <main id="main-content" className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 sr-only">Offer Analytics</h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Date Range Selector */}
              <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
                {dateRanges.map((range) => (
                  <button
                    key={range.value}
                    onClick={() => {
                      setDateRange(range);
                      fetchData();
                    }}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                      dateRange.value === range.value
                        ? 'bg-nilin-coral text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <button
                onClick={fetchData}
                className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>

              {/* Export Button */}
              <button
                onClick={async () => {
                  setIsExporting(true);
                  try {
                    await offerAnalyticsApi.exportOffers({ format: 'csv' });
                  } catch {
                    setError('Failed to export data');
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
                className="w-11 h-11 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 transition-colors"
                title="Export to CSV"
              >
                {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3" role="alert">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex justify-center">
            <div className="inline-flex bg-gray-100 rounded-lg p-1" role="tablist" aria-label="Analytics view selection">
              {[
                { key: 'overview', label: 'Overview', icon: BarChart3 },
                { key: 'trends', label: 'Trends', icon: TrendingUp },
                { key: 'attention', label: 'Attention Required', icon: AlertCircle },
              ].map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  tabIndex={activeTab === tab.key ? 0 : -1}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                  {tab.key === 'attention' && attention && (
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      (attention.underperforming.length + attention.expiringSoon.length + attention.nearlyExhausted.length) > 0
                        ? 'bg-red-100 text-red-600'
                        : 'bg-green-100 text-green-600'
                    }`}>
                      {attention.underperforming.length + attention.expiringSoon.length + attention.nearlyExhausted.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {renderStatCard(
                  'Total Offers',
                  analytics?.totalOffers || 0,
                  `${analytics?.activeOffers || 0} active`,
                  undefined,
                  <Tag className="w-6 h-6 text-purple-500" />
                )}
                {renderStatCard(
                  'Total Claims',
                  analytics?.totalClaims || 0,
                  `${analytics?.totalRedemptions || 0} redemptions`,
                  {
                    value: analytics?.averageConversionRate || 0,
                    isPositive: (analytics?.averageConversionRate || 0) > 50,
                  },
                  <Users className="w-6 h-6 text-blue-500" />
                )}
                {renderStatCard(
                  'Total Discount Given',
                  `AED ${(analytics?.totalDiscountGiven || 0).toLocaleString()}`,
                  'Across all offers',
                  undefined,
                  <DollarSign className="w-6 h-6 text-green-500" />
                )}
                {renderStatCard(
                  'Avg Conversion Rate',
                  `${(analytics?.averageConversionRate || 0).toFixed(1)}%`,
                  'Claims to redemptions',
                  {
                    value: analytics?.averageConversionRate || 0,
                    isPositive: (analytics?.averageConversionRate || 0) > 50,
                  },
                  <Percent className="w-6 h-6 text-amber-500" />
                )}
              </div>

              {/* Top Performing Offers */}
              {dashboard?.topPerformers && dashboard.topPerformers.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Offers</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-sm text-gray-500 border-b">
                          <th className="pb-3 font-medium">Offer</th>
                          <th className="pb-3 font-medium text-right">Claims</th>
                          <th className="pb-3 font-medium text-right">Redemptions</th>
                          <th className="pb-3 font-medium text-right">Conversion</th>
                          <th className="pb-3 font-medium text-right">Discount Given</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.topPerformers.slice(0, 5).map((offer, index) => (
                          <tr key={index} className="border-b border-gray-100 last:border-0">
                            <td className="py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                  <Tag className="w-4 h-4 text-purple-600" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">{offer.name}</p>
                                  <p className="text-sm text-gray-500">{offer.code}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 text-right text-gray-900">{offer.claims}</td>
                            <td className="py-3 text-right text-gray-900">{offer.redemptions}</td>
                            <td className="py-3 text-right">
                              <span className={`px-2 py-1 rounded-full text-sm font-medium ${
                                offer.conversionRate >= 50
                                  ? 'bg-green-100 text-green-700'
                                  : offer.conversionRate >= 25
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-red-100 text-red-700'
                              }`}>
                                {offer.conversionRate.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 text-right text-gray-900">
                              AED {offer.discountGiven.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {dashboard?.recentActivity && dashboard.recentActivity.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
                  <div className="space-y-3">
                    {dashboard.recentActivity.slice(0, 10).map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            activity.type === 'redemption'
                              ? 'bg-green-100 text-green-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {activity.type === 'redemption' ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Gift className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{activity.offerCode}</p>
                            <p className="text-sm text-gray-500">
                              {activity.type === 'redemption' ? 'Redeemed' : 'Claimed'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">
                            AED {activity.discount.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trends Tab */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              {/* Trend Chart */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Claims Over Time</h2>
                {renderTrendChart()}
              </div>

              {/* Offers by Type */}
              {analytics?.offersByType && Object.keys(analytics.offersByType).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Offers by Type</h2>
                    <div className="space-y-3">
                      {Object.entries(analytics.offersByType).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            <span className="text-gray-700 capitalize">{type}</span>
                          </div>
                          <span className="font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Offers by Status</h2>
                    <div className="space-y-3">
                      {Object.entries(analytics.offersByStatus || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                            <span className="text-gray-700 capitalize">{status}</span>
                          </div>
                          <span className="font-medium text-gray-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attention Tab */}
          {activeTab === 'attention' && attention && (
            <div className="space-y-6">
              {/* Underperforming Offers */}
              {attention.underperforming.length > 0 && (
                <div className="bg-white rounded-xl border border-red-200 overflow-hidden">
                  <div className="p-4 bg-red-50 border-b border-red-200">
                    <div className="flex items-center gap-2 text-red-800">
                      <TrendingDown className="w-5 h-5" />
                      <h2 className="font-semibold">Underperforming Offers</h2>
                    </div>
                    <p className="text-sm text-red-600 mt-1">These offers have less than 5 claims</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {attention.underperforming.map((offer) => (
                      <div key={offer.offerId} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{offer.name}</p>
                          <p className="text-sm text-gray-500">{offer.code}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-red-600">{offer.claims}</span>
                          <p className="text-sm text-gray-500">claims</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiring Soon */}
              {attention.expiringSoon.length > 0 && (
                <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                  <div className="p-4 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-center gap-2 text-amber-800">
                      <Clock className="w-5 h-5" />
                      <h2 className="font-semibold">Expiring Soon</h2>
                    </div>
                    <p className="text-sm text-amber-600 mt-1">These offers expire within 30 days</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {attention.expiringSoon.map((offer) => (
                      <div key={offer.offerId} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{offer.name}</p>
                          <p className="text-sm text-gray-500">{offer.code}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-amber-600">{offer.daysRemaining}</span>
                          <p className="text-sm text-gray-500">days left</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearly Exhausted */}
              {attention.nearlyExhausted.length > 0 && (
                <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                  <div className="p-4 bg-orange-50 border-b border-orange-200">
                    <div className="flex items-center gap-2 text-orange-800">
                      <AlertCircle className="w-5 h-5" />
                      <h2 className="font-semibold">Nearly Exhausted</h2>
                    </div>
                    <p className="text-sm text-orange-600 mt-1">These offers have less than 10 uses remaining</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {attention.nearlyExhausted.map((offer) => (
                      <div key={offer.offerId} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{offer.name}</p>
                          <p className="text-sm text-gray-500">{offer.code}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-orange-600">{offer.remainingUses}</span>
                          <p className="text-sm text-gray-500">uses left</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Clear */}
              {attention.underperforming.length === 0 &&
               attention.expiringSoon.length === 0 &&
               attention.nearlyExhausted.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">All Good!</h2>
                  <p className="text-gray-500">No offers require immediate attention.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default OfferAnalyticsPage;
