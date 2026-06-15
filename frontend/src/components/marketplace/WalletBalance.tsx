// Wallet Balance Component - Credits and transactions
import { motion } from 'framer-motion';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useWallet, useRefreshWallet, WalletTransaction, type WalletContext } from '../../services/marketplace/RevenueService';
import { useTranslation } from '../../hooks/useTranslation';

// Currency code to symbol mapping
const CURRENCY_SYMBOLS: Record<string, string> = {
  AED: 'د.إ',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  SAR: '﷼',
  QAR: '﷼',
  KWD: 'د.ك',
  BHD: '.د.ب',
  OMR: 'ر.ع.',
  CHF: 'CHF',
  SGD: 'S$',
};

function getCurrencySymbol(currencyCode: string): string {
  return CURRENCY_SYMBOLS[currencyCode] || currencyCode;
}

interface WalletBalanceProps {
  onAddMoney?: () => void;
  onViewHistory?: () => void;
  compact?: boolean;
  walletContext?: WalletContext;
  hideRecentTransactions?: boolean;
}

export function WalletBalance({
  onAddMoney,
  onViewHistory,
  compact = false,
  walletContext = 'customer',
  hideRecentTransactions = false,
}: WalletBalanceProps) {
  const { t } = useTranslation();
  const wallet = useWallet(walletContext);
  const { loading, error, refresh } = useRefreshWallet(walletContext);

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={onViewHistory}
        className="flex items-center justify-between bg-gradient-to-r from-[#2D2D2D] to-[#1a1a1a] rounded-2xl p-4 text-white cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Wallet className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-xs text-white/60">Wallet</p>
            {error ? (
              <p className="text-sm text-nilin-error" onClick={(e) => { e.stopPropagation(); refresh(); }}>
                Tap to retry
              </p>
            ) : (
              <p className="text-lg font-bold">{getCurrencySymbol(wallet.currency)}{wallet.balance}</p>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/40" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-[#2D2D2D] to-[#1a1a1a] rounded-3xl p-6 text-white relative overflow-hidden"
    >
      {/* Background pattern */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-white/60 text-sm">{t('wallet.available_balance')}</p>
            {error ? (
              <p className="text-3xl font-bold text-nilin-error">--</p>
            ) : (
              <p className="text-3xl font-bold">{wallet ? `${getCurrencySymbol(wallet.currency)}${wallet.balance.toLocaleString()}` : '--'}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAddMoney}
              aria-label="Add money to wallet"
              className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs">{t('wallet.monthly_earnings')}</p>
            <p className="text-lg font-bold text-nilin-success">+{getCurrencySymbol(wallet.currency)}{(wallet.monthlyEarnings ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs">{t('wallet.pending_balance')}</p>
            <p className="text-lg font-bold text-nilin-warning">{getCurrencySymbol(wallet.currency)}{(wallet.pendingCredits ?? 0).toLocaleString()}</p>
          </div>
        </div>

        {!hideRecentTransactions && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{t('wallet.recent_transactions')}</p>
            <button onClick={onViewHistory} className="text-xs text-nilin-coral hover:underline flex items-center gap-1">
              {t('wallet.view_all')} <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {wallet.transactions.slice(0, 3).map((transaction: WalletTransaction) => (
            <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  transaction.type === 'credit'
                    ? 'bg-nilin-success/20 text-nilin-success'
                    : 'bg-nilin-error/20 text-nilin-error'
                }`}>
                  {transaction.type === 'credit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium truncate">{transaction.reason}</p>
                  <p className="text-xs text-white/50">{new Date(transaction.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`font-medium tabular-nums ${transaction.type === 'credit' ? 'text-nilin-success' : 'text-nilin-error'}`}>
                {transaction.type === 'credit' ? '+' : '−'}{getCurrencySymbol(wallet.currency)}{transaction.amount}
              </span>
            </div>
          ))}
          {wallet.transactions.length === 0 && (
            <p className="text-sm text-white/50 text-center py-4">{t('wallet.no_transactions')}</p>
          )}
        </div>
        )}
      </div>
    </motion.div>
  );
}

export default WalletBalance;
