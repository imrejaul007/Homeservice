import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { WalletBalance } from '../../components/marketplace/WalletBalance';
import { AddMoneyModal } from '../../components/wallet/AddMoneyModal';
import NavigationHeader from '../../components/layout/NavigationHeader';
import { CashbackTracking } from '../../components/customer/CashbackTracking';
import { AutoTopup } from '../../components/customer/AutoTopup';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, CreditCard, History, Gift, Users, Sparkles, ChevronRight, TrendingUp, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatting';
import { loyaltyApi, type LoyaltyStatus } from '../../services/loyaltyApi';
import { useWallet, useRefreshWallet, trackRevenueEvent } from '../../services/marketplace/RevenueService';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { socketService } from '../../services/socket';
import { api } from '../../services/api';
import { track, EventCategory, PaymentEvent } from '../../lib/eventTaxonomy';
import { useTranslation } from '../../hooks/useTranslation';

interface RecentTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
  icon: 'trending' | 'card' | 'gift';
}

const WalletPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const wallet = useWallet('customer');
  const { refresh, refreshTransactions, updateWalletBalance, loading: walletLoading, error: walletError } = useRefreshWallet('customer');
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(true);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [referrerReward, setReferrerReward] = useState<number>(500);

  const transactions = useMemo<RecentTransaction[]>(() =>
    (wallet.transactions ?? []).slice(0, 5).map((tx) => {
      const reason = (tx.reason || '').toLowerCase();
      const icon: RecentTransaction['icon'] =
        reason.includes('bonus') || reason.includes('refund') || reason.includes('cashback')
          ? 'gift'
          : tx.type === 'credit'
            ? 'trending'
            : 'card';
      return {
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        description: tx.reason || 'Transaction',
        createdAt: tx.createdAt,
        icon,
      };
    }),
  [wallet.transactions]);

  // Wallet currency (defaults to AED if not provided) for consistent formatting
  const walletCurrency = wallet.currency || 'AED';

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
      // Surface inline only — the loyalty card already shows a retry UI.
    } finally {
      setLoyaltyLoading(false);
    }
  }, []);

  const fetchReferralReward = useCallback(async () => {
    try {
      const response = await api.get('/referrals/my-code');
      if (response.data?.data?.referrerReward) {
        setReferrerReward(response.data.data.referrerReward);
      }
    } catch {
      // Keep default reward amount
    }
  }, []);

  useEffect(() => {
    fetchLoyaltyStatus();
    fetchReferralReward();
    track(EventCategory.PAYMENT, PaymentEvent.WALLET_BALANCE_CHECK, { page: 'wallet' });
    trackRevenueEvent('wallet_topup', { action: 'page_view' });
  }, [fetchLoyaltyStatus, fetchReferralReward]);

  useEffect(() => {
    const unsubscribe = socketService.onWalletBalanceUpdated((data) => {
      updateWalletBalance(data.balance, data.pendingBalance);
      refreshTransactions();
    });
    return unsubscribe;
  }, [updateWalletBalance, refreshTransactions]);

  const handleAddMoneySuccess = (amount: number, newBalance: number, pendingBalance?: number) => {
    toast.success(t('wallet.add_money_success', { amount: formatCurrency(amount, 'AED') }));
    updateWalletBalance(newBalance, pendingBalance);
    refresh();
    track(EventCategory.PAYMENT, PaymentEvent.WALLET_TOP_UP, { amount, newBalance });
    trackRevenueEvent('wallet_topup', { amount, newBalance });
  };

  const handleCashbackRedeem = () => {
    refresh();
  };

  const formatTransactionTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return t('wallet.tx_unknown_date');

      const now = new Date();
      // Use calendar-day comparison (ignore time-of-day) to avoid midnight drift
      const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const diffDays = Math.max(
        0,
        Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / (1000 * 60 * 60 * 24))
      );

      const timeOfDay = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      if (diffDays === 0) {
        return `Today, ${timeOfDay}`;
      } else if (diffDays === 1) {
        return `Yesterday, ${timeOfDay}`;
      } else if (diffDays <= 7) {
        return `${diffDays} days ago`;
      } else {
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      }
    } catch {
      return t('wallet.tx_unknown_date');
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
      default:
        return <CreditCard className="w-5 h-5 text-nilin-warmGray" />;
    }
  };

  return (
    <PageErrorBoundary pageName="Wallet">
    <div className="min-h-screen bg-nilin-cream pb-20 lg:pb-8">
      {/* Add Money Modal */}
      <AddMoneyModal
        isOpen={showAddMoney}
        onClose={() => setShowAddMoney(false)}
        onSuccess={handleAddMoneySuccess}
      />

      {/* Site-wide header with location filter, search and nav */}
      <NavigationHeader showSearch={false} showCategoryTabs={false} />

      {/* Header - Hidden on Desktop */}
      <div className="lg:hidden">
        <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose text-white p-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/customer/profile" className="w-11 h-11 p-0 flex items-center justify-center -ml-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold">{t('wallet.title')}</h1>
          </div>
          <WalletBalance
            walletContext="customer"
            hideRecentTransactions
            onAddMoney={() => setShowAddMoney(true)}
            onViewHistory={() => navigate('/customer/transactions')}
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block">
        {/* Desktop Header */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link to="/customer/profile" className="w-11 h-11 p-0 flex items-center justify-center hover:bg-nilin-blush rounded-xl transition-colors">
                  <ArrowLeft className="w-5 h-5 text-nilin-charcoal" />
                </Link>
                <div>
                  <h1 className="text-2xl font-serif font-bold text-nilin-charcoal">{t('wallet.title')}</h1>
                  <p className="text-sm text-nilin-warmGray">{t('wallet.subtitle')}</p>
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
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">{t('wallet.balance_overview')}</h2>
                  <button
                    onClick={() => setShowAddMoney(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-nilin-warm"
                  >
                    <Plus className="w-4 h-4" />
                    {t('wallet.add_money')}
                  </button>
                </div>
                <div className="p-6">
                  <WalletBalance
                    walletContext="customer"
                    hideRecentTransactions
                    onAddMoney={() => setShowAddMoney(true)}
                    onViewHistory={() => navigate('/customer/transactions')}
                  />
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="bg-white rounded-2xl shadow-nilin overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">{t('wallet.quick_actions')}</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-4 gap-3">
                    <button
                      onClick={() => setShowAddMoney(true)}
                      aria-label={t('payment.add_funds')}
                      className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-nilin-blush/30 hover:bg-nilin-blush/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-nilin-coral flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.add_money')}</span>
                    </button>

                    <Link
                      to="/customer/payment-methods"
                      className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-nilin-blush/30 hover:bg-nilin-blush/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-nilin-rose flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.payment_methods')}</span>
                    </Link>

                    <Link
                      to="/customer/transactions"
                      className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-nilin-blush/30 hover:bg-nilin-blush/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-nilin-charcoal flex items-center justify-center group-hover:scale-110 transition-transform">
                        <History className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.transactions')}</span>
                    </Link>

                    <Link
                      to="/customer/rewards"
                      className="group flex flex-col items-center gap-3 p-4 rounded-xl bg-nilin-blush/30 hover:bg-nilin-blush/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 transition-all"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-nilin-warning flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Gift className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.rewards')}</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              <div className="bg-white rounded-2xl shadow-nilin overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-nilin-charcoal">{t('wallet.recent_activity')}</h2>
                  <Link
                    to="/customer/transactions"
                    className="text-sm text-nilin-coral hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md px-1"
                  >
                    {t('wallet.view_all')} <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
                <div className="p-6">
                  {walletLoading ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3" role="status" aria-live="polite">
                      <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                      <p className="text-xs text-nilin-warmGray">{t('common.loading') || 'Loading…'}</p>
                    </div>
                  ) : walletError ? (
                    <div className="text-center py-6">
                      <AlertCircle className="w-8 h-8 text-nilin-error mx-auto mb-2" />
                      <p className="text-sm text-nilin-charcoal mb-2">{walletError}</p>
                      <button
                        onClick={() => refresh()}
                        className="text-sm text-nilin-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md px-2 py-1"
                      >
                        {t('common.retry')}
                      </button>
                    </div>
                  ) : transactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <div className="w-16 h-16 rounded-full bg-nilin-blush/50 flex items-center justify-center mb-4">
                        <History className="w-7 h-7 text-nilin-coral" />
                      </div>
                      <p className="text-sm font-medium text-nilin-charcoal mb-1">{t('wallet.no_transactions')}</p>
                      <p className="text-xs text-nilin-warmGray max-w-[260px]">{t('wallet.no_transactions_hint')}</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-50 -my-2">
                      {transactions.map((transaction) => (
                        <li key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                              transaction.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                              {getTransactionIcon(transaction.icon)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-nilin-charcoal truncate">{transaction.description}</p>
                              <p className="text-xs text-nilin-warmGray">{formatTransactionTime(transaction.createdAt)}</p>
                            </div>
                          </div>
                          <span className={`flex-shrink-0 font-semibold tabular-nums ${
                            transaction.type === 'credit' ? 'text-nilin-success' : 'text-nilin-error'
                          }`}>
                            {transaction.type === 'credit' ? '+' : '−'}{formatCurrency(transaction.amount, walletCurrency)}
                          </span>
                        </li>
                      ))}
                    </ul>
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
                    <h3 className="font-bold text-lg">{t('wallet.invite_earn')}</h3>
                    <p className="text-white/80 text-sm">{t('wallet.share_with_friends')}</p>
                  </div>
                </div>
                <p className="text-white/90 mb-4">
                  {t('wallet.invite_earn_desc', { coins: referrerReward.toLocaleString() })}
                </p>
                <Link
                  to="/customer/profile?tab=referral"
                  className="block w-full py-3 bg-white text-nilin-coral text-center font-semibold rounded-xl hover:bg-white/95 transition-colors"
                >
                  {t('wallet.invite_friends')}
                </Link>
              </div>

              {/* Loyalty Points Card */}
              <div className="bg-white rounded-2xl p-6 shadow-nilin">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-nilin-blush flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-nilin-coral" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-nilin-charcoal">{t('wallet.loyalty_points')}</h3>
                    <p className="text-sm text-nilin-warmGray">{t('wallet.your_rewards')}</p>
                  </div>
                </div>
                {loyaltyLoading ? (
                  <div className="flex items-center justify-center py-6" role="status" aria-live="polite">
                    <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                  </div>
                ) : loyaltyError ? (
                  <div className="text-center py-4">
                    <AlertCircle className="w-5 h-5 text-nilin-error mx-auto mb-2" />
                    <p className="text-xs text-nilin-warmGray mb-2">{loyaltyError}</p>
                    <button
                      onClick={fetchLoyaltyStatus}
                      className="text-xs text-nilin-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md px-2 py-1"
                    >
                      {t('wallet.try_again')}
                    </button>
                  </div>
                ) : loyaltyStatus ? (
                  <>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="text-3xl font-bold text-nilin-charcoal tabular-nums">
                        {(loyaltyStatus.coins ?? 0).toLocaleString()}
                      </p>
                      <p className="text-sm font-semibold text-amber-500 capitalize">
                        {loyaltyStatus.tier
                          ? t('wallet.member', { tier: loyaltyStatus.tier })
                          : t('wallet.member', { tier: 'bronze' })}
                      </p>
                    </div>
                    <p className="text-xs text-nilin-warmGray mb-4">{t('wallet.points_available')}</p>
                    {loyaltyStatus.nextTier && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-nilin-warmGray mb-1.5">
                          <span>
                            {t('wallet.points_to_tier', {
                              points: (loyaltyStatus.pointsToNextTier ?? 0).toLocaleString(),
                              tier: loyaltyStatus.nextTier,
                            })}
                          </span>
                          <span className="tabular-nums">{Math.min(loyaltyStatus.progressToNext ?? 0, 100)}%</span>
                        </div>
                        <div className="h-2 bg-nilin-blush rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(loyaltyStatus.progressToNext ?? 0, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <Link
                      to="/customer/rewards"
                      className="block mt-4 text-center text-sm text-nilin-coral font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md py-1"
                    >
                      {t('wallet.view_rewards_details')}
                    </Link>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-nilin-warmGray">{t('wallet.unable_load_loyalty')}</p>
                  </div>
                )}
              </div>

              {/* Cashback — compact component renders its own card; no extra wrapper shadow */}
              <CashbackTracking compact onRedeemSuccess={handleCashbackRedeem} />

              {/* Auto Top-up — compact component renders its own card; no extra wrapper shadow */}
              <AutoTopup compact onConfigChange={refresh} />

              {/* Help Card */}
              <div className="bg-white rounded-2xl p-6 shadow-nilin">
                <h3 className="font-semibold text-nilin-charcoal mb-3">{t('wallet.need_help')}</h3>
                <p className="text-sm text-nilin-warmGray mb-4">
                  {t('wallet.need_help_desc')}
                </p>
                <Link
                  to="/help"
                  className="block text-center py-2 text-nilin-coral font-medium hover:underline"
                >
                  {t('wallet.contact_support')}
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
          <h2 className="font-semibold text-nilin-charcoal mb-4">{t('wallet.quick_actions')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowAddMoney(true)}
              aria-label={t('payment.add_funds')}
              className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-nilin-sm hover:shadow-nilin transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-nilin-coral flex items-center justify-center">
                <Plus className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.add_money')}</span>
            </button>

            <Link
              to="/customer/payment-methods"
              className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-nilin-sm hover:shadow-nilin transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-nilin-rose flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.payment_methods')}</span>
            </Link>

            <Link
              to="/customer/transactions"
              className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-nilin-sm hover:shadow-nilin transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-nilin-charcoal flex items-center justify-center">
                <History className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.transaction_history')}</span>
            </Link>

            <Link
              to="/customer/rewards"
              className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2 shadow-nilin-sm hover:shadow-nilin transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
            >
              <div className="w-12 h-12 rounded-2xl bg-nilin-warning flex items-center justify-center">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <span className="text-sm font-medium text-nilin-charcoal">{t('wallet.rewards_offers')}</span>
            </Link>
          </div>
        </div>

        {/* Promotions Banner */}
        <div className="p-4">
          <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-2xl p-4 text-white shadow-nilin-warm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold">{t('wallet.invite_earn')}</h3>
                <p className="text-white/85 text-sm">{t('wallet.earn_coins_per_friend', { coins: referrerReward.toLocaleString() })}</p>
              </div>
            </div>
            <Link
              to="/customer/profile?tab=referral"
              className="block w-full py-2.5 bg-white text-nilin-coral text-center font-semibold rounded-xl text-sm hover:bg-white/95 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {t('wallet.invite_friends')}
            </Link>
          </div>
        </div>

        {/* Mobile: Recent Activity */}
        <div className="p-4">
          <div className="bg-white rounded-2xl shadow-nilin-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-nilin-charcoal">{t('wallet.recent_activity')}</h2>
              <Link
                to="/customer/transactions"
                className="text-sm text-nilin-coral hover:underline flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md px-1"
              >
                {t('wallet.view_all')} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="p-4">
              {walletLoading ? (
                <div className="flex items-center justify-center py-6 gap-2" role="status" aria-live="polite">
                  <Loader2 className="w-5 h-5 text-nilin-coral animate-spin" />
                  <span className="text-xs text-nilin-warmGray">{t('common.loading') || 'Loading…'}</span>
                </div>
              ) : walletError ? (
                <div className="text-center py-4">
                  <AlertCircle className="w-6 h-6 text-nilin-error mx-auto mb-2" />
                  <p className="text-sm text-nilin-charcoal mb-2">{walletError}</p>
                  <button
                    onClick={() => refresh()}
                    className="text-sm text-nilin-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md px-2 py-1"
                  >
                    {t('common.retry')}
                  </button>
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-nilin-blush/50 flex items-center justify-center mb-3">
                    <History className="w-6 h-6 text-nilin-coral" />
                  </div>
                  <p className="text-sm font-medium text-nilin-charcoal mb-1">{t('wallet.no_transactions')}</p>
                  <p className="text-xs text-nilin-warmGray max-w-[220px]">{t('wallet.no_transactions_hint')}</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50 -my-1">
                  {transactions.map((transaction) => (
                    <li key={transaction.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                          transaction.type === 'credit' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {getTransactionIcon(transaction.icon)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-nilin-charcoal">{transaction.description}</p>
                          <p className="text-xs text-nilin-warmGray">{formatTransactionTime(transaction.createdAt)}</p>
                        </div>
                      </div>
                      <span className={`flex-shrink-0 text-sm font-semibold tabular-nums ${
                        transaction.type === 'credit' ? 'text-nilin-success' : 'text-nilin-error'
                      }`}>
                        {transaction.type === 'credit' ? '+' : '−'}{formatCurrency(transaction.amount, walletCurrency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Mobile: Loyalty Points */}
        <div className="p-4">
          <div className="bg-white rounded-2xl p-4 shadow-nilin-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-blush flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-nilin-coral" />
              </div>
              <div>
                <h3 className="font-semibold text-nilin-charcoal">{t('wallet.loyalty_points')}</h3>
                <p className="text-xs text-nilin-warmGray">{t('wallet.your_rewards')}</p>
              </div>
            </div>
            {loyaltyLoading ? (
              <div className="flex items-center justify-center py-3" role="status" aria-live="polite">
                <Loader2 className="w-5 h-5 text-nilin-coral animate-spin" />
              </div>
            ) : loyaltyStatus ? (
              <>
                <p className="text-2xl font-bold text-nilin-charcoal tabular-nums">
                  {(loyaltyStatus.coins ?? 0).toLocaleString()}
                </p>
                <p className="text-xs text-amber-500 capitalize">
                  {t('wallet.member', { tier: loyaltyStatus.tier || 'bronze' })}
                </p>
                <Link
                  to="/customer/rewards"
                  className="block mt-3 text-sm text-nilin-coral font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md py-1"
                >
                  {t('wallet.view_rewards_details')}
                </Link>
              </>
            ) : (
              <p className="text-sm text-nilin-warmGray">{t('wallet.unable_load_loyalty')}</p>
            )}
          </div>
        </div>

        {/* Mobile: Cashback — compact component renders its own card */}
        <div className="px-4">
          <CashbackTracking compact onRedeemSuccess={handleCashbackRedeem} />
        </div>

        {/* Mobile: Auto Top-up — compact component renders its own card */}
        <div className="px-4">
          <AutoTopup compact onConfigChange={refresh} />
        </div>

        {/* Mobile: Help */}
        <div className="p-4 pb-8">
          <div className="bg-white rounded-2xl p-4 shadow-nilin-sm">
            <h3 className="font-semibold text-nilin-charcoal mb-2">{t('wallet.need_help')}</h3>
            <p className="text-sm text-nilin-warmGray mb-3">{t('wallet.need_help_desc')}</p>
            <Link
              to="/help"
              className="text-sm text-nilin-coral font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md py-1"
            >
              {t('wallet.contact_support')}
            </Link>
          </div>
        </div>
      </div>
    </div>
    </PageErrorBoundary>
  );
};

export default WalletPage;
