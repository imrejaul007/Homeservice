import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  Gift,
  TrendingUp,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle,
  Loader2,
  RefreshCw,
  ChevronRight,
  Calendar,
  Tag,
  Users,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils/formatting';
import { cashbackApi, type CashbackEntry, type CashbackBalance, type CashbackStats } from '../../services/cashbackApi';

interface CashbackTrackingProps {
  compact?: boolean;
  onRedeemSuccess?: () => void;
}

type SourceFilter = 'all' | 'booking' | 'referral' | 'promotion' | 'refund' | 'loyalty';
type StatusFilter = 'all' | 'available' | 'earned' | 'redeemed' | 'expired';

const SOURCE_LABELS: Record<string, string> = {
  booking: 'Bookings',
  referral: 'Referrals',
  promotion: 'Promotions',
  refund: 'Refunds',
  loyalty: 'Loyalty',
};

const SOURCE_COLORS: Record<string, string> = {
  booking: 'bg-blue-100 text-blue-600',
  referral: 'bg-purple-100 text-purple-600',
  promotion: 'bg-amber-100 text-amber-600',
  refund: 'bg-green-100 text-green-600',
  loyalty: 'bg-pink-100 text-pink-600',
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  booking: <Calendar className="w-4 h-4" />,
  referral: <Users className="w-4 h-4" />,
  promotion: <Gift className="w-4 h-4" />,
  refund: <TrendingUp className="w-4 h-4" />,
  loyalty: <Sparkles className="w-4 h-4" />,
};

