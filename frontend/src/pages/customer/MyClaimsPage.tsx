import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  ChevronFirst,
  ChevronLast,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import CustomerHubNav from '../../components/customer/CustomerHubNav';
import { useAuthStore } from '../../stores/authStore';
import { disputeApi, type Dispute, type DisputeStatus } from '../../services/disputeApi';
import { showDeduplicatedError } from '../../utils/toastUtils';

// =============================================================================
// Types
// =============================================================================

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// =============================================================================
// Constants
// =============================================================================

const STATUS_CONFIG: Record<DisputeStatus, { label: string; className: string; icon: React.ElementType }> = {
  open: { label: 'Open', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  under_review: { label: 'Under Review', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: AlertCircle },
  resolved: { label: 'Resolved', className: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle },
  escalated: { label: 'Escalated', className: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertCircle },
  closed: { label: 'Closed', className: 'bg-gray-50 text-gray-600 border-gray-200', icon: XCircle },
};

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-400',
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' });

// Relative time for recent dates
const formatRelativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
};

// =============================================================================
// Error Handling
// =============================================================================

const handleFetchError = (err: unknown, context: string): string => {
  const isNetworkError =
    !navigator.onLine ||
    err instanceof TypeError ||
    (err as { message?: string })?.message?.includes('NetworkError');

  if (isNetworkError) {
    showDeduplicatedError('Connection error', 'Please check your internet connection');
    return 'Connection error. Please check your internet connection.';
  }

  const axiosErr = err as { response?: { status?: number; data?: { message?: string } } };
  const status = axiosErr?.response?.status;
  const serverMessage = axiosErr?.response?.data?.message;

  switch (status) {
    case 401:
      showDeduplicatedError('Session expired', 'Please log in again');
      return 'Your session has expired. Please log in again.';
    case 403:
      showDeduplicatedError('Access denied', 'You do not have permission');
      return 'You do not have permission to view claims.';
    case 404:
      showDeduplicatedError('Not found', `${context} not found`);
      return `${context} not found.`;
    case 429:
      showDeduplicatedError('Too many requests', 'Please wait before trying again');
      return 'Too many requests. Please wait and try again.';
    case 500:
      showDeduplicatedError('Server error', 'Please try again later');
      return 'A server error occurred. Please try again later.';
    default:
      if (serverMessage) {
        showDeduplicatedError('Error', serverMessage);
        return serverMessage;
      }
      return 'An error occurred while loading claims.';
  }
};

// =============================================================================
// Component
// =============================================================================

const MyClaimsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();

  // State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPageChanging, setIsPageChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | 'all'>('all');
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [announcement, setAnnouncement] = useState('');
  // Abort controller for race condition fix
  const abortControllerRef = useRef<AbortController | null>(null);
  // Status counts for filter tabs
  const [statusCounts, setStatusCounts] = useState<Record<DisputeStatus | 'all', number>>({
    all: 0, open: 0, under_review: 0, resolved: 0, escalated: 0, closed: 0
  });

  // Announce to screen readers
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement(message);
    setTimeout(() => setAnnouncement(''), 3000);
  }, []);

  // Fetch disputes
  const fetchDisputes = useCallback(async (page = 1, refresh = false, isPageNav = false) => {
    // Cancel any in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const currentAbortController = new AbortController();
    abortControllerRef.current = currentAbortController;

    if (refresh) setIsRefreshing(true);
    else if (isPageNav) setIsPageChanging(true);
    else setIsLoading(true);
    setError(null);

    try {
      const result = await disputeApi.getMyDisputes({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 20,
        page,
      });

      // Skip if request was aborted (use captured reference)
      if (currentAbortController.signal.aborted) {
        return;
      }

      // Use backend status breakdown for accurate tab counts
      if (result.statusBreakdown) {
        setStatusCounts({
          all: result.statusBreakdown.all ?? result.pagination?.total ?? 0,
          open: result.statusBreakdown.open ?? 0,
          under_review: result.statusBreakdown.under_review ?? 0,
          resolved: result.statusBreakdown.resolved ?? 0,
          escalated: result.statusBreakdown.escalated ?? 0,
          closed: result.statusBreakdown.closed ?? 0,
        });
      } else if (result.pagination) {
        setStatusCounts(prev => ({ ...prev, all: result.pagination?.total || 0 }));
      }

      setDisputes(result.data || []);
      if (result.pagination) {
        setPagination({
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          pages: result.pagination.pages,
        });
      }

      if (!refresh) {
        announce(`Loaded ${result.pagination?.total || 0} claims`);
      }
    } catch (err) {
      // Skip error if request was aborted (race condition)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const message = handleFetchError(err, 'Claims');
      setError(message);
      announce('Failed to load claims', 'assertive');
    } finally {
      // Only clear loading states if not aborted
      if (!currentAbortController.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsPageChanging(false);
      }
    }
  }, [statusFilter, announce]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/my-claims' } });
      return;
    }
    fetchDisputes();
  }, [isAuthenticated]);

  // Refetch when filter changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchDisputes(1);
    }
  }, [statusFilter, isAuthenticated]);

  // Handle dispute click
  const handleDisputeClick = (disputeId: string) => {
    navigate(`/customer/my-claims/${disputeId}`);
  };

  // Handle refresh
  const handleRefresh = () => {
    fetchDisputes(pagination.page, true);
    announce('Refreshing claims list');
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    fetchDisputes(newPage, false, true);
    announce(`Page ${newPage} of ${pagination.pages}`);
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      {/* Skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <CustomerHubNav />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <main id="main-content" className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Screen reader announcement */}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-nilin-coral/15 flex items-center justify-center flex-shrink-0">
              <FileText className="h-6 w-6 text-nilin-coral" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-serif text-nilin-charcoal">My Claims</h1>
              <p className="text-sm text-nilin-warmGray">
                {pagination.total > 0 ? `${pagination.total} claim${pagination.total !== 1 ? 's' : ''}` : 'Track disputes and refund requests'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium text-nilin-charcoal bg-white border border-nilin-border rounded-xl hover:bg-nilin-blush/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral disabled:opacity-50"
            aria-label="Refresh claims list"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div
          className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0"
          aria-label="Filter claims by status"
          role="group"
        >
          {(['all', 'open', 'under_review', 'resolved', 'escalated', 'closed'] as const).map((status) => {
            const count = statusCounts[status];
            const showCount = count > 0;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
                className={`flex-shrink-0 min-h-[44px] px-4 py-2.5 text-sm font-medium rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 whitespace-nowrap ${
                  statusFilter === status
                    ? 'bg-nilin-coral text-white border-nilin-coral shadow-sm'
                    : 'bg-white text-nilin-warmGray border-nilin-border hover:border-nilin-coral/40 hover:bg-nilin-cream/50'
                }`}
              >
                {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
                {showCount && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-white/20">
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
          </div>
        ) : error ? (
          /* Error State */
          <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-700 font-medium mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchDisputes(1)}
              className="min-h-[44px] px-6 py-2.5 bg-nilin-coral text-white rounded-xl text-sm font-medium hover:bg-nilin-coral/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
            >
              Try Again
            </button>
          </div>
        ) : disputes.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl border border-nilin-border/50 bg-white/60 p-8 sm:p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
              <FileText className="h-10 w-10 text-nilin-coral opacity-60" />
            </div>
            <h2 className="text-xl font-medium text-nilin-charcoal mb-2">No claims found</h2>
            <p className="text-sm text-nilin-warmGray max-w-md mx-auto mb-6">
              {statusFilter === 'all'
                ? "When you file a dispute or refund request, it will appear here for tracking."
                : statusFilter === 'under_review'
                  ? "You don't have any claims under review."
                  : `You don't have any ${STATUS_CONFIG[statusFilter as DisputeStatus]?.label?.toLowerCase() || statusFilter} claims.`}
            </p>
            {statusFilter !== 'all' ? (
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="min-h-[44px] px-6 py-2.5 bg-nilin-coral text-white rounded-xl text-sm font-medium"
              >
                View All Claims
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/customer/support')}
                className="min-h-[44px] px-6 py-2.5 bg-nilin-coral text-white rounded-xl text-sm font-medium"
              >
                Go to Support Hub
              </button>
            )}
          </div>
        ) : (
          /* Claims List */
          <>
            <div className={`space-y-3 ${isPageChanging ? 'opacity-50 pointer-events-none' : ''}`}>
              {isPageChanging && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                </div>
              )}
              {disputes.map((dispute) => {
                const statusCfg = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open;
                const StatusIcon = statusCfg.icon;
                const priorityDot = PRIORITY_DOT[dispute.priority] || PRIORITY_DOT.low;

                return (
                  <article
                    key={dispute._id}
                    onClick={() => handleDisputeClick(dispute._id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleDisputeClick(dispute._id)}
                    role="button"
                    tabIndex={0}
                    className="w-full text-left bg-white rounded-xl border border-nilin-border/50 p-4 sm:p-5 hover:border-nilin-coral/30 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral cursor-pointer"
                    aria-label={`Claim ${dispute.disputeNumber}, ${statusCfg.label}, ${dispute.reason}. Click to view details.`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {/* Title row with priority dot */}
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {/* Priority indicator */}
                          {dispute.priority !== 'low' && (
                            <span
                              className={`w-2 h-2 rounded-full ${priorityDot}`}
                              title={`${dispute.priority} priority`}
                              aria-hidden="true"
                            />
                          )}
                          <span className="text-sm font-semibold text-nilin-charcoal">
                            #{dispute.disputeNumber}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${statusCfg.className}`}>
                            <StatusIcon className="w-3 h-3" aria-hidden="true" />
                            {statusCfg.label}
                          </span>
                          {/* Category badge */}
                          <span className="px-2 py-0.5 text-xs bg-nilin-muted text-nilin-warmGray rounded-full">
                            {dispute.category.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Reason/Description */}
                        <p className="text-sm text-nilin-charcoal line-clamp-2 mb-2">{dispute.reason}</p>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-nilin-warmGray">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Filed {formatRelativeDate(dispute.createdAt)}
                          </span>
                          {dispute.bookingReference?.serviceName && (
                            <span className="truncate max-w-[200px]">
                              · {dispute.bookingReference.serviceName}
                            </span>
                          )}
                          {dispute.bookingReference && (
                            <span className="font-mono">
                              · {dispute.bookingReference.bookingNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="w-5 h-5 text-nilin-warmGray flex-shrink-0 mt-1" />
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <nav
                className="flex items-center justify-center gap-2 mt-8"
                aria-label="Pagination"
              >
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1}
                  className="w-11 h-11 flex items-center justify-center rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                  aria-label="Go to first page"
                >
                  <ChevronFirst className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="w-11 h-11 flex items-center justify-center rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                  aria-label="Go to previous page"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="px-4 py-2 text-sm text-nilin-charcoal">
                  Page <span className="font-semibold">{pagination.page}</span> of{' '}
                  <span className="font-semibold">{pagination.pages}</span>
                  <span className="text-nilin-warmGray ml-2">({pagination.total} total)</span>
                </span>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="w-11 h-11 flex items-center justify-center rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                  aria-label="Go to next page"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handlePageChange(pagination.pages)}
                  disabled={pagination.page >= pagination.pages}
                  className="w-11 h-11 flex items-center justify-center rounded-lg border border-nilin-border text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-nilin-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                  aria-label="Go to last page"
                >
                  <ChevronLast className="w-5 h-5" />
                </button>
              </nav>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyClaimsPage;
