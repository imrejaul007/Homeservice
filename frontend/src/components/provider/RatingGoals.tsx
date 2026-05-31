/**
 * RatingGoals - Set and track rating improvement targets
 * Provider Dashboard Component
 */
import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Star,
  Target,
  Trophy,
  TrendingUp,
  Award,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Save,
  RotateCcw,
  Lightbulb,
  ThumbsUp,
  MessageSquare,
  Smile,
  Zap,
  Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Type Definitions
// =============================================================================

export interface RatingGoal {
  /** Goal ID */
  id: string;
  /** Target rating (e.g., 4.8) */
  targetRating: number;
  /** Target date */
  targetDate: string;
  /** Current rating */
  currentRating: number;
  /** Progress percentage */
  progress: number;
  /** Status: 'in_progress' | 'achieved' | 'expired' */
  status: 'in_progress' | 'achieved' | 'expired';
  /** Improvement tips to reach goal */
  tips: Array<{ title: string; description: string; completed: boolean; impact: number }>;
  /** Created at */
  createdAt: string;
  /** Achievement badge if reached */
  badge?: {
    name: string;
    icon: string;
    earnedAt: string;
  };
}

export interface RatingStats {
  currentRating: number;
  totalReviews: number;
  avgResponseTime: string;
  completionRate: number;
  recentTrend: number; // positive = improving
  ratingDistribution: {
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  };
}

export interface RatingGoalsProps {
  /** Current goal */
  goal?: RatingGoal;
  /** Rating statistics */
  stats: RatingStats;
  /** Achievement badges earned */
  badges?: Array<{ id: string; name: string; icon: string; earnedAt: string; description: string }>;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when goal is saved */
  onSaveGoal: (targetRating: number, targetDate: string) => Promise<void>;
  /** Callback when tip is marked complete */
  onCompleteTip: (tipId: string) => Promise<void>;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Achievement Badge Component
// =============================================================================

interface BadgeDisplayProps {
  badge: RatingGoalsProps['badges'] extends Array<infer T> ? T : never;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ badge, size = 'md', showDetails = false }) => {
  const sizes = {
    sm: { wrapper: 'w-12 h-12', icon: 'w-6 h-6', text: 'text-xs' },
    md: { wrapper: 'w-16 h-16', icon: 'w-8 h-8', text: 'text-sm' },
    lg: { wrapper: 'w-20 h-20', icon: 'w-10 h-10', text: 'text-base' },
  };

  const s = sizes[size];

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="text-center"
    >
      <div className={cn('rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-2 shadow-lg', s.wrapper)}>
        <span className={s.text}>{badge.icon}</span>
      </div>
      <p className="font-medium text-nilin-charcoal">{badge.name}</p>
      {showDetails && (
        <p className="text-xs text-nilin-warmGray mt-1">{badge.description}</p>
      )}
    </motion.div>
  );
};

// =============================================================================
// Rating Display Component
// =============================================================================

interface RatingDisplayProps {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
  showDecimal?: boolean;
}

const RatingDisplay: React.FC<RatingDisplayProps> = ({ rating, size = 'md', showDecimal = true }) => {
  const sizes = {
    sm: 'text-lg',
    md: 'text-3xl',
    lg: 'text-5xl',
  };

  return (
    <div className="flex items-center gap-1">
      <span className={cn('font-bold text-nilin-charcoal', sizes[size])}>
        {showDecimal ? rating.toFixed(1) : Math.round(rating)}
      </span>
      <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
    </div>
  );
};

// =============================================================================
// Progress Ring Component
// =============================================================================

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#E8B4A8',
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="#E8E4E0"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        fill="none"
        className="transition-all duration-500"
      />
    </svg>
  );
};

// =============================================================================
// Tip Card Component
// =============================================================================

interface TipCardProps {
  tip: RatingGoal['tips'][0];
  onComplete: () => Promise<void>;
  index: number;
}

