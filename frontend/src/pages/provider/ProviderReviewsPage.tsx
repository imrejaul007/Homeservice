import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  MessageSquare,
  X,
  Send,
  AlertCircle,
  Check,
  Settings,
  Clock,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { useToastActions } from '../../components/common/Toast';
import { reviewsApi, type Review, type ProviderReviewScope } from '../../services/reviewsApi';
import { socketService } from '../../services/socket';

type ReviewTab = 'all' | 'approved' | 'pending';

const ProviderReviewsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, refreshProviderProfile } = useAuthStore();
  const toast = useToastActions();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const userRole = user?.role;
  const isProvider = isAuthenticated && userRole === 'provider';

  const fetchReviewsRef = useRef<() => Promise<void>>(async () => {});

  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [averageRating, setAverageRating] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<Record<number, number>>({
    5: 0, 4: 0, 3: 0, 2: 0, 1: 0,
  });
  const [totalReviews, setTotalReviews] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeTab, setActiveTab] = useState<ReviewTab>('all');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPendingOnReviewsPage, setShowPendingOnReviewsPage] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [replyingTo, setReplyingTo] = useState<Review | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const hasLoadedRef = useRef(false);

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const scope: ProviderReviewScope = activeTab === 'pending' ? 'pending' : activeTab === 'approved' ? 'approved' : 'all';
      const response = await reviewsApi.getMyReviews({ scope, limit: 50 });

      if (response.success && response.data) {
        setReviews(response.data.reviews ?? []);
        setAverageRating(response.data.averageRating ?? 0);
        setRatingDistribution(response.data.ratingDistribution ?? { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
        setTotalReviews(response.data.totalReviews ?? response.data.total ?? 0);
        setApprovedCount(response.data.approvedCount ?? 0);
        setPendingCount(response.data.pendingCount ?? 0);
        if (response.data.reviewDisplaySettings) {
          setShowPendingOnReviewsPage(response.data.reviewDisplaySettings.showPendingOnReviewsPage);
        }
        hasLoadedRef.current = true;
      } else {
        setError('Failed to load reviews');
      }
    } catch (err: unknown) {
      const axiosData =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; error?: string } } }).response?.data
          : undefined;
      const message =
        axiosData?.message ||
        axiosData?.error ||
        (err instanceof Error ? err.message : undefined);
      setError(message || 'Failed to load reviews');
      // Only toast once per mount to avoid spam during retry loops
      if (!hasLoadedRef.current) {
        toastRef.current.error('Failed to load reviews', message || 'An error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  fetchReviewsRef.current = fetchReviews;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/provider/reviews' } });
      return;
    }
    if (userRole !== 'provider') {
      navigate('/login', { state: { returnTo: '/provider/reviews' } });
    }
  }, [isAuthenticated, userRole, navigate]);

  useEffect(() => {
    if (!isProvider) return;
    fetchReviews();
  }, [isProvider, fetchReviews]);

  useEffect(() => {
    if (!isProvider) return;

    let unsub: (() => void) | undefined;

    const setup = async () => {
      if (!socketService.isConnected()) {
        try {
          await socketService.connect();
        } catch {
          return;
        }
      }
      unsub = socketService.onReviewModerated((data) => {
        fetchReviewsRef.current();
        refreshProviderProfile();
        if (data.action === 'approved') {
          toastRef.current.success('Review approved', 'A customer review is now visible on your profile.');
        } else if (data.action === 'hidden') {
          toastRef.current.info('Review hidden', 'A review was hidden by moderation.');
        }
      });
    };

    setup();
    return () => {
      unsub?.();
    };
  }, [isProvider, refreshProviderProfile]);

  const handleTogglePendingSetting = async (enabled: boolean) => {
    setSavingSettings(true);
    try {
      await reviewsApi.updateReviewDisplaySettings({ showPendingOnReviewsPage: enabled });
      setShowPendingOnReviewsPage(enabled);
      if (!enabled && activeTab === 'pending') {
        setActiveTab('approved');
      }
      toast.success('Settings saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSubmitReply = async () => {
    if (!replyingTo || !replyText.trim()) return;

    setIsSubmittingReply(true);
    setError(null);

    try {
      const response = await reviewsApi.replyToReview(replyingTo.id, replyText.trim());
      if (response.success) {
        setReviews((prev) =>
          prev.map((r) =>
            r.id === replyingTo.id
              ? { ...r, response: { comment: replyText.trim(), createdAt: new Date().toISOString() } }
              : r
          )
        );
        setReplyingTo(null);
        setReplyText('');
        toast.success('Reply sent');
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      setError(message || 'Failed to submit reply');
      toast.error('Failed to submit reply', message);
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.[0] || '';
    const last = lastName?.[0] || '';
    return (first + last).toUpperCase() || 'C';
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const visibleReviews = reviews.filter((review) => {
    if (!showPendingOnReviewsPage && review.moderationStatus === 'pending') {
      return false;
    }
    if (selectedRating && review.rating !== selectedRating) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">My Reviews</h1>
                <p className="text-nilin-warmGray">Customer feedback for your services</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-nilin border border-nilin-border text-sm text-nilin-charcoal hover:bg-nilin-blush/40"
            >
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-100 rounded">
                <X className="w-4 h-4 text-red-500" />
              </button>
            </div>
          )}

          {showSettings && (
            <div className="mb-6 glass-nilin rounded-nilin-lg p-4 border border-nilin-border/50">
              <h2 className="text-sm font-semibold text-nilin-charcoal mb-3">Review display settings</h2>
              <label className="flex items-center justify-between gap-4 cursor-pointer">
                <span className="text-sm text-nilin-warmGray">
                  Show pending reviews on this page (awaiting admin approval)
                </span>
                <input
                  type="checkbox"
                  checked={showPendingOnReviewsPage}
                  disabled={savingSettings}
                  onChange={(e) => handleTogglePendingSetting(e.target.checked)}
                  className="h-4 w-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <div className="col-span-2 glass-nilin rounded-nilin-lg p-4 text-center">
              <div className="text-4xl font-bold text-nilin-charcoal mb-1">{averageRating.toFixed(1)}</div>
              <div className="flex justify-center mb-2">{renderStars(Math.round(averageRating), 'md')}</div>
              <div className="text-sm text-nilin-warmGray">
                {totalReviews} approved {totalReviews === 1 ? 'review' : 'reviews'}
              </div>
              {pendingCount > 0 && (
                <div className="mt-2 inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                  <Clock className="w-3 h-3" />
                  {pendingCount} pending moderation
                </div>
              )}
            </div>

            <div className="col-span-4 grid grid-cols-5 gap-2">
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setSelectedRating(selectedRating === rating ? null : rating)}
                  className={`glass-nilin rounded-nilin-lg p-3 text-center transition-all ${
                    selectedRating === rating
                      ? 'ring-2 ring-nilin-coral bg-nilin-coral/10'
                      : 'hover:bg-nilin-muted'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <span className="text-sm font-medium text-nilin-charcoal">{rating}</span>
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="text-xs text-nilin-warmGray">{ratingDistribution[rating] || 0}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            {(['all', 'approved', 'pending'] as ReviewTab[]).map((tab) => {
              if (tab === 'pending' && !showPendingOnReviewsPage) return null;
              const label =
                tab === 'all'
                  ? `All (${approvedCount + (showPendingOnReviewsPage ? pendingCount : 0)})`
                  : tab === 'approved'
                    ? `Approved (${approvedCount})`
                    : `Pending (${pendingCount})`;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-nilin-coral text-white'
                      : 'bg-white border border-nilin-border text-nilin-charcoal hover:bg-nilin-blush/40'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {visibleReviews.length === 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">
                {selectedRating ? 'No reviews with this rating' : 'No reviews yet'}
              </h3>
              <p className="text-nilin-warmGray max-w-md mx-auto">
                {selectedRating
                  ? 'Try selecting a different rating filter.'
                  : 'Once customers complete bookings with you, their reviews will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleReviews.map((review) => (
                <div key={review.id} className="glass-nilin rounded-nilin-lg p-6 hover-lift transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center text-white font-medium">
                        {review.customer?.avatar ? (
                          <img
                            src={review.customer.avatar}
                            alt={review.customer.firstName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          getInitials(review.customer?.firstName, review.customer?.lastName)
                        )}
                      </div>
                      <div>
                        <h3 className="font-medium text-nilin-charcoal">
                          {review.customer
                            ? `${review.customer.firstName} ${review.customer.lastName}`
                            : 'Customer'}
                        </h3>
                        <p className="text-sm text-nilin-warmGray">{formatDate(review.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {renderStars(review.rating)}
                      {review.moderationStatus === 'pending' ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          Awaiting approval
                        </span>
                      ) : review.isVerified ? (
                        <span className="badge-nilin-primary text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {review.title && (
                    <h4 className="font-medium text-nilin-charcoal mb-2">{review.title}</h4>
                  )}
                  <p className="text-nilin-charcoal leading-relaxed mb-4">{review.comment}</p>

                  {review.response && (
                    <div className="mt-4 p-4 bg-nilin-muted rounded-nilin border-l-4 border-nilin-coral">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="w-4 h-4 text-nilin-coral" />
                        <span className="text-sm font-medium text-nilin-charcoal">Your Response</span>
                        <span className="text-xs text-nilin-warmGray">
                          {formatDate(review.response.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-nilin-warmGray">{review.response.comment}</p>
                    </div>
                  )}

                  {!review.response && review.moderationStatus === 'approved' && (
                    <div className="mt-4 pt-4 border-t border-nilin-border">
                      <button
                        type="button"
                        onClick={() => setReplyingTo(replyingTo?.id === review.id ? null : review)}
                        className="flex items-center gap-2 text-nilin-coral hover:text-nilin-coral/80 transition-colors text-sm font-medium"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Reply to Review
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {replyingTo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => {
                  setReplyingTo(null);
                  setReplyText('');
                }}
              />
              <div className="relative glass-nilin-strong rounded-nilin-xl p-6 max-w-md w-full shadow-nilin-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-xl text-nilin-charcoal">Reply to Review</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyText('');
                    }}
                    className="p-2 rounded-full hover:bg-nilin-muted transition-colors"
                  >
                    <X className="w-5 h-5 text-nilin-warmGray" />
                  </button>
                </div>
                <div className="mb-4 p-3 bg-nilin-muted rounded-nilin">
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(replyingTo.rating)}
                  </div>
                  <p className="text-sm text-nilin-warmGray line-clamp-2">{replyingTo.comment}</p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Your Response
                  </label>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none resize-none"
                    placeholder="Thank the customer for their feedback..."
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleSubmitReply}
                    disabled={isSubmittingReply || !replyText.trim()}
                    className="btn-nilin flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingReply ? 'Sending...' : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 p-4 bg-nilin-muted rounded-nilin">
            <p className="text-sm text-nilin-warmGray">
              <strong>Tip:</strong> Responding to approved reviews shows customers you value their feedback.
              Pending reviews appear here before admin moderation and are not shown on your public profile.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderReviewsPage;
