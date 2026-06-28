
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
import { AdminPageShell } from '../../components/admin/AdminPageShell';
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
  color?: 'coral' | 'sage' | 'gold' | 'blush' | 'rose';
  subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  change,
  trend,
  icon,
  color = 'coral',
  subtitle,
}) => {
  const colorClasses = {
    coral: 'bg-nilin-coral/20 dark:bg-nilin-coral/10 text-nilin-coral dark:text-nilin-coral',
    sage: 'bg-nilin-success/20 dark:bg-nilin-success/10 text-nilin-success dark:text-nilin-success',
    gold: 'bg-nilin-warning/20 dark:bg-nilin-warning/10 text-nilin-charcoal dark:text-nilin-charcoal',
    blush: 'bg-nilin-blush dark:bg-nilin-blush/20 text-nilin-charcoal dark:text-nilin-charcoal',
    rose: 'bg-nilin-rose/20 dark:bg-nilin-rose/10 text-nilin-rose dark:text-nilin-rose',
  };

  const trendColors = {
    up: 'text-nilin-success dark:text-nilin-success',
    down: 'text-nilin-error dark:text-nilin-error',
    stable: 'text-nilin-warmGray dark:text-nilin-lightGray',
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
    <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
        {change !== undefined && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend === 'up'
                ? trendColors.up
                : trend === 'down'
                ? trendColors.down
                : trendColors.stable
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
        <p className="text-sm text-nilin-warmGray dark:text-gray-400">{title}</p>
        <p className="text-2xl font-bold text-nilin-charcoal dark:text-white">
          {formatValue(value)}
        </p>
        {subtitle && (
          <p className="text-xs text-nilin-warmGray/70 dark:text-gray-500">{subtitle}</p>
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
    success: 'bg-nilin-success/10 dark:bg-nilin-success/20 border-nilin-success/30 dark:border-nilin-success/50',
    info: 'bg-nilin-coral/10 dark:bg-nilin-coral/20 border-nilin-coral/30 dark:border-nilin-coral/50',
    warning: 'bg-nilin-warning/10 dark:bg-nilin-warning/20 border-nilin-warning/30 dark:border-nilin-warning/50',
    critical: 'bg-nilin-rose/10 dark:bg-nilin-rose/20 border-nilin-rose/30 dark:border-nilin-rose/50',
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-nilin-success dark:text-nilin-success" />,
    info: <Info className="w-5 h-5 text-nilin-coral dark:text-nilin-coral" />,
    warning: <AlertTriangle className="w-5 h-5 text-nilin-warning dark:text-nilin-warning" />,
    critical: <XCircle className="w-5 h-5 text-nilin-rose dark:text-nilin-rose" />,
  };

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm bg-white/80 dark:bg-gray-800/80 ${styles[alert.type]}`}
    >
      {icons[alert.type]}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-nilin-charcoal dark:text-white">{alert.title}</p>
        <p className="text-sm text-nilin-warmGray dark:text-gray-300 mt-1">
          {alert.message}
        </p>
        {alert.actionRequired && alert.actionUrl && (
          <a
            href={alert.actionUrl}
            className="inline-flex items-center gap-1 text-sm font-medium text-nilin-coral dark:text-nilin-coral hover:underline mt-2"
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
  color?: 'coral' | 'sage' | 'gold' | 'blush' | 'rose';
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  value,
  max,
  color = 'coral',
}) => {
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colorClasses = {
    coral: 'bg-nilin-coral',
    sage: 'bg-nilin-success',
    gold: 'bg-nilin-warning',
    blush: 'bg-nilin-blush',
    rose: 'bg-nilin-rose',
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-nilin-warmGray dark:text-gray-400">{label}</span>
        <span className="font-medium text-nilin-charcoal dark:text-white">
          {percentage.toFixed(0)}%
        </span>
      </div>
      <div className="h-2 bg-nilin-blush/30 dark:bg-gray-700 rounded-full overflow-hidden">
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
      <AdminPageShell
        title="Executive Dashboard"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Executive Dashboard', current: true },
        ]}
        backHref="/admin/dashboard"
      >
        {/* Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-nilin-warmGray dark:text-gray-400">
              Loading dashboard...
            </p>
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Executive Dashboard"
        subtitle="Real-time business intelligence and KPIs"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Executive Dashboard', current: true },
        ]}
        backHref="/admin/dashboard"
        wideLayout
      >
        {/* Skip link */}
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
            <h1 className="text-2xl font-bold text-nilin-charcoal dark:text-white">
              Executive Overview
            </h1>
            <p className="text-sm text-nilin-warmGray dark:text-gray-400">
              Real-time business intelligence and KPIs
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-nilin-warmGray/70 dark:text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-nilin-charcoal dark:text-white">
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
              color="sage"
              subtitle={`Last month: ${formatCurrency(kpis?.revenue.lastMonth || 0)}`}
            />
            <KPICard
              title="Year to Date"
              value={formatCurrency(kpis?.revenue.yearToDate || 0)}
              icon={<BarChart3 className="w-6 h-6" />}
              color="coral"
            />
            <KPICard
              title="Projected Annual"
              value={formatCurrency(kpis?.revenue.projectedAnnual || 0)}
              icon={<Target className="w-6 h-6" />}
              color="rose"
            />
            <KPICard
              title="Take Rate"
              value={`${(kpis?.platform.takeRate || 0).toFixed(2)}%`}
              icon={<PieChart className="w-6 h-6" />}
              color="gold"
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
              color="coral"
              subtitle={`${kpis?.bookings.completed || 0} completed`}
            />
            <KPICard
              title="Completion Rate"
              value={`${(kpis?.bookings.completionRate || 0).toFixed(1)}%`}
              icon={<CheckCircle className="w-6 h-6" />}
              color="sage"
              subtitle={`${kpis?.bookings.cancelled || 0} cancelled`}
            />
            <KPICard
              title="Active Customers"
              value={kpis?.customers.total || 0}
              change={growth?.customers.growth}
              trend={growth?.customers.trend}
              icon={<Users className="w-6 h-6" />}
              color="rose"
              subtitle={`${kpis?.customers.newThisMonth || 0} new this month`}
            />
            <KPICard
              title="Customer LTV"
              value={formatCurrency(kpis?.customers.ltv || 0)}
              icon={<TrendingUp className="w-6 h-6" />}
              color="gold"
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
              color="coral"
              subtitle={`${kpis?.providers.pendingVerification || 0} pending`}
            />
            <KPICard
              title="Avg Provider Rating"
              value={`${(kpis?.providers.averageRating || 0).toFixed(1)}`}
              icon={<Star className="w-6 h-6" />}
              color="gold"
            />
            <KPICard
              title="Avg Order Value"
              value={formatCurrency(kpis?.platform.averageOrderValue || 0)}
              icon={<DollarSign className="w-6 h-6" />}
              color="sage"
            />
            <KPICard
              title="Platform Margin"
              value={`${(kpis?.platform.netMargin || 0).toFixed(1)}%`}
              icon={<Zap className="w-6 h-6" />}
              color="rose"
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
              color="gold"
              subtitle={`${churnData?.criticalCount || 0} critical, ${churnData?.highCount || 0} high`}
            />
            <KPICard
              title="Fraud Flags"
              value={fraudData?.totalFlagged || 0}
              icon={<Shield className="w-6 h-6" />}
              color="rose"
              subtitle={`${fraudData?.recentFlags || 0} in last 7 days`}
            />
            <KPICard
              title="SLA Compliance"
              value={`${(slaData?.currentCompliance || 100).toFixed(1)}%`}
              icon={<Award className="w-6 h-6" />}
              color={slaData?.currentCompliance && slaData.currentCompliance >= 90 ? 'sage' : slaData?.currentCompliance && slaData.currentCompliance >= 70 ? 'gold' : 'rose'}
              subtitle={`${slaData?.totalBreaches || 0} breaches`}
            />
            <KPICard
              title="Retention Rate"
              value={`${(kpis?.customers.retentionRate || 0).toFixed(1)}%`}
              icon={<TrendingUp className="w-6 h-6" />}
              color="rose"
              subtitle="Customer retention"
            />
          </div>
        </div>

        {/* Revenue Breakdown & Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Breakdown */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4">
              Revenue Breakdown
            </h3>
            <div className="space-y-4">
              <ProgressBar
                label="Gross Revenue"
                value={revenue?.summary.grossRevenue || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="sage"
              />
              <ProgressBar
                label="Commissions"
                value={revenue?.summary.commissions || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="coral"
              />
              <ProgressBar
                label="Platform Fees"
                value={revenue?.summary.platformFees || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="rose"
              />
              <ProgressBar
                label="Provider Payouts"
                value={revenue?.summary.providerPayouts || 0}
                max={revenue?.summary.grossRevenue || 1}
                color="gold"
              />
              <div className="pt-4 border-t border-nilin-border/50 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-nilin-warmGray dark:text-gray-400">
                    Platform Profit
                  </span>
                  <span className="font-semibold text-nilin-charcoal dark:text-white">
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
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4">
              Top Categories
            </h3>
            <div className="space-y-3">
              {revenue?.breakdown.byCategory.slice(0, 5).map((cat, idx) => (
                <div key={cat.categoryId} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-nilin-coral/20 dark:bg-nilin-coral/30 flex items-center justify-center text-nilin-coral dark:text-nilin-coral font-medium">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-nilin-charcoal dark:text-white truncate">
                        {cat.categoryName}
                      </p>
                      <p className="text-sm font-medium text-nilin-charcoal dark:text-white">
                        {formatCurrency(cat.revenue)}
                      </p>
                    </div>
                    <div className="mt-1 h-2 bg-nilin-blush/30 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-nilin-coral rounded-full"
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
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-nilin-warning" />
              Customer Satisfaction
            </h3>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-nilin-charcoal dark:text-white">
                  {(operations?.customerSatisfaction.averageRating || 0).toFixed(1)}
                </div>
                <div className="flex justify-center gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(operations?.customerSatisfaction.averageRating || 0)
                          ? 'text-nilin-warning fill-nilin-warning'
                          : 'text-nilin-blush/50 dark:text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-nilin-warmGray dark:text-gray-400 mt-1">
                  Average Rating
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-nilin-border/50 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-xl font-bold text-nilin-charcoal dark:text-white">
                    {(operations?.customerSatisfaction.responseRate || 0).toFixed(0)}%
                  </div>
                  <p className="text-xs text-nilin-warmGray dark:text-gray-400">Response Rate</p>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-nilin-charcoal dark:text-white">
                    {(operations?.customerSatisfaction.reviewRate || 0).toFixed(0)}%
                  </div>
                  <p className="text-xs text-nilin-warmGray dark:text-gray-400">Review Rate</p>
                </div>
              </div>
            </div>
          </div>

          {/* Operational Metrics */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-nilin-coral" />
              Operations
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-nilin-border/50 dark:border-gray-700">
                <span className="text-sm text-nilin-warmGray dark:text-gray-400">
                  Avg Booking Value
                </span>
                <span className="font-medium text-nilin-charcoal dark:text-white">
                  {formatCurrency(operations?.averageBookingValue || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-nilin-border/50 dark:border-gray-700">
                <span className="text-sm text-nilin-warmGray dark:text-gray-400">
                  Avg Service Duration
                </span>
                <span className="font-medium text-nilin-charcoal dark:text-white">
                  {Math.round(operations?.averageServiceDuration || 0)} min
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-nilin-border/50 dark:border-gray-700">
                <span className="text-sm text-nilin-warmGray dark:text-gray-400">
                  Provider Utilization
                </span>
                <span className="font-medium text-nilin-charcoal dark:text-white">
                  {(operations?.providerUtilization || 0).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm text-nilin-warmGray dark:text-gray-400">
                  Active Services
                </span>
                <span className="font-medium text-nilin-charcoal dark:text-white">
                  {operations?.serviceHealth.activeServices || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Market Opportunities */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-nilin-coral" />
              Market Opportunities
            </h3>
            <div className="space-y-3">
              {opportunities.length > 0 ? (
                opportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-nilin-coral/5 dark:bg-nilin-coral/20 rounded-lg border border-nilin-coral/20"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-nilin-charcoal dark:text-white">
                        {opp.category}
                      </span>
                      <span className="text-xs font-medium text-nilin-coral dark:text-nilin-coral">
                        Score: {opp.opportunityScore.toFixed(0)}
                      </span>
                    </div>
                    <p className="text-xs text-nilin-warmGray dark:text-gray-400 line-clamp-2">
                      {opp.recommendation}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-nilin-warmGray dark:text-gray-400 text-center py-4">
                  No opportunities identified
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Daily Revenue Trend */}
        <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-nilin-warm border border-nilin-border/50 p-6">
          <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4">
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
                    className="w-full bg-gradient-to-t from-nilin-coral to-nilin-rose/60 rounded-t transition-all hover:from-nilin-rose hover:to-nilin-rose/40"
                    style={{ height: `${Math.max(height, 2)}%` }}
                    title={`${day.date}: ${formatCurrency(day.revenue)}`}
                  />
                  <span className="text-[10px] sm:text-xs text-nilin-warmGray dark:text-gray-400 sm:transform sm:-rotate-45 sm:origin-center">
                    {new Date(day.date).getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-4 text-sm text-nilin-warmGray dark:text-gray-400">
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
        </main>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ExecutiveDashboard;