export const CashbackTracking: React.FC<CashbackTrackingProps> = ({
  compact = false,
  onRedeemSuccess,
}) => {
  // State
  const [balance, setBalance] = useState<CashbackBalance | null>(null);
  const [stats, setStats] = useState<CashbackStats | null>(null);
  const [cashbacks, setCashbacks] = useState<CashbackEntry[]>([]);
  const [expiringCashbacks, setExpiringCashbacks] = useState<CashbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Selection for redemption
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [redeeming, setRedeeming] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);

  // Fetch data
  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [balanceData, statsData, historyData, expiringData] = await Promise.all([
        cashbackApi.getBalance(),
        cashbackApi.getStats(),
        cashbackApi.getHistory({
          page: 1,
          limit: 20,
          source: sourceFilter !== 'all' ? sourceFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }),
        cashbackApi.getExpiring(14),
      ]);

      setBalance(balanceData);
      setStats(statsData);
      setCashbacks(historyData.cashbacks);
      setHasMore(historyData.page < historyData.pages);
      setPage(1);
      setExpiringCashbacks(expiringData);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cashback data';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sourceFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load more
  const loadMore = async () => {
    if (!hasMore || loading) return;

    try {
      const nextPage = page + 1;
      const moreData = await cashbackApi.getHistory({
        page: nextPage,
        limit: 20,
        source: sourceFilter !== 'all' ? sourceFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });

      setCashbacks((prev) => [...prev, ...moreData.cashbacks]);
      setPage(nextPage);
      setHasMore(moreData.page < moreData.pages);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  // Handle selection
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllAvailable = () => {
    const availableIds = cashbacks
      .filter((c) => c.status === 'available')
      .map((c) => c.id);
    setSelectedIds(new Set(availableIds));
  };

  // Handle redemption
  const handleRedeem = async () => {
    if (selectedIds.size === 0) return;

    setRedeeming(true);
    try {
      const result = await cashbackApi.redeem(Array.from(selectedIds));
      if (result.success) {
        setShowRedeemModal(false);
        setSelectedIds(new Set());
        onRedeemSuccess?.();
        fetchData();
      }
    } catch (err) {
      console.error('Redemption failed:', err);
    } finally {
      setRedeeming(false);
    }
  };

  // Calculate selected total
  const selectedTotal = cashbacks
    .filter((c) => selectedIds.has(c.id))
    .reduce((sum, c) => sum + c.amount, 0);

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Days until expiry
  const daysUntilExpiry = (dateStr: string): number => {
    const expiry = new Date(dateStr);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (compact) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Gift className="w-4 h-4 text-amber-600" />
            </div>
            <span className="font-medium text-nilin-charcoal">Cashback</span>
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
          {formatCurrency(balance?.balance || 0, balance?.currency || 'AED')}
        </div>
        <p className="text-xs text-nilin-warmGray mt-1">
          {cashbacks.filter((c) => c.status === 'available').length} available entries
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="text-center py-8">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="text-nilin-charcoal font-medium mb-2">Unable to load cashback</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-nilin-charcoal">Cashback</h2>
        <button
          onClick={() => fetchData(true)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={cn('w-5 h-5 text-gray-500', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <p className="text-white/80 text-sm">Available Cashback</p>
            <p className="text-3xl font-bold">{formatCurrency(balance?.balance || 0, 'AED')}</p>
          </div>
        </div>

        {/* Breakdown by source */}
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(balance?.breakdown || {}).map(([source, amount]) => (
            <div key={source} className="bg-white/10 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', SOURCE_COLORS[source] || 'bg-gray-100')}>
                  {SOURCE_ICONS[source]}
                </div>
                <div>
                  <p className="text-xs text-white/70">{SOURCE_LABELS[source] || source}</p>
                  <p className="font-semibold">{formatCurrency(amount, 'AED')}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Stats */}
        {stats && (
          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-white/70">Total Earned</p>
              <p className="font-semibold">{formatCurrency(stats.totalEarned, 'AED')}</p>
            </div>
            <div>
              <p className="text-xs text-white/70">Redeemed</p>
              <p className="font-semibold">{formatCurrency(stats.totalRedeemed, 'AED')}</p>
            </div>
            <div>
              <p className="text-xs text-white/70">Expired</p>
              <p className="font-semibold">{formatCurrency(stats.totalExpired, 'AED')}</p>
            </div>
          </div>
        )}

        {/* Redeem Button */}
        {cashbacks.filter((c) => c.status === 'available').length > 0 && (
          <button
            onClick={() => setShowRedeemModal(true)}
            className="mt-4 w-full py-3 bg-white text-amber-600 font-semibold rounded-xl hover:bg-white/95 transition-colors"
          >
            Redeem to Wallet
          </button>
        )}
      </div>

      {/* Expiring Alert */}
      {expiringCashbacks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800">Expiring Soon</p>
              <p className="text-sm text-amber-700 mt-1">
                {expiringCashbacks.length} cashback {expiringCashbacks.length === 1 ? 'entry' : 'entries'} expiring in the next 14 days
              </p>
              <div className="mt-2 space-y-1">
                {expiringCashbacks.slice(0, 3).map((cb) => (
                  <div key={cb.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-800">{formatCurrency(cb.amount, 'AED')}</span>
                    <span className="text-amber-600">Expires {daysUntilExpiry(cb.expiresAt)} days</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-nilin-charcoal">Filters</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/20"
          >
            <option value="all">All Sources</option>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/20"
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="earned">Earned</option>
            <option value="redeemed">Redeemed</option>
            <option value="expired">Expired</option>
          </select>
          {statusFilter === 'available' && (
            <button
              onClick={selectAllAvailable}
              className="px-3 py-1.5 text-sm text-nilin-coral hover:bg-nilin-blush/50 rounded-lg transition-colors"
            >
              Select All Available
            </button>
          )}
        </div>
      </div>

      {/* Cashback History */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-nilin-charcoal">History</h3>
        </div>
        {cashbacks.length === 0 ? (
          <div className="p-8 text-center">
            <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-nilin-warmGray">No cashback entries yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {cashbacks.map((cb) => (
              <div
                key={cb.id}
                className={cn(
                  'p-4 flex items-center gap-3',
                  cb.status === 'available' && 'cursor-pointer hover:bg-gray-50 transition-colors'
                )}
                onClick={() => cb.status === 'available' && toggleSelection(cb.id)}
              >
                {/* Selection checkbox */}
                {cb.status === 'available' && (
                  <div
                    className={cn(
                      'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
                      selectedIds.has(cb.id)
                        ? 'bg-nilin-coral border-nilin-coral'
                        : 'border-gray-300'
                    )}
                  >
                    {selectedIds.has(cb.id) && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                )}

                {/* Icon */}
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', SOURCE_COLORS[cb.source] || 'bg-gray-100')}>
                  {SOURCE_ICONS[cb.source]}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-nilin-charcoal truncate">{cb.sourceDescription}</p>
                  <div className="flex items-center gap-2 text-xs text-nilin-warmGray">
                    <span className="capitalize">{cb.source}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{formatDate(cb.earnedAt)}</span>
                    {cb.isExpiringSoon && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span className="text-amber-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {daysUntilExpiry(cb.expiresAt)} days left
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount and status */}
                <div className="text-right">
                  <p className={cn(
                    'font-semibold',
                    cb.status === 'redeemed' ? 'text-green-600' :
                    cb.status === 'expired' ? 'text-gray-400' : 'text-nilin-charcoal'
                  )}>
                    {cb.status === 'redeemed' ? '-' : ''}{formatCurrency(cb.amount, cb.currency)}
                  </p>
                  <p className={cn(
                    'text-xs capitalize',
                    cb.status === 'available' ? 'text-green-600' :
                    cb.status === 'redeemed' ? 'text-green-500' :
                    cb.status === 'expired' ? 'text-gray-400' : 'text-amber-600'
                  )}>
                    {cb.status}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={loadMore}
              className="w-full py-2 text-nilin-coral hover:bg-nilin-blush/30 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Load More <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Redeem Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-nilin-charcoal mb-4">Redeem Cashback</h3>
            <p className="text-nilin-warmGray mb-4">
              You are about to redeem {selectedIds.size} cashback {selectedIds.size === 1 ? 'entry' : 'entries'} to your wallet.
            </p>
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-nilin-warmGray">Total Amount</span>
                <span className="text-2xl font-bold text-nilin-charcoal">
                  {formatCurrency(selectedTotal, 'AED')}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRedeemModal(false)}
                className="flex-1 py-3 border border-gray-200 text-nilin-charcoal rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeem}
                disabled={redeeming || selectedIds.size === 0}
                className="flex-1 py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
                Redeem
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashbackTracking;
