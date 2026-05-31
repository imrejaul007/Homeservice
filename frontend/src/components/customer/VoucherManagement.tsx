import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Gift,
  Clock,
  AlertTriangle,
  Check,
  Loader2,
  RefreshCw,
  ChevronRight,
  Calendar,
  Percent,
  Tag,
  Copy,
  CheckCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatCurrency } from '../../utils/formatting';
import { voucherApi, type Voucher, type VoucherUsage } from '../../services/voucherApi';

interface VoucherManagementProps {
  compact?: boolean;
  onApplyVoucher?: (code: string, discount: number) => void;
  onClose?: () => void;
}

type Tab = 'available' | 'history' | 'apply';

export const VoucherManagement: React.FC<VoucherManagementProps> = ({
  compact = false,
  onApplyVoucher,
  onClose,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<Tab>('available');
  const [availableVouchers, setAvailableVouchers] = useState<Voucher[]>([]);
  const [voucherHistory, setVoucherHistory] = useState<VoucherUsage[]>([]);
  const [expiringVouchers, setExpiringVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Apply voucher state
  const [applyCode, setApplyCode] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    voucher?: Voucher;
    discount?: number;
    error?: string;
  } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [availableData, historyData, expiringData] = await Promise.all([
        voucherApi.getAvailable({ page: 1, limit: 20 }),
        voucherApi.getHistory({ page: 1, limit: 20 }),
        voucherApi.getExpiring(14),
      ]);

      setAvailableVouchers(availableData.vouchers);
      setVoucherHistory(historyData.usages);
      setExpiringVouchers(expiringData);
      setPage(1);
      setHasMore(availableData.page < availableData.pages);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load vouchers';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load more
  const loadMore = async () => {
    if (!hasMore || loading) return;

    try {
      const nextPage = page + 1;
      const moreData = activeTab === 'available'
        ? await voucherApi.getAvailable({ page: nextPage, limit: 20 })
        : await voucherApi.getHistory({ page: nextPage, limit: 20 });

      if (activeTab === 'available' && 'vouchers' in moreData) {
        setAvailableVouchers((prev) => [...prev, ...moreData.vouchers]);
      } else if ('usages' in moreData) {
        setVoucherHistory((prev) => [...prev, ...moreData.usages]);
      }
      setPage(nextPage);
      setHasMore(moreData.page < moreData.pages);
    } catch (err) {
      console.error('Failed to load more:', err);
    }
  };

  // Validate voucher code
  const handleValidate = async () => {
    if (!applyCode.trim()) return;

    setValidating(true);
    setValidationResult(null);

    try {
      const amount = orderAmount ? parseFloat(orderAmount) : undefined;
      const result = await voucherApi.validate(applyCode.trim(), amount);
      setValidationResult({
        valid: result.valid,
        voucher: result.voucher,
        discount: result.discount,
        error: result.error,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate voucher';
      setValidationResult({
        valid: false,
        error: errorMessage,
      });
    } finally {
      setValidating(false);
    }
  };

  // Copy voucher code
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
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

  // Days until expiry
  const daysUntilExpiry = (dateStr: string): number => {
    const expiry = new Date(dateStr);
    const now = new Date();
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  // Format discount
  const formatDiscount = (voucher: Voucher): string => {
    if (voucher.type === 'percentage') {
      return `${voucher.discountValue}%`;
    } else if (voucher.type === 'fixed') {
      return formatCurrency(voucher.discountValue, voucher.currency);
    }
    return 'Free Service';
  };

  // Apply voucher to booking
  const handleApply = () => {
    if (validationResult?.valid && validationResult.voucher && validationResult.discount !== undefined) {
      onApplyVoucher?.(applyCode.trim(), validationResult.discount);
      onClose?.();
    }
  };

  if (compact) {
    return (
      <div className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <Ticket className="w-4 h-4 text-purple-600" />
            </div>
            <span className="font-medium text-nilin-charcoal">Vouchers</span>
          </div>
          <button
            onClick={() => fetchData(true)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={refreshing}
          >
            <RefreshCw className={cn('w-4 h-4 text-gray-400', refreshing && 'animate-spin')} />
          </button>
        </div>
        <p className="text-2xl font-bold text-nilin-charcoal">{availableVouchers.length}</p>
        <p className="text-xs text-nilin-warmGray mt-1">available vouchers</p>
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
          <p className="text-nilin-charcoal font-medium mb-2">Unable to load vouchers</p>
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
        <h2 className="text-xl font-bold text-nilin-charcoal">Vouchers</h2>
        <button
          onClick={() => fetchData(true)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={refreshing}
        >
          <RefreshCw className={cn('w-5 h-5 text-gray-500', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('available')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'available' ? 'text-nilin-coral' : 'text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          Available
          {availableVouchers.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-nilin-coral/10 text-nilin-coral text-xs rounded">
              {availableVouchers.length}
            </span>
          )}
          {activeTab === 'available' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-nilin-coral" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'history' ? 'text-nilin-coral' : 'text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          History
          {activeTab === 'history' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-nilin-coral" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('apply')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'apply' ? 'text-nilin-coral' : 'text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          Apply Code
          {activeTab === 'apply' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-nilin-coral" />
          )}
        </button>
      </div>

      {/* Expiring Alert */}
      {expiringVouchers.length > 0 && activeTab === 'available' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800">Expiring Soon</p>
              <p className="text-sm text-amber-700 mt-1">
                {expiringVouchers.length} voucher{expiringVouchers.length === 1 ? '' : 's'} expiring in the next 14 days
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Available Tab */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          {availableVouchers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-warmGray">No vouchers available</p>
              <p className="text-sm text-gray-400 mt-1">Check back later for new offers</p>
            </div>
          ) : (
            availableVouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-start gap-4">
                  {/* Discount Badge */}
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white flex-shrink-0">
                    <div className="text-center">
                      {voucher.type === 'percentage' ? (
                        <>
                          <p className="text-lg font-bold">{voucher.discountValue}%</p>
                          <p className="text-xs opacity-80">OFF</p>
                        </>
                      ) : voucher.type === 'fixed' ? (
                        <>
                          <p className="text-lg font-bold">AED</p>
                          <p className="text-xs opacity-80">{voucher.discountValue}</p>
                        </>
                      ) : (
                        <Gift className="w-6 h-6" />
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-nilin-charcoal">{voucher.name}</h4>
                    {voucher.description && (
                      <p className="text-sm text-nilin-warmGray mt-1 line-clamp-2">
                        {voucher.description}
                      </p>
                    )}

                    {/* Code */}
                    <div className="flex items-center gap-2 mt-2">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-nilin-charcoal">
                        {voucher.code}
                      </code>
                      <button
                        onClick={() => copyCode(voucher.code)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        {copiedCode === voucher.code ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>

                    {/* Expiry */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Expires {formatDate(voucher.validUntil)}
                      </span>
                      {daysUntilExpiry(voucher.validUntil) <= 7 && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Clock className="w-3 h-3" />
                          {daysUntilExpiry(voucher.validUntil)} days left
                        </span>
                      )}
                    </div>

                    {/* Minimum order */}
                    {voucher.minimumOrderValue && (
                      <p className="text-xs text-nilin-warmGray mt-1">
                        Min. order: {formatCurrency(voucher.minimumOrderValue, voucher.currency)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-3 bg-white text-nilin-coral hover:bg-nilin-blush/30 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              Load More <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {voucherHistory.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center shadow-sm">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-nilin-warmGray">No voucher history</p>
              <p className="text-sm text-gray-400 mt-1">Your used vouchers will appear here</p>
            </div>
          ) : (
            voucherHistory.map((usage) => (
              <div
                key={usage.id}
                className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-nilin-charcoal">{usage.voucherCode}</p>
                      <p className="text-xs text-nilin-warmGray">
                        Used on {formatDate(usage.usedAt)}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-green-600">
                    -{formatCurrency(usage.discountApplied, 'AED')}
                  </p>
                </div>
              </div>
            ))
          )}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={loadMore}
              className="w-full py-3 bg-white text-nilin-coral hover:bg-nilin-blush/30 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              Load More <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Apply Tab */}
      {activeTab === 'apply' && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-semibold text-nilin-charcoal mb-4">Enter Voucher Code</h3>

          {/* Code input */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={applyCode}
              onChange={(e) => {
                setApplyCode(e.target.value.toUpperCase());
                setValidationResult(null);
              }}
              placeholder="Enter code (e.g., SAVE20)"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral uppercase font-mono"
            />
            <button
              onClick={handleValidate}
              disabled={!applyCode.trim() || validating}
              className="px-6 py-3 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {validating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Apply'
              )}
            </button>
          </div>

          {/* Order amount (optional) */}
          <div className="mb-4">
            <label className="text-sm text-nilin-warmGray mb-1 block">
              Order amount (optional - for discount preview)
            </label>
            <input
              type="number"
              value={orderAmount}
              onChange={(e) => {
                setOrderAmount(e.target.value);
                if (validationResult?.valid) {
                  handleValidate();
                }
              }}
              placeholder="Enter order total"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/20 focus:border-nilin-coral"
            />
          </div>

          {/* Validation result */}
          {validationResult && (
            <div
              className={cn(
                'rounded-xl p-4',
                validationResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              )}
            >
              {validationResult.valid ? (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-green-800">Voucher Applied</p>
                    <p className="text-sm text-green-700 mt-1">{validationResult.voucher?.name}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-green-600">
                        You save: {formatCurrency(validationResult.discount || 0, 'AED')}
                      </span>
                    </div>
                    <button
                      onClick={handleApply}
                      className="mt-3 w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      Apply to Booking
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <X className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="font-medium text-red-800">Invalid Voucher</p>
                    <p className="text-sm text-red-700 mt-1">{validationResult.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VoucherManagement;
