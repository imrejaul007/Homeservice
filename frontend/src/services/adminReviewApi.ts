import { api } from './api';

export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden' | 'flagged';

export interface AdminReviewUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  businessInfo?: { businessName?: string };
}

export interface AdminReview {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  photos?: string[];
  isHidden: boolean;
  isVerified: boolean;
  helpfulVotes: number;
  reportCount: number;
  moderationStatus: 'pending' | 'approved' | 'rejected' | 'hidden';
  moderationReason?: string;
  reviewerId: AdminReviewUser;
  revieweeId: AdminReviewUser;
  bookingId?: {
    _id: string;
    bookingNumber: string;
    scheduledDate: string;
    serviceId?: { _id: string; name: string; category?: string };
    providerId?: { _id: string; firstName: string; lastName: string };
  };
  response?: { comment: string; createdAt: string };
  createdAt: string;
  updatedAt: string;
}

export interface AdminReviewStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  hidden: number;
  flagged: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
}

export interface ReviewListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

function normalizeStats(raw: Record<string, unknown>): AdminReviewStats {
  const rating = (raw.rating as { average?: number; distribution?: Record<number, number> }) || {};
  const dist = rating.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  return {
    total: Number(raw.total ?? 0),
    pending: Number(raw.pending ?? 0),
    approved: Number(raw.approved ?? 0),
    rejected: Number(raw.rejected ?? 0),
    hidden: Number(raw.hidden ?? 0),
    flagged: Number(raw.flagged ?? 0),
    averageRating: Number(rating.average ?? raw.averageRating ?? 0),
    ratingDistribution: {
      1: Number(dist[1] ?? 0),
      2: Number(dist[2] ?? 0),
      3: Number(dist[3] ?? 0),
      4: Number(dist[4] ?? 0),
      5: Number(dist[5] ?? 0),
    },
  };
}

export function getReviewDisplayStatus(review: AdminReview): ReviewModerationStatus {
  if (review.reportCount > 0 && review.moderationStatus !== 'rejected') return 'flagged';
  return review.moderationStatus;
}

export function formatReviewUserName(user?: AdminReviewUser | null): string {
  if (!user || typeof user !== 'object') return 'Unknown';
  const business = user.businessInfo?.businessName?.trim();
  if (business) return business;
  const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  return name || user.email || 'Unknown';
}

export const adminReviewApi = {
  list: async (params: ReviewListParams = {}) => {
    const response = await api.get('/admin/reviews', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
        ...(params.search ? { search: params.search } : {}),
      },
    });
    return response.data.data as {
      reviews: AdminReview[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
      };
    };
  },

  stats: async (): Promise<AdminReviewStats> => {
    const response = await api.get('/admin/reviews/stats');
    const payload = response.data.data;
    if (payload?.stats) return normalizeStats(payload.stats as Record<string, unknown>);
    return normalizeStats(payload as Record<string, unknown>);
  },

  moderate: async (
    id: string,
    action: 'approve' | 'reject' | 'restore' | 'hide' | 'delete',
    reason?: string
  ) => {
    const serverAction = action === 'restore' ? 'approve' : action;
    const response = await api.patch(`/admin/reviews/${id}/moderate`, {
      action: serverAction,
      ...(reason ? { reason } : {}),
    });
    return response.data;
  },
};
