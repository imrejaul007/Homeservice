
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Shield,
  ShieldAlert,
  Ban,
  CheckCircle,
  RefreshCw,
  Flag,
  Eye,
  X,
  TrendingUp,
  TrendingDown,
  Users,
  BarChart3,
  Activity,
  Clock,
  DollarSign,
  Calendar,
  UserX,
  UserCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  customerOpsApi,
  getTierColor,
  getTierLabel,
  getRiskColor,
  getRiskLabel,
  getTrustScoreColor,
  getTrustScoreBgColor,
  formatFlagType,
  bulkUserActionApi,
  exportUsersApi,
  BulkUserAction,
} from '../../services/customerOpsApi';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import { useAuthStore } from '../../stores/authStore';
import type {
  CustomerListItem,
  CustomerMetrics,
  CustomerTier,
  RiskLevel,
  AbuseFlag,
  CustomerSearchFilters,
  DashboardStats,
  TrustScoreBreakdown,
} from '../../services/customerOpsApi';

// ============================================
// Components
// ============================================

// Trust Score Gauge Component
const TrustScoreGauge: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-20 h-20 text-xl',
    lg: 'w-32 h-32 text-3xl',
  };

  const strokeWidth = size === 'sm' ? 4 : size === 'md' ? 6 : 8;
  const radius = size === 'sm' ? 22 : size === 'md' ? 36 : 58;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getScoreColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#3b82f6';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className={`${sizeClasses[size]} relative`}>
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="50%"
          cy="50%"
          r={radius}
          fill="none"
          stroke={getScoreColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold ${getTrustScoreColor(score)}`}>{score}</span>
      </div>
    </div>
  );
};

// Tier Badge Component
const TierBadge: React.FC<{ tier: CustomerTier }> = ({ tier }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTierColor(tier)}`}>
    {getTierLabel(tier)}
  </span>
);

