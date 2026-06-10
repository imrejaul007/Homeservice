
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import {
  analyticsApi,
  businessIntelligenceApi,
} from '../../services/analyticsApi';
import type {
  DashboardMetrics,
  TimeSeriesData,
  CohortData,
  FunnelStep,
  CategoryPerformance,
  GeoDistribution,
  CustomerLTV,
  RetentionMetrics,
  RFMAnalysis,
  BusinessHealthScore,
} from '../../services/analyticsApi';
import PageLayout from '../../components/layout/PageLayout';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  PieChart,
  Target,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Clock,
  Repeat,
  UserCheck,
  UserX,
  MapPin,
  Globe,
  Building2,
  Star,
  Eye,
  ChevronLeft,
  Layers,
  PieChart as PieChartIcon,
  ArrowRight,
} from 'lucide-react';

// ============================================
// Utility Components
// ============================================

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'cohorts', label: 'Cohort Analysis', icon: <Users className="w-4 h-4" /> },
  { id: 'funnel', label: 'Conversion Funnel', icon: <Target className="w-4 h-4" /> },
  { id: 'geography', label: 'Geographic', icon: <Globe className="w-4 h-4" /> },
  { id: 'customers', label: 'Customer Analytics', icon: <UserCheck className="w-4 h-4" /> },
];

