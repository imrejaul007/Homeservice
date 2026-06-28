import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import {
  ArrowLeft,
  Search,
  Filter,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  RefreshCw,
  Loader2,
  X,
  AlertCircle,
  Calendar,
  User,
  CreditCard,
  AlertTriangle,
  Check,
  Ban,
  TrendingUp,
  TrendingDown,
  Wallet,
  Square,
  CheckSquare,
  Layers,
} from 'lucide-react';
import { payoutApi, type AdminWithdrawal, type WithdrawalStats, type WithdrawalFilters, type WithdrawalDetails } from '../../services/payoutApi';
import { useAuthStore } from '../../stores/authStore';
import { AdminPageShell } from '../../components/admin/AdminPageShell';

type WithdrawalStatusFilter = 'pending' | 'processing' | 'completed' | 'failed' | 'rejected' | 'all';

const VALID_STATUS_FILTERS = new Set<string>([
  'pending',
  'processing',
  'completed',
  'failed',
  'rejected',
  'all',
]);

function withdrawalRowId(w: AdminWithdrawal): string {
  const id = String(w._id);
  if (id.includes(':')) return id;
  return `${id}:${w.transaction.id}`;
}

function formatProviderName(w: AdminWithdrawal): string {
  const name = `${w.userFirstName || ''} ${w.userLastName || ''}`.trim();
  if (name) return name;
  const email = w.userEmail || '';
  const local = email.split('@')[0];
  return local
    ? local.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : email || 'Provider';
}

