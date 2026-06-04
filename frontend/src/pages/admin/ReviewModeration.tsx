import React, { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import {
  Search,
  Star,
  Flag,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  X,
  MessageSquare,
  User,
  Calendar,
  Briefcase,
  RefreshCw,
  Info,
  Link2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { cn } from '../../lib/utils';
import {
  adminReviewApi,
  type AdminReview,
  type AdminReviewStats,
  type ReviewModerationStatus,
  getReviewDisplayStatus,
  formatReviewUserName,
} from '../../services/adminReviewApi';

type FilterStatus = 'all' | ReviewModerationStatus;

const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 16 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={cn(
          size > 16 ? 'w-5 h-5' : 'w-4 h-4',
          star <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
        )}
      />
    ))}
  </div>
);

const statusStyles: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  all: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'All' },
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
  flagged: { bg: 'bg-red-100', text: 'text-red-800', label: 'Flagged' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
  rejected: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Rejected' },
  hidden: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Hidden' },
};

const StatusBadge: React.FC<{ status: ReviewModerationStatus | 'all' }> = ({ status }) => {
  const { bg, text, label } = statusStyles[status] || statusStyles.pending;
  return (
    <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-medium capitalize', bg, text)}>
      {label}
    </span>
  );
};

function extractError(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    return (err as { response?: { data?: { message?: string } } }).response?.data?.message;
  }
  return undefined;
}

