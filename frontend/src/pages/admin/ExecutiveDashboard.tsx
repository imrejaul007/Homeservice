
import React, { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import {
  executiveDashboardApi,
  analyticsApi,
  churnApi,
  fraudApi,
  slaApi,
} from '../../services/analyticsApi';
import type {
  ExecutiveKPIs,
  GrowthMetrics,
  RevenueDashboard,
  OperationalMetrics,
  ExecutiveAlert,
  MarketOpportunity,
} from '../../services/analyticsApi';
import PageLayout from '../../components/layout/PageLayout';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  UserCheck,
  Calendar,
  Clock,
  Star,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  BarChart3,
  PieChart,
  Target,
  Zap,
  Building2,
  Briefcase,
  Eye,
  Shield,
  Activity,
  Award,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ============================================
// KPI Card Component
// ============================================

interface KPICardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'yellow';
  subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({
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
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
  };

  const formatValue = (val: string | number) => {
    if (typeof val === 'number') {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
      if (val < 100) return val.toFixed(1);
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend === 'up'
                ? 'text-green-600 dark:text-green-400'
                : trend === 'down'
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {trend === 'up' ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : trend === 'down' ? (
              <ArrowDownRight className="w-4 h-4" />
            ) : null}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatValue(value)}
        </p>
        {subtitle && (
          <p className="text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
};

// ============================================
// Alert Badge Component
// ============================================

interface AlertBadgeProps {
  alert: ExecutiveAlert;
}

const AlertBadge: React.FC<AlertBadgeProps> = ({ alert }) => {
  const styles = {
    success: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    critical: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />,
    info: <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
    critical: <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />,
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border ${styles[alert.type]}`}
    >
      {icons[alert.type]}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white">{alert.title}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          {alert.message}
        </p>
        {alert.actionRequired && alert.actionUrl && (
          <a
            href={alert.actionUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
          >
            Take Action <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};

// ============================================
// Progress Bar Component
// ============================================

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  value,
  max,
  color = 'blue',
}) => {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{label}</span>
        <span className="font-medium text-gray-900 dark:text-white">
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// ============================================
// Main Executive Dashboard Component
// ============================================

const ExecutiveDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Data states
  const [kpis, setKPIs] = useState<ExecutiveKPIs | null>(null);
  const [growth, setGrowth] = useState<GrowthMetrics | null>(null);
  const [revenue, setRevenue] = useState<RevenueDashboard | null>(null);
  const [operations, setOperations] = useState<OperationalMetrics | null>(null);
  const [alerts, setAlerts] = useState<ExecutiveAlert[]>([]);
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);

  // Additional metrics states
  const [churnData, setChurnData] = useState<{ atRiskCount: number; criticalCount: number; highCount: number } | null>(null);
  const [fraudData, setFraudData] = useState<{ totalFlagged: number; recentFlags: number; alertLevel: string } | null>(null);
  const [slaData, setSlaData] = useState<{ currentCompliance: number; totalBreaches: number; trend: string } | null>(null);

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch executive dashboard data
      const data = await executiveDashboardApi.getExecutiveDashboard();

      setKPIs(data.kpis);
      setGrowth(data.growth);
      setRevenue(data.revenue);
      setOperations(data.operations);
      setAlerts(data.alerts);
      setOpportunities(data.opportunities);

      // Fetch additional metrics in parallel
      const [churnOverview, fraudOverview, slaOverview] = await Promise.allSettled([
        churnApi.getChurnOverview(),
        fraudApi.getFraudOverview(),
        slaApi.getSLAOverview(),
      ]);

      if (churnOverview.status === 'fulfilled') {
        setChurnData({
          atRiskCount: churnOverview.value.atRiskCount,
          criticalCount: churnOverview.value.criticalCount,
          highCount: churnOverview.value.highCount,
        });
      }

      if (fraudOverview.status === 'fulfilled') {
        setFraudData({
          totalFlagged: fraudOverview.value.totalFlagged,
          recentFlags: fraudOverview.value.recentFlags,
          alertLevel: fraudOverview.value.alertLevel,
        });
      }

      if (slaOverview.status === 'fulfilled') {
        setSlaData({
          currentCompliance: slaOverview.value.currentCompliance,
          totalBreaches: slaOverview.value.totalBreaches,
          trend: slaOverview.value.trend,
        });
      }

      setLastUpdated(new Date());
    } catch {
      toast.error('Failed to load executive dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Format currency (AED)
  const formatCurrency = (value: number): string => {
    if (value >= 1000000) return `AED ${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `AED ${(value / 1000).toFixed(1)}K`;
    return `AED ${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <PageLayout title="Executive Dashboard" backHref="/admin/dashboard">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Loading dashboard...
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <ErrorBoundary>
      <PageLayout title="Executive Dashboard" backHref="/admin/dashboard">
        <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Executive Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Real-time business intelligence and KPIs
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Alerts
            </h2>
            <div className="grid gap-3">
              {alerts.map((alert) => (
                <AlertBadge key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}

        {/* Revenue & Growth KPIs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Revenue & Growth
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Monthly Revenue"
              value={formatCurrency(kpis?.revenue.thisMonth || 0)}
              change={kpis?.revenue.monthOverMonthGrowth}
              trend={
                (kpis?.revenue.monthOverMonthGrowth || 0) > 0
                  ? 'up'
                  : (kpis?.revenue.monthOverMonthGrowth || 0) < 0
                  ? 'down'
                  : 'stable'
              }
              icon={<DollarSign className="w-6 h-6" />}
              color="green"
              subtitle={`Last month: ${formatCurrency(kpis?.revenue.lastMonth || 0)}`}
            />
            <KPICard
              title="Year to Date"
              value={formatCurrency(kpis?.revenue.yearToDate || 0)}
              icon={<BarChart3 className="w-6 h-6" />}
              color="blue"
            />
            <KPICard
              title="Projected Annual"
              value={formatCurrency(kpis?.revenue.projectedAnnual || 0)}
              icon={<Target className="w-6 h-6" />}
              color="purple"
            />
            <KPICard
              title="Take Rate"
              value={`${(kpis?.platform.takeRate || 0).toFixed(2)}%`}
              icon={<PieChart className="w-6 h-6" />}
              color="orange"
            />
          </div>
        </div>

        {/* Booking & Customer KPIs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Bookings & Customers
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Bookings"
              value={kpis?.bookings.total || 0}
              change={growth?.bookings.growth}
              trend={growth?.bookings.trend}
              icon={<Calendar className="w-6 h-6" />}
              color="blue"
              subtitle={`${kpis?.bookings.completed || 0} completed`}
            />
            <KPICard
              title="Completion Rate"
              value={`${(kpis?.bookings.completionRate || 0).toFixed(1)}%`}
              icon={<CheckCircle className="w-6 h-6" />}
              color="green"
              subtitle={`${kpis?.bookings.cancelled || 0} cancelled`}
            />
            <KPICard
              title="Active Customers"
              value={kpis?.customers.total || 0}
              change={growth?.customers.growth}
              trend={growth?.customers.trend}
              icon={<Users className="w-6 h-6" />}
              color="purple"
              subtitle={`${kpis?.customers.newThisMonth || 0} new this month`}
            />
            <KPICard
              title="Customer LTV"
              value={formatCurrency(kpis?.customers.ltv || 0)}
              icon={<TrendingUp className="w-6 h-6" />}
              color="orange"
              subtitle={`${(kpis?.customers.retentionRate || 0).toFixed(1)}% retention`}
            />
          </div>
        </div>

        {/* Provider & Platform KPIs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Briefcase className="w-5 h-5" />
            Providers & Platform
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Active Providers"
              value={kpis?.providers.active || 0}
              change={growth?.providers.growth}
              trend={growth?.providers.trend}
              icon={<UserCheck className="w-6 h-6" />}
              color="blue"
              subtitle={`${kpis?.providers.pendingVerification || 0} pending`}
            />
            <KPICard
              title="Avg Provider Rating"
              value={`${(kpis?.providers.averageRating || 0).toFixed(1)}`}
              icon={<Star className="w-6 h-6" />}
              color="yellow"
            />
            <KPICard
              title="Avg Order Value"
              value={formatCurrency(kpis?.platform.averageOrderValue || 0)}
              icon={<DollarSign className="w-6 h-6" />}
              color="green"
            />
            <KPICard
              title="Platform Margin"
              value={`${(kpis?.platform.netMargin || 0).toFixed(1)}%`}
              icon={<Zap className="w-6 h-6" />}
              color="purple"
              subtitle={`Gross: ${(kpis?.platform.grossMargin || 0).toFixed(1)}%`}
            />
          </div>
        </div>

        {/* Churn, Fraud & SLA KPIs */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Health Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="At-Risk Customers"
              value={churnData?.atRiskCount || 0}
              icon={<Users className="w-6 h-6" />}
              color="orange"
              subtitle={`${churnData?.criticalCount || 0} critical, ${churnData?.highCount || 0} high`}
            />
            <KPICard
              title="Fraud Flags"
              value={fraudData?.totalFlagged || 0}
              icon={<Shield className="w-6 h-6" />}
              color="red"
              subtitle={`${fraudData?.recentFlags || 0} in last 7 days`}
            />
            <KPICard
              title="SLA Compliance"
              value={`${(slaData?.currentCompliance || 100).toFixed(1)}%`}
              icon={<Award className="w-6 h-6" />}
              color={slaData?.currentCompliance && slaData.currentCompliance >= 90 ? 'green' : slaData?.currentCompliance && slaData.currentCompliance >= 70 ? 'orange' : 'red'}
              subtitle={`${slaData?.totalBreaches || 0} breaches`}
            />
            <KPICard
              title="Retention Rate"
              value={`${(kpis?.customers.retentionRate || 0).toFixed(1)}%`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="purple"
              subtitle="Customer retention"
            />
          </div>
        </div>

        {/* Revenue Breakdown & Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Revenue Breakdown
            </h3>
            <div className="space-y-4">
              <ProgressBar
                label="Gross Revenue"
                value={revenue?.summary.grossRevenue || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="green"
              />
              <ProgressBar
                label="Commissions"
                value={revenue?.summary.commissions || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="blue"
              />
              <ProgressBar
                label="Platform Fees"
                value={revenue?.summary.platformFees || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="purple"
              />
              <ProgressBar
                label="Provider Payouts"
                value={revenue?.summary.providerPayouts || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="orange"
              />
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Platform Profit
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(
                      (revenue?.summary.grossRevenue || 0) -
                        (revenue?.summary.providerPayouts || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Top Categories
            </h3>
            <div className="space-y-3">
              {revenue?.breakdown.byCategory.slice(0, 5).map((cat, idx) => (
                <div key={cat.categoryId} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-medium">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {cat.categoryName}
                      </p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(cat.revenue)}
                      </p>
                    </div>
                    <div className="mt-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${cat.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Operations & Satisfaction */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Satisfaction */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Customer Satisfaction
            </h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
                  {(operations?.customerSatisfaction.averageRating || 0).toFixed(1)}
                </div>
                <div className="flex justify-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(operations?.customerSatisfaction.averageRating || 0)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Average Rating
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {(operations?.customerSatisfaction.responseRate || 0).toFixed(0)}%
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Response Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {(operations?.customerSatisfaction.reviewRate || 0).toFixed(0)}%
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Review Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-500" />
              Operations
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Avg Booking Value
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(operations?.averageBookingValue || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Avg Service Duration
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {Math.round(operations?.averageServiceDuration || 0)} min
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Provider Utilization
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {(operations?.providerUtilization || 0).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Active Services
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {operations?.serviceHealth.activeServices || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Market Opportunities */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              Market Opportunities
            </h3>
            <div className="space-y-3">
              {opportunities.length > 0 ? (
                opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {opp.category}
                      </span>
                      <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                        Score: {opp.opportunityScore.toFixed(0)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {opp.recommendation}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No opportunities identified
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Daily Revenue Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Revenue Trend
          </h3>
          <div className="h-64 flex items-end gap-1">
            {revenue?.trends.daily.slice(-14).map((day, idx) => {
              const maxRevenue = Math.max(
                ...(revenue?.trends.daily.map((d) => d.revenue) || [1])
              );
              const height = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;

              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <div
                    className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:from-blue-500 hover:to-blue-300"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.date}: ${formatCurrency(day.revenue)}`}
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400 transform -rotate-45 origin-center whitespace-nowrap">
                    {new Date(day.date).getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
            <span>
              Avg:{' '}
              {formatCurrency(
                (revenue?.trends.daily.reduce((sum, d) => sum + d.revenue, 0) || 0) /
                  (revenue?.trends.daily.length || 1)
              )}
            </span>
            <span>
              Total:{' '}
              {formatCurrency(
                revenue?.trends.daily.reduce((sum, d) => sum + d.revenue, 0) || 0
              )}
            </span>
          </div>
        </div>
      </div>
    </PageLayout>
    </ErrorBoundary>
  );
};

export default ExecutiveDashboard;
