import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { churnApi } from '../../services/analyticsApi';
import type {
  ChurnRisk,
  ChurnStats,
  CustomerSegment,
  ChurnOverview,
  RetentionAction,
  AtRiskCustomer,
} from '../../services/analyticsApi';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';
import {
  Users,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Filter,
  ChevronDown,
  ChevronRight,
  Mail,
  Gift,
  MessageSquare,
  Phone,
  Bell,
  XCircle,
  Clock,
  DollarSign,
  Activity,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

type ChurnTab = 'at-risk' | 'segments' | 'overview';
type RiskFilter = 'all' | 'critical' | 'high' | 'medium';

const VALID_TABS = new Set<ChurnTab>(['at-risk', 'segments', 'overview']);

function formatAED(value: number) {
  if (value >= 1_000_000) return `AED ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `AED ${(value / 1_000).toFixed(1)}K`;
  return `AED ${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function mapAdminCustomerToChurnRisk(c: AtRiskCustomer): ChurnRisk & { customerName?: string; email?: string } {
  return {
    userId: c.customerId,
    customerName: c.customerName,
    email: c.email,
    riskScore: c.riskScore,
    riskLevel: c.riskLevel,
    factors: c.riskFactors.map((name) => ({
      name,
      weight: 50,
      description: name.replace(/_/g, ' '),
      severity: 'medium' as const,
    })),
    indicators: [],
    confidence: 0.85,
    recommendedActions: c.recommendedActions.map((title) => ({
      type: 'outreach' as const,
      priority: 'medium' as const,
      title,
      description: title,
      expectedImpact: 0.5,
      channels: ['email' as const],
    })),
    daysSinceLastBooking: c.daysSinceLastBooking,
    totalBookings: c.totalBookings,
    lifetimeValue: c.totalSpent,
    lastBookingDate: c.lastBookingDate,
  };
}

function getCustomerLabel(customer: ChurnRisk & { customerName?: string; email?: string }) {
  if (customer.customerName?.trim()) return customer.customerName.trim();
  if (customer.email) {
    const local = customer.email.split('@')[0];
    return local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return `Customer …${customer.userId.slice(-6)}`;
}

// ============================================
// Risk Level Badge Component
// ============================================

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high' | 'critical';
}

const RiskBadge: React.FC<RiskBadgeProps> = ({ level }) => {
  const styles = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
};

// ============================================
// Customer Card Component
// ============================================

interface CustomerCardProps {
  customer: ChurnRisk & { customerName?: string; email?: string };
  onExecuteAction?: (userId: string, action: RetentionAction) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onExecuteAction }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-nilin-border/50 bg-white/60 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-nilin-blush/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-nilin-blush/50 flex items-center justify-center">
              <Users className="w-5 h-5 text-nilin-coral" />
            </div>
            <div>
              <p className="font-medium text-nilin-charcoal font-sans">{getCustomerLabel(customer)}</p>
              <p className="text-sm text-nilin-warmGray font-sans">
                {customer.email || `ID …${customer.userId.slice(-6)}`} · {customer.totalBookings} bookings ·{' '}
                {formatAED(customer.lifetimeValue)} LTV
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RiskBadge level={customer.riskLevel} />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {customer.riskScore}
            </span>
            {expanded ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            <Clock className="w-4 h-4 inline mr-1" />
            {customer.daysSinceLastBooking} days inactive
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            <Activity className="w-4 h-4 inline mr-1" />
            {(customer.confidence * 100).toFixed(0)}% confidence
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          {/* Risk Factors */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Risk Factors</h4>
            <div className="space-y-2">
              {customer.factors.map((factor, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {factor.name.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          factor.severity === 'high' ? 'bg-red-500' :
                          factor.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(factor.weight, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">{factor.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Actions */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recommended Actions</h4>
            <div className="space-y-2">
              {customer.recommendedActions.map((action, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center gap-3">
                    {action.type === 'offer' && <Gift className="w-5 h-5 text-purple-500" />}
                    {action.type === 'outreach' && <Phone className="w-5 h-5 text-blue-500" />}
                    {action.type === 'reengagement' && <Bell className="w-5 h-5 text-orange-500" />}
                    {action.type === 'feedback' && <MessageSquare className="w-5 h-5 text-gray-500" />}
                    {action.type === 'incentive' && <DollarSign className="w-5 h-5 text-green-500" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{action.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded ${
                      action.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {action.priority}
                    </span>
                    {onExecuteAction && (
                      <button
                        onClick={() => onExecuteAction(customer.userId, action)}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Execute
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Churn Report Component
// ============================================

const ChurnReport: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();

  const getInitialTab = (): ChurnTab => {
    const t = searchParams.get('tab');
    return t && VALID_TABS.has(t as ChurnTab) ? (t as ChurnTab) : 'at-risk';
  };

  const getInitialRisk = (): RiskFilter => {
    const r = searchParams.get('risk');
    if (r === 'critical' || r === 'high' || r === 'medium' || r === 'all') return r;
    return 'all';
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ChurnTab>(getInitialTab);
  const [churnRate, setChurnRate] = useState(0);

  const [stats, setStats] = useState<ChurnStats | null>(null);
  const [atRiskCustomers, setAtRiskCustomers] = useState<Array<ChurnRisk & { customerName?: string; email?: string }>>(
    []
  );
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [overview, setOverview] = useState<ChurnOverview | null>(null);

  const [riskFilter, setRiskFilter] = useState<RiskFilter>(getInitialRisk);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const syncUrl = useCallback(
    (tab: ChurnTab, risk: RiskFilter, q?: string) => {
      const params: Record<string, string> = { tab, risk };
      if (q?.trim()) params.q = q.trim();
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      if (isRefresh) {
        try {
          await churnApi.refreshChurnCache();
        } catch {
          // non-blocking
        }
      }

      const [adminStats, atRiskAdmin, segmentsData, overviewAdmin] = await Promise.all([
        churnApi.getChurnStatsAdmin(),
        churnApi.getAtRiskCustomersAdmin({ minRiskLevel: 'medium', limit: 200 }),
        churnApi.getCustomerSegments(),
        churnApi.getChurnOverviewAdmin(),
      ]);

      setStats({
        totalAtRisk: adminStats.atRiskCustomers,
        byRiskLevel: adminStats.byRiskLevel,
        averageRiskScore: adminStats.averageRiskScore,
        totalLifetimeValueAtRisk: adminStats.totalLifetimeValueAtRisk,
        topRiskFactors: adminStats.topRiskFactors.map((f) => ({ factor: f.factor, count: f.count })),
      });
      setChurnRate(adminStats.churnRate);
      setAtRiskCustomers(atRiskAdmin.customers.map(mapAdminCustomerToChurnRisk));
      setSegments(segmentsData);
      setOverview({
        atRiskCount: overviewAdmin.totalAtRisk,
        criticalCount: overviewAdmin.byRiskLevel.critical,
        highCount: overviewAdmin.byRiskLevel.high,
        mediumCount: overviewAdmin.byRiskLevel.medium,
        segments: segmentsData,
        recentAlerts: overviewAdmin.recentAlerts.map((a) => ({
          userId: a.customerId,
          customerName: a.customerName,
          riskLevel: a.riskLevel,
          riskScore: a.riskScore,
          daysSinceLastBooking: a.daysSinceLastBooking,
          recommendedAction: a.recommendedAction,
        })),
      });

      if (isRefresh) toast.success('Churn data refreshed');
    } catch (error) {
      console.error('Failed to fetch churn data:', error);
      toast.error('Failed to load churn data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredCustomers = atRiskCustomers.filter((customer) => {
    if (riskFilter !== 'all' && customer.riskLevel !== riskFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const haystack = [customer.userId, customer.email, customer.customerName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const hasAtRiskData = (stats?.totalAtRisk ?? 0) > 0;

  const handleTabChange = (tab: ChurnTab) => {
    setActiveTab(tab);
    syncUrl(tab, riskFilter, searchQuery);
  };

  const handleRiskFilter = (risk: RiskFilter) => {
    setRiskFilter(risk);
    syncUrl(activeTab, risk, searchQuery);
  };

  const handleExecuteAction = async (userId: string, action: RetentionAction) => {
    try {
      await churnApi.executeRetentionAction(userId, action);
      toast.success(`Action "${action.title}" executed for user`);
    } catch (error) {
      console.error('Failed to execute action:', error);
      toast.error('Failed to execute action');
    }
  };

  if (loading) {
    return (
      <AdminPageShell title="Churn & Retention" subtitle="Loading at-risk customers…">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-nilin-warmGray font-sans">Loading churn analysis…</p>
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Churn & Retention"
        subtitle={`At-risk customers & retention · ${churnRate.toFixed(1)}% churn rate (30 days)`}
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Churn', current: true },
        ]}
        headerActions={
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-nilin-charcoal text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              key: 'all' as const,
              label: 'Total at risk',
              value: stats?.totalAtRisk ?? 0,
              icon: AlertTriangle,
              accent: 'from-red-100/80 to-red-50 text-red-800',
            },
            {
              key: 'critical' as const,
              label: 'Critical',
              value: stats?.byRiskLevel.critical ?? 0,
              icon: XCircle,
              accent: 'from-red-200/80 to-red-100 text-red-900',
            },
            {
              key: 'avg' as const,
              label: 'Avg risk score',
              value: (stats?.averageRiskScore ?? 0).toFixed(0),
              icon: TrendingDown,
              accent: 'from-orange-100/80 to-orange-50 text-orange-800',
            },
            {
              key: 'ltv' as const,
              label: 'LTV at risk',
              value: formatAED(stats?.totalLifetimeValueAtRisk ?? 0),
              icon: DollarSign,
              accent: 'from-violet-100/80 to-violet-50 text-violet-800',
            },
          ].map((kpi) => (
            <button
              key={kpi.key}
              type="button"
              disabled={kpi.key === 'avg' || kpi.key === 'ltv'}
              onClick={() => {
                if (kpi.key === 'critical') handleRiskFilter('critical');
                else if (kpi.key === 'all') handleRiskFilter('all');
              }}
              className={cn(
                'glass glass-blur rounded-2xl border border-nilin-border/50 p-5 text-left transition-all',
                kpi.key !== 'avg' && kpi.key !== 'ltv' && 'hover:border-nilin-coral/40 cursor-pointer',
                (kpi.key === 'avg' || kpi.key === 'ltv') && 'cursor-default',
                kpi.key === 'critical' && riskFilter === 'critical' && 'ring-2 ring-nilin-coral/50'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray font-sans">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-serif text-nilin-charcoal mt-1">{kpi.value}</p>
                </div>
                <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center', kpi.accent)}>
                  <kpi.icon className="w-5 h-5" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {!hasAtRiskData && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-5 py-4">
            <p className="text-sm font-medium text-sky-900">No at-risk customers right now</p>
            <p className="text-sm text-sky-800 mt-1">
              Customers appear here when inactivity, declining bookings, or engagement drops push their churn score
              to medium or higher. With active bookings and recent logins, the queue stays empty — that is healthy.
            </p>
            <Link
              to="/admin/reports?tab=users"
              className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-sky-700 hover:text-sky-900"
            >
              View user analytics <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
          <div className="flex flex-wrap gap-2 p-4 border-b border-nilin-border/40">
            {(['at-risk', 'segments', 'overview'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => handleTabChange(tab)}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium font-sans transition-all',
                  activeTab === tab
                    ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-nilin-warm'
                    : 'border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/40'
                )}
              >
                {tab === 'at-risk' ? 'At-Risk Customers' : tab === 'segments' ? 'Customer Segments' : 'Overview'}
              </button>
            ))}
          </div>

        {activeTab === 'at-risk' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray" />
                <input
                  type="text"
                  placeholder="Search name, email, or customer ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    syncUrl(activeTab, riskFilter, e.target.value);
                  }}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {(['all', 'critical', 'high', 'medium'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => handleRiskFilter(level)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-sm font-medium font-sans border transition-all',
                      riskFilter === level
                        ? 'bg-nilin-charcoal text-white border-nilin-charcoal'
                        : 'border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/40'
                    )}
                  >
                    {level === 'all' ? 'All levels' : level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <CustomerCard
                    key={customer.userId}
                    customer={customer}
                    onExecuteAction={handleExecuteAction}
                  />
                ))
              ) : (
                <div className="text-center py-14">
                  <Users className="w-12 h-12 mx-auto text-nilin-border mb-3" />
                  <p className="text-nilin-charcoal font-medium font-sans">No at-risk customers in this view</p>
                  <p className="text-sm text-nilin-warmGray mt-1 font-sans">
                    {hasAtRiskData
                      ? 'Try a different risk filter or clear search.'
                      : 'Scores are calculated from booking and engagement signals.'}
                  </p>
                  {riskFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => handleRiskFilter('all')}
                      className="mt-3 text-sm font-medium text-nilin-coral hover:text-nilin-rose"
                    >
                      Show all risk levels
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'segments' && (
          <div className="p-4">
            {segments.length === 0 ? (
              <div className="text-center py-12 text-nilin-warmGray font-sans">No segments generated yet</div>
            ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment) => (
              <div
                key={segment.segmentId}
                className="rounded-xl border border-nilin-border/50 bg-white/60 p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{segment.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    segment.avgChurnRisk >= 60 ? 'bg-red-100 text-red-700' :
                    segment.avgChurnRisk >= 30 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {(segment.avgChurnRisk).toFixed(0)}% risk
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{segment.description}</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Customers</span>
                    <span className="font-medium text-gray-900 dark:text-white">{segment.customerCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Avg LTV</span>
                    <span className="font-medium text-gray-900 dark:text-white">{formatAED(segment.avgLifetimeValue)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Avg Bookings/Month</span>
                    <span className="font-medium text-gray-900 dark:text-white">{segment.characteristics.avgBookingsPerMonth.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="p-4 space-y-6">
            {/* Risk Distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Risk Level Distribution</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-red-600 dark:text-red-400">{overview?.criticalCount || 0}</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">Critical</p>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{overview?.highCount || 0}</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">High</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{overview?.mediumCount || 0}</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">Medium</p>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {(stats?.byRiskLevel.low || 0)}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">Low</p>
                </div>
              </div>
            </div>

            {/* Top Risk Factors */}
            {stats?.topRiskFactors && stats.topRiskFactors.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Risk Factors</h3>
                <div className="space-y-3">
                  {stats.topRiskFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 font-medium">
                          {idx + 1}
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white capitalize">
                          {factor.factor.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-gray-500 dark:text-gray-400">{factor.count} customers</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Alerts */}
            {overview?.recentAlerts && overview.recentAlerts.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Alerts</h3>
                <div className="space-y-3">
                  {overview.recentAlerts.map((alert, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {alert.customerName?.trim() || `Customer …${alert.userId.slice(-6)}`}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Score {alert.riskScore} · {alert.riskLevel}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {alert.daysSinceLastBooking} days inactive
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{alert.recommendedAction}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Recommended action</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ChurnReport;
