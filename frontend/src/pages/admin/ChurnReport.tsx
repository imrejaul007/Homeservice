import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { churnApi } from '../../services/analyticsApi';
import type { ChurnRisk, ChurnStats, CustomerSegment, ChurnOverview, RetentionAction } from '../../services/analyticsApi';
import PageLayout from '../../components/layout/PageLayout';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
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
  customer: ChurnRisk;
  onExecuteAction?: (userId: string, action: RetentionAction) => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, onExecuteAction }) => {
  const [expanded, setExpanded] = useState(false);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <Users className="w-5 h-5 text-gray-500" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Customer {customer.userId.slice(-6)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {customer.totalBookings} bookings | {formatCurrency(customer.lifetimeValue)} LTV
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
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'at-risk' | 'segments' | 'overview'>('at-risk');

  // Data states
  const [stats, setStats] = useState<ChurnStats | null>(null);
  const [atRiskCustomers, setAtRiskCustomers] = useState<ChurnRisk[]>([]);
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [overview, setOverview] = useState<ChurnOverview | null>(null);

  // Filter states
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, atRiskData, segmentsData, overviewData] = await Promise.all([
        churnApi.getChurnStats(),
        churnApi.getAtRiskCustomers({ minRiskLevel: 'medium', limit: 100 }),
        churnApi.getCustomerSegments(),
        churnApi.getChurnOverview(),
      ]);

      setStats(statsData);
      setAtRiskCustomers(atRiskData.customers);
      setSegments(segmentsData);
      setOverview(overviewData);
    } catch (error) {
      console.error('Failed to fetch churn data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const filteredCustomers = atRiskCustomers.filter(customer => {
    if (riskFilter !== 'all' && customer.riskLevel !== riskFilter) return false;
    if (searchQuery && !customer.userId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
        title="Churn & Retention"
        subtitle="Identify at-risk customers and execute retention campaigns"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Churn', current: true },
        ]}
        headerActions={
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      >
      <div className="space-y-6">

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total At Risk</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.totalAtRisk || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Critical Risk</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {stats?.byRiskLevel.critical || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-200 dark:bg-red-900/50 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-700 dark:text-red-300" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Risk Score</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {(stats?.averageRiskScore || 0).toFixed(0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">LTV at Risk</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {formatCurrency(stats?.totalLifetimeValueAtRisk || 0)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4">
            {(['at-risk', 'segments', 'overview'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'at-risk' ? 'At-Risk Customers' : tab === 'segments' ? 'Customer Segments' : 'Overview'}
              </button>
            ))}
          </nav>
        </div>

        {/* At-Risk Tab */}
        {activeTab === 'at-risk' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search by customer ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as typeof riskFilter)}
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Risk Levels</option>
                <option value="critical">Critical Only</option>
                <option value="high">High Risk</option>
                <option value="medium">Medium Risk</option>
              </select>
            </div>

            {/* Customer List */}
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
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">No at-risk customers found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Segments Tab */}
        {activeTab === 'segments' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment) => (
              <div
                key={segment.segmentId}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
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
                    <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(segment.avgLifetimeValue)}</span>
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
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
                            Score: {alert.riskScore} ({alert.riskLevel})
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
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ChurnReport;
