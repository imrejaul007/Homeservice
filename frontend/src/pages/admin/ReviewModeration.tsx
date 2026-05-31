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
  EyeOff,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  X,
  Filter,
  MessageSquare,
  User,
  Calendar,
  Briefcase
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import PageLayout from '../../components/layout/PageLayout';
import { AdminPageShell } from '../../components/admin/AdminPageShell';

// ============================================
// Types
// ============================================

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  isHidden: boolean;
  isVerified: boolean;
  helpfulVotes: number;
  reportCount: number;
  reviewerId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatar?: string;
  };
  revieweeId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  bookingId?: {
    _id: string;
    bookingNumber: string;
    scheduledDate: string;
    serviceId?: {
      _id: string;
      name: string;
      category: string;
    };
    providerId?: {
      _id: string;
      firstName: string;
      lastName: string;
    };
  };
  response?: {
    content: string;
    createdAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ReviewStats {
  total: number;
  flagged: number;
  rejected: number;
  approved: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type FilterStatus = 'all' | 'pending' | 'flagged' | 'approved' | 'rejected';

// ============================================
// Star Rating Component
// ============================================

const StarRating: React.FC<{ rating: number; size?: number }> = ({ rating, size = 16 }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        className={`${size > 16 ? 'w-5 h-5' : 'w-4 h-4'} ${
          star <= rating
            ? 'text-amber-400 fill-amber-400'
            : 'text-gray-300'
        }`}
      />
    ))}
  </div>
);

// ============================================
// Status Badge Component
// ============================================