// ============================================
// Metric Card Component
// ============================================

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  subtitle?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend,
  icon,
  color = 'blue',
  subtitle,
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {change !== undefined && (
          <span
            className={`flex items-center gap-1 text-sm font-medium ${
              trend === 'up'
                ? 'text-green-600 dark:text-green-400'
                : trend === 'down'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500'
            }`}
          >
            {trend === 'up' ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : trend === 'down' ? (
              <ArrowDownRight className="w-4 h-4" />
            ) : null}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// ============================================
// Cohort Table Component
// ============================================

interface CohortTableProps {
  data: CohortData[];
  cohortType: 'weekly' | 'monthly';
}

const CohortTable: React.FC<CohortTableProps> = ({ data, cohortType }) => {
  // Group data by cohort
  const cohortGroups = data.reduce((acc, item) => {
    if (!acc[item.cohort]) {
      acc[item.cohort] = [];
    }
    acc[item.cohort].push(item);
    return acc;
  }, {} as Record<string, CohortData[]>);

  const sortedCohorts = Object.keys(cohortGroups).sort().reverse().slice(0, 6);

  const getColor = (rate: number): string => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-green-400';
    if (rate >= 40) return 'bg-yellow-400';
    if (rate >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const cohortValues = Object.values(cohortGroups).map((g) => g.length);
  const maxPeriods = cohortValues.length > 0 ? Math.max(...cohortValues) : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
              {cohortType === 'monthly' ? 'Month' : 'Week'}
            </th>
            <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
              Users
            </th>
            {Array.from({ length: maxPeriods }).map((_, i) => (
              <th
                key={i}
                className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400"
              >
                {cohortType === 'monthly' ? `M${i}` : `W${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedCohorts.map((cohort) => {
            const cohortData = cohortGroups[cohort];
            const firstRow = cohortData[0];

            return (
              <tr
                key={cohort}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                  {cohort}
                </td>
                <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                  {firstRow?.users || 0}
                </td>
                {Array.from({ length: maxPeriods }).map((_, i) => {
                  const periodData = cohortData.find((d) => d.period === i);
                  const rate = periodData?.retentionRate || 0;

                  return (
                    <td key={i} className="py-3 px-2 text-center">
                      {periodData ? (
                        <div className="flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mr-1">
                            {rate.toFixed(0)}%
                          </span>
                          <div
                            className={`w-8 h-4 rounded ${getColor(rate)} opacity-${Math.round(
                              rate
                            )}`}
                            style={{ opacity: Math.max(0.2, rate / 100) }}
                          />
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// Funnel Visualization Component
// ============================================

interface FunnelVizProps {
  data: FunnelStep[];
}

const FunnelViz: React.FC<FunnelVizProps> = ({ data }) => {
  const dataCounts = data.map((d) => d.count);
  const maxCount = dataCounts.length > 0 ? Math.max(...dataCounts) : 0;

  return (
    <div className="space-y-4">
      {data.map((step, idx) => {
        const width = maxCount > 0 ? (step.count / maxCount) * 100 : 0;

        return (
          <div key={step.step} className="relative">
            <div className="flex items-center gap-4">
              <div className="w-32 text-sm text-gray-600 dark:text-gray-400">
                {step.step}
              </div>
              <div className="flex-1">
                <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg transition-all duration-500 flex items-center justify-end pr-4"
                    style={{ width: `${width}%` }}
                  >
                    <span className="text-white font-bold text-sm">
                      {step.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-20 text-right text-sm">
                <span className="font-medium text-gray-900 dark:text-white">
                  {step.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
            {idx < data.length - 1 && (
              <div className="ml-32 mt-2 mb-2">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <ArrowDownRight className="w-3 h-3" />
                  <span>{step.dropoffRate.toFixed(1)}% drop-off</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// RFM Segment Badge Component
// ============================================

type RFMSegment = 'champions' | 'loyal' | 'potential' | 'at_risk' | 'lost';
type CustomerSegment = 'low' | 'medium' | 'high' | 'vip';

interface RFMSegmentBadgeProps {
  segment: RFMSegment | CustomerSegment;
}

const RFMSegmentBadge: React.FC<RFMSegmentBadgeProps> = ({ segment }) => {
  const rfmStyles: Record<RFMSegment, { bg: string; text: string }> = {
    champions: { bg: 'bg-purple-100', text: 'text-purple-700' },
    loyal: { bg: 'bg-blue-100', text: 'text-blue-700' },
    potential: { bg: 'bg-green-100', text: 'text-green-700' },
    at_risk: { bg: 'bg-orange-100', text: 'text-orange-700' },
    lost: { bg: 'bg-red-100', text: 'text-red-700' },
  };

  const customerStyles: Record<CustomerSegment, { bg: string; text: string }> = {
    low: { bg: 'bg-gray-100', text: 'text-gray-700' },
    medium: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    high: { bg: 'bg-blue-100', text: 'text-blue-700' },
    vip: { bg: 'bg-purple-100', text: 'text-purple-700' },
  };

  const rfmLabels: Record<RFMSegment, string> = {
    champions: 'Champions',
    loyal: 'Loyal',
    potential: 'Potential',
    at_risk: 'At Risk',
    lost: 'Lost',
  };

  const customerLabels: Record<CustomerSegment, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    vip: 'VIP',
  };

  const isRfmSegment = (s: string): s is RFMSegment => s in rfmStyles;
  const isCustomerSegment = (s: string): s is CustomerSegment => s in customerStyles;

  const getStyles = () => {
    if (isRfmSegment(segment)) {
      return rfmStyles[segment];
    } else if (isCustomerSegment(segment)) {
      return customerStyles[segment];
    }
    return { bg: 'bg-gray-100', text: 'text-gray-700' };
  };

  const getLabel = () => {
    if (isRfmSegment(segment)) {
      return rfmLabels[segment];
    } else if (isCustomerSegment(segment)) {
      return customerLabels[segment];
    }
    return segment;
  };

  const { bg, text } = getStyles();

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}
    >
      {getLabel()}
    </span>
  );
};

// ============================================
// Main Analytics Dashboard Component
// ============================================

const AnalyticsDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Permission guard - redirect non-admins to unauthorized page
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [cohortType, setCohortType] = useState<'weekly' | 'monthly'>('monthly');

  // Data states
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelStep[]>([]);
  const [geoData, setGeoData] = useState<GeoDistribution[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryPerformance[]>([]);
  const [customerLTV, setCustomerLTV] = useState<CustomerLTV[]>([]);
  const [retentionMetrics, setRetentionMetrics] = useState<RetentionMetrics | null>(null);
  const [rfmData, setRfmData] = useState<RFMAnalysis[]>([]);
  const [healthScore, setHealthScore] = useState<BusinessHealthScore | null>(null);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate = new Date();

    switch (dateRange) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    };
  }, [dateRange]);

  const fetchAllData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { startDate, endDate } = getDateRange();

      const [
        metricsData,
        timeSeriesData,
        cohortResponse,
        funnelResponse,
        geoResponse,
        categoryResponse,
        ltvResponse,
        retentionResponse,
        rfmResponse,
        healthResponse,
      ] = await Promise.all([
        analyticsApi.getDashboardMetrics(),
        analyticsApi.getTimeSeriesData(startDate, endDate, 'day'),
        analyticsApi.getCohortAnalysis(cohortType, 6),
        analyticsApi.getConversionFunnel(startDate, endDate),
        analyticsApi.getGeographicDistribution(startDate, endDate),
        analyticsApi.getCategoryPerformance(startDate, endDate),
        businessIntelligenceApi.getCustomerLTV(startDate, endDate, 100),
        businessIntelligenceApi.getRetentionMetrics(startDate, endDate),
        businessIntelligenceApi.getRFMAnalysis(500),
        businessIntelligenceApi.getBusinessHealthScore(),
      ]);

      setMetrics(metricsData);
      setTimeSeries(timeSeriesData);
      setCohortData(cohortResponse);
      setFunnelData(funnelResponse);
      setGeoData(geoResponse);
      setCategoryData(categoryResponse);
      setCustomerLTV(ltvResponse);
      setRetentionMetrics(retentionResponse);
      setRfmData(rfmResponse);
      setHealthScore(healthResponse);
    } catch {
      toast.error('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getDateRange, cohortType]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Format currency
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Calculate time series max for chart scaling
  const maxRevenue = timeSeries.length > 0 ? Math.max(...timeSeries.map((d) => d.revenue)) : 0;

  if (loading) {
    return (
      <PageLayout title="Analytics Dashboard" backHref="/admin/dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Loading analytics...
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <ErrorBoundary>
    <PageLayout title="Analytics Dashboard" backHref="/admin/dashboard">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Analytics & Insights
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Deep dive into your marketplace performance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Last 7 days</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
            </select>
            <button
              onClick={() => fetchAllData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Total Bookings"
                value={metrics?.bookings.total || 0}
                icon={<Calendar className="w-5 h-5" />}
                color="blue"
                subtitle={`${metrics?.bookings.completed || 0} completed`}
              />
              <MetricCard
                title="Revenue"
                value={formatCurrency(metrics?.revenue.total || 0)}
                icon={<DollarSign className="w-5 h-5" />}
                color="green"
                change={metrics?.revenue.monthOverMonthGrowth}
                trend={
                  (metrics?.revenue.monthOverMonthGrowth || 0) > 0
                    ? 'up'
                    : (metrics?.revenue.monthOverMonthGrowth || 0) < 0
                    ? 'down'
                    : 'stable'
                }
              />
              <MetricCard
                title="Active Customers"
                value={metrics?.customers.active || 0}
                icon={<Users className="w-5 h-5" />}
                color="purple"
                subtitle={`${metrics?.customers.newThisMonth || 0} new`}
              />
              <MetricCard
                title="Active Providers"
                value={metrics?.providers.active || 0}
                icon={<UserCheck className="w-5 h-5" />}
                color="orange"
                subtitle={`${metrics?.providers.pending || 0} pending`}
              />
            </div>

            {/* Time Series Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Revenue Trend
              </h3>
              <div className="h-72 flex items-end gap-2">
                {timeSeries.slice(-14).map((data, idx) => {
                  const height = (data.revenue / maxRevenue) * 100;

                  return (
                    <div
                      key={data.date}
                      className="flex-1 flex flex-col items-center gap-1 group"
                    >
                      <div
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg transition-all hover:from-blue-500 hover:to-blue-300 cursor-pointer"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-gray-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {formatCurrency(data.revenue)}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {new Date(data.date).getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
                <span>Avg: {formatCurrency(
                  timeSeries.reduce((s, d) => s + d.revenue, 0) / (timeSeries.length || 1)
                )}</span>
                <span>Peak: {formatCurrency(maxRevenue)}</span>
              </div>
            </div>

            {/* Category Performance */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Category Performance
              </h3>
              <div className="space-y-4">
                {categoryData.slice(0, 6).map((cat) => (
                  <div key={cat.categoryId} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {cat.categoryName}
                        </span>
                        <div className="flex items-center gap-3 text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            {formatCurrency(cat.totalRevenue)}
                          </span>
                          <span
                            className={`flex items-center gap-1 ${
                              cat.growth >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {cat.growth >= 0 ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {Math.abs(cat.growth).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${cat.share}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Health */}
            {healthScore && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Business Health Score
                  </h3>
                  <div
                    className={`text-3xl font-bold ${
                      healthScore.overall >= 80
                        ? 'text-green-600 dark:text-green-400'
                        : healthScore.overall >= 60
                        ? 'text-yellow-600 dark:text-yellow-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {healthScore.overall}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {healthScore.categories.map((cat) => (
                    <div
                      key={cat.name}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {cat.name}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            cat.score >= 80
                              ? 'text-green-600'
                              : cat.score >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                          }`}
                        >
                          {cat.score}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            cat.score >= 80
                              ? 'bg-green-500'
                              : cat.score >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${cat.score}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {healthScore.alerts.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Alerts
                    </h4>
                    <div className="space-y-2">
                      {healthScore.alerts.map((alert, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-sm ${
                            alert.severity === 'critical'
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : alert.severity === 'warning'
                              ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {alert.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cohort Analysis Tab */}
        {activeTab === 'cohorts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cohort Analysis
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setCohortType('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    cohortType === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setCohortType('weekly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    cohortType === 'weekly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Weekly
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">
                Customer Retention by Cohort
              </h3>
              <CohortTable data={cohortData} cohortType={cohortType} />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                Color intensity indicates retention rate. Darker cells = higher retention.
              </p>
            </div>

            {/* Retention Metrics */}
            {retentionMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Retention Rate
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                    {retentionMetrics.retentionRate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Churn Rate
                  </p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                    {retentionMetrics.churnRate.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Retained Customers
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {retentionMetrics.retainedCustomers.toLocaleString()}
                  </p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Churned Customers
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {retentionMetrics.churnedCustomers.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversion Funnel Tab */}
        {activeTab === 'funnel' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Conversion Funnel
              </h3>
              <FunnelViz data={funnelData} />
            </div>

            {/* Funnel Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {funnelData.map((step, idx) => (
                <div
                  key={step.step}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {step.step}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {step.count.toLocaleString()} users
                      </p>
                    </div>
                  </div>
                  {idx > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Drop-off:{' '}
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {step.dropoffRate.toFixed(1)}%
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Geographic Tab */}
        {activeTab === 'geography' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Regions */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Revenue by Region
                </h3>
                <div className="space-y-3">
                  {geoData.slice(0, 10).map((geo, idx) => (
                    <div key={geo.region} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium text-sm">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {geo.region || 'Unknown'}
                          </span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(geo.revenue)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({geo.percentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${geo.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Booking Distribution */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Bookings by Region
                </h3>
                <div className="space-y-3">
                  {geoData.slice(0, 10).map((geo) => (
                    <div key={geo.region} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3">
                        <Globe className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {geo.region || 'Unknown'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {geo.count.toLocaleString()} bookings
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customer Analytics Tab */}
        {activeTab === 'customers' && (
          <div className="space-y-6">
            {/* Customer LTV Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Customer Lifetime Value
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    VIP Customers
                  </p>
                  <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                    {customerLTV.filter((c) => c.segment === 'vip').length}
                  </p>
                </div>
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">
                    High Value
                  </p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {customerLTV.filter((c) => c.segment === 'high').length}
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Medium Value
                  </p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                    {customerLTV.filter((c) => c.segment === 'medium').length}
                  </p>
                </div>
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Low Value
                  </p>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {customerLTV.filter((c) => c.segment === 'low').length}
                  </p>
                </div>
              </div>

              {/* Top LTV Customers */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Customer
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Bookings
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Total Spent
                      </th>
                      <th className="text-right py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Predicted LTV
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Segment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerLTV.slice(0, 10).map((customer) => (
                      <tr
                        key={customer.customerId}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">
                          {customer.customerName}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                          {customer.totalBookings}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                          {formatCurrency(customer.totalSpent)}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-medium">
                          {formatCurrency(customer.predictedLTV)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <RFMSegmentBadge segment={customer.segment} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RFM Analysis */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                RFM Analysis
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                {(['champions', 'loyal', 'potential', 'at_risk', 'lost'] as const).map((segment) => {
                  const count = rfmData.filter((c) => c.segment === segment).length;
                  const percentage = rfmData.length > 0
                    ? (count / rfmData.length) * 100
                    : 0;

                  return (
                    <div key={segment} className="text-center">
                      <RFMSegmentBadge segment={segment} />
                      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                        {count}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {percentage.toFixed(1)}%
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* RFM Distribution Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Customer ID
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Recency
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Frequency
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Monetary
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Score
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600 dark:text-gray-400">
                        Segment
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rfmData.slice(0, 15).map((customer) => (
                      <tr
                        key={customer.customerId}
                        className="border-b border-gray-100 dark:border-gray-800"
                      >
                        <td className="py-3 px-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {customer.customerId.slice(-8)}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                          {customer.recency}d
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                          {customer.frequency}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                          {formatCurrency(customer.monetary)}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-gray-900 dark:text-white">
                          {customer.rfmScore}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <RFMSegmentBadge segment={customer.segment} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
    </ErrorBoundary>
  );
};

export default AnalyticsDashboard;
