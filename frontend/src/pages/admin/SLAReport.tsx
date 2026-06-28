import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { slaApi } from '../../services/analyticsApi';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import type { SLAMetrics, SLAReport, SLAOverview, SLAThresholds, SLATrend, SLAComplianceByProvider, SLAComplianceByCategory } from '../../services/analyticsApi';
import PageLayout from '../../components/layout/PageLayout';
import { useAuthStore } from '../../stores/authStore';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Settings,
  Filter,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Briefcase,
  BarChart3,
} from 'lucide-react';

// ============================================
// Compliance Badge Component
// ============================================

interface ComplianceBadgeProps {
  rate: number;
  size?: 'sm' | 'md' | 'lg';
}

const ComplianceBadge: React.FC<ComplianceBadgeProps> = ({ rate, size = 'md' }) => {
  const isGood = rate >= 90;
  const isWarning = rate >= 70 && rate < 90;
  const isBad = rate < 70;

  const styles = {
    bg: isGood ? 'bg-green-100 dark:bg-green-900/30' : isWarning ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30',
    text: isGood ? 'text-green-700 dark:text-green-400' : isWarning ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400',
    size: size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-xl' : 'text-sm',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles.bg} ${styles.text}`}>
      {rate.toFixed(1)}%
    </span>
  );
};

// ============================================
// Main SLA Report Component
// ============================================

