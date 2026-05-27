// Wallet Balance Component - Credits and transactions
import { motion } from 'framer-motion';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useWallet, useRefreshWallet, WalletTransaction } from '../../services/marketplace/RevenueService';

interface WalletBalanceProps {
  onAddMoney?: () => void;
  onViewHistory?: () => void;
  compact?: boolean;
}

export function WalletBalance({ onAddMoney, onViewHistory, compact = false }: WalletBalanceProps) {
  const wallet = useWallet();
  const { loading, error, refresh } = useRefreshWallet();

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
              <p className="text-sm text-red-400" onClick={(e) => { e.stopPropagation(); refresh(); }}>
                Tap to retry
              </p>
            ) : (
              <p className="text-lg font-bold">₹{wallet.balance}</p>
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
            <p className="text-white/60 text-sm">Available Balance</p>
            {error ? (
              <p className="text-3xl font-bold text-red-400">--</p>
            ) : (
              <p className="text-3xl font-bold">₹{wallet.balance.toLocaleString()}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onAddMoney}
              className="p-3 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs">This Month</p>
            <p className="text-lg font-bold text-green-400">+₹{wallet.transactions.filter((t: WalletTransaction) => t.type === 'credit').reduce((s: number, t: WalletTransaction) => s + t.amount, 0)}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3">
            <p className="text-white/60 text-xs">Pending</p>
            <p className="text-lg font-bold text-amber-400">₹0</p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Recent Transactions</p>
            <button onClick={onViewHistory} className="text-xs text-nilin-coral hover:underline flex items-center gap-1">
              View All <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {wallet.transactions.slice(0, 3).map((transaction: WalletTransaction) => (
            <div key={transaction.id} className="flex items-center justify-between py-2 border-b border-white/10 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  transaction.type === 'credit'
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {transaction.type === 'credit' ? (
                    <ArrowDownLeft className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{transaction.reason}</p>
                  <p className="text-xs text-white/50">{new Date(transaction.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              <span className={`font-medium ${transaction.type === 'credit' ? 'text-green-400' : 'text-red-400'}`}>
                {transaction.type === 'credit' ? '+' : '-'}₹{transaction.amount}
              </span>
            </div>
          ))}
          {wallet.transactions.length === 0 && (
            <p className="text-sm text-white/50 text-center py-4">No transactions yet</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default WalletBalance;