const PayoutManagement: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const getInitialStatus = (): WithdrawalStatusFilter => {
    const s = searchParams.get('status');
    if (s && VALID_STATUS_FILTERS.has(s)) return s as WithdrawalStatusFilter;
    return 'pending';
  };

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [stats, setStats] = useState<WithdrawalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const initialStatus = getInitialStatus();
  const [filters, setFilters] = useState<WithdrawalFilters>({
    status: initialStatus === 'all' ? 'all' : initialStatus,
    page: 1,
    limit: 20,
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeStatus, setActiveStatus] = useState<WithdrawalStatusFilter>(initialStatus);

  // Process Modal
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<AdminWithdrawal | null>(null);
  const [processAction, setProcessAction] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');

  // Detail Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<WithdrawalDetails | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await payoutApi.getAdminWithdrawals({
        ...filters,
        status:
          filters.status ??
          (activeStatus === 'all' ? 'all' : activeStatus),
      });
      if (response.success && response.data) {
        setWithdrawals(response.data.withdrawals);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      const message = err.message || 'Failed to load withdrawals';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [filters, activeStatus]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const response = await payoutApi.getAdminWithdrawalStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to load statistics. Please try again.');
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // Fetch withdrawal details
  const fetchWithdrawalDetails = useCallback(async (withdrawalId: string) => {
    setIsLoadingDetail(true);
    try {
      const response = await payoutApi.getAdminWithdrawalDetails(withdrawalId);
      if (response.success && response.data) {
        setDetailData(response.data);
      }
    } catch (err) {
      const message = err.message || 'Failed to load withdrawal details';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    fetchWithdrawals();
    fetchStats();
  }, [fetchWithdrawals, fetchStats]);

  // Apply filters
  const syncStatusToUrl = useCallback(
    (status: WithdrawalStatusFilter, q?: string) => {
      const params: Record<string, string> = { status };
      if (q?.trim()) params.q = q.trim();
      setSearchParams(params);
    },
    [setSearchParams]
  );

  const applyFilters = (newFilters: Partial<WithdrawalFilters>, statusTab?: WithdrawalStatusFilter) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);
    if (statusTab) {
      setActiveStatus(statusTab);
      syncStatusToUrl(statusTab, updatedFilters.search ?? searchQuery);
    }
  };

  const handlePageChange = (newPage: number) => {
    setFilters({ ...filters, page: newPage });
  };

  const handleStatusFilter = (status: WithdrawalStatusFilter) => {
    applyFilters({ status: status === 'all' ? 'all' : status }, status);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters({ search: searchQuery.trim() || undefined }, activeStatus);
    syncStatusToUrl(activeStatus, searchQuery);
  };

  const handleRefresh = async () => {
    await Promise.all([fetchWithdrawals(), fetchStats()]);
    toast.success('Payout queue refreshed');
  };

  // Open process modal
  const openProcessModal = (withdrawal: AdminWithdrawal, action: 'approve' | 'reject') => {
    setSelectedWithdrawal(withdrawal);
    setProcessAction(action);
    setRejectionReason('');
    setShowProcessModal(true);
  };

  // Close process modal
  const closeProcessModal = () => {
    setShowProcessModal(false);
    setSelectedWithdrawal(null);
    setRejectionReason('');
  };

  // Process withdrawal
  const processWithdrawal = async () => {
    if (!selectedWithdrawal) return;

    if (processAction === 'reject' && !rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      let response;
      if (processAction === 'approve') {
        response = await payoutApi.approveWithdrawal(withdrawalRowId(selectedWithdrawal));
      } else {
        response = await payoutApi.rejectWithdrawal(withdrawalRowId(selectedWithdrawal), rejectionReason);
      }

      if (response.success) {
        toast.success(`Withdrawal ${processAction === 'approve' ? 'approved' : 'rejected'} successfully`);
        closeProcessModal();
        fetchWithdrawals();
        fetchStats();
      } else {
        const errorMsg = response.message || `Failed to ${processAction} withdrawal`;
        setError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err) {
      const errorMsg = err.message || `Failed to ${processAction} withdrawal`;
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open detail modal
  const openDetailModal = async (withdrawal: AdminWithdrawal) => {
    setShowDetailModal(true);
    setDetailData(null);
    await fetchWithdrawalDetails(withdrawalRowId(withdrawal));
  };

  // Close detail modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setDetailData(null);
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'reversed':
      case 'rejected':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statusFilters: Array<{
    value: WithdrawalStatusFilter;
    label: string;
    icon: React.ElementType;
    count?: number;
  }> = [
    { value: 'pending', label: 'Pending', icon: Clock, count: stats?.pending.count },
    { value: 'processing', label: 'Processing', icon: RefreshCw, count: stats?.processing.count },
    { value: 'completed', label: 'Completed', icon: CheckCircle, count: stats?.completed.count },
    { value: 'failed', label: 'Failed', icon: XCircle, count: stats?.failed.count },
    { value: 'rejected', label: 'Rejected', icon: Ban, count: stats?.rejected.count },
    { value: 'all', label: 'All', icon: Filter },
  ];

  const hasQueueActivity =
    (stats?.pending.count ?? 0) +
      (stats?.processing.count ?? 0) +
      (stats?.completed.count ?? 0) +
      (stats?.failed.count ?? 0) +
      (stats?.rejected.count ?? 0) >
    0;

  const headerActions = (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={isLoading || isLoadingStats}
      className="inline-flex items-center justify-center gap-2 min-h-11 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-nilin-charcoal text-sm font-sans hover:bg-nilin-blush/40 disabled:opacity-50"
    >
      <RefreshCw className={cn('w-4 h-4', (isLoading || isLoadingStats) && 'animate-spin')} />
      Refresh
    </button>
  );

  return (
    <ErrorBoundary>
      {/* Skip link for keyboard accessibility (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:ring-2 focus:ring-white"
      >
        Skip to main content
      </a>
      <AdminPageShell
        wideLayout
        title="Payout Management"
        subtitle="Review provider withdrawal requests · approve or reject with audit trail"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Payouts', current: true },
        ]}
        headerActions={headerActions}
      >
        <div id="main-content">
          {/* KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              key: 'pending' as const,
              label: 'Pending',
              count: stats?.pending.count,
              amount: stats?.pending.totalAmount,
              icon: Clock,
              accent: 'from-amber-100/80 to-amber-50 text-amber-800',
            },
            {
              key: 'processing' as const,
              label: 'Processing',
              count: stats?.processing.count,
              amount: stats?.processing.totalAmount,
              icon: RefreshCw,
              accent: 'from-blue-100/80 to-blue-50 text-blue-800',
            },
            {
              key: 'completed' as const,
              label: 'Completed',
              count: stats?.completed.count,
              amount: stats?.completed.totalAmount,
              icon: CheckCircle,
              accent: 'from-emerald-100/80 to-emerald-50 text-emerald-800',
            },
            {
              key: 'total' as const,
              label: 'Awaiting payout',
              count: null,
              amount: stats?.totalPendingAmount,
              icon: Wallet,
              accent: 'from-violet-100/80 to-violet-50 text-violet-800',
            },
          ].map((kpi) => (
            <button
              key={kpi.key}
              type="button"
              onClick={() => kpi.key !== 'total' && handleStatusFilter(kpi.key)}
              disabled={kpi.key === 'total'}
              className={cn(
                'glass glass-blur rounded-2xl border border-nilin-border/50 p-5 text-left transition-all',
                kpi.key !== 'total' && 'hover:border-nilin-coral/40 hover:shadow-nilin-warm cursor-pointer',
                kpi.key === 'total' && 'cursor-default',
                kpi.key !== 'total' && activeStatus === kpi.key && 'ring-2 ring-nilin-coral/50 border-nilin-coral/40'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray font-sans">
                    {kpi.label}
                  </p>
                  <p className="text-2xl font-serif text-nilin-charcoal mt-1">
                    {isLoadingStats ? '—' : kpi.count != null ? kpi.count : formatCurrency(kpi.amount || 0)}
                  </p>
                  <p className="text-sm text-nilin-warmGray mt-1 font-sans">
                    {isLoadingStats
                      ? '—'
                      : kpi.count != null
                        ? formatCurrency(kpi.amount || 0)
                        : 'Pending + processing'}
                  </p>
                </div>
                <div className={cn('w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center', kpi.accent)}>
                  <kpi.icon className="w-5 h-5" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {!isLoadingStats && !hasQueueActivity && (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/80 px-5 py-4">
            <p className="text-sm font-medium text-sky-900">No withdrawal requests yet</p>
            <p className="text-sm text-sky-800 mt-1">
              When providers request payouts from their wallet, requests appear here for admin approval. Providers
              submit withdrawals from their earnings dashboard after linking a bank account.
            </p>
            <p className="text-xs text-sky-700 mt-2 font-sans">
              Admin: approve releases funds · reject returns balance to provider wallet
            </p>
          </div>
        )}

        {/* Workspace */}
        <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
          <div className="p-4 border-b border-nilin-border/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {statusFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => handleStatusFilter(filter.value)}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium font-sans transition-all',
                    activeStatus === filter.value
                      ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-nilin-warm'
                      : 'border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/40'
                  )}
                >
                  <filter.icon className="w-4 h-4" />
                  {filter.label}
                  {filter.count != null && filter.count > 0 && (
                    <span
                      className={cn(
                        'min-w-[1.25rem] h-5 px-1 rounded-full text-xs font-bold flex items-center justify-center',
                        activeStatus === filter.value ? 'bg-white/25 text-white' : 'bg-nilin-coral/15 text-nilin-coral'
                      )}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                <input
                  type="text"
                  placeholder="Search provider name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:ring-2 focus:ring-nilin-coral/30 focus:border-nilin-coral"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-nilin-charcoal text-white text-sm font-sans hover:bg-nilin-charcoal/90"
              >
                Search
              </button>
            </form>
          </div>

        {error && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto w-11 h-11 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                aria-label="Dismiss error"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

          {/* Mobile withdrawal cards */}
          <div className="md:hidden p-4 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                <p className="text-gray-500 mt-2">Loading withdrawals...</p>
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="py-12 text-center px-2">
                <Wallet className="w-12 h-12 text-nilin-border mx-auto" />
                <p className="text-nilin-charcoal font-medium mt-3 font-sans">No withdrawals in this queue</p>
                {activeStatus !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleStatusFilter('all')}
                    className="mt-4 min-h-11 text-sm font-medium text-nilin-coral hover:text-nilin-rose"
                  >
                    View all withdrawals
                  </button>
                )}
              </div>
            ) : (
              withdrawals.map((withdrawal) => (
                <div
                  key={withdrawalRowId(withdrawal)}
                  className="bg-white rounded-xl border border-nilin-border/40 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-nilin-blush/50 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-nilin-coral" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-nilin-charcoal truncate">
                          {formatProviderName(withdrawal)}
                        </p>
                        <p className="text-xs text-nilin-warmGray truncate">{withdrawal.userEmail}</p>
                      </div>
                    </div>
                    <span
                      className={`flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                        withdrawal.transaction.status
                      )}`}
                    >
                      {withdrawal.transaction.status === 'reversed'
                        ? 'rejected'
                        : withdrawal.transaction.status}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-sm mb-4">
                    <div>
                      <dt className="text-xs text-nilin-warmGray">Amount</dt>
                      <dd className="font-semibold text-gray-900">
                        {formatCurrency(withdrawal.transaction.amount, withdrawal.transaction.currency)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-nilin-warmGray">Requested</dt>
                      <dd>{formatDate(withdrawal.transaction.createdAt)}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-xs text-nilin-warmGray">Bank</dt>
                      <dd>
                        {withdrawal.transaction.metadata?.bankAccount?.bankName || 'N/A'}
                        {withdrawal.transaction.metadata?.bankAccount?.accountNumber && (
                          <span className="text-nilin-warmGray">
                            {' '}
                            · ****{withdrawal.transaction.metadata.bankAccount.accountNumber.slice(-4)}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openDetailModal(withdrawal)}
                      className="flex-1 min-h-11 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <Eye className="w-4 h-4" />
                      Details
                    </button>
                    {withdrawal.transaction.status === 'pending' && (
                      <>
                        <button
                          onClick={() => openProcessModal(withdrawal, 'approve')}
                          className="w-11 h-11 flex items-center justify-center text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                          aria-label="Approve withdrawal"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openProcessModal(withdrawal, 'reject')}
                          className="w-11 h-11 flex items-center justify-center text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                          aria-label="Reject withdrawal"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-nilin-border/40">
              <thead className="bg-nilin-blush/20">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                    Provider
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                    Bank Account
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                    Requested
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nilin-border/30">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto" />
                      <p className="text-gray-500 mt-2">Loading withdrawals...</p>
                    </td>
                  </tr>
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <Wallet className="w-12 h-12 text-nilin-border mx-auto" />
                      <p className="text-nilin-charcoal font-medium mt-3 font-sans">
                        No withdrawals in this queue
                      </p>
                      <p className="text-sm text-nilin-warmGray mt-1 max-w-md mx-auto font-sans">
                        {activeStatus === 'pending'
                          ? 'No pending requests. Try All or Completed, or wait for providers to request a payout.'
                          : `No ${activeStatus === 'all' ? '' : activeStatus} withdrawals match your filters.`}
                      </p>
                      {activeStatus !== 'all' && (
                        <button
                          type="button"
                          onClick={() => handleStatusFilter('all')}
                          className="mt-4 text-sm font-medium text-nilin-coral hover:text-nilin-rose"
                        >
                          View all withdrawals
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((withdrawal) => (
                    <tr key={withdrawalRowId(withdrawal)} className="hover:bg-nilin-blush/20">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-nilin-blush/50 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-nilin-coral" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm font-medium text-nilin-charcoal font-sans">
                              {formatProviderName(withdrawal)}
                            </p>
                            <p className="text-xs text-nilin-warmGray font-sans">{withdrawal.userEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(withdrawal.transaction.amount, withdrawal.transaction.currency)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                            withdrawal.transaction.status
                          )}`}
                        >
                          {withdrawal.transaction.status === 'reversed'
                            ? 'rejected'
                            : withdrawal.transaction.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {withdrawal.transaction.metadata?.bankAccount?.bankName || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {withdrawal.transaction.metadata?.bankAccount?.accountNumber
                            ? `****${withdrawal.transaction.metadata.bankAccount.accountNumber.slice(-4)}`
                            : 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">
                          {formatDate(withdrawal.transaction.createdAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => openDetailModal(withdrawal)}
                            className="w-11 h-11 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            aria-label="View withdrawal details"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          {withdrawal.transaction.status === 'pending' && (
                            <>
                              <button
                                onClick={() => openProcessModal(withdrawal, 'approve')}
                                className="w-11 h-11 flex items-center justify-center text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                aria-label="Approve withdrawal"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => openProcessModal(withdrawal, 'reject')}
                                className="w-11 h-11 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label="Reject withdrawal"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-4 sm:px-5 py-4 border-t border-nilin-border/40 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-gray-500 text-center sm:text-left">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="min-h-11 px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="min-h-11 px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Process Modal */}
      {showProcessModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {processAction === 'approve' ? 'Approve' : 'Reject'} Withdrawal
                </h3>
                <button
                  onClick={closeProcessModal}
                  className="w-11 h-11 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center space-x-4 mb-4">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{formatProviderName(selectedWithdrawal)}</p>
                    <p className="text-sm text-gray-500">{selectedWithdrawal.userEmail}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Amount</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(
                        selectedWithdrawal.transaction.amount,
                        selectedWithdrawal.transaction.currency
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500">Bank</span>
                    <span className="text-sm text-gray-900">
                      {selectedWithdrawal.transaction.metadata?.bankAccount?.bankName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Account</span>
                    <span className="text-sm text-gray-900">
                      {selectedWithdrawal.transaction.metadata?.bankAccount?.accountNumber
                        ? `****${selectedWithdrawal.transaction.metadata.bankAccount.accountNumber.slice(-4)}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {processAction === 'reject' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection (minimum 10 characters)..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    This reason will be shared with the provider.
                  </p>
                </div>
              )}

              {processAction === 'approve' && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">Approve this withdrawal?</p>
                      <p className="text-sm text-green-700 mt-1">
                        The requested amount will be deducted from the provider's wallet and
                        transferred to their bank account.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
              <button
                onClick={closeProcessModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={processWithdrawal}
                disabled={
                  isProcessing ||
                  (processAction === 'reject' && rejectionReason.trim().length < 10)
                }
                className={`px-4 py-2 rounded-lg text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  processAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : processAction === 'approve' ? (
                  'Approve Withdrawal'
                ) : (
                  'Reject Withdrawal'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Withdrawal Details</h3>
                <button
                  onClick={closeDetailModal}
                  className="w-11 h-11 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </div>
              ) : detailData ? (
                <div className="space-y-6">
                  {/* Provider Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Provider</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-6 h-6 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {detailData.provider.firstName} {detailData.provider.lastName}
                          </p>
                          <p className="text-sm text-gray-500">{detailData.provider.email}</p>
                          {detailData.provider.phone && (
                            <p className="text-sm text-gray-500">{detailData.provider.phone}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">
                      Transaction Details
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Amount</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(detailData.transaction.amount, detailData.transaction.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Status</span>
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(
                            detailData.transaction.status
                          )}`}
                        >
                          {detailData.transaction.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Reference</span>
                        <span className="text-sm text-gray-900 font-mono">
                          {detailData.transaction.reference}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Requested</span>
                        <span className="text-sm text-gray-900">
                          {formatDate(detailData.transaction.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bank Details */}
                  {/* SECURITY FIX: Use safe type extraction with optional chaining */}
                  {(() => {
                    const metadata = detailData.transaction.metadata as Record<string, unknown> | undefined;
                    const bankAccount = metadata?.bankAccount as { bankName?: string; accountHolder?: string; accountNumber?: string; iban?: string } | undefined;
                    if (!bankAccount) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">
                          Bank Account
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Bank</span>
                            <span className="text-sm text-gray-900">
                              {bankAccount.bankName ?? 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Account Holder</span>
                            <span className="text-sm text-gray-900">
                              {bankAccount.accountHolder ?? 'N/A'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Account Number</span>
                            <span className="text-sm text-gray-900 font-mono">
                              {bankAccount.accountNumber ?? 'N/A'}
                            </span>
                          </div>
                          {bankAccount.iban && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">IBAN</span>
                              <span className="text-sm text-gray-900 font-mono">
                                {bankAccount.iban}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Wallet Info */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">Wallet</h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Current Balance</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(detailData.wallet.balance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Pending Balance</span>
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(detailData.wallet.pendingBalance)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Available Balance</span>
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(detailData.wallet.availableBalance)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {/* SECURITY FIX: Use safe type extraction with optional chaining */}
                  {(() => {
                    const metadata = detailData.transaction.metadata as Record<string, unknown> | undefined;
                    const rejectionReason = metadata?.rejectionReason as string | undefined;
                    const rejectedAt = metadata?.rejectedAt as string | undefined;
                    if (!rejectionReason) return null;
                    return (
                      <div>
                        <h4 className="text-sm font-medium text-gray-500 uppercase mb-3">
                          Rejection Reason
                        </h4>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm text-red-800">
                            {rejectionReason}
                          </p>
                          {rejectedAt && (
                            <p className="text-xs text-red-600 mt-2">
                              Rejected on {formatDate(rejectedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <p className="text-center text-gray-500">No details available</p>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default PayoutManagement;
