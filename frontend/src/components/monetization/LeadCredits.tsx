import React, { useState } from 'react';
import {
  CreditCard,
  Plus,
  Minus,
  History,
  AlertCircle,
  Check,
  Zap,
  Gift,
  TrendingUp,
  Package,
  Star,
  RefreshCw,
  Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';

type CreditPackage = {
  packageId: string;
  name: string;
  creditCount: number;
  pricePerCredit: number;
  totalPrice: number;
  validityDays: number;
  bonusCredits?: number;
  isPopular?: boolean;
};

type TransactionType = 'purchase' | 'bonus' | 'used' | 'expired' | 'refund';

interface CreditTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  balance: number;
  description: string;
  referenceId?: string;
  createdAt: Date;
}

interface LeadCreditsProps {
  availableCredits: number;
  totalCredits: number;
  usedCredits: number;
  transactions: CreditTransaction[];
  onPurchasePackage: (packageId: string) => Promise<void>;
  onEnableAutoRefill: (enabled: boolean, threshold?: number, refillAmount?: number) => Promise<void>;
  isLoading?: boolean;
}

const creditPackages: CreditPackage[] = [
  {
    packageId: 'LEAD-STARTER',
    name: 'Starter Pack',
    creditCount: 10,
    pricePerCredit: 2.50,
    totalPrice: 25.00,
    validityDays: 30,
    bonusCredits: 0,
  },
  {
    packageId: 'LEAD-GROWTH',
    name: 'Growth Pack',
    creditCount: 25,
    pricePerCredit: 2.00,
    totalPrice: 50.00,
    validityDays: 30,
    bonusCredits: 5,
    isPopular: true,
  },
  {
    packageId: 'LEAD-PROFESSIONAL',
    name: 'Professional Pack',
    creditCount: 50,
    pricePerCredit: 1.75,
    totalPrice: 87.50,
    validityDays: 60,
    bonusCredits: 10,
  },
  {
    packageId: 'LEAD-ENTERPRISE',
    name: 'Enterprise Pack',
    creditCount: 100,
    pricePerCredit: 1.50,
    totalPrice: 150.00,
    validityDays: 90,
    bonusCredits: 25,
  },
];