const SLAReport: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'report' | 'providers' | 'categories' | 'thresholds'>('overview');
  const [dateRange, setDateRange] = useState('30');

  // Data states
  const [overview, setOverview] = useState<SLAOverview | null>(null);
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [report, setReport] = useState<SLAReport | null>(null);
  const [thresholds, setThresholds] = useState<SLAThresholds | null>(null);
  const [providerCompliance, setProviderCompliance] = useState<SLAComplianceByProvider[]>([]);
  const [categoryCompliance, setCategoryCompliance] = useState<SLAComplianceByCategory[]>([]);

  // Filter states
  const [minCompliance, setMinCompliance] = useState<number>(0);

  const getDateParams = () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - parseInt(dateRange));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  };

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { startDate, endDate } = getDateParams();

    try {
      const [overviewData, metricsData, reportData, thresholdsData, providersData, categoriesData] = await Promise.all([
        slaApi.getSLAOverview(),
        slaApi.getSLAMetrics(startDate, endDate),
        slaApi.getSLAReport(startDate, endDate),
        slaApi.getSLAThresholds(),
        slaApi.getSLAByProvider(startDate, endDate, minCompliance > 0 ? minCompliance : undefined),
        slaApi.getSLAByCategory(startDate, endDate, minCompliance > 0 ? minCompliance : undefined),
      ]);

      setOverview(overviewData);
      setMetrics(metricsData);
      setReport(reportData);
      setThresholds(thresholdsData);
      setProviderCompliance(providersData);
      setCategoryCompliance(categoriesData);
    } catch (error) {
      console.error('Failed to fetch SLA data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, minCompliance]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `AED ${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `AED ${(value / 1000).toFixed(1)}K`;
    return `AED ${value.toFixed(0)}`;
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-5 h-5 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-5 h-5 text-red-500" />;
    return null;
  };

  if (loading) {
    return (
      <PageLayout title="SLA Compliance" backHref="/admin/reports">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading SLA compliance data...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <ErrorBoundary>
      <PageLayout title="SLA Compliance" subtitle="Service Level Agreement monitoring and compliance tracking">
        <div className="space-y-6 overflow-x-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">SLA Compliance</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor and track service level agreement compliance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="min-h-11 px-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 min-h-11 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Compliance Rate</p>
                <p className={`text-3xl font-bold mt-1 ${overview?.currentCompliance >= 90 ? 'text-green-600 dark:text-green-400' : overview?.currentCompliance >= 70 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                  {(overview?.currentCompliance || 0).toFixed(1)}%
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${overview?.currentCompliance >= 90 ? 'bg-green-100 dark:bg-green-900/30' : overview?.currentCompliance >= 70 ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                {overview?.currentCompliance >= 90 ? (
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                )}
              </div>
            </div>
            {overview?.trend && (
              <div className="flex items-center gap-1 mt-2">
                {getTrendIcon(overview.trend)}
                <span className="text-xs text-gray-500 capitalize">{overview.trend}</span>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Breaches</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {overview?.totalBreaches || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Critical Breaches</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {overview?.criticalBreaches || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Response Time</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatTime(overview?.averageResponseTime || 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4">
            {(['overview', 'report', 'providers', 'categories', 'thresholds'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'report' ? 'Detailed Report' : tab === 'providers' ? 'By Provider' : tab === 'categories' ? 'By Category' : 'Thresholds'}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && metrics && (
          <div className="space-y-6">
            {/* Metrics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{metrics.totalBookings}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">Meeting SLA</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{metrics.meetingSLA}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <p className="text-sm text-gray-500 dark:text-gray-400">Breached SLA</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{metrics.breachedSLA}</p>
              </div>
            </div>

            {/* Compliance Trend */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compliance Trend</h3>
              <div className="h-64 flex items-end gap-1">
                {metrics.trends.slice(-14).map((trend, idx) => {
                  const maxRate = 100;
                  const height = (trend.complianceRate / maxRate) * 100;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-full rounded-t transition-all hover:opacity-80 ${
                          trend.complianceRate >= 90 ? 'bg-green-500' :
                          trend.complianceRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ height: `${Math.max(height, 2)}%` }}
                        title={`${trend.date}: ${trend.complianceRate.toFixed(1)}%`}
                      />
                      <span className="text-xs text-gray-500 transform -rotate-45 origin-center whitespace-nowrap">
                        {new Date(trend.date).getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-sm text-gray-500">
                <span>Avg: {metrics.complianceRate.toFixed(1)}%</span>
                <span>Min: {Math.min(...metrics.trends.map(t => t.complianceRate)).toFixed(1)}%</span>
                <span>Max: {Math.max(...metrics.trends.map(t => t.complianceRate)).toFixed(1)}%</span>
              </div>
            </div>

            {/* Top Issue */}
            {overview?.topIssue && (
              <div className={`p-4 rounded-xl border ${overview.criticalBreaches > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`w-6 h-6 ${overview.criticalBreaches > 0 ? 'text-red-600' : 'text-yellow-600'}`} />
                  <div>
                    <p className={`font-medium ${overview.criticalBreaches > 0 ? 'text-red-800' : 'text-yellow-800'}`}>Top Issue</p>
                    <p className={`text-sm ${overview.criticalBreaches > 0 ? 'text-red-700' : 'text-yellow-700'}`}>{overview.topIssue}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Report Tab */}
        {activeTab === 'report' && report && (
          <div className="space-y-6">
            {/* Breach Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Breaches by Type</h3>
                <div className="space-y-3">
                  {Object.entries(report.breachBreakdown.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <span className="text-gray-700 dark:text-gray-300 capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Breaches by Severity</h3>
                <div className="space-y-3">
                  {Object.entries(report.breachBreakdown.bySeverity).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <span className={`capitalize font-medium ${
                        severity === 'critical' ? 'text-red-600' :
                        severity === 'high' ? 'text-orange-600' :
                        severity === 'medium' ? 'text-yellow-600' : 'text-green-600'
                      }`}>{severity}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h3>
              <ul className="space-y-2">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-gray-600 dark:text-gray-400">
                    <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* Top Breached Categories */}
            {report.topBreachedCategories.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Breached Categories</h3>
                <div className="space-y-2">
                  {report.topBreachedCategories.map((cat, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-medium">
                          {idx + 1}
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">{cat.categoryName}</span>
                      </div>
                      <span className="font-semibold text-red-600">{cat.breachCount} breaches</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Providers Tab */}
        {activeTab === 'providers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-500">Min Compliance:</label>
                <select
                  value={minCompliance}
                  onChange={(e) => setMinCompliance(parseInt(e.target.value))}
                  className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
                >
                  <option value={0}>All</option>
                  <option value={90}>90%+</option>
                  <option value={80}>80%+</option>
                  <option value={70}>70%+</option>
                </select>
              </div>
              <span className="text-sm text-gray-500">{providerCompliance.length} providers</span>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bookings</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Compliance</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Breaches</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {providerCompliance.map((provider) => (
                    <tr key={provider.providerId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-white">{provider.providerName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{provider.totalBookings}</td>
                      <td className="px-4 py-3 text-center">
                        <ComplianceBadge rate={provider.complianceRate} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={provider.breachedCount > 0 ? 'text-red-600' : 'text-green-600'}>
                          {provider.breachedCount}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {providerCompliance.length === 0 && (
                <div className="text-center py-12">
                  <Briefcase className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No provider data available</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Bookings</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Compliance</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Avg Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {categoryCompliance.map((cat) => (
                  <tr key={cat.categoryId} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900 dark:text-white">{cat.categoryName}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{cat.totalBookings}</td>
                    <td className="px-4 py-3 text-center">
                      <ComplianceBadge rate={cat.complianceRate} />
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                      {formatTime(cat.avgResponseTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {categoryCompliance.length === 0 && (
              <div className="text-center py-12">
                <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No category data available</p>
              </div>
            )}
          </div>
        )}

        {/* Thresholds Tab */}
        {activeTab === 'thresholds' && thresholds && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">SLA Thresholds</h3>
              <Settings className="w-5 h-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Booking Response Time</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatTime(thresholds.bookingResponseTime)}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Booking Confirmation</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatTime(thresholds.bookingConfirmationTime)}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Service Completion</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatTime(thresholds.serviceCompletionTime * 60)}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Cancellation Window</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">{formatTime(thresholds.cancellationWindow)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Contact admin to modify SLA thresholds.
            </p>
          </div>
        )}
      </div>
    </PageLayout>
    </ErrorBoundary>
  );
};

export default SLAReport;
