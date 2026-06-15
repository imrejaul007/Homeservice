import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Filter, TrendingUp, CreditCard, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../utils/formatting';
import { customerWalletApi, type WalletTransaction } from '../../services/walletApi';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { useTranslation } from '../../hooks/useTranslation';

type TransactionFilter = 'all' | 'credit' | 'debit';

const WalletTransactionsPage: React.FC = () => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTransactions = useCallback(async (pageNum: number, append = false) => {
    if (pageNum === 1) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    setError(null);

    try {
      const response = await customerWalletApi.getTransactions({
        page: pageNum,
        limit: 20,
        type: filter === 'all' ? undefined : filter,
      });

      if (response.success && response.data) {
        setTransactions((prev) =>
          append ? [...prev, ...response.data.transactions] : response.data.transactions
        );
        setTotalPages(response.data.pages);
        setPage(pageNum);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load transactions';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTransactions(1);
  }, [fetchTransactions]);

  const formatTransactionTime = (dateStr: string | Date): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return t('wallet.tx_unknown_date');
    }
  };

  const getTransactionIcon = (transaction: WalletTransaction) => {
    if (transaction.referenceType === 'bonus' || transaction.referenceType === 'refund') {
      return <Gift className="w-5 h-5 text-nilin-warning" />;
    }
    if (transaction.type === 'credit') {
      return <TrendingUp className="w-5 h-5 text-nilin-success" />;
    }
    return <CreditCard className="w-5 h-5 text-nilin-error" />;
  };

  return (
    <PageErrorBoundary pageName="Wallet Transactions">
      <div className="min-h-screen bg-nilin-cream pb-20 lg:pb-8">
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <Link
                to="/customer/wallet"
                className="p-2 hover:bg-nilin-blush rounded-xl transition-colors"
                aria-label={t('wallet.tx_back_to_wallet')}
              >
                <ArrowLeft className="w-5 h-5 text-nilin-charcoal" />
              </Link>
              <div>
                <h1 className="text-2xl font-serif font-bold text-nilin-charcoal">{t('wallet.tx_title')}</h1>
                <p className="text-sm text-nilin-warmGray">{t('wallet.tx_subtitle')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 lg:px-8 py-6">
          <div className="flex items-center gap-2 mb-6" role="group" aria-label={t('wallet.tx_filter_label')}>
            <Filter className="w-4 h-4 text-nilin-warmGray" />
            {(['all', 'credit', 'debit'] as TransactionFilter[]).map((value) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  filter === value
                    ? 'bg-nilin-coral text-white'
                    : 'bg-white text-nilin-charcoal hover:bg-nilin-blush'
                }`}
                aria-pressed={filter === value}
              >
                {value === 'all' ? t('wallet.tx_filter_all') : value === 'credit' ? t('wallet.tx_filter_credits') : t('wallet.tx_filter_debits')}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-nilin overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16" role="status" aria-live="polite">
                <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <p className="text-sm text-nilin-charcoal mb-3">{error}</p>
                <button
                  onClick={() => fetchTransactions(1)}
                  className="text-sm text-nilin-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-md px-2 py-1"
                >
                  {t('wallet.try_again')}
                </button>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-nilin-warmGray">{t('wallet.tx_no_results')}</p>
                <Link to="/customer/wallet" className="text-sm text-nilin-coral hover:underline mt-2 inline-block">
                  {t('wallet.tx_back_to_wallet')}
                </Link>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-50">
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 hover:bg-nilin-blush/20 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                            transaction.type === 'credit' ? 'bg-nilin-success/10' : 'bg-nilin-error/10'
                          }`}
                        >
                          {getTransactionIcon(transaction)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-nilin-charcoal truncate">{transaction.description}</p>
                          <p className="text-xs text-nilin-warmGray">
                            {formatTransactionTime(transaction.createdAt)} · <span className="capitalize">{transaction.referenceType}</span>
                          </p>
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 font-semibold tabular-nums ${
                          transaction.type === 'credit' ? 'text-nilin-success' : 'text-nilin-error'
                        }`}
                      >
                        {transaction.type === 'credit' ? '+' : '−'}{formatCurrency(transaction.amount, 'AED')}
                      </span>
                    </div>
                  ))}
                </div>

                {page < totalPages && (
                  <div className="p-4 border-t border-gray-100 text-center">
                    <button
                      onClick={() => fetchTransactions(page + 1, true)}
                      disabled={loadingMore}
                      className="px-6 py-2 text-sm font-medium text-nilin-coral hover:underline disabled:opacity-50"
                    >
                      {loadingMore ? t('wallet.tx_loading') : t('wallet.tx_load_more')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </PageErrorBoundary>
  );
};

export default WalletTransactionsPage;