const LeadCredits: React.FC<LeadCreditsProps> = ({
  availableCredits,
  totalCredits,
  usedCredits,
  transactions,
  onPurchasePackage,
  onEnableAutoRefill,
  isLoading = false,
}) => {
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null);
  const [autoRefillEnabled, setAutoRefillEnabled] = useState(false);
  const [autoRefillThreshold, setAutoRefillThreshold] = useState(5);
  const [autoRefillAmount, setAutoRefillAmount] = useState(10);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const transactionColors: Record<TransactionType, { bg: string; text: string; icon: React.ElementType }> = {
    purchase: { bg: 'bg-blue-100', text: 'text-blue-700', icon: CreditCard },
    bonus: { bg: 'bg-green-100', text: 'text-green-700', icon: Gift },
    used: { bg: 'bg-gray-100', text: 'text-gray-700', icon: Minus },
    expired: { bg: 'bg-red-100', text: 'text-red-700', icon: Clock },
    refund: { bg: 'bg-purple-100', text: 'text-purple-700', icon: RefreshCw },
  };

  const handlePurchase = async () => {
    if (!selectedPackage) return;

    setError(null);
    try {
      await onPurchasePackage(selectedPackage.packageId);
      setSelectedPackage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  };

  const handleAutoRefillToggle = async () => {
    try {
      await onEnableAutoRefill(!autoRefillEnabled, autoRefillThreshold, autoRefillAmount);
      setAutoRefillEnabled(!autoRefillEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update auto-refill settings');
    }
  };

  const creditUtilization = totalCredits > 0 ? (usedCredits / totalCredits) * 100 : 0;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">
          Lead Credits
        </h2>
        <p className="text-nilin-gray mt-2 max-w-md mx-auto">
          Purchase credits to access premium leads and increase your visibility to customers.
        </p>
      </div>

      {/* Credit Balance Card */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/70 text-sm">Available Credits</p>
            <p className="text-4xl font-bold">{availableCredits}</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <Zap className="h-8 w-8" />
          </div>
        </div>

        {/* Credit Usage Bar */}
        <div className="relative h-3 bg-white/20 rounded-full mb-2">
          <div
            className="absolute left-0 top-0 h-full bg-white rounded-full transition-all"
            style={{ width: `${creditUtilization}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-white/70">
          <span>Used: {usedCredits}</span>
          <span>Total: {totalCredits}</span>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/20">
          <div className="text-center">
            <p className="text-2xl font-bold">{totalCredits}</p>
            <p className="text-xs text-white/70">Total Purchased</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{usedCredits}</p>
            <p className="text-xs text-white/70">Used</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{totalCredits - usedCredits}</p>
            <p className="text-xs text-white/70">Available</p>
          </div>
        </div>
      </div>

      {/* Credit Packages */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
          Purchase Credits
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {creditPackages.map((pkg) => {
            const isSelected = selectedPackage?.packageId === pkg.packageId;
            const effectiveCredits = pkg.creditCount + (pkg.bonusCredits || 0);

            return (
              <div
                key={pkg.packageId}
                onClick={() => setSelectedPackage(pkg)}
                className={cn(
                  'relative border-2 rounded-xl p-4 cursor-pointer transition-all',
                  isSelected
                    ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                )}
              >
                {pkg.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-xs font-semibold rounded-full shadow">
                    Most Popular
                  </div>
                )}

                <h4 className="font-bold text-nilin-charcoal mb-1">{pkg.name}</h4>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-2xl font-bold text-green-600">{effectiveCredits}</span>
                  <span className="text-sm text-nilin-gray">credits</span>
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-nilin-gray">Base credits</span>
                    <span className="text-nilin-charcoal">{pkg.creditCount}</span>
                  </div>
                  {pkg.bonusCredits && pkg.bonusCredits > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Bonus</span>
                      <span className="font-medium">+{pkg.bonusCredits}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-nilin-gray">Price/credit</span>
                    <span className="text-nilin-charcoal">{formatPrice(pkg.pricePerCredit)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-nilin-gray">Valid for</span>
                    <span className="text-nilin-charcoal">{pkg.validityDays} days</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-lg font-bold text-nilin-charcoal">{formatPrice(pkg.totalPrice)}</p>
                </div>

                {isSelected && (
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-nilin-coral rounded-full flex items-center justify-center shadow-lg">
                    <Check className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Purchase Button */}
      {selectedPackage && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-nilin-charcoal">{selectedPackage.name}</h4>
              <p className="text-sm text-nilin-gray">
                {selectedPackage.creditCount + (selectedPackage.bonusCredits || 0)} credits
                ({selectedPackage.creditCount} base + {selectedPackage.bonusCredits || 0} bonus)
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-nilin-charcoal">{formatPrice(selectedPackage.totalPrice)}</p>
              <p className="text-sm text-nilin-gray">Valid {selectedPackage.validityDays} days</p>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mt-4">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setSelectedPackage(null)}
              className="flex-1 py-2 border border-gray-300 rounded-lg font-medium text-nilin-gray hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={isLoading}
              className={cn(
                'flex-1 py-2 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2',
                isLoading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg'
              )}
            >
              {isLoading ? (
                <>
                  <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5" />
                  Purchase Credits
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Auto-Refill Settings */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <RefreshCw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-nilin-charcoal">Auto-Refill</h4>
              <p className="text-sm text-nilin-gray">Automatically replenish credits when low</p>
            </div>
          </div>
          <button
            onClick={handleAutoRefillToggle}
            className={cn(
              'w-12 h-7 rounded-full transition-colors relative',
              autoRefillEnabled ? 'bg-nilin-coral' : 'bg-gray-300'
            )}
          >
            <div
              className={cn(
                'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform',
                autoRefillEnabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>

        {autoRefillEnabled && (
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Refill when credits drop below
              </label>
              <select
                value={autoRefillThreshold}
                onChange={(e) => setAutoRefillThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
              >
                {[5, 10, 15, 20, 25].map(v => (
                  <option key={v} value={v}>{v} credits</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Refill amount
              </label>
              <select
                value={autoRefillAmount}
                onChange={(e) => setAutoRefillAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral outline-none"
              >
                {[10, 25, 50, 100].map(v => (
                  <option key={v} value={v}>{v} credits</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-3">
            <History className="h-5 w-5 text-nilin-gray" />
            <span className="font-semibold text-nilin-charcoal">Transaction History</span>
          </div>
          <span className="text-sm text-nilin-gray">{showHistory ? 'Hide' : 'Show'}</span>
        </button>

        {showHistory && (
          <div className="border-t border-gray-100 divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="p-8 text-center">
                <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-nilin-gray">No transactions yet</p>
              </div>
            ) : (
              transactions.map((tx) => {
                const config = transactionColors[tx.type];
                const Icon = config.icon;
                const isPositive = tx.type === 'purchase' || tx.type === 'bonus' || tx.type === 'refund';

                return (
                  <div key={tx.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', config.bg)}>
                        <Icon className={cn('h-5 w-5', config.text)} />
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal">{tx.description}</p>
                        <p className="text-xs text-nilin-gray">{formatDate(tx.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('font-bold', isPositive ? 'text-green-600' : 'text-red-600')}>
                        {isPositive ? '+' : '-'}{tx.amount}
                      </p>
                      <p className="text-xs text-nilin-gray">Balance: {tx.balance}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadCredits;
