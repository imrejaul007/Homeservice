/**
 * ReviewVoting Component
 * Allows users to vote on reviews as helpful or not helpful
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { reviewsApi } from '../../services/reviewsApi';
import { useAuthStore } from '../../stores/authStore';

interface ReviewVotingProps {
  reviewId: string;
  initialHelpfulVotes?: number;
  className?: string;
  onVoteChange?: (helpfulVotes: number, userVote: boolean | null) => void;
}

export const ReviewVoting: React.FC<ReviewVotingProps> = ({
  reviewId,
  initialHelpfulVotes = 0,
  className,
  onVoteChange,
}) => {
  const { isAuthenticated } = useAuthStore();
  const [helpfulVotes, setHelpfulVotes] = useState(initialHelpfulVotes);
  const [userVote, setUserVote] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial vote state
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchVotes = async () => {
      try {
        const response = await reviewsApi.getReviewVotes(reviewId);
        if (response.success) {
          setHelpfulVotes(response.data.helpfulVotes);
          setUserVote(response.data.userVote);
        }
      } catch (err) {
        console.error('Failed to fetch review votes:', err);
      }
    };

    fetchVotes();
  }, [reviewId, isAuthenticated]);

  const handleVote = useCallback(async (helpful: boolean) => {
    if (!isAuthenticated || loading) return;

    setLoading(true);
    setError(null);

    try {
      const response = await reviewsApi.voteReview(reviewId, helpful);
      if (response.success) {
        setHelpfulVotes(response.helpfulVotes);
        const newUserVote = response.userVote;
        setUserVote(newUserVote);
        onVoteChange?.(response.helpfulVotes, newUserVote);
      }
    } catch (err) {
      console.error('Failed to vote:', err);
      setError('Failed to submit vote. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [reviewId, isAuthenticated, loading, onVoteChange]);

  if (!isAuthenticated) {
    return (
      <div className={cn('flex items-center gap-3 text-sm text-nilin-warmGray', className)}>
        <ThumbsUp className="w-4 h-4" />
        <span>{helpfulVotes} people found this helpful</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-sm text-nilin-warmGray">
        Was this review helpful?
      </span>

      <div className="flex items-center gap-1">
        {/* Helpful Button */}
        <button
          onClick={() => handleVote(true)}
          disabled={loading}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            userVote === true
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-nilin-muted/50 text-nilin-warmGray hover:bg-green-50 hover:text-green-600 border border-transparent',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ThumbsUp
              className={cn(
                'w-4 h-4',
                userVote === true && 'fill-current'
              )}
            />
          )}
          <span>Yes</span>
        </button>

        {/* Not Helpful Button */}
        <button
          onClick={() => handleVote(false)}
          disabled={loading}
          className={cn(
            'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
            userVote === false
              ? 'bg-red-100 text-red-700 border border-red-300'
              : 'bg-nilin-muted/50 text-nilin-warmGray hover:bg-red-50 hover:text-red-600 border border-transparent',
            loading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ThumbsDown
              className={cn(
                'w-4 h-4',
                userVote === false && 'fill-current'
              )}
            />
          )}
          <span>No</span>
        </button>
      </div>

      {/* Helpfulness count */}
      <span className="text-sm text-nilin-warmGray">
        ({helpfulVotes} found helpful)
      </span>

      {/* Error message */}
      {error && (
        <span className="text-xs text-red-500">{error}</span>
      )}
    </div>
  );
};

export default ReviewVoting;
