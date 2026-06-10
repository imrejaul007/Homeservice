import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Star,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Eye,
  Trash2,
  Shield,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  User,
  Calendar,
  Flag,
  TrendingUp,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { useToastActions } from '../common/Toast';
import { AdminReview, AdminReviewStats, getReviewDisplayStatus } from '../../services/adminReviewApi';

/**
 * REWRITTEN: This component now uses the existing review moderation system
 * with reportCount-based flagging instead of a non-existent ML infrastructure.
 *
 * Reviews with reportCount > 0 are flagged for review.
 * This leverages the existing: /admin/reviews endpoint with status filtering
 */

// Flagged review extends AdminReview with computed flag info
interface FlaggedReview extends AdminReview {
  flagReasons: string[];
  confidence: number;
}

interface FakeReviewDetectorProps {
  embedded?: boolean;
  onClose?: () => void;
}

export const FakeReviewDetector: React.FC<FakeReviewDetectorProps> = ({
  embedded = false,
  onClose
}) => {
  const [reviews, setReviews] = useState<FlaggedReview[]>([]);
  const [stats, setStats] = useState<AdminReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all');
  const [reportFilter, setReportFilter] = useState<number | 'all'>('all');
  const [selectedReview, setSelectedReview] = useState<FlaggedReview | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const toast = useToastActions();
  const isMountedRef = useRef(true);

  const computeFlagReasons = (review: AdminReview): string[] => {
    const reasons: string[] = [];

    if (review.reportCount > 0) {
      reasons.push(`${review.reportCount} user report(s)`);
    }

    // Add more flagging reasons based on patterns
    if (review.comment.length < 10) {
      reasons.push('Very short review text');
    }

    if (review.isVerified && review.reportCount > 0) {
      reasons.push('Verified booking but flagged');
    }

    return reasons;
  };

  const computeConfidence = (review: AdminReview): number => {
    let confidence = 50; // Base confidence

    // More reports = higher confidence
    confidence += Math.min(review.reportCount * 15, 40);

    // Very short reviews are suspicious
    if (review.comment.length < 20) {
      confidence += 20;
    }

    // Generic positive/negative patterns
    const lowerComment = review.comment.toLowerCase();
    if (review.rating === 5 && (lowerComment.includes('!') || lowerComment.length < 30)) {
      confidence += 15;
    }
    if (review.rating === 1 && review.comment.length < 50) {
      confidence += 15;
    }

    return Math.min(confidence, 100);
  };

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch flagged reviews (those with reportCount > 0)
      // We'll fetch all reviews and filter client-side for now
      // TODO: Add backend endpoint /admin/reviews/flagged that filters by reportCount
      const [reviewsResponse, statsResponse] = await Promise.all([
        api.get('/admin/reviews', {
          params: { page: 1, limit: 100, status: 'all' }
        }),
        api.get('/admin/reviews/stats')
      ]);

      if (reviewsResponse.data?.success && statsResponse.data?.success) {
        const allReviews: AdminReview[] = reviewsResponse.data.data.reviews || [];
        const rawStats = statsResponse.data.data;

        // Filter to only flagged reviews (reportCount > 0)
        const flaggedReviews: FlaggedReview[] = allReviews
          .filter(r => r.reportCount > 0)
          .map(r => ({
            ...r,
            flagReasons: computeFlagReasons(r),
            confidence: computeConfidence(r)
          }))
          .sort((a, b) => b.reportCount - a.reportCount); // Most reported first

        setReviews(flaggedReviews);

        // Compute stats for flagged reviews
        const flaggedStats: AdminReviewStats = {
          total: flaggedReviews.length,
          pending: flaggedReviews.filter(r => getReviewDisplayStatus(r) === 'pending').length,
          approved: flaggedReviews.filter(r => getReviewDisplayStatus(r) === 'approved').length,
          rejected: flaggedReviews.filter(r => getReviewDisplayStatus(r) === 'rejected').length,
          hidden: flaggedReviews.filter(r => r.isHidden).length,
          flagged: flaggedReviews.length,
          averageRating: flaggedReviews.length > 0
            ? flaggedReviews.reduce((sum, r) => sum + r.rating, 0) / flaggedReviews.length
            : 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        };

        flaggedReviews.forEach(r => {
          flaggedStats.ratingDistribution[r.rating]++;
        });

        setStats(flaggedStats);
      }
    } catch (err: any) {
      console.error('Error fetching review flags:', err);
      if (isMountedRef.current) {
        setError(err.response?.data?.message || 'Failed to load flagged reviews');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchData();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleModerate = async (reviewId: string, action: 'approve' | 'reject' | 'hide' | 'delete') => {
    setActionLoading(reviewId);
    try {
      await api.patch(`/admin/reviews/${reviewId}/moderate`, { action });
      toast.success('Review moderated', `Action '${action}' completed`);
      await fetchData(); // Refresh data
    } catch (err: any) {
      console.error('Error moderating review:', err);
      toast.error('Moderation failed', err.response?.data?.message || 'Please try again');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredReviews = useMemo(() => {
    return reviews.filter(review => {
      const matchesSearch =
        review.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.reviewerId?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        review.revieweeId?.firstName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = ratingFilter === 'all' || review.rating === ratingFilter;
      const matchesReports = reportFilter === 'all' || review.reportCount >= reportFilter;
      return matchesSearch && matchesRating && matchesReports;
    });
  }, [reviews, searchQuery, ratingFilter, reportFilter]);

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Flagged Reviews</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const formatUserName = (user?: { firstName?: string; lastName?: string; email?: string; businessInfo?: { businessName?: string } } | null) => {
    if (!user) return 'Unknown';
    if (user.businessInfo?.businessName) return user.businessInfo.businessName;
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
  };

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Review Flagging</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Reviews with user reports - based on reportCount system</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <XCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <Flag className="w-5 h-5 text-amber-500 mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.flagged || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Flagged</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <Clock className="w-5 h-5 text-blue-500 mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.pending || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending Review</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-serif text-red-600">{reviews.filter(r => r.reportCount >= 3).length}</p>
          <p className="text-xs text-nilin-warmGray">High Risk (3+ reports)</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <CheckCircle className="w-5 h-5 text-green-500 mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.approved || 0}</p>
          <p className="text-xs text-nilin-warmGray">Cleared</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search flagged reviews..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={ratingFilter}
          onChange={(e) => setRatingFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Ratings</option>
          <option value="5">5 Stars</option>
          <option value="4">4 Stars</option>
          <option value="3">3 Stars</option>
          <option value="2">2 Stars</option>
          <option value="1">1 Star</option>
        </select>
        <select
          value={reportFilter}
          onChange={(e) => setReportFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Reports</option>
          <option value="1">1+ Reports</option>
          <option value="2">2+ Reports</option>
          <option value="3">3+ Reports</option>
          <option value="5">5+ Reports</option>
        </select>
      </div>

      {/* Flagged Reviews List */}
      <div className="space-y-4">
        {filteredReviews.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No flagged reviews match your filters</p>
            <p className="text-sm mt-1">
              {reviews.length === 0 ? 'All reviews are clear of reports' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          filteredReviews.map(review => {
            const displayStatus = getReviewDisplayStatus(review);
            const isHighRisk = review.reportCount >= 3;

            return (
              <div
                key={review._id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all hover:shadow-md',
                  isHighRisk ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={cn(
                          'w-3 h-3',
                          star <= review.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'
                        )}
                      />
                    ))}
                    <span className="text-xs font-medium text-nilin-charcoal mt-1">{review.rating}/5</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        isHighRisk ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      )}>
                        {review.reportCount} Report{review.reportCount !== 1 ? 's' : ''}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        displayStatus === 'pending' ? 'bg-blue-100 text-blue-700' :
                        displayStatus === 'approved' ? 'bg-green-100 text-green-700' :
                        displayStatus === 'rejected' ? 'bg-gray-100 text-gray-700' :
                        'bg-gray-100 text-gray-700'
                      )}>
                        {displayStatus}
                      </span>
                      <span className="ml-auto text-xs text-nilin-warmGray">
                        Flag Confidence: <strong className={cn(
                          'text-nilin-charcoal',
                          review.confidence >= 70 && 'text-red-600',
                          review.confidence >= 50 && review.confidence < 70 && 'text-amber-600'
                        )}>{review.confidence}%</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-nilin-warmGray mb-2">
                      <span>By: <strong className="text-nilin-charcoal">{formatUserName(review.reviewerId)}</strong></span>
                      <span>For: <strong className="text-nilin-charcoal">{formatUserName(review.revieweeId)}</strong></span>
                      {review.bookingId?.serviceId && (
                        <span>Service: <strong className="text-nilin-charcoal">{review.bookingId.serviceId.name}</strong></span>
                      )}
                    </div>

                    <p className="text-sm text-nilin-charcoal mt-1">"{review.comment}"</p>

                    {/* Flag Reasons */}
                    {review.flagReasons.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {review.flagReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {displayStatus === 'pending' && (
                      <>
                        <button
                          onClick={() => handleModerate(review._id, 'hide')}
                          disabled={actionLoading === review._id}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          title="Hide Review"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleModerate(review._id, 'reject')}
                          disabled={actionLoading === review._id}
                          className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          title="False Positive"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleModerate(review._id, 'delete')}
                          disabled={actionLoading === review._id}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Delete Review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {displayStatus !== 'pending' && (
                      <button
                        onClick={() => handleModerate(review._id, 'approve')}
                        disabled={actionLoading === review._id}
                        className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                        title="Restore Review"
                      >
                        <ThumbsUp className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default FakeReviewDetector;
