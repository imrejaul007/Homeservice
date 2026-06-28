
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ActivityTimeline } from '../../components/admin/ActivityTimeline';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import type { Activity, ActivityType } from '../../types/activity';
import {
  Search,
  Filter,
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
  Clock,
  DollarSign,
  Calendar,
  UserX,
  UserCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  MapPin,
  MapPinOff,
  CreditCard,
  RotateCcw,
  Star,
  User,
  Tag,
  MessageCircle,
  LogIn,
  LogOut,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  Send,
  Mail,
  Building,
  Home,
  Briefcase,
  Activity as ActivityIcon,
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
  BookingStatus,
  formatBookingStatus,
  getBookingStatusColor,
  CustomerAddress,
  MaskedPaymentMethod,
  formatPaymentMethod,
  formatPaymentMethodExpiry,
  ActivityItem,
  formatActivityType,
  Message,
} from '../../services/customerOpsApi';
import { useAuthStore } from '../../stores/authStore';
import { ExportDropdown } from '../../components/admin/ExportDropdown';
import { AdminPagination } from '../../components/admin/AdminPagination';
import {
  BulkActionToolbar,
  type BulkAction,
} from '../../components/admin/BulkActionToolbar';
import type {
  CustomerListItem,
  CustomerMetrics,
  CustomerTier,
  RiskLevel,
  AbuseFlag,
  CustomerSearchFilters,
  DashboardStats,
  TrustScoreBreakdown,
  CustomerDetailResponse,
  BookingListResponse,
  ActivityListResponse,
  MessageListResponse,
  RecentBooking,
  CustomerAddress,
  MaskedPaymentMethod,
  ActivityItem,
  BookingStatus,
  Message,
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

        <button
          type="button"
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          aria-label={`View details for ${user.firstName} ${user.lastName}`}
          className="flex items-start gap-4 flex-1 w-full text-left cursor-pointer hover:bg-gray-50 rounded-lg p-2 -m-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
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
        </button>
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
  const [customer, setCustomer] = useState<CustomerDetailResponse | null>(null);
  const [trustScoreBreakdown, setTrustScoreBreakdown] = useState<TrustScoreBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  type CustomerDetailTab = 'overview' | 'bookings' | 'addresses' | 'payments' | 'activity' | 'abuse' | 'actions';
  const [activeTab, setActiveTab] = useState<CustomerDetailTab>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagType, setFlagType] = useState<string>('');
  const [flagReason, setFlagReason] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [showBlockConfirmModal, setShowBlockConfirmModal] = useState(false);

  // Addresses state
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<MaskedPaymentMethod[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Bookings state (paginated)
  const [bookings, setBookings] = useState<RecentBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsPagination, setBookingsPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [bookingStatusFilter, setBookingStatusFilter] = useState<string>('');
  const [bookingStartDate, setBookingStartDate] = useState<string>('');
  const [bookingEndDate, setBookingEndDate] = useState<string>('');

  // Activity state (paginated)
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesPagination, setActivitiesPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    hasNext: false,
    hasPrev: false,
  });

  // Message state
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageContent, setMessageContent] = useState('');
  const [messageHistory, setMessageHistory] = useState<Message[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  useEffect(() => {
    if (activeTab === 'addresses' && customerId) {
      loadAddresses();
    }
  }, [activeTab, customerId]);

  useEffect(() => {
    if (activeTab === 'payments' && customerId) {
      loadPaymentMethods();
    }
  }, [activeTab, customerId]);

  useEffect(() => {
    if (activeTab === 'bookings' && customerId) {
      loadBookings(1);
    }
  }, [activeTab, customerId]);

  useEffect(() => {
    if (activeTab === 'activity' && customerId) {
      loadActivities(1);
    }
  }, [activeTab, customerId]);

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
      // Detect network errors with timeout detection
      const isNetworkError =
        !navigator.onLine ||
        error instanceof TypeError ||
        (error as Error)?.message?.includes('NetworkError') ||
        (error as Error)?.message?.includes('Failed to fetch') ||
        (error as Error)?.message?.includes('timeout') ||
        (error as { code?: string })?.code === 'ETIMEDOUT' ||
        (error as { code?: string })?.code === 'ECONNABORTED';

      // Retry logic for transient failures
      const shouldRetry =
        (error as { response?: { status?: number } })?.response?.status === 0 ||
        ((error as { response?: { status?: number } })?.response?.status ?? 0) >= 500;

      if (isNetworkError) {
        toast.error('Connection error', { description: 'Please check your internet connection and try again' });
      } else if (shouldRetry) {
        toast.error('Server error', { description: 'Please try again in a moment' });
      } else {
        toast.error(error instanceof Error ? error.message : 'Failed to load customer details');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadAddresses = async () => {
    setAddressesLoading(true);
    try {
      const result = await customerOpsApi.getCustomerAddresses(customerId);
      setAddresses(result);
    } catch (error) {
      toast.error('Failed to load addresses');
    } finally {
      setAddressesLoading(false);
    }
  };

  const loadPaymentMethods = async () => {
    setPaymentsLoading(true);
    try {
      const result = await customerOpsApi.getCustomerPaymentMethods(customerId);
      setPaymentMethods(result);
    } catch (error) {
      toast.error('Failed to load payment methods');
    } finally {
      setPaymentsLoading(false);
    }
  };

  const loadBookings = async (page: number = 1) => {
    setBookingsLoading(true);
    try {
      const status = bookingStatusFilter ? bookingStatusFilter as BookingStatus : undefined;
      const result = await customerOpsApi.getCustomerBookings(customerId, {
        page,
        limit: 10,
        status,
        startDate: bookingStartDate || undefined,
        endDate: bookingEndDate || undefined,
      });
      setBookings(result.bookings);
      setBookingsPagination({
        page: result.pagination.page,
        pages: result.pagination.pages,
        total: result.pagination.total,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
      });
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setBookingsLoading(false);
    }
  };

  const loadActivities = async (page: number = 1) => {
    setActivitiesLoading(true);
    try {
      const result = await customerOpsApi.getCustomerActivity(customerId, {
        page,
        limit: 15,
      });
      setActivities(result.activities);
      setActivitiesPagination({
        page: result.pagination.page,
        pages: result.pagination.pages,
        total: result.pagination.total,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev,
      });
    } catch (error) {
      toast.error('Failed to load activity');
    } finally {
      setActivitiesLoading(false);
    }
  };

  const loadMessageHistory = async () => {
    setMessageLoading(true);
    try {
      const result = await customerOpsApi.getCustomerMessages(customerId, { limit: 50 });
      setMessageHistory(result.messages);
    } catch (error) {
      toast.error('Failed to load message history');
    } finally {
      setMessageLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim()) return;
    setMessageSending(true);
    try {
      await customerOpsApi.sendCustomerMessage(customerId, messageContent);
      toast.success('Message sent successfully');
      setMessageContent('');
      setShowMessageModal(false);
      await loadMessageHistory();
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setMessageSending(false);
    }
  };

  const handleBookingFilterChange = (status: string) => {
    setBookingStatusFilter(status);
    if (activeTab === 'bookings') {
      loadBookings(1);
    }
  };

  const handleBookingDateChange = (startDate: string, endDate: string) => {
    setBookingStartDate(startDate);
    setBookingEndDate(endDate);
    if (activeTab === 'bookings') {
      loadBookings(1);
    }
  };

  const handleAddFlag = async () => {
    if (!flagType || !flagReason) return;
    setActionLoading(true);
    try {
      await customerOpsApi.addAbuseFlag(customerId, flagType as AbuseFlagType, flagReason);
      setShowFlagModal(false);
      setFlagType('');
      setFlagReason('');
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add abuse flag');
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
      toast.error(error instanceof Error ? error.message : 'Failed to resolve flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!blockReason) return;
    setActionLoading(true);
    try {
      await customerOpsApi.blockCustomer(customerId, blockReason);
      toast.success('Customer blocked successfully');
      setBlockReason('');
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to block customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockCustomer = async () => {
    setActionLoading(true);
    try {
      await customerOpsApi.unblockCustomer(customerId);
      toast.success('Customer unblocked successfully');
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unblock customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefreshScore = async () => {
    setActionLoading(true);
    try {
      const breakdown = await customerOpsApi.refreshTrustScore(customerId);
      toast.success('Trust score refreshed successfully');
      setTrustScoreBreakdown(breakdown);
      await loadCustomerData();
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to refresh trust score');
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowMessageModal(true);
                loadMessageHistory();
              }}
              className="px-3 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors flex items-center gap-2 text-sm"
            >
              <Mail className="w-4 h-4" />
              Message
            </button>
            <button
              onClick={onClose}
              aria-label="Close customer details"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 px-6 overflow-x-auto">
          <div role="tablist" aria-label="Customer details tabs" className="flex gap-1 min-w-max">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'bookings', label: 'Bookings' },
              { id: 'addresses', label: 'Addresses' },
              { id: 'payments', label: 'Payments' },
              { id: 'activity', label: 'Activity' },
              { id: 'abuse', label: 'Abuse' },
              { id: 'actions', label: 'Actions' },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`customer-tab-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id as CustomerDetailTab)}
                className={`py-3 px-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
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
              {/* Filters */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="booking-status-filter" className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Status
                    </label>
                    <select
                      id="booking-status-filter"
                      value={bookingStatusFilter}
                      onChange={(e) => handleBookingFilterChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="no_show">No Show</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="booking-start-date" className="block text-sm font-medium text-nilin-charcoal mb-1">
                      Start Date
                    </label>
                    <input
                      id="booking-start-date"
                      type="date"
                      value={bookingStartDate}
                      onChange={(e) => handleBookingDateChange(e.target.value, bookingEndDate)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-end-date" className="block text-sm font-medium text-nilin-charcoal mb-1">
                      End Date
                    </label>
                    <input
                      id="booking-end-date"
                      type="date"
                      value={bookingEndDate}
                      onChange={(e) => handleBookingDateChange(bookingStartDate, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => {
                        setBookingStatusFilter('');
                        setBookingStartDate('');
                        setBookingEndDate('');
                        loadBookings(1);
                      }}
                      className="px-4 py-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors text-sm"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Bookings count */}
              <p className="text-sm text-nilin-warmGray">
                {bookingsPagination.total} booking{bookingsPagination.total !== 1 ? 's' : ''} found
              </p>

              {bookingsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Calendar className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" />
                  <p className="text-nilin-warmGray">No bookings found</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="bg-gray-50 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-nilin-charcoal">{booking.service}</p>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getBookingStatusColor(booking.status)}`}>
                                {formatBookingStatus(booking.status)}
                              </span>
                            </div>
                            <p className="text-sm text-nilin-warmGray">{booking.provider}</p>
                            <p className="text-sm text-nilin-warmGray">
                              {new Date(booking.scheduledDate).toLocaleDateString()}
                              {booking.completedDate && ` - ${new Date(booking.completedDate).toLocaleDateString()}`}
                            </p>
                            {booking.bookingNumber && (
                              <p className="text-xs text-nilin-warmGray mt-1">#{booking.bookingNumber}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-nilin-charcoal">
                              {booking.totalAmount} {booking.currency || 'AED'}
                            </p>
                            {booking.paymentStatus && (
                              <p className="text-xs text-nilin-warmGray mt-1">
                                Payment: {booking.paymentStatus}
                              </p>
                            )}
                          </div>
                        </div>
                        {booking.notes && (
                          <p className="text-xs text-nilin-warmGray mt-2 italic">{booking.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {bookingsPagination.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        onClick={() => loadBookings(1)}
                        disabled={!bookingsPagination.hasPrev}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => loadBookings(bookingsPagination.page - 1)}
                        disabled={!bookingsPagination.hasPrev}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-1 text-sm text-nilin-charcoal">
                        Page {bookingsPagination.page} of {bookingsPagination.pages}
                      </span>
                      <button
                        onClick={() => loadBookings(bookingsPagination.page + 1)}
                        disabled={!bookingsPagination.hasNext}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => loadBookings(bookingsPagination.pages)}
                        disabled={!bookingsPagination.hasNext}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Last
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Addresses Tab */}
          {activeTab === 'addresses' && (
            <div className="space-y-4">
              {addressesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <MapPin className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" />
                  <p className="text-nilin-warmGray">No saved addresses</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {addresses.map((address) => (
                    <div key={address.id} className="bg-gray-50 rounded-xl p-4 relative">
                      {address.isDefault && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral rounded text-xs font-medium">
                          Default
                        </span>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-100 text-blue-600">
                          {address.type === 'home' ? <Home className="w-5 h-5" /> : address.type === 'work' ? <Briefcase className="w-5 h-5" /> : <Building className="w-5 h-5" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-nilin-charcoal">{address.label}</span>
                            <span className="text-xs text-nilin-warmGray capitalize">({address.type})</span>
                          </div>
                          <p className="text-sm text-nilin-warmGray">{address.address}</p>
                          {(address.building || address.apartment || address.floor) && (
                            <p className="text-sm text-nilin-warmGray mt-1">
                              {[address.building && `Bldg ${address.building}`, address.apartment && `Apt ${address.apartment}`, address.floor && `Floor ${address.floor}`].filter(Boolean).join(', ')}
                            </p>
                          )}
                          {address.instructions && (
                            <p className="text-xs text-nilin-warmGray mt-2 italic">{address.instructions}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Payments Tab */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              {paymentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
                </div>
              ) : paymentMethods.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <CreditCard className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" />
                  <p className="text-nilin-warmGray">No payment methods saved</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="bg-gray-50 rounded-xl p-4 relative">
                      {method.isDefault && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral rounded text-xs font-medium">
                          Default
                        </span>
                      )}
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100 text-green-600">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-nilin-charcoal capitalize">{method.type}</span>
                            {method.brand && (
                              <span className="text-xs text-nilin-warmGray">{method.brand}</span>
                            )}
                          </div>
                          <p className="text-lg font-mono text-nilin-charcoal">
                            **** **** **** {method.last4}
                          </p>
                          {method.expiryMonth && method.expiryYear && (
                            <p className="text-sm text-nilin-warmGray mt-1">
                              Expires: {formatPaymentMethodExpiry(method)}
                            </p>
                          )}
                          <p className="text-xs text-nilin-warmGray mt-2">
                            Added: {new Date(method.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-nilin-charcoal">Activity History</h3>
                <p className="text-sm text-nilin-warmGray">
                  {activitiesPagination.total} activit{activitiesPagination.total !== 1 ? 'ies' : 'y'} recorded
                </p>
              </div>

              {activitiesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <ActivityIcon className="w-12 h-12 text-nilin-warmGray mx-auto mb-4" />
                  <p className="text-nilin-warmGray">No activity recorded for this customer</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {activities.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-4 bg-gray-50 rounded-lg p-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          activity.type.includes('login') ? 'bg-blue-100 text-blue-600' :
                          activity.type.includes('booking') ? 'bg-purple-100 text-purple-600' :
                          activity.type.includes('payment') || activity.type.includes('refund') ? 'bg-green-100 text-green-600' :
                          activity.type.includes('review') ? 'bg-yellow-100 text-yellow-600' :
                          activity.type.includes('flag') ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          <ActivityIcon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-medium text-nilin-charcoal">{activity.title}</p>
                            <span className="text-xs text-nilin-warmGray whitespace-nowrap">
                              {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-nilin-warmGray mt-1">{activity.description}</p>
                          {activity.ipAddress && (
                            <p className="text-xs text-nilin-warmGray mt-1">IP: {activity.ipAddress}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {activitiesPagination.pages > 1 && (
                    <div className="flex items-center justify-center gap-2 pt-4">
                      <button
                        onClick={() => loadActivities(1)}
                        disabled={!activitiesPagination.hasPrev}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        First
                      </button>
                      <button
                        onClick={() => loadActivities(activitiesPagination.page - 1)}
                        disabled={!activitiesPagination.hasPrev}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-1 text-sm text-nilin-charcoal">
                        Page {activitiesPagination.page} of {activitiesPagination.pages}
                      </span>
                      <button
                        onClick={() => loadActivities(activitiesPagination.page + 1)}
                        disabled={!activitiesPagination.hasNext}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Next
                      </button>
                      <button
                        onClick={() => loadActivities(activitiesPagination.pages)}
                        disabled={!activitiesPagination.hasNext}
                        className="px-3 py-1 rounded border border-gray-200 disabled:opacity-50 hover:bg-gray-50 transition-colors text-sm"
                      >
                        Last
                      </button>
                    </div>
                  )}
                </>
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
                    <p className="text-sm text-nilin-warmGray mb-2">
                      Blocking will prevent this customer from accessing their account.
                    </p>
                    <button
                      onClick={() => setShowBlockConfirmModal(true)}
                      disabled={actionLoading}
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

      {/* Message Modal */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-nilin-charcoal">Message Customer</h3>
              <button
                onClick={() => setShowMessageModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            {/* Message History */}
            {messageLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-nilin-coral"></div>
              </div>
            ) : messageHistory.length > 0 ? (
              <div className="flex-1 overflow-y-auto mb-4 max-h-48 bg-gray-50 rounded-lg p-3 space-y-3">
                {messageHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${
                      msg.senderType === 'admin'
                        ? 'bg-nilin-coral/10 ml-8'
                        : 'bg-white mr-8 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm text-nilin-charcoal">{msg.content}</p>
                    <p className="text-xs text-nilin-warmGray mt-1">
                      {msg.senderType === 'admin' ? 'You' : 'Customer'} - {new Date(msg.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Message Input */}
            <div className="space-y-4">
              <div>
                <label htmlFor="message-content" className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Your Message
                </label>
                <textarea
                  id="message-content"
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Type your message here..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowMessageModal(false);
                    setMessageContent('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={messageSending || !messageContent.trim()}
                  className="flex-1 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  {messageSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
          <div
            className="bg-white rounded-xl p-6 max-w-md w-full animate-scale-in shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="block-confirm-title"
          >
            {/* Warning Icon */}
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>

            {/* Title */}
            <h3
              id="block-confirm-title"
              className="text-lg font-semibold text-nilin-charcoal text-center mb-2"
            >
              Block Customer?
            </h3>

            {/* Description */}
            <p className="text-sm text-nilin-warmGray text-center mb-4">
              This will prevent {user.firstName} {user.lastName} from accessing their account.
              You can unblock them at any time.
            </p>

            {/* Reason Input */}
            <div className="mb-6">
              <label
                htmlFor="block-reason-input"
                className="block text-sm font-medium text-nilin-charcoal mb-2"
              >
                Reason for blocking <span className="text-red-500">*</span>
              </label>
              <textarea
                id="block-reason-input"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Enter the reason for blocking this customer..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent resize-none"
                autoFocus
              />
              {!blockReason && (
                <p className="mt-1.5 text-sm text-red-500" role="alert">
                  Please provide a reason for blocking this customer.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowBlockConfirmModal(false);
                  setBlockReason('');
                }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockCustomer}
                disabled={actionLoading || !blockReason.trim()}
                className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {actionLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Blocking...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Block Customer
                  </>
                )}
              </button>
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
  // Use stable user.id (not array index) so re-renders with shuffled data
  // don't deselect the wrong rows.
  const visibleUserIds = useMemo(
    () => customers.map((c) => c.user.id).filter((id): id is string => Boolean(id)),
    [customers]
  );

  const allVisibleSelected = useMemo(
    () => visibleUserIds.length > 0 && visibleUserIds.every((id) => selectedUserIds.has(id)),
    [visibleUserIds, selectedUserIds]
  );

  const selectAllVisibleUsers = () => {
    if (allVisibleSelected) {
      // Only deselect the currently visible users; preserve any selection
      // that exists outside the current page (e.g., a future multi-page select).
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        visibleUserIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        visibleUserIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  // Define bulk actions
  const bulkActions: BulkAction[] = [
    {
      id: 'activate',
      label: 'Activate',
      icon: <CheckCircle className="w-4 h-4" />,
      variant: 'success',
    },
    {
      id: 'deactivate',
      label: 'Deactivate',
      icon: <Ban className="w-4 h-4" />,
      variant: 'warning',
    },
    {
      id: 'suspend',
      label: 'Suspend',
      icon: <UserX className="w-4 h-4" />,
      variant: 'danger',
      requiresConfirm: true,
      confirmTitle: 'Confirm Suspension',
      confirmDescription: 'Suspended users will not be able to access their accounts.',
    },
  ];

  // Handle bulk action
  const handleBulkAction = async (actionId: string) => {
    if (selectedUserIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      const result = await bulkUserActionApi(
        actionId as BulkUserAction,
        Array.from(selectedUserIds)
      );
      if (result.success) {
        setSelectedUserIds(new Set());
        await loadCustomers();
      } else {
        toast.error(result.failed?.length ? `Failed to update ${result.failed.length} accounts` : 'Bulk action failed');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk action failed. Please try again.');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Export users state
  const [isExporting, setIsExporting] = useState(false);

  // Export users
  const handleExportUsers = async (format: 'csv' | 'excel' | 'pdf') => {
    setIsExporting(true);
    try {
      await exportUsersApi({
        format,
        status: filters.isBlocked === undefined ? undefined : filters.isBlocked ? 'suspended' : 'active',
        role: 'customer',
      });
      toast.success(`Export started as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExporting(false);
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
    } catch {
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
    <AdminPageShell
      title="Customer Management"
      subtitle="Monitor customer trust scores, detect abuse patterns, and manage customer tiers"
      wideLayout={true}
    >
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

      
        {/* Bulk Action Toolbar */}
        {selectedUserIds.size > 0 && (
          <BulkActionToolbar
            selectedItems={customers.filter(c => selectedUserIds.has(c.user.id))}
            totalCount={pagination.total}
            entityName="customers"
            actions={bulkActions}
            onAction={handleBulkAction}
            onClear={() => setSelectedUserIds(new Set())}
            getItemId={(c) => c.user.id}
            className="mb-6"
          />
        )}

        {/* Customer List */}
        {loading ? (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral" />
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
                  checked={allVisibleSelected}
                  onChange={selectAllVisibleUsers}
                  aria-label="Select all customers on this page"
                  className="w-5 h-5 text-nilin-coral rounded border-gray-300 focus:ring-nilin-coral cursor-pointer"
                />
                <span className="text-sm text-nilin-warmGray">
                  {allVisibleSelected ? 'Deselect all' : 'Select all on this page'}
                </span>
              </div>
              <ExportDropdown
                onExport={handleExportUsers}
                formats={['csv', 'excel', 'pdf']}
                loading={isExporting}
              />
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
            <AdminPagination
              page={pagination.page}
              totalPages={pagination.pages}
              total={pagination.total}
              pageSize={20}
              onPageChange={handlePageChange}
              showPageNumbers
              showTotal
              className="mt-6"
              ariaLabel="Customer list pagination"
            />
          </>
        )}

      {/* Customer Detail Modal */}
      {selectedCustomerId && (
        <CustomerDetailModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
          onRefresh={loadCustomers}
        />
      )}
    </AdminPageShell>
  );
};

export default CustomerManagement;