const TipCard: React.FC<TipCardProps> = ({ tip, onComplete, index }) => {
  const [isCompleting, setIsCompleting] = useState(false);

  const handleComplete = async () => {
    setIsCompleting(true);
    try {
      await onComplete();
    } finally {
      setIsCompleting(false);
    }
  };

  const impactLabel =
    tip.impact >= 30
      ? 'High Impact'
      : tip.impact >= 15
      ? 'Medium Impact'
      : 'Low Impact';

  const impactColor =
    tip.impact >= 30
      ? 'text-green-600 bg-green-100'
      : tip.impact >= 15
      ? 'text-amber-600 bg-amber-100'
      : 'text-gray-600 bg-gray-100';

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-all',
        tip.completed
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-nilin-border hover:border-nilin-coral/30'
      )}
    >
      <div
        className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0',
          tip.completed ? 'bg-green-500 text-white' : 'bg-nilin-muted text-nilin-warmGray'
        )}
      >
        {tip.completed ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <span className="text-xs font-bold">{index + 1}</span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <h5 className={cn('text-sm font-medium', tip.completed && 'line-through text-nilin-warmGray')}>
            {tip.title}
          </h5>
          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', impactColor)}>
            {impactLabel}
          </span>
        </div>
        <p className="text-xs text-nilin-warmGray">{tip.description}</p>
        {!tip.completed && (
          <button
            onClick={handleComplete}
            disabled={isCompleting}
            className="mt-2 text-xs text-nilin-coral hover:text-nilin-rose transition-colors"
          >
            {isCompleting ? 'Marking...' : 'Mark as done'}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// =============================================================================
// Set Goal Modal Component
// =============================================================================

interface SetGoalModalProps {
  isOpen: boolean;
  currentRating: number;
  onSave: (targetRating: number, targetDate: string) => Promise<void>;
  onClose: () => void;
}

const SetGoalModal: React.FC<SetGoalModalProps> = ({
  isOpen,
  currentRating,
  onSave,
  onClose,
}) => {
  const [targetRating, setTargetRating] = useState(Math.min(currentRating + 0.2, 5));
  const [targetDate, setTargetDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString().split('T')[0];
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(targetRating, targetDate);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const improvement = targetRating - currentRating;
  const estimatedDays = Math.ceil(improvement * 30); // Rough estimate

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-nilin-xl max-w-md w-full p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
                  <Target className="w-8 h-8 text-nilin-coral" />
                </div>
                <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
                  Set Your Rating Goal
                </h3>
                <p className="text-sm text-nilin-warmGray">
                  Set a target rating and date to track your improvement
                </p>
              </div>

              {/* Current Rating */}
              <div className="bg-nilin-muted/30 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-nilin-warmGray">Current Rating</span>
                  <RatingDisplay rating={currentRating} size="sm" />
                </div>
              </div>

              {/* Target Rating */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Target Rating
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={currentRating}
                    max={5}
                    step={0.1}
                    value={targetRating}
                    onChange={(e) => setTargetRating(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-nilin-muted rounded-lg appearance-none cursor-pointer accent-nilin-coral"
                  />
                  <div className="w-20 text-center">
                    <RatingDisplay rating={targetRating} size="sm" />
                  </div>
                </div>
              </div>

              {/* Target Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                  Target Date
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>

              {/* Estimate */}
              <div className="bg-blue-50 rounded-lg p-3 mb-6">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">
                    To reach {targetRating.toFixed(1)} stars, aim for ~{Math.ceil(improvement * 5)} more
                    5-star reviews in {estimatedDays} days
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 border border-nilin-border rounded-xl text-nilin-charcoal font-medium hover:bg-nilin-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || improvement <= 0}
                  className="flex-1 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Set Goal'}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// =============================================================================
// Stats Card Component
// =============================================================================

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  color?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  trend,
  color = 'coral',
}) => {
  const colorClasses: Record<string, string> = {
    coral: 'bg-nilin-coral/10 text-nilin-coral',
    success: 'bg-green-100 text-green-600',
    warning: 'bg-amber-100 text-amber-600',
    info: 'bg-blue-100 text-blue-600',
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-nilin-warmGray">{label}</span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', colorClasses[color])}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-nilin-charcoal">{value}</p>
      {trend !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-xs',
            trend >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          {trend >= 0 ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingUp className="w-3 h-3 transform rotate-180" />
          )}
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const RatingGoals: React.FC<RatingGoalsProps> = ({
  goal,
  stats,
  badges = [],
  isLoading = false,
  onSaveGoal,
  onCompleteTip,
  onRefresh,
  className,
}) => {
  const [showGoalModal, setShowGoalModal] = useState(false);

  const handleSaveGoal = useCallback(
    async (targetRating: number, targetDate: string) => {
      await onSaveGoal(targetRating, targetDate);
    },
    [onSaveGoal]
  );

  const daysRemaining = useMemo(() => {
    if (!goal || goal.status !== 'in_progress') return 0;
    const target = new Date(goal.targetDate);
    const now = new Date();
    return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [goal]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="flex items-center justify-center mb-6">
            <div className="w-32 h-32 bg-nilin-muted rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Rating Goals
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Track and improve your rating
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          {!goal || goal.status !== 'in_progress' ? (
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
            >
              <Target className="w-4 h-4" />
              Set Goal
            </button>
          ) : (
            <button
              onClick={() => setShowGoalModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-nilin-border rounded-xl text-nilin-charcoal hover:bg-nilin-muted transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Edit Goal
            </button>
          )}
        </div>
      </div>

      {/* Goal Progress or Empty State */}
      {goal && goal.status === 'in_progress' ? (
        <div className="mb-6">
          <div className="flex items-center gap-6">
            {/* Progress Ring */}
            <div className="relative">
              <ProgressRing progress={goal.progress} size={140} strokeWidth={10} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <RatingDisplay rating={goal.currentRating} size="sm" />
                <span className="text-xs text-nilin-warmGray">
                  of {goal.targetRating}
                </span>
              </div>
            </div>

            {/* Goal Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  In Progress
                </span>
              </div>
              <h4 className="text-lg font-semibold text-nilin-charcoal mb-1">
                Goal: {goal.targetRating.toFixed(1)} Stars
              </h4>
              <p className="text-sm text-nilin-warmGray">
                Target date: {new Date(goal.targetDate).toLocaleDateString()}
              </p>
              <p className="text-sm text-nilin-coral font-medium mt-2">
                {daysRemaining} days remaining
              </p>
            </div>

            {/* Badge if earned */}
            {goal.badge && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-2 shadow-lg">
                  <span className="text-2xl">{goal.badge.icon}</span>
                </div>
                <p className="text-xs font-medium text-nilin-charcoal">{goal.badge.name}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-6 bg-nilin-muted/30 rounded-xl text-center">
          <div className="w-16 h-16 rounded-full bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
            <Target className="w-8 h-8 text-nilin-coral" />
          </div>
          <h4 className="text-lg font-semibold text-nilin-charcoal mb-2">
            Set a Rating Goal
          </h4>
          <p className="text-sm text-nilin-warmGray mb-4 max-w-md mx-auto">
            Set a target rating and get personalized tips to improve your service quality
          </p>
          <button
            onClick={() => setShowGoalModal(true)}
            className="px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
          >
            Get Started
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Reviews"
          value={stats.totalReviews}
          icon={<MessageSquare className="w-4 h-4" />}
          color="coral"
        />
        <StatCard
          label="Response Time"
          value={stats.avgResponseTime}
          icon={<Clock className="w-4 h-4" />}
          color="info"
        />
        <StatCard
          label="Completion Rate"
          value={`${stats.completionRate}%`}
          icon={<CheckCircle className="w-4 h-4" />}
          color="success"
        />
        <StatCard
          label="Rating Trend"
          value={`${stats.recentTrend >= 0 ? '+' : ''}${stats.recentTrend.toFixed(1)}%`}
          icon={<TrendingUp className="w-4 h-4" />}
          trend={stats.recentTrend}
          color={stats.recentTrend >= 0 ? 'success' : 'warning'}
        />
      </div>

      {/* Tips Section */}
      {goal && goal.tips.length > 0 && goal.status !== 'achieved' && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Tips to Improve ({goal.tips.filter((t) => !t.completed).length} remaining)
          </h4>
          <div className="space-y-2">
            {goal.tips.map((tip, index) => (
              <TipCard
                key={tip.title}
                tip={tip}
                index={index}
                onComplete={() => onCompleteTip(tip.title)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Achieved Badges */}
      {badges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Achievement Badges
          </h4>
          <div className="flex items-center gap-4 flex-wrap">
            {badges.map((badge) => (
              <BadgeDisplay key={badge.id} badge={badge} size="md" showDetails />
            ))}
          </div>
        </div>
      )}

      {/* Rating Distribution */}
      <div className="mt-6">
        <h4 className="text-sm font-semibold text-nilin-charcoal mb-3">
          Rating Distribution
        </h4>
        <div className="space-y-2">
          {[
            { stars: 5, count: stats.ratingDistribution.fiveStar, color: 'bg-green-500' },
            { stars: 4, count: stats.ratingDistribution.fourStar, color: 'bg-green-400' },
            { stars: 3, count: stats.ratingDistribution.threeStar, color: 'bg-yellow-400' },
            { stars: 2, count: stats.ratingDistribution.twoStar, color: 'bg-orange-400' },
            { stars: 1, count: stats.ratingDistribution.oneStar, color: 'bg-red-400' },
          ].map(({ stars, count, color }) => {
            const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
            return (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16">
                  <span className="text-sm text-nilin-charcoal">{stars}</span>
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                </div>
                <div className="flex-1 h-4 bg-nilin-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', color)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-nilin-warmGray w-12 text-right">
                  {count} ({percentage.toFixed(0)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Goal Modal */}
      <SetGoalModal
        isOpen={showGoalModal}
        currentRating={stats.currentRating}
        onSave={handleSaveGoal}
        onClose={() => setShowGoalModal(false)}
      />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default RatingGoals;
