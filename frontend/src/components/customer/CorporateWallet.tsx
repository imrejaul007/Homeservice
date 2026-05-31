import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  DollarSign,
  Users,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  FileText,
  Send,
  Lock,
  Loader,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils/formatting';
import { corporateWalletApi, type CorporateWallet as CorporateWalletData, type CorporateTransaction, type EmployeeSpending, type SpendingBreakdown } from '../../services/corporateWalletApi';

interface CorporateWalletProps {
  compact?: boolean;
  onRequestIncrease?: () => void;
}

type Tab = 'overview' | 'transactions' | 'spending';
type TransactionFilter = 'all' | 'charge' | 'refund' | 'credit';

export const CorporateWallet: React.FC<CorporateWalletProps> = ({
  compact = false,
  onRequestIncrease,
}) => {
  // State
  const [wallet, setWallet] = useState<CorporateWalletData | null>(null);
  const [transactions, setTransactions] = useState<CorporateTransaction[]>([]);
  const [employeeSpending, setEmployeeSpending] = useState<EmployeeSpending[]>([]);
  const [breakdown, setBreakdown] = useState<SpendingBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [walletData, transactionData, spendingData, breakdownData] = await Promise.all([
        corporateWalletApi.getWallet(),
        corporateWalletApi.getTransactions({ page: 1, limit: 20 }),
        corporateWalletApi.getSpending(),
        corporateWalletApi.getBreakdown(),
      ]);

      if (walletData.hasCorporateWallet && walletData.wallet) {
        setWallet(walletData.wallet);
      }
      setTransactions(transactionData.transactions);
      setEmployeeSpending(spendingData.employees);
      setBreakdown(breakdownData.breakdown);
      setHasMore(transactionData.page < transactionData.pages);
      setPage(1);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load corporate wallet';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load more transactions
  const loadMore = async () => {
    if (!hasMore || loading) return;

    try {
      const nextPage = page + 1;
      const moreData = await corporateWalletApi.getTransactions({
        page: nextPage,
        limit: 20,
        type: transactionFilter !== 'all' ? transactionFilter : undefined,
      });

      setTransactions((prev) => [...prev, ...moreData.transactions]);
      setPage(nextPage);
      setHasMore(moreData.page < moreData.pages);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  // Submit limit increase request
  const handleSubmitRequest = async () => {
    if (!requestAmount || !requestReason.trim()) return;

    setSubmitting(true);
    try {
      const result = await corporateWalletApi.requestIncrease(
        parseFloat(requestAmount),
        requestReason.trim()
      );
      if (result.success) {
        setShowRequestModal(false);
        setRequestAmount('');
        setRequestReason('');
        onRequestIncrease?.();
      }
    } catch (err) {
      console.error('Failed to submit request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format date with time
  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'suspended':
        return 'text-amber-600 bg-amber-100';
      case 'frozen':
        return 'text-red-600 bg-red-100';
      case 'closed':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    if (transactionFilter === 'all') return true;
    return t.type === transactionFilter;
  });

  // No corporate wallet
  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center py-8">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">No Corporate Account</h3>
          <p className="text-nilin-warmGray mb-4 max-w-sm mx-auto">
            Corporate accounts are for businesses that want to manage employee spending on home services.
          </p>
          <button className="px-6 py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors">
            Contact Sales
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-nilin-charcoal font-medium mb-2">Unable to load corporate wallet</p>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={() => fetchData()}
            className="px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-purple-600" />
            </div>
            <span className="font-medium text-nilin-charcoal">{wallet.companyName}</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-400', refreshing && 'animate-spin')} />
          </button>
        </div>
        <div className="text-2xl font-bold text-nilin-charcoal">
          {formatCurrency(wallet.availableCredit, wallet.currency)}
        </div>
        <p className="text-xs text-nilin-warmGray mt-1">
          Credit limit: {formatCurrency(wallet.creditLimit, wallet.currency)}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-nilin-charcoal">{wallet.companyName}</h2>
            <p className="text-sm text-nilin-warmGray">Corporate Account</p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={cn('w-5 h-5 text-gray-500', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Status Banner */}
      {wallet.status !== 'active' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-800 capitalize">Account {wallet.status}</p>
            <p className="text-sm text-amber-700">Contact support to resolve this issue</p>
          </div>
        </div>
      )}

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-white/80 text-sm mb-1">Available Credit</p>
            <p className="text-3xl font-bold">{formatCurrency(wallet.availableCredit, wallet.currency)}</p>
          </div>
          <div className={cn(
            'px-3 py-1 rounded-full text-sm font-medium capitalize',
            wallet.status === 'active' ? 'bg-white/20' : 'bg-amber-500'
          )}>
            {wallet.status}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/70 text-xs">Credit Limit</p>
            <p className="font-semibold">{formatCurrency(wallet.creditLimit, wallet.currency)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/70 text-xs">Used This Month</p>
            <p className="font-semibold">{formatCurrency(wallet.totalSpentThisMonth, wallet.currency)}</p>
          </div>
        </div>

        {/* Spending Progress */}
        <div className="mt-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-white/70">Monthly Usage</span>
            <span className="text-white/70">
              {wallet.monthlySpendingLimit
                ? `${Math.round((wallet.totalSpentThisMonth / wallet.monthlySpendingLimit) * 100)}%`
                : '0%'}
            </span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{
                width: wallet.monthlySpendingLimit
                  ? `${Math.min((wallet.totalSpentThisMonth / wallet.monthlySpendingLimit) * 100, 100)}%`
                  : '0%',
              }}
            />
          </div>
        </div>
      </div>

      {/* Limits Overview */}
      <div className="grid grid-cols-3 gap-4">
        {wallet.dailySpendingLimit && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-nilin-warmGray">Daily Limit</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1">
              {formatCurrency(wallet.dailySpendingLimit, wallet.currency)}
            </p>
          </div>
        )}
        {wallet.monthlySpendingLimit && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-nilin-warmGray">Monthly Limit</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1">
              {formatCurrency(wallet.monthlySpendingLimit, wallet.currency)}
            </p>
          </div>
        )}
        {wallet.perTransactionLimit && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-xs text-nilin-warmGray">Per Transaction</p>
            <p className="text-lg font-bold text-nilin-charcoal mt-1">
              {formatCurrency(wallet.perTransactionLimit, wallet.currency)}
            </p>
          </div>
        )}
      </div>

      {/* Request Limit Increase */}
      <button
        onClick={() => setShowRequestModal(true)}
        className="w-full py-3 border-2 border-dashed border-purple-300 text-purple-600 rounded-xl hover:bg-purple-50 transition-colors flex items-center justify-center gap-2"
      >
        <Lock className="w-4 h-4" />
        Request Limit Increase
      </button>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['overview', 'transactions', 'spending'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors relative capitalize',
              activeTab === tab ? 'text-purple-600' : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            {tab === 'overview' ? 'Overview' : tab === 'transactions' ? 'Transactions' : 'Spending'}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600" />
            )}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-green-600 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">Total Spent</span>
              </div>
              <p className="text-xl font-bold text-nilin-charcoal">
                {formatCurrency(wallet.totalSpent, wallet.currency)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm font-medium">Current Balance</span>
              </div>
              <p className="text-xl font-bold text-nilin-charcoal">
                {formatCurrency(wallet.currentBalance, wallet.currency)}
              </p>
            </div>
          </div>

          {/* Billing Info */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h4 className="font-semibold text-nilin-charcoal mb-3">Billing</h4>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Billing Cycle</span>
                <span className="text-nilin-charcoal capitalize">{wallet.billingCycle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Billing Day</span>
                <span className="text-nilin-charcoal">Day {wallet.billingDay}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Next Billing</span>
                <span className="text-nilin-charcoal">{formatDate(wallet.nextBillingDate)}</span>
              </div>
            </div>
          </div>

          {/* Spending Breakdown by Category */}
          {breakdown.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <h4 className="font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Spending by Category
              </h4>
              <div className="space-y-3">
                {breakdown.map((item) => (
                  <div key={item.categoryId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-nilin-charcoal">{item.categoryName}</span>
                      <span className="text-nilin-warmGray">
                        {formatCurrency(item.amount, wallet.currency)} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            {(['all', 'charge', 'refund', 'credit'] as TransactionFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTransactionFilter(filter)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-lg transition-colors capitalize',
                  transactionFilter === filter
                    ? 'bg-purple-100 text-purple-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Transaction List */}
          {filteredTransactions.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-warmGray">No transactions yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filteredTransactions.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      tx.type === 'charge' ? 'bg-red-100 text-red-600' :
                      tx.type === 'refund' ? 'bg-green-100 text-green-600' :
                      'bg-blue-100 text-blue-600'
                    )}>
                      {tx.type === 'charge' ? (
                        <ArrowUpRight className="w-5 h-5" />
                      ) : tx.type === 'refund' ? (
                        <ArrowDownRight className="w-5 h-5" />
                      ) : (
                        <DollarSign className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-nilin-charcoal truncate">{tx.description}</p>
                      <div className="flex items-center gap-2 text-xs text-nilin-warmGray">
                        {tx.employeeName && <span>{tx.employeeName}</span>}
                        <span>{formatDateTime(tx.createdAt)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        'font-semibold',
                        tx.type === 'charge' ? 'text-red-600' :
                        tx.type === 'refund' ? 'text-green-600' :
                        'text-blue-600'
                      )}>
                        {tx.type === 'charge' ? '-' : '+'}{formatCurrency(tx.amount, wallet.currency)}
                      </p>
                      <p className="text-xs text-nilin-warmGray capitalize">{tx.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Load More */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-3 bg-white text-purple-600 hover:bg-purple-50 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              Load More <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Spending Tab */}
      {activeTab === 'spending' && (
        <div className="space-y-4">
          {/* Employee Spending */}
          {employeeSpending.length > 0 ? (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h4 className="font-semibold text-nilin-charcoal flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Employee Spending
                </h4>
              </div>
              <div className="divide-y divide-gray-50">
                {employeeSpending.map((emp) => (
                  <div key={emp.employeeId} className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-nilin-charcoal">{emp.employeeName}</p>
                      <p className="text-xs text-nilin-warmGray">
                        {emp.employeeEmail}
                        {emp.department && ` - ${emp.department}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-nilin-charcoal">
                        {formatCurrency(emp.usedThisMonth, wallet.currency)}
                      </p>
                      <p className="text-xs text-nilin-warmGray">
                        {emp.bookingCount} bookings
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-warmGray">No employee spending data</p>
            </div>
          )}
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-nilin-charcoal mb-4">Request Limit Increase</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-nilin-charcoal mb-1 block">
                  Requested Credit Limit
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">AED</span>
                  <input
                    type="number"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="50000"
                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <p className="text-xs text-nilin-warmGray mt-1">
                  Current limit: {formatCurrency(wallet.creditLimit, wallet.currency)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-nilin-charcoal mb-1 block">
                  Reason for Request
                </label>
                <textarea
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="Please explain why you need a higher credit limit..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRequestModal(false)}
                className="flex-1 py-3 border border-gray-200 text-nilin-charcoal rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting || !requestAmount || !requestReason.trim()}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CorporateWallet;
