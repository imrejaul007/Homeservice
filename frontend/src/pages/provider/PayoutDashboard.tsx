
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft,
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Hash,
  X,
  Filter,
  FileText,
  Banknote,
  PieChart,
  Settings,
  Eye,
  XCircle,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { payoutApi } from '../../services/payoutApi';
import { useToast } from '../../components/common/Toast';
import { socketService } from '../../services/socket';
import type {
  Payout,
  Settlement,
  EarningsSummary,
  PayoutStats,
  SettlementSummary,
  PayoutConfig,
} from '../../services/payoutApi';

// ===================================
// HELPER FUNCTIONS
// ===================================

const formatCurrency = (amount: number, currency: string = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    processing: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    disputed: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getStatusIcon = (status: string): React.ReactNode => {
  switch (status) {
    case 'completed':
    case 'paid':
      return <CheckCircle className="w-4 h-4" />;
    case 'failed':
    case 'cancelled':
      return <XCircle className="w-4 h-4" />;
    case 'processing':
      return <Clock className="w-4 h-4 animate-spin" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
};

// ===================================
// COMPONENTS
// ===================================

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'blue' | 'green' | 'yellow' | 'purple' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color,
}) => {
  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-600' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-600' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', text: 'text-yellow-600' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-600' },
    red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-600' },
  };

  const classes = colorClasses[color];

  return (
    <div className={`${classes.bg} rounded-xl p-5 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`${classes.icon} p-2 rounded-lg bg-white`}>{icon}</div>
        {trend && (
          <div
            className={`flex items-center text-sm font-medium ${
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-4 h-4 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 mr-1" />
            )}
            {Math.abs(trend.value).toFixed(1)}%
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold ${classes.text} mb-1`}>{value}</div>
      <div className="text-sm text-gray-600">{title}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
};

interface PayoutCardProps {
  payout: Payout;
  onView: (payout: Payout) => void;
  onCancel?: (payout: Payout) => void;
}

const PayoutCard: React.FC<PayoutCardProps> = ({ payout, onView, onCancel }) => {
  const canCancel = ['pending', 'scheduled'].includes(payout.status);

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2 rounded-lg ${
              payout.method === 'bank_transfer' ? 'bg-blue-100' : 'bg-purple-100'
            }`}
          >
            {payout.method === 'bank_transfer' ? (
              <Building2 className="w-5 h-5 text-blue-600" />
            ) : (
              <Wallet className="w-5 h-5 text-purple-600" />
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(payout.amount, payout.currency)}
            </div>
            <div className="text-sm text-gray-500">#{payout.payoutNumber}</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            payout.status
          )}`}
        >
          {getStatusIcon(payout.status)}
          <span className="ml-1 capitalize">{payout.status}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <div className="text-gray-500">Scheduled</div>
          <div className="font-medium text-gray-900">{formatDate(payout.scheduledDate)}</div>
        </div>
        {payout.processedDate && (
          <div>
            <div className="text-gray-500">Processed</div>
            <div className="font-medium text-gray-900">{formatDate(payout.processedDate)}</div>
          </div>
        )}
      </div>

      {payout.failures.length > 0 && (
        <div className="mb-4 p-3 bg-red-50 rounded-lg">
          <div className="text-xs font-medium text-red-800 mb-1">Failure Details</div>
          <div className="text-sm text-red-700">
            {payout.failures[payout.failures.length - 1].reason}
          </div>
          <div className="text-xs text-red-600 mt-1">
            Attempt {payout.failures[payout.failures.length - 1].retryAttempt} of{' '}
            {payout.maxRetries || 3}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button
          onClick={() => onView(payout)}
          className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </button>
        {canCancel && onCancel && (
          <button
            onClick={() => onCancel(payout)}
            className="flex items-center text-red-600 hover:text-red-700 text-sm font-medium"
          >
            <XCircle className="w-4 h-4 mr-1" />
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

interface SettlementCardProps {
  settlement: Settlement;
  onView: (settlement: Settlement) => void;
}

const SettlementCard: React.FC<SettlementCardProps> = ({ settlement, onView }) => {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-green-100">
            <FileText className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">
              {formatCurrency(settlement.netAmount, settlement.currency)}
            </div>
            <div className="text-sm text-gray-500">#{settlement.settlementNumber}</div>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
            settlement.status
          )}`}
        >
          {getStatusIcon(settlement.status)}
          <span className="ml-1 capitalize">{settlement.status}</span>
        </span>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Period</span>
          <span className="font-medium text-gray-900">
            {formatDate(settlement.periodStart)} - {formatDate(settlement.periodEnd)}
          </span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Gross</span>
          <span className="font-medium text-gray-900">
            {formatCurrency(settlement.grossAmount, settlement.currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Commission</span>
          <span className="font-medium text-red-600">
            -{formatCurrency(settlement.commission, settlement.currency)}
          </span>
        </div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-500">Platform Fee</span>
          <span className="font-medium text-red-600">
            -{formatCurrency(settlement.platformFee, settlement.currency)}
          </span>
        </div>
        {settlement.deductions.length > 0 && (
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Deductions</span>
            <span className="font-medium text-red-600">
              -{formatCurrency(
                settlement.deductions.reduce((sum, d) => sum + d.amount, 0),
                settlement.currency
              )}
            </span>
          </div>
        )}
        <div className="border-t pt-2 mt-2">
          <div className="flex justify-between text-sm font-medium">
            <span className="text-gray-700">Net Payable</span>
            <span className="text-green-600">
              {formatCurrency(settlement.netAmount, settlement.currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-4">
        {settlement.lineItems.length} booking{settlement.lineItems.length !== 1 ? 's' : ''}{' '}
        included
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <button
          onClick={() => onView(settlement)}
          className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
        >
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </button>
        {settlement.status === 'paid' && settlement.paidAt && (
          <div className="text-sm text-gray-500">Paid on {formatDate(settlement.paidAt)}</div>
        )}
      </div>
    </div>
  );
};

// ===================================
// MAIN COMPONENT
// ===================================

type TabType = 'overview' | 'payouts' | 'settlements' | 'settings';

const PayoutDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const toast = useToast();

  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [payoutStats, setPayoutStats] = useState<PayoutStats | null>(null);
  const [settlementSummary, setSettlementSummary] = useState<SettlementSummary | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [payoutConfig, setPayoutConfig] = useState<PayoutConfig | null>(null);

  // Pagination
  const [payoutsPage, setPayoutsPage] = useState(1);
  const [payoutsTotalPages, setPayoutsTotalPages] = useState(1);
  const [settlementsPage, setSettlementsPage] = useState(1);
  const [settlementsTotalPages, setSettlementsTotalPages] = useState(1);

  // Filters
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<string>('');
  const [settlementStatusFilter, setSettlementStatusFilter] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<'week' | 'month' | 'year'>('month');

  // Modal state
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Socket cleanup ref
  const socketCleanupRef = useRef<(() => void)[]>([]);

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/provider/dashboard'); // FIX: Was '/dashboard'
    }
  }, [user, navigate]);

  // Fetch overview data
  const fetchOverviewData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) setIsRefreshing(true);
    setError(null);

    try {
      const [earningsRes, statsRes, summaryRes] = await Promise.all([
        payoutApi.getEarnings(),
        payoutApi.getPayoutStats(periodFilter),
        payoutApi.getSettlementSummary(periodFilter),
      ]);

      if (earningsRes.success) setEarnings(earningsRes.data);
      if (statsRes.success) setPayoutStats(statsRes.data);
      if (summaryRes.success) setSettlementSummary(summaryRes.data);
    } catch (err: any) {
      console.error('Failed to fetch overview data:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [periodFilter]);

  // Fetch payouts
  const fetchPayouts = useCallback(async (page = 1) => {
    try {
      const response = await payoutApi.getPayouts({
        page,
        limit: 10,
        status: payoutStatusFilter || undefined,
      });

      if (response.success) {
        setPayouts(response.data);
        setPayoutsPage(page);
        setPayoutsTotalPages(response.pagination.pages);
      }
    } catch (err: any) {
      console.error('Failed to fetch payouts:', err);
    }
  }, [payoutStatusFilter]);

  // Fetch settlements
  const fetchSettlements = useCallback(async (page = 1) => {
    try {
      const response = await payoutApi.getSettlements({
        page,
        limit: 10,
        status: settlementStatusFilter || undefined,
      });

      if (response.success) {
        setSettlements(response.data);
        setSettlementsPage(page);
        setSettlementsTotalPages(response.pagination.pages);
      }
    } catch (err: any) {
      console.error('Failed to fetch settlements:', err);
    }
  }, [settlementStatusFilter]);

  // Fetch payout config
  const fetchPayoutConfig = useCallback(async () => {
    try {
      const response = await payoutApi.getPayoutConfig();
      if (response.success) {
        setPayoutConfig(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch payout config:', err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    if (user?.role === 'provider') {
      fetchOverviewData();
      fetchPayouts();
      fetchSettlements();
      fetchPayoutConfig();
    }
  }, [user, fetchOverviewData, fetchPayouts, fetchSettlements, fetchPayoutConfig]);

  // Refetch when filters change
  useEffect(() => {
    if (activeTab === 'payouts' && !isLoading) {
      fetchPayouts(1);
    }
  }, [payoutStatusFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 'settlements' && !isLoading) {
      fetchSettlements(1);
    }
  }, [settlementStatusFilter, activeTab]);

  useEffect(() => {
    if (activeTab === 'overview' && !isLoading) {
      fetchOverviewData(true);
    }
  }, [periodFilter, activeTab]);

  // Socket listeners for real-time updates
  useEffect(() => {
    let isMounted = true;

    const setupSocket = async () => {
      // Connect to socket only if not already connected
      if (!socketService.isConnected()) {
        try {
          await socketService.connect();
        } catch (error) {
          console.warn('Socket connection failed:', error);
          return;
        }
      }

      if (!isMounted) return;

      // Listen for withdrawal approved events
      const unsubWithdrawalApproved = socketService.onWithdrawalApproved((data) => {
        if (isMounted) {
          // Refresh payout data when a withdrawal is approved
          fetchPayouts(payoutsPage);
          fetchOverviewData(true);
          toast.addToast({
            title: 'Withdrawal Approved',
            description: `Your withdrawal of ${data.amount} ${data.currency} has been approved and is being processed.`,
            variant: 'success'
          });
        }
      });

      // Listen for withdrawal rejected events
      const unsubWithdrawalRejected = socketService.onWithdrawalRejected((data) => {
        if (isMounted) {
          // Refresh payout data when a withdrawal is rejected
          fetchPayouts(payoutsPage);
          fetchOverviewData(true);
          toast.addToast({
            title: 'Withdrawal Rejected',
            description: `Your withdrawal request was rejected. Reason: ${data.reason}`,
            variant: 'error'
          });
        }
      });

      // Listen for withdrawal pending events
      const unsubWithdrawalPending = socketService.onWithdrawalPending((data) => {
        if (isMounted) {
          // Refresh payout data when status changes to pending
          fetchPayouts(payoutsPage);
          fetchOverviewData(true);
        }
      });

      // Store cleanup functions
      socketCleanupRef.current = [
        unsubWithdrawalApproved,
        unsubWithdrawalRejected,
        unsubWithdrawalPending
      ];
    };

    setupSocket();

    // Cleanup on unmount
    return () => {
      isMounted = false;

      // Unsubscribe from events
      socketCleanupRef.current.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      socketCleanupRef.current = [];
    };
  }, [payoutsPage, fetchPayouts, fetchOverviewData, toast]);

  // Handlers
  const handleRefresh = () => {
    fetchOverviewData(true);
    if (activeTab === 'payouts') fetchPayouts(payoutsPage);
    if (activeTab === 'settlements') fetchSettlements(settlementsPage);
    if (activeTab === 'settings') fetchPayoutConfig();
  };

  const handleViewPayout = (payout: Payout) => {
    setSelectedPayout(payout);
  };

  const handleViewSettlement = (settlement: Settlement) => {
    setSelectedSettlement(settlement);
  };

  const handleCancelPayout = (payout: Payout) => {
    setSelectedPayout(payout);
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedPayout || !cancelReason.trim()) return;

    setIsCancelling(true);
    try {
      const response = await payoutApi.cancelPayout(selectedPayout._id, cancelReason);
      if (response.success) {
        setShowCancelModal(false);
        setSelectedPayout(null);
        setCancelReason('');
        fetchPayouts(payoutsPage);
        fetchOverviewData(true);
      }
    } catch (err: any) {
      console.error('Failed to cancel payout:', err);
      toast.addToast({
        title: 'Failed to cancel payout',
        description: err.response?.data?.message || 'An error occurred',
        variant: 'error'
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const handleUpdateConfig = async (updates: Partial<PayoutConfig>) => {
    try {
      const response = await payoutApi.updatePayoutConfig(updates);
      if (response.success) {
        setPayoutConfig(response.data);
        toast.addToast({
          title: 'Configuration Updated',
          description: 'Your payout configuration has been saved successfully',
          variant: 'success'
        });
      }
    } catch (err: any) {
      console.error('Failed to update payout config:', err);
      toast.addToast({
        title: 'Update Failed',
        description: err.response?.data?.message || 'Failed to update configuration',
        variant: 'error'
      });
    }
  };

  // Tab content
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Pending"
          value={earnings?.pendingAmount ? formatCurrency(earnings.pendingAmount) : formatCurrency(0)}
          subtitle="Available"
          icon={<Wallet className="w-4 h-4 sm:w-5 sm:h-5" />}
          color="yellow"
        />
        <StatCard
          title="Total Paid"
          value={earnings?.totalPaid ? formatCurrency(earnings.totalPaid) : formatCurrency(0)}
          subtitle={`${periodFilter} total`}
          icon={<DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />}
          color="green"
        />
        <StatCard
          title="This Period"
          value={
            earnings?.breakdown.netPayable
              ? formatCurrency(earnings.breakdown.netPayable)
              : formatCurrency(0)
          }
          subtitle={`${earnings?.breakdown.completedBookings || 0} bookings`}
          icon={<TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />}
          color="blue"
        />
        <StatCard
          title="Avg Payout"
          value={
            payoutStats?.avgPayoutAmount
              ? formatCurrency(payoutStats.avgPayoutAmount)
              : formatCurrency(0)
          }
          subtitle={`${payoutStats?.payoutCount || 0} payouts`}
          icon={<PieChart className="w-4 h-4 sm:w-5 sm:h-5" />}
          color="purple"
        />
      </div>

      {/* Earnings Breakdown */}
      {earnings?.breakdown && (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Earnings Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">
                {formatCurrency(earnings.breakdown.grossAmount)}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Gross</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                -{formatCurrency(earnings.breakdown.commission)}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Commission</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-red-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                -{formatCurrency(earnings.breakdown.platformFee)}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Platform Fee</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {formatCurrency(earnings.breakdown.netPayable)}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Net Payable</div>
            </div>
          </div>

          {earnings.breakdown.refundedAmount > 0 && (
            <div className="text-xs sm:text-sm text-red-600 mb-3 sm:mb-4">
              Includes {formatCurrency(earnings.breakdown.refundedAmount)} in refunds
            </div>
          )}

          <div className="text-[10px] sm:text-xs text-gray-500">
            Period: {formatDate(earnings.breakdown.periodStart)} -{' '}
            {formatDate(earnings.breakdown.periodEnd)}
          </div>
        </div>
      )}

      {/* Upcoming Payouts */}
      {earnings?.upcomingPayouts && earnings.upcomingPayouts.length > 0 && (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Upcoming Payouts</h3>
          <div className="space-y-2 sm:space-y-3">
            {earnings.upcomingPayouts.map((payout) => (
              <div
                key={payout._id}
                className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                    {payout.method === 'bank_transfer' ? (
                      <Building2 className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" />
                    ) : (
                      <Wallet className="w-3 h-3 sm:w-4 sm:h-4 text-purple-600" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm sm:text-base truncate max-w-[100px] sm:max-w-none">
                      {formatCurrency(payout.amount, payout.currency)}
                    </div>
                    <div className="text-xs text-gray-500 hidden sm:block">#{payout.payoutNumber}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <div className="text-xs sm:text-sm font-medium text-gray-900">
                    {formatDate(payout.scheduledDate)}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500">
                    {payout.status === 'scheduled' ? 'Scheduled' : 'Pending'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settlement Summary */}
      {settlementSummary && (
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Settlement Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-900">
                {settlementSummary.settlementCount}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Total</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-yellow-600">
                {settlementSummary.pendingCount}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Pending</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                {settlementSummary.paidCount}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Paid</div>
            </div>
            <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
              <div className="text-base sm:text-2xl font-bold text-blue-600 truncate">
                {formatCurrency(settlementSummary.totalNet)}
              </div>
              <div className="text-[10px] sm:text-sm text-gray-500">Total Net</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderPayoutsTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={payoutStatusFilter}
            onChange={(e) => setPayoutStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Payouts List */}
      {payouts.length === 0 ? (
        <div className="bg-white rounded-xl p-8 sm:p-12 text-center">
          <Wallet className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No payouts found</h3>
          <p className="text-gray-500 text-sm">Your payout history will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {payouts.map((payout) => (
            <PayoutCard
              key={payout._id}
              payout={payout}
              onView={handleViewPayout}
              onCancel={handleCancelPayout}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {payoutsTotalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => fetchPayouts(payoutsPage - 1)}
            disabled={payoutsPage === 1}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs sm:text-sm text-gray-600">
            Page {payoutsPage} of {payoutsTotalPages}
          </span>
          <button
            onClick={() => fetchPayouts(payoutsPage + 1)}
            disabled={payoutsPage === payoutsTotalPages}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );

  const renderSettlementsTab = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto overflow-x-auto">
          <select
            value={settlementStatusFilter}
            onChange={(e) => setSettlementStatusFilter(e.target.value)}
            className="px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
            <option value="disputed">Disputed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Settlements List */}
      {settlements.length === 0 ? (
        <div className="bg-white rounded-xl p-8 sm:p-12 text-center">
          <FileText className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No settlements found</h3>
          <p className="text-gray-500 text-sm">Your settlement history will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {settlements.map((settlement) => (
            <SettlementCard
              key={settlement._id}
              settlement={settlement}
              onView={handleViewSettlement}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {settlementsTotalPages > 1 && (
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => fetchSettlements(settlementsPage - 1)}
            disabled={settlementsPage === 1}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs sm:text-sm text-gray-600">
            Page {settlementsPage} of {settlementsTotalPages}
          </span>
          <button
            onClick={() => fetchSettlements(settlementsPage + 1)}
            disabled={settlementsPage === settlementsTotalPages}
            className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Payout Schedule</h3>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payout Frequency
            </label>
            <select
              value={payoutConfig?.schedule?.frequency || 'weekly'}
              onChange={(e) =>
                handleUpdateConfig({
                  schedule: {
                    ...payoutConfig?.schedule,
                    frequency: e.target.value as 'weekly' | 'bi-weekly' | 'monthly',
                  },
                })
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="weekly">Weekly</option>
              <option value="bi-weekly">Bi-Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Payout Amount
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">AED</span>
              <input
                type="number"
                value={payoutConfig?.schedule?.minPayoutAmount || 100}
                onChange={(e) =>
                  handleUpdateConfig({
                    schedule: {
                      ...payoutConfig?.schedule,
                      minPayoutAmount: parseFloat(e.target.value) || 100,
                    },
                  })
                }
                className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Payouts will only be processed when your balance exceeds this amount.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payout Method
            </label>
            <div className="space-y-2">
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="method"
                  value="bank_transfer"
                  checked={!payoutConfig?.bankDetails}
                  onChange={() =>
                    handleUpdateConfig({
                      bankDetails: undefined,
                    })
                  }
                  className="mr-3"
                />
                <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                <div>
                  <div className="font-medium text-gray-900">Bank Transfer</div>
                  <div className="text-sm text-gray-500">
                    Transfer to your registered bank account
                  </div>
                </div>
              </label>
              <label className="flex items-center p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="method"
                  value="wallet"
                  checked={!!payoutConfig?.bankDetails}
                  onChange={() =>
                    handleUpdateConfig({
                      bankDetails: {
                        bankName: '',
                        accountNumber: '',
                        accountHolderName: '',
                      },
                    })
                  }
                  className="mr-3"
                />
                <Wallet className="w-5 h-5 text-gray-400 mr-2" />
                <div>
                  <div className="font-medium text-gray-900">Platform Wallet</div>
                  <div className="text-sm text-gray-500">Credit to your platform wallet</div>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Details</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure your bank account for receiving payouts via bank transfer.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <input
              type="text"
              value={payoutConfig?.bankDetails?.bankName || ''}
              onChange={(e) =>
                handleUpdateConfig({
                  bankDetails: {
                    ...payoutConfig?.bankDetails,
                    bankName: e.target.value,
                    accountNumber: payoutConfig?.bankDetails?.accountNumber || '',
                    accountHolderName: payoutConfig?.bankDetails?.accountHolderName || '',
                  },
                })
              }
              placeholder="Enter bank name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Account Holder Name
            </label>
            <input
              type="text"
              value={payoutConfig?.bankDetails?.accountHolderName || ''}
              onChange={(e) =>
                handleUpdateConfig({
                  bankDetails: {
                    ...payoutConfig?.bankDetails,
                    bankName: payoutConfig?.bankDetails?.bankName || '',
                    accountNumber: payoutConfig?.bankDetails?.accountNumber || '',
                    accountHolderName: e.target.value,
                  },
                })
              }
              placeholder="Enter account holder name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
            <input
              type="text"
              value={payoutConfig?.bankDetails?.iban || ''}
              onChange={(e) =>
                handleUpdateConfig({
                  bankDetails: {
                    ...payoutConfig?.bankDetails,
                    bankName: payoutConfig?.bankDetails?.bankName || '',
                    accountNumber: e.target.value,
                    accountHolderName: payoutConfig?.bankDetails?.accountHolderName || '',
                    iban: e.target.value,
                  },
                })
              }
              placeholder="AE12 3456 7890 1234 5678 90"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input
              type="text"
              value={payoutConfig?.bankDetails?.accountNumber || ''}
              onChange={(e) =>
                handleUpdateConfig({
                  bankDetails: {
                    ...payoutConfig?.bankDetails,
                    bankName: payoutConfig?.bankDetails?.bankName || '',
                    accountNumber: e.target.value,
                    accountHolderName: payoutConfig?.bankDetails?.accountHolderName || '',
                    iban: payoutConfig?.bankDetails?.iban || '',
                  },
                })
              }
              placeholder="Enter account number"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <button
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-gray-600 hover:text-gray-900 mb-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </button>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Payout Dashboard</h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm min-h-[40px]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 sm:mb-6 border-b border-gray-200 overflow-x-auto">
          <nav className="flex space-x-4 sm:space-x-8 min-w-max">
            {[
              { id: 'overview', label: 'Overview', icon: PieChart },
              { id: 'payouts', label: 'Payouts', icon: DollarSign },
              { id: 'settlements', label: 'Settlements', icon: FileText },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center pb-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-1 sm:mr-2" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <>
            {activeTab === 'overview' && renderOverviewTab()}
            {activeTab === 'payouts' && renderPayoutsTab()}
            {activeTab === 'settlements' && renderSettlementsTab()}
            {activeTab === 'settings' && renderSettingsTab()}
          </>
        )}
      </div>

      <Footer />

      {/* Payout Detail Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Payout Details</h2>
              <button
                onClick={() => setSelectedPayout(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Payout Number</div>
                  <div className="font-medium text-gray-900">#{selectedPayout.payoutNumber}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      selectedPayout.status
                    )}`}
                  >
                    {selectedPayout.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Amount</div>
                  <div className="font-medium text-gray-900">
                    {formatCurrency(selectedPayout.amount, selectedPayout.currency)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Method</div>
                  <div className="font-medium text-gray-900 capitalize">
                    {selectedPayout.method.replace('_', ' ')}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Scheduled Date</div>
                  <div className="font-medium text-gray-900">
                    {formatDate(selectedPayout.scheduledDate)}
                  </div>
                </div>
                {selectedPayout.processedDate && (
                  <div>
                    <div className="text-sm text-gray-500">Processed Date</div>
                    <div className="font-medium text-gray-900">
                      {formatDate(selectedPayout.processedDate)}
                    </div>
                  </div>
                )}
              </div>

              {selectedPayout.stripePayoutId && (
                <div>
                  <div className="text-sm text-gray-500">Stripe Payout ID</div>
                  <div className="font-mono text-sm text-gray-900">
                    {selectedPayout.stripePayoutId}
                  </div>
                </div>
              )}

              {selectedPayout.failures.length > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="font-medium text-red-800 mb-2">Failure History</div>
                  {selectedPayout.failures.map((failure, index) => (
                    <div key={index} className="text-sm text-red-700 mb-1">
                      <div>{failure.reason}</div>
                      <div className="text-xs text-red-600">
                        {formatDateTime(failure.date)} - Attempt {failure.retryAttempt}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settlement Detail Modal */}
      {selectedSettlement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Settlement Details</h2>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Settlement Number</div>
                  <div className="font-medium text-gray-900">
                    #{selectedSettlement.settlementNumber}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      selectedSettlement.status
                    )}`}
                  >
                    {selectedSettlement.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Period</div>
                  <div className="font-medium text-gray-900">
                    {formatDate(selectedSettlement.periodStart)} -{' '}
                    {formatDate(selectedSettlement.periodEnd)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Bookings</div>
                  <div className="font-medium text-gray-900">
                    {selectedSettlement.lineItems.length}
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Financial Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Gross Amount</span>
                    <span className="font-medium text-gray-900">
                      {formatCurrency(selectedSettlement.grossAmount, selectedSettlement.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Commission</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(selectedSettlement.commission, selectedSettlement.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform Fee</span>
                    <span className="font-medium text-red-600">
                      -{formatCurrency(selectedSettlement.platformFee, selectedSettlement.currency)}
                    </span>
                  </div>
                  {selectedSettlement.deductions.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deductions</span>
                      <span className="font-medium text-red-600">
                        -{formatCurrency(
                          selectedSettlement.deductions.reduce((sum, d) => sum + d.amount, 0),
                          selectedSettlement.currency
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium text-gray-900">Net Payable</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(selectedSettlement.netAmount, selectedSettlement.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Included Bookings</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedSettlement.lineItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg text-sm"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{item.bookingNumber}</div>
                        <div className="text-xs text-gray-500">{formatDate(item.date)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">
                          {formatCurrency(item.netAmount, selectedSettlement.currency)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Gross: {formatCurrency(item.grossAmount, selectedSettlement.currency)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Payout Modal */}
      {showCancelModal && selectedPayout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Cancel Payout</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-600">
                Are you sure you want to cancel payout #{selectedPayout.payoutNumber} for{' '}
                {formatCurrency(selectedPayout.amount, selectedPayout.currency)}?
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cancellation Reason *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Please provide a reason for cancellation"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedPayout(null);
                  setCancelReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Keep Payout
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!cancelReason.trim() || isCancelling}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayoutDashboard;
