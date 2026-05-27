import React, { useState, useEffect, useCallback } from 'react';
import { WalletBalance } from '../../components/marketplace/WalletBalance';
import { AddMoneyModal } from '../../components/wallet/AddMoneyModal';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, CreditCard, History, Gift, Users, Sparkles, ChevronRight, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatting';
import { walletApi, type WalletTransaction } from '../../services/walletApi';
import { loyaltyApi, type LoyaltyStatus } from '../../services/loyaltyApi';

interface RecentTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
  icon: 'trending' | 'card' | 'gift';
}

const WalletPage: React.FC = () => {
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [transactions, setTransactions] = useState<RecentTransaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const response = await walletApi.getTransactions({ limit: 5 });
      if (response.success && response.data?.transactions) {
        const mappedTransactions: RecentTransaction[] = response.data.transactions.map((t: WalletTransaction) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt,
          icon: t.referenceType === 'bonus' || t.referenceType === 'refund' ? 'gift' : t.type === 'credit' ? 'trending' : 'card',
        }));
        setTransactions(mappedTransactions);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load transactions';
      setTransactionsError(errorMessage);
      console.error('Failed to fetch transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  const fetchLoyaltyStatus = useCallback(async () => {
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    try {
      const response = await loyaltyApi.getStatus();
      if (response.success && response.data) {
        setLoyaltyStatus(response.data);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load loyalty status';
      setLoyaltyError(errorMessage);
      console.error('Failed to fetch loyalty status:', err);
    } finally {
      setLoyaltyLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    fetchLoyaltyStatus();
  }, [fetchTransactions, fetchLoyaltyStatus]);

  const handleAddMoneySuccess = (amount: number, newBalance: number) => {
    toast.success(`${formatCurrency(amount, 'AED')} added successfully!`);
    fetchTransactions();
  };

  const formatTransactionTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
      } else if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
      } else if (diffDays < 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch {
      return 'Unknown';
    }
  };

  const getTransactionIcon = (iconType: 'trending' | 'card' | 'gift') => {
    switch (iconType) {
      case 'trending':
        return <TrendingUp className="w-5 h-5 text-green-600" />;
      case 'card':
        return <CreditCard className="w-5 h-5 text-red-600" />;
      case 'gift':
        return <Gift className="w-5 h-5 text-amber-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-nilin-cream pb-20 lg:pb-8">
      {/* Add Money Modal */}
      <AddMoneyModal
        isOpen={showAddMoney}
        onClose={() => setShowAddMoney(false)}
        onSuccess={handleAddMoneySuccess}
      />
      {/* Header - Hidden on Desktop */}
      <div className="lg:hidden">
        <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose text-white p-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/customer/profile" className="p-2 -ml-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold">My Wallet</h1>
          </div>
          <WalletBalance />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Desktop Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/customer/profile" className="p-2 hover:bg-nilin-blush rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-nilin-charcoal" />
                </Link>
                <div>
                  <h1 className="text-2xl font-serif font-bold text-nilin-charcoal">My Wallet</h1>
                  <p className="text-sm text-nilin-warmGray">Manage your balance and payments</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - Wallet & Stats */}
            <div className="col-span-2 space-y-6">
              {/* Wallet Card */}
              <div className="bg-white rounded-2xl shadow-nilin overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">Balance Overview</h2>
                </div>
                <div className="p-6">
                  <WalletBalance />
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="bg-white rounded-2xl shadow-nilin overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">Quick Actions</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-4 gap-4">
                    <button
                      onClick={() => setShowAddMoney(true)}
                      className="group bg-nilin-blush/30 hover:bg-nilin-blush/50 rounded-xl p-4 text-center transition-all"
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-nilin-coral flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">Add Money</span>
                    </button>

                    <Link
                      to="/customer/payment-methods"
                      className="group bg-green-50/50 hover:bg-green-100/50 rounded-xl p-4 text-center transition-all"
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-green-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">Payment Methods</span>
                    </Link>

                    <Link
                      to="/customer/bookings"
                      className="group bg-purple-50/50 hover:bg-purple-100/50 rounded-xl p-4 text-center transition-all"
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-purple-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <History className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">Transactions</span>
                    </Link>

                    <Link
                      to="/customer/rewards"
                      className="group bg-amber-50/50 hover:bg-amber-100/50 rounded-xl p-4 text-center transition-all"
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-amber-500 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">Rewards</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-2xl shadow-nilin overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">Recent Activity</h2>
                  <Link to="/customer/transactions" className="text-sm text-nilin-coral hover:underline flex items-center gap-1">
                    View All <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="p-6">
                  {transactionsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                    </div>
                  ) : transactionsError ? (
                    <div className="text-center py-4">
                      <p className="text-sm text-red-500 mb-2">{transactionsError}</p>
                      <button
                        onClick={fetchTransactions}
                        className="text-sm text-nilin-coral hover:underline"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-nilin-warmGray">No transactions yet</p>
                      <p className="text-xs text-nilin-warmGray mt-1">Your recent activity will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {transactions.map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              transaction.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              {getTransactionIcon(transaction.icon)}
                            </div>
                            <div>
                              <p className="font-medium text-nilin-charcoal">{transaction.description}</p>
                              <p className="text-xs text-nilin-warmGray">{formatTransactionTime(transaction.createdAt)}</p>
                            </div>
                          </div>
                          <span className={`font-semibold ${transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                            {transaction.type === 'credit' ? '+' : '-'}{formatCurrency(transaction.amount, 'AED')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Promotions & Info */}
            <div className="space-y-6">
              {/* Invite & Earn Card */}
              <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-2xl p-6 text-white shadow-nilin">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Invite & Earn</h3>
                    <p className="text-white/80 text-sm">Share with friends</p>
                  </div>
                </div>
                <p className="text-white/90 mb-4">
                  Get <span className="font-bold text-white">{formatCurrency(100, 'AED')}</span> for each friend who signs up and completes their first booking!
                </p>
                <Link
                  to="/customer/profile?tab=referral"
                  className="block w-full py-3 bg-white text-nilin-coral text-center font-semibold rounded-xl hover:bg-white/95 transition-colors"
                >
                  Invite Friends
                </Link>
              </div>

              {/* Loyalty Points Card */}
              <div className="bg-white rounded-2xl p-6 shadow-nilin">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-nilin-blush flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-nilin-coral" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-nilin-charcoal">Loyalty Points</h3>
                    <p className="text-sm text-nilin-warmGray">Your rewards</p>
                  </div>
                </div>
                {loyaltyLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                  </div>
                ) : loyaltyError ? (
                  <div className="text-center py-4">
                    <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                    <p className="text-xs text-red-500">{loyaltyError}</p>
                    <button
                      onClick={fetchLoyaltyStatus}
                      className="text-xs text-nilin-coral hover:underline mt-1"
                    >
                      Try Again
                    </button>
                  </div>
                ) : loyaltyStatus ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-3xl font-bold text-nilin-charcoal">
                          {loyaltyStatus.coins?.toLocaleString() || 0}
                        </p>
                        <p className="text-xs text-nilin-warmGray">points available</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-amber-500 capitalize">
                          {loyaltyStatus.tier || 'Bronze'} Member
                        </p>
                        {loyaltyStatus.nextTier && (
                          <p className="text-xs text-nilin-warmGray">
                            {loyaltyStatus.pointsToNextTier?.toLocaleString() || 0} to {loyaltyStatus.nextTier}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="h-2 bg-nilin-blush rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(loyaltyStatus.progressToNext || 0, 100)}%` }}
                      />
                    </div>
                    <Link
                      to="/customer/rewards"
                      className="block mt-4 text-center text-sm text-nilin-coral font-medium hover:underline"
                    >
                      View Rewards Details
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-nilin-warmGray">Unable to load loyalty data</p>
                  </div>
                )}
              </div>

              {/* Help Card */}
              <div className="bg-white rounded-2xl p-6 shadow-nilin">
                <h3 className="font-semibold text-nilin-charcoal mb-3">Need Help?</h3>
                <p className="text-sm text-nilin-warmGray mb-4">
                  Contact our support team for any wallet-related queries.
                </p>
                <Link
                  to="/support"
                  className="block text-center py-2 text-nilin-coral font-medium hover:underline"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Layout - Same as before */}
      <div className="lg:hidden">
        {/* Quick Actions */}
        <div className="p-4">
          <h2 className="font-semibold text-nilin-charcoal mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowAddMoney(true)}
              className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Plus className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium">Add Money</span>
            </button>

            <Link
              to="/customer/payment-methods"
              className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-sm font-medium">Payment Methods</span>
            </Link>

            <Link
              to="/customer/bookings"
              className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <History className="w-6 h-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium">Transaction History</span>
            </Link>

            <Link
              to="/customer/rewards"
              className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Gift className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-sm font-medium">Rewards & Offers</span>
            </Link>
          </div>
        </div>

        {/* Promotions Banner */}
        <div className="p-4">
          <div className="bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-2xl p-4 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">Invite & Earn</h3>
                <p className="text-white/80 text-sm">Get {formatCurrency(100, 'AED')} for each friend!</p>
              </div>
            </div>
            <Link
              to="/customer/profile?tab=referral"
              className="block w-full py-2 bg-white text-nilin-coral text-center font-semibold rounded-lg text-sm"
            >
              Invite Friends
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
