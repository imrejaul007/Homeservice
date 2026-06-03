import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Hash,
  X,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { walletApi } from '../../services/walletApi';
import type { Wallet as WalletType, WalletTransaction, EarningsSummary } from '../../services/walletApi';
import { socketService } from '../../services/socket';
import { formatPrice } from '../../utils/currency';
import { EmptyState } from '../../components/common/EmptyState';

// Security: HTML entity escaping to prevent XSS
const escapeHtml = (text: string): string => {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
};

// Withdrawal limits configuration
const MAX_WITHDRAWAL_AMOUNT = 10000; // Maximum single withdrawal amount
const MINIMUM_BALANCE_RESERVE = 10; // Minimum balance to maintain after withdrawal

interface Transaction {
  id: string;
  type: 'earning' | 'withdrawal' | 'refund' | 'fee' | 'bonus' | 'topup';
  amount: number;
  description: string;
  date: Date;
  status: 'completed' | 'pending' | 'failed' | 'reversed';
  bookingId?: string;
}

interface WithdrawalForm {
  amount: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  accountHolder: string;
}

interface ApiError {
  message: string;
  code?: string;
}

const ProviderEarningsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Data state
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<EarningsSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<EarningsSummary | null>(null);

  // UI state
  const [filter, setFilter] = useState<'all' | 'earning' | 'withdrawal' | 'refund'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const limit = 10;

  // Use ref to track currentPage without causing re-renders in useCallback dependencies
  const currentPageRef = useRef(currentPage);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Withdrawal modal state
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalForm>({
    amount: '',
    bankName: '',
    accountNumber: '',
    iban: '',
    accountHolder: '',
  });
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [withdrawalSuccess, setWithdrawalSuccess] = useState(false);

  // Ref to track timeout ID for cleanup on unmount
  const withdrawalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (withdrawalTimeoutRef.current) {
        clearTimeout(withdrawalTimeoutRef.current);
      }
    };
  }, []);

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/customer/dashboard');
    }
  }, [user, navigate]);

  // Map backend transaction type to frontend type
  // Handles all WalletTransaction.referenceType values:
  // booking, refund, bonus, payout, topup, commission
  const mapTransactionType = (transaction: WalletTransaction): Transaction['type'] => {
    const typeMap: Record<WalletTransaction['referenceType'], Transaction['type']> = {
      booking: 'earning',
      payout: 'withdrawal',
      refund: 'refund',
      commission: 'fee',
      bonus: 'bonus',
      topup: 'topup',
    };

    return typeMap[transaction.referenceType] ?? (transaction.type === 'credit' ? 'earning' : 'withdrawal');
  };

  // Map API transaction to frontend transaction
  const mapTransaction = (apiTransaction: WalletTransaction): Transaction => ({
    id: apiTransaction.id,
    type: mapTransactionType(apiTransaction),
    amount: apiTransaction.type === 'credit' ? apiTransaction.amount : -apiTransaction.amount,
    description: apiTransaction.description,
    date: new Date(apiTransaction.createdAt),
    status: apiTransaction.status as 'completed' | 'pending' | 'failed',
    bookingId: apiTransaction.referenceType === 'booking' ? apiTransaction.reference : undefined,
  });

  // Fetch all data - accepts page as parameter to avoid stale closure
  const fetchData = useCallback(async (showRefreshLoader = false, page?: number) => {
    if (showRefreshLoader) {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      // Use provided page or fall back to currentPageRef for stable reference
      const fetchPage = page ?? currentPageRef.current;

      // Fetch wallet, transactions, and summaries in parallel with individual error tracking
      const [walletRes, transactionsRes, weeklyRes, monthlyRes] = await Promise.allSettled([
        walletApi.getWallet(),
        walletApi.getTransactions({ page: fetchPage, limit }),
        walletApi.getEarningsSummary('week'),
        walletApi.getEarningsSummary('month'),
      ]);

      // Handle wallet response independently
      if (walletRes.status === 'fulfilled' && walletRes.value.success) {
        setWallet(walletRes.value.data);
      } else if (walletRes.status === 'rejected') {
        console.error('Failed to fetch wallet:', walletRes.reason);
      }

      // Handle transactions response independently
      if (transactionsRes.status === 'fulfilled' && transactionsRes.value.success) {
        setTransactions(transactionsRes.value.data.transactions.map(mapTransaction));
        setTotalPages(transactionsRes.value.data.pages);
        setTotalTransactions(transactionsRes.value.data.total);
      } else if (transactionsRes.status === 'rejected') {
        console.error('Failed to fetch transactions:', transactionsRes.reason);
      }

      // Handle weekly summary response independently
      if (weeklyRes.status === 'fulfilled' && weeklyRes.value.success) {
        setWeeklySummary(weeklyRes.value.data);
      } else if (weeklyRes.status === 'rejected') {
        console.error('Failed to fetch weekly summary:', weeklyRes.reason);
      }

      // Handle monthly summary response independently
      if (monthlyRes.status === 'fulfilled' && monthlyRes.value.success) {
        setMonthlySummary(monthlyRes.value.data);
      } else if (monthlyRes.status === 'rejected') {
        console.error('Failed to fetch monthly summary:', monthlyRes.reason);
      }
    } catch (err: any) {
      console.error('Failed to fetch wallet data:', err);
      setError({
        message: err.response?.data?.message || err.message || err.toString() || 'Failed to load wallet data',
        code: err.response?.data?.code,
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial fetch and refetch when page changes
  // FIX: Combined into single useEffect to prevent double fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Socket listeners for real-time updates
  useEffect(() => {
    // Listen for withdrawal approved
    const unsubWithdrawalApproved = socketService.onWithdrawalApproved(() => {
      fetchData(true);
    });

    // Listen for withdrawal rejected
    const unsubWithdrawalRejected = socketService.onWithdrawalRejected(() => {
      fetchData(true);
    });

    // Listen for booking confirmed (new earnings)
    const unsubBookingConfirmed = socketService.on('booking:confirmed', () => {
      fetchData(true);
    });

    // Listen for booking completed (real-time earnings update)
    // FIX: Replaced dead payment:completed subscription with booking:completed
    // payment:completed is never emitted by backend - booking:completed indicates earnings credited
    const unsubBookingCompleted = socketService.on('booking:completed', (data) => {
      // Only refresh if this booking is for this provider
      if (data.userId === user?._id) {
        fetchData(true);
      }
    });

    // Cleanup on unmount
    return () => {
      unsubWithdrawalApproved();
      unsubWithdrawalRejected();
      unsubBookingConfirmed();
      unsubBookingCompleted();
    };
  }, [fetchData, user?._id]);

  // Filter transactions
  const filteredTransactions = transactions.filter((txn) => {
    if (filter === 'all') return true;
    return txn.type === filter;
  });

  // Calculate comparison
  const monthlyChange = monthlySummary && weeklySummary
    ? weeklySummary.earnings - (monthlySummary.earnings / 4)
    : 0;
  const monthlyChangePercent = monthlySummary && monthlySummary.earnings > 0
    ? ((monthlyChange) / (monthlySummary.earnings / 4)) * 100
    : 0;

  // Handle withdrawal
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawalForm.amount);

    // Validation
    if (isNaN(amount) || amount <= 0) {
      setWithdrawalError('Please enter a valid amount');
      return;
    }

    if (!wallet || amount > wallet.balance - wallet.pendingBalance) {
      setWithdrawalError('Insufficient balance');
      return;
    }

    if (!withdrawalForm.bankName || !withdrawalForm.accountNumber || !withdrawalForm.iban || !withdrawalForm.accountHolder) {
      setWithdrawalError('Please fill in all bank account details');
      return;
    }

    setIsWithdrawing(true);
    setWithdrawalError(null);

    try {
      const response = await walletApi.requestWithdrawal({
        amount,
        bankAccount: {
          bankName: withdrawalForm.bankName,
          accountNumber: withdrawalForm.accountNumber,
          iban: withdrawalForm.iban,
          accountHolder: withdrawalForm.accountHolder,
        },
      });

      if (response.success) {
        setWithdrawalSuccess(true);
        // Refresh data after successful withdrawal
        await fetchData(true);
        // Close modal after delay - store timeout ID for cleanup
        if (withdrawalTimeoutRef.current) {
          clearTimeout(withdrawalTimeoutRef.current);
        }
        withdrawalTimeoutRef.current = setTimeout(() => {
          setShowWithdrawModal(false);
          setWithdrawalSuccess(false);
          setWithdrawalForm({
            amount: '',
            bankName: '',
            accountNumber: '',
            iban: '',
            accountHolder: '',
          });
          withdrawalTimeoutRef.current = null;
        }, 2000);
      }
    } catch (err: any) {
      setWithdrawalError(err.response?.data?.message || err.message || 'Failed to process withdrawal');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Escape CSV field - handles commas, quotes, and newlines
  const escapeCsvField = (field: string): string => {
    const stringField = String(field);
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
      return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
  };

  // Handle export
  const handleExport = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Status'];
    const rows = filteredTransactions.map((txn) => [
      escapeCsvField(txn.date.toLocaleDateString()),
      escapeCsvField(txn.type),
      escapeCsvField(txn.description),
      escapeCsvField(txn.amount.toString()),
      escapeCsvField(txn.status),
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Get transaction icon
  const getTransactionIcon = (type: Transaction['type']) => {
    switch (type) {
      case 'earning':
      case 'bonus':
      case 'topup':
        return <DollarSign className="h-4 w-4 text-green-600" />;
      case 'withdrawal':
        return <ArrowDownRight className="h-4 w-4 text-blue-600" />;
      case 'refund':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      case 'fee':
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <Wallet className="h-4 w-4 text-nilin-warmGray" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
    }
  };

  // Format transaction type for display
  const formatTransactionType = (type: Transaction['type']) => {
    switch (type) {
      case 'earning':
        return 'Earning';
      case 'withdrawal':
        return 'Withdrawal';
      case 'refund':
        return 'Refund';
      case 'fee':
        return 'Fee';
      case 'bonus':
        return 'Bonus';
      case 'topup':
        return 'Top Up';
      default:
        return type;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-nilin-warmGray">Loading wallet data...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error && !wallet) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto px-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-serif text-nilin-charcoal mb-2">Unable to Load Wallet</h2>
            <p className="text-nilin-warmGray mb-4">{error.message}</p>
            <button
              onClick={() => fetchData(true)}
              className="btn-nilin flex items-center gap-2 mx-auto"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Try Again
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const availableBalance = wallet ? wallet.balance - wallet.pendingBalance : 0;

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Earnings</h1>
                <p className="text-nilin-warmGray">Track your income and manage withdrawals</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => fetchData(true)}
                  disabled={isRefreshing}
                  className="px-4 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={handleExport}
                  disabled={filteredTransactions.length === 0}
                  className="px-4 py-2 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
                <button
                  onClick={() => setShowWithdrawModal(true)}
                  disabled={!wallet || availableBalance <= 0}
                  className="btn-nilin flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Wallet className="h-4 w-4" />
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && wallet && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-nilin flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error.message}</p>
              <button
                onClick={() => setError(null)}
                className="ml-auto p-1 hover:bg-red-100 rounded"
              >
                <X className="h-4 w-4 text-red-500" />
              </button>
            </div>
          )}

          {/* Earnings Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Earnings */}
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-green-100 rounded-nilin">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                {monthlyChangePercent !== 0 && (
                  <div className={`flex items-center gap-1 text-sm font-medium ${monthlyChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {monthlyChangePercent >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {Math.abs(monthlyChangePercent).toFixed(1)}%
                  </div>
                )}
              </div>
              <p className="text-sm text-nilin-warmGray mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {wallet ? formatPrice(wallet.totalEarned, wallet.currency) : '-'}
              </p>
            </div>

            {/* Available Balance */}
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                  <Wallet className="h-5 w-5 text-nilin-coral" />
                </div>
              </div>
              <p className="text-sm text-nilin-warmGray mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {wallet ? formatPrice(availableBalance, wallet.currency) : '-'}
              </p>
            </div>

            {/* Pending Balance */}
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-yellow-100 rounded-nilin">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
              </div>
              <p className="text-sm text-nilin-warmGray mb-1">Pending Balance</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {wallet ? formatPrice(wallet.pendingBalance, wallet.currency) : '-'}
              </p>
              <p className="text-xs text-nilin-warmGray mt-1">Clears after service completion</p>
            </div>

            {/* This Month */}
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 bg-blue-100 rounded-nilin">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-nilin-warmGray mb-1">This Month</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {monthlySummary ? formatPrice(monthlySummary.earnings, wallet?.currency) : '-'}
              </p>
            </div>
          </div>

          {/* Weekly Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <h3 className="text-sm font-medium text-nilin-warmGray mb-4">This Week</h3>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-nilin-charcoal">
                    {weeklySummary ? formatPrice(weeklySummary.earnings, wallet?.currency) : '-'}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {monthlyChange >= 0 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">
                          +{formatPrice(Math.abs(monthlyChange), wallet?.currency)}
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-600 font-medium">
                          -{formatPrice(Math.abs(monthlyChange), wallet?.currency)}
                        </span>
                      </>
                    )}
                    <span className="text-sm text-nilin-warmGray">vs avg week</span>
                  </div>
                </div>
                {weeklySummary && (
                  <div className="text-right">
                    <p className="text-sm text-nilin-warmGray">Transactions</p>
                    <p className="text-xl font-semibold text-nilin-charcoal">
                      {weeklySummary.transactionCount}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <h3 className="text-sm font-medium text-nilin-warmGray mb-4">Earnings Goal</h3>
              <div className="mb-2">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-nilin-charcoal">Monthly Target: {formatPrice(5000, wallet?.currency)}</span>
                  <span className="text-nilin-warmGray">
                    {monthlySummary ? `${((monthlySummary.earnings / 5000) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
                <div className="h-3 bg-nilin-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full transition-all"
                    style={{ width: `${monthlySummary ? Math.min((monthlySummary.earnings / 5000) * 100, 100) : 0}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-nilin-warmGray">
                {monthlySummary
                  ? `${formatPrice(5000 - monthlySummary.earnings, wallet?.currency)} more to reach your goal`
                  : 'Set your monthly earnings goal'}
              </p>
            </div>
          </div>

          {/* Transactions */}
          <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif text-nilin-charcoal">
                Transaction History
                {totalTransactions > 0 && (
                  <span className="text-sm font-normal text-nilin-warmGray ml-2">
                    ({totalTransactions} total)
                  </span>
                )}
              </h2>

              {/* Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-nilin-warmGray" />
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  aria-label="Filter transactions"
                  className="px-3 py-1.5 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal focus:outline-none focus:border-nilin-coral bg-white"
                >
                  <option value="all">All Transactions</option>
                  <option value="earning">Earnings</option>
                  <option value="withdrawal">Withdrawals</option>
                  <option value="refund">Refunds</option>
                </select>
              </div>
            </div>

            {filteredTransactions.length === 0 ? (
              <EmptyState
                icon={<Wallet className="h-8 w-8" />}
                title="No transactions found"
                description={filter !== 'all' ? 'Try changing the filter' : 'Your transactions will appear here'}
                compact
              />
            ) : (
              <>
                <div className="space-y-4">
                  {filteredTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      tabIndex={0}
                      role="row"
                      className="flex items-center justify-between p-4 bg-nilin-muted/30 rounded-nilin hover:bg-nilin-muted/50 transition-colors cursor-pointer"
                      aria-label={`Transaction: ${transaction.description}, Amount: ${transaction.amount > 0 ? '+' : ''}${transaction.amount}, Status: ${transaction.status}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          // Transaction detail expansion can be added here if needed
                        }
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          transaction.amount > 0 ? 'bg-green-100' : 'bg-gray-100'
                        }`}>
                          {getTransactionIcon(transaction.type)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-nilin-charcoal">{transaction.description}</p>
                            <span className="text-xs px-2 py-0.5 bg-nilin-muted rounded text-nilin-warmGray">
                              {formatTransactionType(transaction.type)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-nilin-warmGray">
                              {transaction.date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            {transaction.bookingId && (
                              <>
                                <span className="text-nilin-warmGray">•</span>
                                <span className="text-sm text-nilin-warmGray">{transaction.bookingId}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${
                          transaction.amount > 0 ? 'text-green-600' : 'text-nilin-charcoal'
                        }`}>
                          {transaction.amount > 0 ? '+' : ''}{formatPrice(Math.abs(transaction.amount), wallet?.currency)}
                        </p>
                        {getStatusBadge(transaction.status)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-nilin-border">
                    <p className="text-sm text-nilin-warmGray">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-nilin border border-nilin-border hover:bg-nilin-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-4 w-4 text-nilin-charcoal" />
                      </button>
                      <span className="px-3 py-1 text-sm text-nilin-charcoal">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-nilin border border-nilin-border hover:bg-nilin-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-4 w-4 text-nilin-charcoal" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="withdraw-modal-title"
        >
          <div className="bg-white rounded-nilin-lg max-w-md w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 id="withdraw-modal-title" className="text-xl font-serif text-nilin-charcoal">Withdraw Funds</h2>
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawalError(null);
                  setWithdrawalSuccess(false);
                }}
                className="p-2 hover:bg-nilin-muted rounded-nilin transition-colors"
              >
                <X className="h-5 w-5 text-nilin-warmGray" />
              </button>
            </div>

            {withdrawalSuccess ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">Withdrawal Submitted!</h3>
                <p className="text-nilin-warmGray text-sm">
                  Your withdrawal request has been submitted and will be processed within 2-3 business days.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="text-sm text-nilin-warmGray mb-2">Available Balance</p>
                  <p className="text-2xl font-bold text-nilin-charcoal">
                    {formatPrice(availableBalance, wallet?.currency)}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                      Withdrawal Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nilin-warmGray">
                        {wallet?.currency || 'AED'}
                      </span>
                      <input
                        type="number"
                        value={withdrawalForm.amount}
                        onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                        placeholder="0.00"
                        min="1"
                        max={availableBalance}
                        className="w-full pl-12 pr-4 py-3 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal text-lg"
                      />
                    </div>
                  </div>

                  {/* Quick Amount Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {[50, 100, 250, 500].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setWithdrawalForm({ ...withdrawalForm, amount: amount.toString() })}
                        disabled={amount > availableBalance}
                        className="px-3 py-2 rounded-nilin border border-nilin-border text-sm font-medium text-nilin-charcoal hover:bg-nilin-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {formatPrice(amount, wallet?.currency)}
                      </button>
                    ))}
                    <button
                      onClick={() => setWithdrawalForm({ ...withdrawalForm, amount: availableBalance.toString() })}
                      className="px-3 py-2 rounded-nilin border border-nilin-border text-sm font-medium text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                    >
                      Max
                    </button>
                  </div>

                  {/* Bank Account Details */}
                  <div className="pt-4 border-t border-nilin-border">
                    <h4 className="text-sm font-medium text-nilin-charcoal mb-4 flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Bank Account Details
                    </h4>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-nilin-warmGray mb-1">Bank Name</label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                          <input
                            type="text"
                            value={withdrawalForm.bankName}
                            onChange={(e) => setWithdrawalForm({ ...withdrawalForm, bankName: e.target.value })}
                            placeholder="e.g. Emirates NBD"
                            className="w-full pl-10 pr-4 py-2.5 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-nilin-warmGray mb-1">Account Holder Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                          <input
                            type="text"
                            value={withdrawalForm.accountHolder}
                            onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountHolder: e.target.value })}
                            placeholder="Full name as per bank records"
                            className="w-full pl-10 pr-4 py-2.5 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-nilin-warmGray mb-1">Account Number</label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                          <input
                            type="text"
                            value={withdrawalForm.accountNumber}
                            onChange={(e) => setWithdrawalForm({ ...withdrawalForm, accountNumber: e.target.value })}
                            placeholder="Account number"
                            className="w-full pl-10 pr-4 py-2.5 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-nilin-warmGray mb-1">IBAN</label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                          <input
                            type="text"
                            value={withdrawalForm.iban}
                            onChange={(e) => setWithdrawalForm({ ...withdrawalForm, iban: e.target.value })}
                            placeholder="e.g. AE12 3456 7890 1234 5678 90"
                            className="w-full pl-10 pr-4 py-2.5 rounded-nilin border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="p-4 bg-blue-50 rounded-nilin">
                    <div className="flex items-start gap-3">
                      <CreditCard className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-900">Processing Time</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Funds will be transferred to your account within 2-3 business days after approval.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {withdrawalError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-nilin flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{withdrawalError}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleWithdraw}
                      disabled={isWithdrawing || !withdrawalForm.amount}
                      className="flex-1 btn-nilin flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isWithdrawing ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Wallet className="h-4 w-4" />
                          Withdraw Funds
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowWithdrawModal(false);
                        setWithdrawalError(null);
                      }}
                      className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default ProviderEarningsPage;