const ReviewDetailModal: React.FC<{
  review: AdminReview;
  onClose: () => void;
  onModerate: (action: 'approve' | 'reject' | 'restore' | 'delete') => Promise<void>;
  isLoading: boolean;
}> = ({ review, onClose, onModerate, isLoading }) => {
  const [confirmAction, setConfirmAction] = useState<'reject' | 'delete' | null>(null);
  const status = getReviewDisplayStatus(review);

  const run = async (action: 'approve' | 'reject' | 'restore' | 'delete') => {
    if ((action === 'reject' || action === 'delete') && confirmAction !== action) {
      setConfirmAction(action);
      return;
    }
    await onModerate(action);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-nilin-border/50">
        <div className="p-6 border-b border-nilin-border/40 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-serif text-nilin-charcoal">Review details</h2>
            <p className="text-sm text-nilin-warmGray mt-1 font-mono">#{review._id.slice(-8)}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-nilin-blush/40 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 font-sans">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <StarRating rating={review.rating} size={24} />
              <span className="text-2xl font-semibold">{review.rating}/5</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <StatusBadge status={status} />
              {review.reportCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 flex items-center gap-1">
                  <Flag className="w-3 h-3" />
                  {review.reportCount} reports
                </span>
              )}
            </div>
          </div>

          {review.title && <h3 className="text-lg font-medium text-nilin-charcoal">{review.title}</h3>}

          <div className="bg-nilin-blush/20 rounded-xl p-4">
            <p className="text-nilin-charcoal whitespace-pre-wrap">{review.comment}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-sky-200/60 bg-sky-50/50 p-4">
              <div className="flex items-center gap-2 mb-2 text-sky-800 text-sm font-medium">
                <User className="w-4 h-4" />
                Customer (reviewer)
              </div>
              <p className="font-medium">{formatReviewUserName(review.reviewerId)}</p>
              <p className="text-sm text-nilin-warmGray">{review.reviewerId?.email}</p>
            </div>
            <div className="rounded-xl border border-violet-200/60 bg-violet-50/50 p-4">
              <div className="flex items-center gap-2 mb-2 text-violet-800 text-sm font-medium">
                <Briefcase className="w-4 h-4" />
                Provider (reviewee)
              </div>
              <p className="font-medium">{formatReviewUserName(review.revieweeId)}</p>
              <p className="text-sm text-nilin-warmGray">{review.revieweeId?.email}</p>
            </div>
          </div>

          {review.bookingId && (
            <div className="rounded-xl border border-nilin-border/50 p-4 text-sm">
              <div className="flex items-center gap-2 mb-2 font-medium text-nilin-charcoal">
                <Calendar className="w-4 h-4" />
                Booking
              </div>
              <p>#{review.bookingId.bookingNumber}</p>
              {review.bookingId.serviceId && (
                <p className="text-nilin-warmGray">Service: {review.bookingId.serviceId.name}</p>
              )}
            </div>
          )}

          {review.response && (
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/50 p-4">
              <p className="text-sm font-medium text-emerald-800 mb-1">Provider response</p>
              <p className="text-sm">{review.response.comment}</p>
            </div>
          )}

          {confirmAction && (
            <div
              className={cn(
                'p-4 rounded-xl border flex gap-2',
                confirmAction === 'delete'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              )}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">
                {confirmAction === 'delete'
                  ? 'Permanently delete this review?'
                  : 'Reject and hide this review from customers?'}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-nilin-border/40 flex flex-wrap gap-2">
          {review.moderationStatus !== 'approved' && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => run('approve')}
              className="flex-1 btn-nilin inline-flex items-center justify-center gap-2 min-w-[120px]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Approve
            </button>
          )}
          {(review.moderationStatus === 'rejected' || review.isHidden) && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => run('restore')}
              className="flex-1 px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              Restore
            </button>
          )}
          {review.moderationStatus !== 'rejected' && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => run('reject')}
              className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
            >
              Reject
            </button>
          )}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => run('delete')}
            className="px-4 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const ReviewModeration: React.FC = () => {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [stats, setStats] = useState<AdminReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionReviewId, setActionReviewId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPagination((p) => ({ ...p, page: 1 }));
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [listRes, statsRes] = await Promise.all([
          adminReviewApi.list({
            page: pagination.page,
            limit: 20,
            status: statusFilter,
            search: search || undefined,
          }),
          adminReviewApi.stats(),
        ]);
        setReviews(listRes.reviews);
        setPagination((p) => ({ ...p, ...listRes.pagination }));
        setStats(statsRes);
        if (isRefresh) toast.success('Reviews refreshed');
      } catch (err) {
        toast.error(extractError(err) || 'Failed to load reviews');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [pagination.page, statusFilter, search]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const moderateReview = async (
    reviewId: string,
    action: 'approve' | 'reject' | 'restore' | 'delete'
  ) => {
    setActionLoading(true);
    setActionReviewId(reviewId);
    try {
      await adminReviewApi.moderate(reviewId, action);
      toast.success(
        action === 'delete'
          ? 'Review deleted'
          : action === 'restore'
            ? 'Review restored and approved'
            : `Review ${action}d`
      );
      setSelectedReview(null);
      await loadData(true);
    } catch (err) {
      toast.error(extractError(err) || `Failed to ${action} review`);
    } finally {
      setActionLoading(false);
      setActionReviewId(null);
    }
  };

  const tabCounts = stats
    ? {
        all: stats.total,
        pending: stats.pending,
        flagged: stats.flagged,
        approved: stats.approved,
        rejected: stats.rejected,
      }
    : null;

  return (
    <ErrorBoundary>
      <AdminPageShell
        wideLayout
        title="Review Moderation"
        subtitle="Approve customer reviews before they appear on provider profiles and service pages"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Reviews', current: true },
        ]}
        headerActions={
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-sm hover:bg-nilin-blush/40 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            Refresh
          </button>
        }
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-violet-200/70 bg-violet-50/60 px-5 py-4 flex gap-3">
            <Info className="w-5 h-5 text-violet-800 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-violet-950 space-y-1">
              <p className="font-medium flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Customer → admin → provider flow
              </p>
              <p>
                After a completed booking, customers submit a review via{' '}
                <strong>POST /reviews/booking/:id</strong>. New reviews start as{' '}
                <strong>pending</strong>. When you <strong>approve</strong>, ratings update on the
                provider profile and the review is visible publicly. <strong>Reject</strong> hides it
                and notifies the customer.
              </p>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total', value: stats.total },
                { label: 'Pending', value: stats.pending, accent: 'text-amber-700' },
                { label: 'Flagged', value: stats.flagged, accent: 'text-red-600' },
                { label: 'Approved', value: stats.approved, accent: 'text-emerald-700' },
                {
                  label: 'Avg rating',
                  value: stats.averageRating,
                  accent: 'text-nilin-charcoal',
                  star: true,
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5"
                >
                  <p className="text-xs uppercase tracking-wide text-nilin-warmGray">{kpi.label}</p>
                  <p className={cn('text-2xl font-serif mt-1 flex items-center gap-1', kpi.accent)}>
                    {kpi.value}
                    {kpi.star && <Star className="w-5 h-5 text-amber-400 fill-amber-400" />}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {(['all', 'pending', 'flagged', 'approved', 'rejected'] as FilterStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => {
                      setStatusFilter(status);
                      setPagination((p) => ({ ...p, page: 1 }));
                    }}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      statusFilter === status
                        ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white'
                        : 'bg-white/80 border border-nilin-border/50 hover:bg-nilin-blush/30'
                    )}
                  >
                    <StatusBadge status={status === 'all' ? 'all' : status} />
                    {tabCounts && status !== 'all' && (
                      <span className="ml-1 opacity-80">({tabCounts[status as keyof typeof tabCounts]})</span>
                    )}
                  </button>
                )
              )}
            </div>
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="search"
                placeholder="Search comment, code, customer or provider…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-nilin-border/60 bg-white/80 text-sm"
              />
            </div>
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="py-16 text-center text-nilin-warmGray">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No reviews match your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm font-sans">
                  <thead>
                    <tr className="border-b border-nilin-border/50 bg-nilin-blush/20">
                      {['Rating', 'Review', 'Customer', 'Provider', 'Status', 'Date', 'Actions'].map(
                        (h) => (
                          <th
                            key={h}
                            className={cn(
                              'px-5 py-3 text-xs font-semibold uppercase text-nilin-warmGray',
                              h === 'Actions' ? 'text-right' : 'text-left'
                            )}
                          >
                            {h}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nilin-border/40">
                    {reviews.map((review) => {
                      const displayStatus = getReviewDisplayStatus(review);
                      const busy = actionReviewId === review._id;
                      return (
                        <tr key={review._id} className="hover:bg-nilin-blush/10">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <StarRating rating={review.rating} />
                              <span className="font-medium">{review.rating}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            <p className="truncate text-nilin-charcoal">
                              {review.title || review.comment}
                            </p>
                            {review.reportCount > 0 && (
                              <span className="text-xs text-red-600 flex items-center gap-1 mt-1">
                                <Flag className="w-3 h-3" />
                                {review.reportCount}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium">{formatReviewUserName(review.reviewerId)}</p>
                            <p className="text-xs text-nilin-warmGray truncate max-w-[140px]">
                              {review.reviewerId?.email}
                            </p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium">{formatReviewUserName(review.revieweeId)}</p>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={displayStatus} />
                          </td>
                          <td className="px-5 py-4 text-nilin-warmGray">
                            {new Date(review.createdAt).toLocaleDateString('en-AE', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setSelectedReview(review)}
                                className="p-2 rounded-lg hover:bg-nilin-blush/50"
                                title="View"
                              >
                                <Eye className="w-4 h-4 text-nilin-coral" />
                              </button>
                              {review.moderationStatus !== 'approved' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => moderateReview(review._id, 'approve')}
                                  className="p-2 rounded-lg hover:bg-emerald-50 disabled:opacity-50"
                                  title="Approve"
                                >
                                  {busy ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                  )}
                                </button>
                              )}
                              {review.moderationStatus !== 'rejected' && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => moderateReview(review._id, 'reject')}
                                  className="p-2 rounded-lg hover:bg-red-50 disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4 text-red-600" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {pagination.pages > 1 && (
              <div className="px-5 py-4 border-t border-nilin-border/40 flex items-center justify-between text-sm">
                <span className="text-nilin-warmGray">
                  Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!pagination.hasPrev}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    className="p-2 rounded-lg border disabled:opacity-40"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    disabled={!pagination.hasNext}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    className="p-2 rounded-lg border disabled:opacity-40"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedReview && (
          <ReviewDetailModal
            review={selectedReview}
            onClose={() => setSelectedReview(null)}
            onModerate={(action) => moderateReview(selectedReview._id, action)}
            isLoading={actionLoading}
          />
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ReviewModeration;