const StatusBadge: React.FC<{ status: FilterStatus; count?: number }> = ({ status, count }) => {
  const config: Record<FilterStatus, { bg: string; text: string; label: string }> = {
    all: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'All' },
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' },
    flagged: { bg: 'bg-red-100', text: 'text-red-700', label: 'Flagged' },
    approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved' },
    rejected: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Rejected' }
  };

  const { bg, text, label } = config[status];

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${bg} ${text}`}>
      {label}
      {count !== undefined && <span className="ml-1 opacity-75">({count})</span>}
    </span>
  );
};

// ============================================
// Review Detail Modal
// ============================================

const ReviewDetailModal: React.FC<{
  review: Review;
  onClose: () => void;
  onModerate: (action: 'approve' | 'reject' | 'restore') => Promise<void>;
  onDelete: () => Promise<void>;
  isLoading: boolean;
}> = ({ review, onClose, onModerate, onDelete, isLoading }) => {
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'restore' | 'delete'>('approve');

  const handleAction = async () => {
    if (actionType === 'reject' && !showRejectConfirm) {
      setShowRejectConfirm(true);
      return;
    }
    if (actionType === 'delete' && !showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    try {
      if (actionType === 'delete') {
        await onDelete();
      } else {
        await onModerate(actionType);
      }
      onClose();
    } catch (error) {
      // Error handled by parent
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-nilin-border flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">Review Details</h2>
            <p className="text-sm text-nilin-warmGray mt-1">
              ID: {review._id.slice(-8)}...
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-nilin-muted rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Rating and Status */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <StarRating rating={review.rating} size={24} />
              <span className="text-2xl font-bold text-nilin-charcoal">{review.rating}/5</span>
            </div>
            <div className="flex items-center gap-2">
              {review.isHidden ? (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <EyeOff className="w-4 h-4" />
                  Hidden
                </span>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  Visible
                </span>
              )}
              {review.reportCount > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1">
                  <Flag className="w-4 h-4" />
                  {review.reportCount} flags
                </span>
              )}
            </div>
          </div>

          {/* Title */}
          {review.title && (
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
              {review.title}
            </h3>
          )}

          {/* Comment */}
          <div className="bg-nilin-muted/30 rounded-xl p-4 mb-6">
            <p className="text-nilin-charcoal whitespace-pre-wrap">{review.comment}</p>
          </div>

          {/* Photos */}
          {review.photos && review.photos.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Photos</h4>
              <div className="flex gap-2 flex-wrap">
                {review.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Review photo ${index + 1}`}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-800">Reviewer (Customer)</h4>
              </div>
              <p className="text-nilin-charcoal font-medium">
                {review.reviewerId?.firstName} {review.reviewerId?.lastName}
              </p>
              <p className="text-sm text-nilin-warmGray">{review.reviewerId?.email}</p>
            </div>

            <div className="bg-purple-50 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-medium text-purple-800">Reviewee (Provider)</h4>
              </div>
              <p className="text-nilin-charcoal font-medium">
                {review.revieweeId?.firstName} {review.revieweeId?.lastName}
              </p>
              <p className="text-sm text-nilin-warmGray">{review.revieweeId?.email}</p>
            </div>
          </div>

          {/* Booking Info */}
          {review.bookingId && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-600" />
                <h4 className="text-sm font-medium text-gray-800">Booking Info</h4>
              </div>
              <p className="text-nilin-charcoal">
                <span className="font-medium">Booking #:</span> {review.bookingId.bookingNumber}
              </p>
              {review.bookingId.serviceId && (
                <p className="text-nilin-charcoal">
                  <span className="font-medium">Service:</span> {review.bookingId.serviceId.name}
                </p>
              )}
              {review.bookingId.scheduledDate && (
                <p className="text-sm text-nilin-warmGray">
                  <span className="font-medium">Date:</span>{' '}
                  {new Date(review.bookingId.scheduledDate).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Response */}
          {review.response && (
            <div className="bg-green-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="w-4 h-4 text-green-600" />
                <h4 className="text-sm font-medium text-green-800">Provider Response</h4>
              </div>
              <p className="text-nilin-charcoal whitespace-pre-wrap">{review.response.content}</p>
              <p className="text-sm text-nilin-warmGray mt-2">
                {new Date(review.response.createdAt).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Meta Info */}
          <div className="text-sm text-nilin-warmGray flex gap-4">
            <span>Created: {new Date(review.createdAt).toLocaleDateString()}</span>
            <span>|</span>
            <span>Verified: {review.isVerified ? 'Yes' : 'No'}</span>
            <span>|</span>
            <span>Helpful: {review.helpfulVotes}</span>
          </div>

          {/* Confirmation Messages */}
          {showRejectConfirm && (
            <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Confirm Rejection</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                This will hide the review from public view. Continue?
              </p>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Confirm Deletion</span>
              </div>
              <p className="text-sm text-red-700 mt-1">
                This will soft-delete the review. Continue?
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-nilin-border flex gap-3">
          {!review.isHidden ? (
            <>
              <button
                onClick={() => {
                  setActionType('reject');
                  handleAction();
                }}
                disabled={isLoading}
                className="flex-1 px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading && actionType === 'reject' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                Reject
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setActionType('restore');
                handleAction();
              }}
              disabled={isLoading}
              className="flex-1 px-4 py-2 rounded-xl border-2 border-green-200 text-green-600 hover:bg-green-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && actionType === 'restore' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              Restore
            </button>
          )}

          <button
            onClick={() => {
              setActionType('approve');
              handleAction();
            }}
            disabled={isLoading}
            className="flex-1 btn-nilin flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading && actionType === 'approve' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle className="w-5 h-5" />
            )}
            Approve
          </button>

          <button
            onClick={() => {
              setActionType('delete');
              handleAction();
            }}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading && actionType === 'delete' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const ReviewModeration: React.FC = () => {
  const { tokens } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // Load reviews
  const loadReviews = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchTerm && { search: searchTerm })
      });

      const response = await fetch(`${API_URL}/admin/reviews?${params}`, {
        headers: {
          Authorization: `Bearer ${tokens?.accessToken || ''}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setReviews(data.data.reviews);
        setPagination(data.data.pagination);
      } else {
        toast.error(data.message || 'Failed to load reviews');
      }
    } catch (error) {
      console.error('Failed to load reviews:', error);
      toast.error('Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [API_URL, tokens?.accessToken, statusFilter, searchTerm]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/admin/reviews/stats`, {
        headers: {
          Authorization: `Bearer ${tokens?.accessToken || ''}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [API_URL, tokens?.accessToken]);

  useEffect(() => {
    loadReviews();
    loadStats();
  }, [loadReviews, loadStats]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadReviews(1);
  };

  // Handle status filter change
  const handleStatusChange = (status: FilterStatus) => {
    setStatusFilter(status);
    loadReviews(1);
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    loadReviews(newPage);
  };

  // Handle review moderation
  const handleModerate = async (action: 'approve' | 'reject' | 'restore') => {
    if (!selectedReview) return;
    setActionLoading(true);

    try {
      // Backend expects /admin/reviews/:id/moderate with action in body
      const response = await fetch(`${API_URL}/admin/reviews/${selectedReview._id}/moderate`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken || ''}`
        },
        body: JSON.stringify({ action })
      });

      const data = await response.json();
      if (data.success) {
        toast.success(`Review ${action}d successfully`);
        loadReviews(pagination.page);
        loadStats();
      } else {
        toast.error(data.message || `Failed to ${action} review`);
      }
    } catch (error) {
      console.error(`Failed to ${action} review:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} review. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle review deletion
  const handleDelete = async () => {
    if (!selectedReview) return;
    setActionLoading(true);

    try {
      const response = await fetch(`${API_URL}/admin/reviews/${selectedReview._id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokens?.accessToken || ''}`
        },
        body: JSON.stringify({ reason: 'Admin deletion' })
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Review deleted successfully');
        loadReviews(pagination.page);
        loadStats();
      } else {
        toast.error(data.message || 'Failed to delete review');
      }
    } catch (error) {
      console.error('Failed to delete review:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete review. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Get status badge for a review
  const getReviewStatus = (review: Review): FilterStatus => {
    if (review.isHidden) return 'rejected';
    if (review.reportCount > 0) return 'flagged';
    return 'approved';
  };

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Review Moderation"
        subtitle="Manage and moderate customer reviews"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Reviews', current: true },
        ]}
      >
        <div className="space-y-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-nilin-warmGray">Total Reviews</p>
              <p className="text-2xl font-bold text-nilin-charcoal">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-nilin-warmGray">Flagged</p>
              <p className="text-2xl font-bold text-red-600">{stats.flagged}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-nilin-warmGray">Rejected</p>
              <p className="text-2xl font-bold text-gray-600">{stats.rejected}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-nilin-warmGray">Avg Rating</p>
              <p className="text-2xl font-bold text-nilin-charcoal flex items-center gap-1">
                {stats.averageRating}
                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-sm text-nilin-warmGray">Rating Distribution</p>
              <div className="flex gap-1 mt-1">
                {[5, 4, 3, 2, 1].map((rating) => (
                  <div key={rating} className="flex flex-col items-center">
                    <span className="text-xs text-nilin-warmGray">{rating}</span>
                    <div
                      className="w-4 bg-amber-400 rounded-sm"
                      style={{
                        height: `${Math.max(
                          4,
                          (stats.ratingDistribution[rating] / stats.total) * 40
                        )}px`
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          {/* Status Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'flagged', 'approved', 'rejected'] as FilterStatus[]).map(
              (status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-nilin-coral text-white'
                      : 'bg-white text-nilin-charcoal hover:bg-nilin-muted'
                  }`}
                >
                  <StatusBadge status={status} />
                </button>
              )
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                type="text"
                placeholder="Search reviews..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 rounded-xl border-2 border-nilin-border bg-white/80 focus:border-nilin-coral focus:outline-none w-64"
              />
            </div>
            <button type="submit" className="btn-nilin">
              <Filter className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <MessageSquare className="w-16 h-16 text-nilin-warmGray mx-auto mb-4" />
            <h3 className="text-xl font-medium text-nilin-charcoal mb-2">No reviews found</h3>
            <p className="text-nilin-warmGray">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No reviews have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-nilin-border bg-nilin-muted/30">
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Rating
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Review
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Provider
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-medium text-nilin-charcoal">
                      Date
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-medium text-nilin-charcoal">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((review) => (
                    <tr
                      key={review._id}
                      className={`border-b border-nilin-border last:border-b-0 hover:bg-nilin-muted/20 transition-colors ${
                        review.isHidden ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <StarRating rating={review.rating} />
                          <span className="font-medium text-nilin-charcoal">{review.rating}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-sm text-nilin-charcoal truncate">
                          {review.title || review.comment.slice(0, 60)}
                          {(review.title?.length || review.comment.length) > 60 ? '...' : ''}
                        </p>
                        {review.reportCount > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1 text-xs text-red-600">
                            <Flag className="w-3 h-3" />
                            {review.reportCount} flags
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-nilin-charcoal">
                          {review.reviewerId?.firstName} {review.reviewerId?.lastName}
                        </p>
                        <p className="text-xs text-nilin-warmGray truncate max-w-[120px]">
                          {review.reviewerId?.email}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-nilin-charcoal">
                          {review.revieweeId?.firstName} {review.revieweeId?.lastName}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={getReviewStatus(review)} />
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-nilin-warmGray">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedReview(review)}
                            className="p-2 hover:bg-nilin-muted rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye className="w-4 h-4 text-nilin-coral" />
                          </button>
                          {review.isHidden ? (
                            <button
                              onClick={async () => {
                                setSelectedReview(review);
                                await handleModerate('restore');
                              }}
                              className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                              title="Restore review"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                setSelectedReview(review);
                                await handleModerate('reject');
                              }}
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject review"
                            >
                              <XCircle className="w-4 h-4 text-red-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="px-6 py-4 border-t border-nilin-border flex items-center justify-between">
                <p className="text-sm text-nilin-warmGray">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                  {pagination.total} reviews
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrev}
                    className="p-2 rounded-lg border border-nilin-border hover:bg-nilin-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-sm text-nilin-charcoal">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNext}
                    className="p-2 rounded-lg border border-nilin-border hover:bg-nilin-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onModerate={handleModerate}
          onDelete={handleDelete}
          isLoading={actionLoading}
        />
      )}
    </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ReviewModeration;