// Risk Badge Component
const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => (
  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(level)}`}>
    {getRiskLabel(level)}
  </span>
);

// Customer Card Component
const CustomerCard: React.FC<{
  customer: CustomerListItem;
  onClick: () => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}> = ({ customer, onClick, isSelected, onToggleSelect }) => {
  const { metrics, user } = customer;

  return (
    <div
      className={`bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-2 ${
        isSelected ? 'border-nilin-coral' : 'border-gray-100'
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Checkbox for bulk selection */}
        <div className="flex items-center h-12">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className="w-5 h-5 text-nilin-coral rounded border-gray-300 focus:ring-nilin-coral cursor-pointer"
          />
        </div>

        <div
          onClick={onClick}
          className="flex items-start gap-4 flex-1 cursor-pointer"
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-nilin-coral/10 flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt={user.firstName} className="w-full h-full object-cover" />
              ) : (
                <span className="text-nilin-coral font-semibold text-lg">
                  {user.firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            {metrics.isBlocked && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                <Ban className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-nilin-charcoal truncate">
                {user.firstName} {user.lastName}
              </h3>
              <TierBadge tier={metrics.tier} />
            </div>

            <p className="text-sm text-nilin-warmGray truncate mb-2">{user.email}</p>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <TrustScoreGauge score={metrics.trustScore} size="sm" />
                <span className="text-nilin-warmGray">Trust</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-nilin-warmGray" />
                <span className="text-nilin-warmGray">{metrics.totalBookings} bookings</span>
              </div>
              <RiskBadge level={metrics.riskLevel} />
            </div>

            {metrics.abuseCount > 0 && (
              <div className="mt-2 flex items-center gap-1 text-amber-600 text-xs">
                <AlertTriangle className="w-3 h-3" />
                <span>{metrics.abuseCount} unresolved flag(s)</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Filters Component
const FiltersPanel: React.FC<{
  filters: CustomerSearchFilters;
  onFiltersChange: (filters: CustomerSearchFilters) => void;
  stats: DashboardStats | null;
}> = ({ filters, onFiltersChange, stats }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchValue, setSearchValue] = useState(filters.search || '');

  const handleSearch = () => {
    onFiltersChange({ ...filters, search: searchValue || undefined });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const tiers: CustomerTier[] = ['new', 'regular', 'trusted', 'flagged', 'banned'];
  const riskLevels: RiskLevel[] = ['low', 'medium', 'high', 'critical'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent"
            />
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={() => onFiltersChange({})}
              className="px-4 py-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Expanded filters */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Tier filter */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Tier</label>
                <select
                  value={filters.tier || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      tier: e.target.value ? (e.target.value as CustomerTier) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="">All Tiers</option>
                  {tiers.map((tier) => (
                    <option key={tier} value={tier}>
                      {getTierLabel(tier)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Risk level filter */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Risk Level</label>
                <select
                  value={filters.riskLevel || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      riskLevel: e.target.value ? (e.target.value as RiskLevel) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="">All Risk Levels</option>
                  {riskLevels.map((level) => (
                    <option key={level} value={level}>
                      {getRiskLabel(level)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trust score range */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Min Trust Score
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={filters.minTrustScore || ''}
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      minTrustScore: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="0"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                />
              </div>

              {/* Blocked filter */}
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Status</label>
                <select
                  value={
                    filters.isBlocked === undefined
                      ? ''
                      : filters.isBlocked
                      ? 'blocked'
                      : 'active'
                  }
                  onChange={(e) =>
                    onFiltersChange({
                      ...filters,
                      isBlocked:
                        e.target.value === '' ? undefined : e.target.value === 'blocked',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                >
                  <option value="">All</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              {/* Has unresolved flags */}
              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.hasUnresolvedFlags || false}
                    onChange={(e) =>
                      onFiltersChange({
                        ...filters,
                        hasUnresolvedFlags: e.target.checked || undefined,
                      })
                    }
                    className="w-4 h-4 text-nilin-coral rounded focus:ring-nilin-coral"
                  />
                  <span className="text-sm text-nilin-charcoal">Show only with unresolved flags</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 rounded-b-xl">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-nilin-warmGray">
              <Users className="w-4 h-4 inline mr-1" />
              {stats.totalCustomers.toLocaleString()} customers
            </span>
            <span className="text-nilin-warmGray">
              <Shield className="w-4 h-4 inline mr-1" />
              Avg Trust: {stats.averageTrustScore}
            </span>
            <span className="text-nilin-warmGray">
              <AlertTriangle className="w-4 h-4 inline mr-1 text-amber-500" />
              {stats.tierDistribution.flagged || 0} flagged
            </span>
            <span className="text-nilin-warmGray">
              <Ban className="w-4 h-4 inline mr-1 text-red-500" />
              {stats.tierDistribution.banned || 0} banned
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// Customer Detail Modal Component
const CustomerDetailModal: React.FC<{
  customerId: string;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ customerId, onClose, onRefresh }) => {
  const [customer, setCustomer] = useState<any>(null);
  const [trustScoreBreakdown, setTrustScoreBreakdown] = useState<TrustScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'abuse' | 'actions'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagType, setFlagType] = useState<string>('');
  const [flagReason, setFlagReason] = useState('');
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const [detail, breakdown] = await Promise.all([
        customerOpsApi.getCustomerDetail(customerId),
        customerOpsApi.getTrustScoreBreakdown(customerId),
      ]);
      setCustomer(detail);
      setTrustScoreBreakdown(breakdown);
    } catch (error) {
      console.error('Failed to load customer:', error);
      toast.error('Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFlag = async () => {
    if (!flagType || !flagReason) return;
    setActionLoading(true);
    try {
      await customerOpsApi.addAbuseFlag(customerId, flagType as any, flagReason);
      setShowFlagModal(false);
      setFlagType('');
      setFlagReason('');
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      console.error('Failed to add flag:', error);
      toast.error('Failed to add abuse flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveFlag = async (flagIndex: number, notes: string) => {
    setActionLoading(true);
    try {
      await customerOpsApi.resolveAbuseFlag(customerId, flagIndex, notes);
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      console.error('Failed to resolve flag:', error);
      toast.error('Failed to resolve flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!blockReason) return;
    setActionLoading(true);
    try {
      await customerOpsApi.blockCustomer(customerId, blockReason);
      setBlockReason('');
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      console.error('Failed to block customer:', error);
      toast.error('Failed to block customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockCustomer = async () => {
    setActionLoading(true);
    try {
      await customerOpsApi.unblockCustomer(customerId);
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      console.error('Failed to unblock customer:', error);
      toast.error('Failed to unblock customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshScore = async () => {
    setActionLoading(true);
    try {
      const breakdown = await customerOpsApi.refreshTrustScore(customerId);
      setTrustScoreBreakdown(breakdown);
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      console.error('Failed to refresh trust score:', error);
      toast.error('Failed to refresh trust score');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || !customer) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral mb-4"></div>
            <p className="text-nilin-warmGray">Loading customer details...</p>
          </div>
        </div>
      </div>
    );
  }

  const { metrics, user, recentBookings, abuseHistory, recommendations } = customer;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center">
              {user.avatar ? (
                <img src={user.avatar} alt={user.firstName} className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-nilin-coral font-semibold text-2xl">
                  {user.firstName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-nilin-charcoal">
                {user.firstName} {user.lastName}
              </h2>
              <p className="text-nilin-warmGray">{user.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <TierBadge tier={metrics.tier} />
                <RiskBadge level={metrics.riskLevel} />
                {metrics.isBlocked && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                    Blocked
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-nilin-warmGray" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 px-6">
          <div className="flex gap-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'bookings', label: 'Bookings' },
              { id: 'abuse', label: 'Abuse History' },
              { id: 'actions', label: 'Actions' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-nilin-coral text-nilin-coral'
                    : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Trust Score */}
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-nilin-charcoal">Trust Score</h3>
                  <button
                    onClick={handleRefreshScore}
                    disabled={actionLoading}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className="flex items-center gap-6">
                  <TrustScoreGauge score={metrics.trustScore} size="lg" />
                  <div className="flex-1">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-nilin-warmGray">Base Score</span>
                        <span className="font-medium">{trustScoreBreakdown?.baseScore || 100}</span>
                      </div>
                      {trustScoreBreakdown?.deductions.slice(0, 5).map((d, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-nilin-warmGray">{d.category}</span>
                          <span className="text-red-600">-{d.amount.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {trustScoreBreakdown?.riskFactors && trustScoreBreakdown.riskFactors.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm font-medium text-nilin-charcoal mb-2">Risk Factors:</p>
                    <div className="flex flex-wrap gap-2">
                      {trustScoreBreakdown.riskFactors.map((factor, i) => (
                        <span key={i} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-nilin-charcoal mb-4">Behavior Metrics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-nilin-warmGray">Total Bookings</p>
                    <p className="text-2xl font-bold text-nilin-charcoal">{metrics.totalBookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-nilin-warmGray">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{metrics.completedBookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-nilin-warmGray">Cancelled</p>
                    <p className="text-2xl font-bold text-amber-600">{metrics.cancelledBookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-nilin-warmGray">No-Shows</p>
                    <p className="text-2xl font-bold text-red-600">{metrics.noShows}</p>
                  </div>
                  <div>
                    <p className="text-sm text-nilin-warmGray">Cancellation Rate</p>
                    <p className="text-2xl font-bold text-nilin-charcoal">{metrics.cancellationRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-nilin-warmGray">Avg. Booking Value</p>
                    <p className="text-2xl font-bold text-nilin-charcoal">
                      {metrics.averageBookingValue.toFixed(0)} AED
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div className="bg-blue-50 rounded-xl p-6 lg:col-span-2">
                  <h3 className="font-semibold text-nilin-charcoal mb-3">Recommendations</h3>
                  <ul className="space-y-2">
                    {recommendations.map((rec: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span className="text-nilin-charcoal">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4">
              {recentBookings.length === 0 ? (
                <p className="text-center text-nilin-warmGray py-8">No bookings found</p>
              ) : (
                recentBookings.map((booking: any) => (
                  <div key={booking.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-nilin-charcoal">{booking.service}</p>
                        <p className="text-sm text-nilin-warmGray">{booking.provider}</p>
                        <p className="text-sm text-nilin-warmGray">
                          {new Date(booking.scheduledDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-nilin-charcoal">{booking.totalAmount} AED</p>
                        <span
                          className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            booking.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : booking.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : booking.status === 'no_show'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'abuse' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-nilin-warmGray">Refunds</p>
                  <p className="text-2xl font-bold text-red-600">
                    {metrics.refundCount} ({metrics.refundRate.toFixed(1)}%)
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-nilin-warmGray">Chargebacks</p>
                  <p className="text-2xl font-bold text-red-600">{metrics.chargebackCount}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-nilin-warmGray">Suspicious Referrals</p>
                  <p className="text-2xl font-bold text-amber-600">{metrics.suspiciousReferrals}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-4">
                  <p className="text-sm text-nilin-warmGray">Coupon Abuse</p>
                  <p className="text-2xl font-bold text-amber-600">{metrics.couponAbuseCount}</p>
                </div>
              </div>

              {abuseHistory.length === 0 ? (
                <p className="text-center text-nilin-warmGray py-8">No abuse flags recorded</p>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-semibold text-nilin-charcoal">Flag History</h3>
                  {abuseHistory.map((flag: AbuseFlag, index: number) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 ${
                        flag.resolved ? 'bg-gray-50' : 'bg-red-50 border border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-nilin-charcoal">
                              {formatFlagType(flag.type)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                flag.resolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {flag.resolved ? 'Resolved' : 'Active'}
                            </span>
                          </div>
                          <p className="text-sm text-nilin-warmGray mt-1">{flag.reason}</p>
                          <p className="text-xs text-nilin-warmGray mt-2">
                            {new Date(flag.createdAt).toLocaleDateString()}
                            {flag.resolved && flag.resolvedAt && (
                              <> | Resolved: {new Date(flag.resolvedAt).toLocaleDateString()}</>
                            )}
                          </p>
                        </div>
                        {!flag.resolved && (
                          <button
                            onClick={() => handleResolveFlag(index, 'Resolved by admin')}
                            disabled={actionLoading}
                            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'actions' && (
            <div className="space-y-6">
              {/* Add Flag */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-nilin-charcoal mb-4 flex items-center gap-2">
                  <Flag className="w-5 h-5 text-nilin-coral" />
                  Add Abuse Flag
                </h3>
                <button
                  onClick={() => setShowFlagModal(true)}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Add New Flag
                </button>
              </div>

              {/* Block/Unblock */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-nilin-charcoal mb-4 flex items-center gap-2">
                  {metrics.isBlocked ? (
                    <>
                      <UserCheck className="w-5 h-5 text-green-500" />
                      Unblock Customer
                    </>
                  ) : (
                    <>
                      <UserX className="w-5 h-5 text-red-500" />
                      Block Customer
                    </>
                  )}
                </h3>
                {metrics.isBlocked ? (
                  <button
                    onClick={handleUnblockCustomer}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    Unblock Customer
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Reason for blocking..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <button
                      onClick={handleBlockCustomer}
                      disabled={actionLoading || !blockReason}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                    >
                      Block Customer
                    </button>
                  </div>
                )}
              </div>

              {/* Refresh Trust Score */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-nilin-charcoal mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-nilin-coral" />
                  Refresh Trust Score
                </h3>
                <p className="text-sm text-nilin-warmGray mb-4">
                  Recalculate trust score based on current metrics and behavior data.
                </p>
                <button
                  onClick={handleRefreshScore}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors disabled:opacity-50"
                >
                  Refresh Score
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Flag Modal */}
      {showFlagModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Add Abuse Flag</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Flag Type</label>
                <select
                  value={flagType}
                  onChange={(e) => setFlagType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                >
                  <option value="">Select type...</option>
                  <option value="high_refund_rate">High Refund Rate</option>
                  <option value="chargeback">Chargeback</option>
                  <option value="coupon_abuse">Coupon Abuse</option>
                  <option value="fake_referral">Fake Referral</option>
                  <option value="suspicious_activity">Suspicious Activity</option>
                  <option value="spam">Spam</option>
                  <option value="fake_review">Fake Review</option>
                  <option value="multiple_accounts">Multiple Accounts</option>
                  <option value="payment_fraud">Payment Fraud</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">Reason</label>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Describe the reason for this flag..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowFlagModal(false);
                    setFlagType('');
                    setFlagReason('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddFlag}
                  disabled={actionLoading || !flagType || !flagReason}
                  className="flex-1 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
                >
                  {actionLoading ? 'Adding...' : 'Add Flag'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const CustomerManagement: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [filters, setFilters] = useState<CustomerSearchFilters>({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('trustScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Bulk selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<BulkUserAction | null>(null);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  // Select all visible users
  const selectAllVisibleUsers = () => {
    if (selectedUserIds.size === customers.length) {
      setSelectedUserIds(new Set());
    } else {
      setSelectedUserIds(new Set(customers.map((c) => c.user.id)));
    }
  };

  // Handle bulk action
  const handleBulkAction = async () => {
    if (!pendingBulkAction || selectedUserIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const result = await bulkUserActionApi(
        pendingBulkAction,
        Array.from(selectedUserIds)
      );
      if (result.success) {
        setSelectedUserIds(new Set());
        await loadCustomers();
      }
    } catch (error) {
      console.error('Bulk action failed:', error);
      toast.error('Bulk action failed. Please try again.');
    } finally {
      setBulkActionLoading(false);
      setShowBulkActionModal(false);
      setPendingBulkAction(null);
    }
  };

  // Export users to CSV
  const handleExportUsers = async () => {
    try {
      await exportUsersApi({
        status: filters.isBlocked === undefined ? undefined : filters.isBlocked ? 'suspended' : 'active',
        role: 'customer',
      });
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
    }
  };

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await customerOpsApi.getCustomerList({
        filters,
        page: pagination.page,
        limit: 20,
        sortBy,
        sortOrder,
      });
      setCustomers(result.customers);
      setPagination({ page: result.page, pages: result.pages, total: result.total });
      setStats(result.stats as DashboardStats);
    } catch (error) {
      console.error('Failed to load customers:', error);
      toast.error('Failed to load customers. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, sortBy, sortOrder]);

  const loadStats = useCallback(async () => {
    try {
      const dashboardStats = await customerOpsApi.getDashboardStats();
      setStats((prev) =>
        prev
          ? {
              ...dashboardStats,
              totalCustomers: prev.totalCustomers,
              averageTrustScore: prev.averageTrustScore,
              tierDistribution: prev.tierDistribution,
              riskDistribution: prev.riskDistribution,
            }
          : dashboardStats
      );
    } catch (error) {
      console.error('Failed to load stats:', error);
      toast.error('Failed to load statistics');
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  const handleFiltersChange = (newFilters: CustomerSearchFilters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-nilin-cream">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-nilin-charcoal mb-2">Customer Management</h1>
          <p className="text-nilin-warmGray">
            Monitor customer trust scores, detect abuse patterns, and manage customer tiers
          </p>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">Total Customers</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {stats.totalCustomers.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">Avg Trust Score</p>
                  <p className="text-xl font-bold text-nilin-charcoal">{stats.averageTrustScore}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">Flagged</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {stats.tierDistribution.flagged || 0}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-nilin-warmGray">High Risk</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {(stats.riskDistribution.high || 0) + (stats.riskDistribution.critical || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <FiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          stats={stats}
        />

        {/* Bulk Action Toolbar */}
        {selectedUserIds.size > 0 && (
          <div className="bg-nilin-coral/10 border border-nilin-coral/20 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-nilin-charcoal font-medium">
                  {selectedUserIds.size} user{selectedUserIds.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={() => setSelectedUserIds(new Set())}
                  className="text-sm text-nilin-warmGray hover:text-nilin-charcoal"
                >
                  Clear selection
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPendingBulkAction('activate');
                    setShowBulkActionModal(true);
                  }}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  Activate
                </button>
                <button
                  onClick={() => {
                    setPendingBulkAction('deactivate');
                    setShowBulkActionModal(true);
                  }}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
                >
                  <Ban className="w-4 h-4" />
                  Deactivate
                </button>
                <button
                  onClick={() => {
                    setPendingBulkAction('suspend');
                    setShowBulkActionModal(true);
                  }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <UserX className="w-4 h-4" />
                  Suspend
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Customer List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral"></div>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <Users className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">No customers found</h3>
            <p className="text-nilin-warmGray">
              Try adjusting your filters or search criteria
            </p>
          </div>
        ) : (
          <>
            {/* Header with export and select all */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selectedUserIds.size === customers.length && customers.length > 0}
                  onChange={selectAllVisibleUsers}
                  className="w-5 h-5 text-nilin-coral rounded border-gray-300 focus:ring-nilin-coral cursor-pointer"
                />
                <span className="text-sm text-nilin-warmGray">
                  {selectedUserIds.size === customers.length && customers.length > 0
                    ? 'Deselect all'
                    : 'Select all on this page'}
                </span>
              </div>
              <button
                onClick={handleExportUsers}
                className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <BarChart3 className="w-4 h-4" />
                Export CSV
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {customers.map((customer) => (
                <CustomerCard
                  key={customer.metrics._id}
                  customer={customer}
                  onClick={() => setSelectedCustomerId(customer.user.id)}
                  isSelected={selectedUserIds.has(customer.user.id)}
                  onToggleSelect={() => toggleUserSelection(customer.user.id)}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-nilin-warmGray">
                  Showing {(pagination.page - 1) * 20 + 1} to{' '}
                  {Math.min(pagination.page * 20, pagination.total)} of {pagination.total} customers
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm text-nilin-charcoal">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onRefresh={loadCustomers}
        />
      )}

      {/* Bulk Action Confirmation Modal */}
      {showBulkActionModal && pendingBulkAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              {pendingBulkAction === 'activate' && (
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
              )}
              {pendingBulkAction === 'deactivate' && (
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Ban className="w-5 h-5 text-amber-600" />
                </div>
              )}
              {pendingBulkAction === 'suspend' && (
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <UserX className="w-5 h-5 text-red-600" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-nilin-charcoal">
                Confirm {pendingBulkAction.charAt(0).toUpperCase() + pendingBulkAction.slice(1)}
              </h3>
            </div>
            <p className="text-nilin-warmGray mb-6">
              Are you sure you want to {pendingBulkAction}{' '}
              <span className="font-semibold text-nilin-charcoal">{selectedUserIds.size}</span> selected
              user{selectedUserIds.size !== 1 ? 's' : ''}?
              {pendingBulkAction === 'suspend' && (
                <span className="block mt-2 text-amber-600">
                  Suspended users will not be able to access their accounts.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBulkActionModal(false);
                  setPendingBulkAction(null);
                }}
                disabled={bulkActionLoading}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkAction}
                disabled={bulkActionLoading}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                  pendingBulkAction === 'activate'
                    ? 'bg-green-500 hover:bg-green-600'
                    : pendingBulkAction === 'deactivate'
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {bulkActionLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
};

export default CustomerManagement;
