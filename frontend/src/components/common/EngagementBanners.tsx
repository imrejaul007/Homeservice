// Engagement Banners - Re-engagement, Weekly Challenges, and Streak Reminders
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Target, Flame, Gift, Clock, ArrowRight, X, CheckCircle2, TrendingUp, Zap, ChevronRight } from 'lucide-react';
import { useHabits, useReengagement, useWeeklyChallenges } from '../../services/superapp/HabitEngine';

// ============================================
// RE-ENGAGEMENT BANNER - DESKTOP OPTIMIZED
// ============================================

interface ReEngagementBannerProps {
  onAction?: () => void;
  onDismiss?: () => void;
}

export function ReEngagementBanner({ onAction, onDismiss }: ReEngagementBannerProps) {
  const reengagement = useReengagement();
  const shouldReengage = reengagement.shouldShowReengagement();
  const nudge = reengagement.getReengagementNudge();

  if (!shouldReengage || !nudge) return null;

  const getBannerStyle = () => {
    switch (nudge.priority) {
      case 'high':
        return {
          gradient: 'from-rose-50 via-pink-50 to-purple-50',
          border: 'border-rose-200/50',
          icon: 'bg-gradient-to-br from-rose-400 to-pink-500',
          iconGlow: 'shadow-rose-200',
          button: 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600',
          badge: 'bg-rose-100 text-rose-600',
          accent: 'text-rose-500',
        };
      case 'medium':
        return {
          gradient: 'from-amber-50 via-orange-50 to-yellow-50',
          border: 'border-amber-200/50',
          icon: 'bg-gradient-to-br from-amber-400 to-orange-500',
          iconGlow: 'shadow-amber-200',
          button: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600',
          badge: 'bg-amber-100 text-amber-600',
          accent: 'text-amber-500',
        };
      default:
        return {
          gradient: 'from-purple-50 via-violet-50 to-indigo-50',
          border: 'border-purple-200/50',
          icon: 'bg-gradient-to-br from-purple-400 to-violet-500',
          iconGlow: 'shadow-purple-200',
          button: 'bg-gradient-to-r from-purple-500 to-violet-500 hover:from-purple-600 hover:to-violet-600',
          badge: 'bg-purple-100 text-purple-600',
          accent: 'text-purple-500',
        };
    }
  };

  const style = getBannerStyle();

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="hidden lg:block"
      >
        <div className={`mx-4 lg:mx-auto lg:max-w-5xl my-4 p-6 rounded-2xl bg-gradient-to-br ${style.gradient} border ${style.border} shadow-lg`}>
          <div className="flex items-center justify-between gap-6">
            {/* Content Section */}
            <div className="flex items-center gap-5 flex-1">
              {/* Animated Icon */}
              <motion.div
                className={`w-16 h-16 rounded-2xl ${style.icon} flex items-center justify-center shadow-lg ${style.iconGlow}`}
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, -5, 5, 0]
                }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Sparkles className="w-8 h-8 text-white" />
              </motion.div>

              <div className="flex-1">
                {/* Header Row */}
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-xl font-serif font-bold text-nilin-charcoal">
                    {nudge.title}
                  </h3>
                  {nudge.priority === 'high' && (
                    <motion.span
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`px-3 py-1 ${style.badge} text-xs font-semibold rounded-full`}
                    >
                      Special Offer
                    </motion.span>
                  )}
                </div>

                {/* Message */}
                <p className="text-sm text-nilin-warmGray mb-3">
                  {nudge.message}
                </p>

                {/* Feature Pills */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100">
                    <Gift className={`w-4 h-4 ${style.accent}`} />
                    <span className="text-xs font-medium text-nilin-charcoal">Exclusive discount</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-nilin-charcoal">Limited time</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-medium text-nilin-charcoal">Instant booking</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <motion.button
                onClick={onAction}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`${style.button} text-white px-6 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2`}
              >
                <span>Book Now</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="p-2 hover:bg-white/50 rounded-lg transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-5 h-5 text-nilin-warmGray" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}

// ============================================
// WEEKLY CHALLENGE BANNER - DESKTOP OPTIMIZED
// ============================================

interface WeeklyChallengeBannerProps {
  onChallengeClick?: () => void;
  compact?: boolean;
}

export function WeeklyChallengeBanner({ onChallengeClick, compact = false }: WeeklyChallengeBannerProps) {
  const weeklyChallenges = useWeeklyChallenges();
  const challenge = weeklyChallenges.activeChallenge;

  if (!challenge) return null;

  const progress = Math.min((challenge.progress / challenge.target) * 100, 100);
  const isCompleted = challenge.completed || progress >= 100;
  const daysRemaining = Math.ceil((challenge.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));

  const getChallengeIcon = () => {
    switch (challenge.type) {
      case 'bookings':
        return <Target className="w-6 h-6" />;
      case 'spending':
        return <TrendingUp className="w-6 h-6" />;
      case 'checkin':
        return <Flame className="w-6 h-6" />;
      case 'referral':
        return <Sparkles className="w-6 h-6" />;
      default:
        return <Target className="w-6 h-6" />;
    }
  };

  // Completed state
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="hidden lg:block mx-4 lg:mx-auto lg:max-w-5xl my-4 p-6 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/50 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg"
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            >
              <CheckCircle2 className="w-8 h-8 text-white" />
            </motion.div>
            <div>
              <h3 className="text-lg font-bold text-nilin-charcoal">Challenge Complete!</h3>
              <p className="text-sm text-emerald-600 font-medium">+{challenge.reward} points added to your account</p>
            </div>
          </div>
          <button
            onClick={onChallengeClick}
            className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-semibold hover:bg-emerald-600 transition-colors flex items-center gap-2"
          >
            View Rewards
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  // Active challenge state
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="hidden lg:block mx-4 lg:mx-auto lg:max-w-5xl my-4 p-6 rounded-2xl bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 border border-purple-200/50 shadow-lg"
    >
      <div className="flex items-center justify-between gap-6">
        {/* Left Section */}
        <div className="flex items-center gap-5 flex-1">
          {/* Icon */}
          <motion.div
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-400 to-fuchsia-500 flex items-center justify-center shadow-lg"
            animate={!compact ? { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] } : {}}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
          >
            <span className="text-white">{getChallengeIcon()}</span>
          </motion.div>

          <div className="flex-1">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Weekly Challenge</span>
              {daysRemaining <= 2 && (
                <span className="px-2.5 py-1 bg-amber-100 text-amber-600 text-xs font-semibold rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                </span>
              )}
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-nilin-charcoal mb-3">
              {challenge.title}
            </h3>

            {/* Progress Section */}
            <div className="flex items-center gap-4">
              {/* Progress Bar */}
              <div className="flex-1 max-w-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-nilin-warmGray">
                    Progress
                  </span>
                  <span className="text-sm font-bold text-purple-600">
                    {Math.round(progress)}%
                  </span>
                </div>
                <div className="h-3 bg-purple-100 rounded-full overflow-hidden shadow-inner">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-purple-500 to-fuchsia-500 rounded-full relative overflow-hidden"
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                  </motion.div>
                </div>
              </div>

              {/* Counter */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-lg border border-gray-100">
                <span className="text-sm font-bold text-nilin-charcoal">
                  {challenge.progress}/{challenge.target}
                </span>
                <span className="text-xs text-nilin-warmGray">completed</span>
              </div>
            </div>

            {/* CTA when close */}
            {progress >= 75 && !isCompleted && (
              <motion.button
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                onClick={onChallengeClick}
                className="mt-3 text-sm text-purple-600 font-medium hover:text-purple-700 flex items-center gap-1"
              >
                Almost there! Complete now
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Reward Badge */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex-shrink-0"
        >
          <div className="px-5 py-4 bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 rounded-2xl shadow-lg">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-5 h-5 text-white" />
              <span className="text-xl font-bold text-white">+{challenge.reward}</span>
            </div>
            <span className="text-xs font-medium text-amber-100">loyalty points</span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ============================================
// STREAK AT RISK BANNER - DESKTOP OPTIMIZED
// ============================================

interface StreakAtRiskBannerProps {
  onCheckIn?: () => void;
}

export function StreakAtRiskBanner({ onCheckIn }: StreakAtRiskBannerProps) {
  const habits = useHabits();

  if (habits.status.status !== 'at_risk') return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="hidden lg:block mx-4 lg:mx-auto lg:max-w-5xl my-4 p-6 rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 border border-amber-200/50 shadow-lg"
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg"
          >
            <span className="text-3xl">🔥</span>
          </motion.div>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h3 className="text-lg font-bold text-nilin-charcoal">
                {habits.currentStreak}-day streak at risk!
              </h3>
              <span className="px-3 py-1 bg-amber-100 text-amber-600 text-xs font-semibold rounded-full">
                {habits.status.daysUntilLoss} day{habits.status.daysUntilLoss !== 1 ? 's' : ''} left
              </span>
            </div>
            <p className="text-sm text-nilin-warmGray">
              {habits.status.protectionMessage || "Check in today to keep your streak alive!"}
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCheckIn}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-xl font-semibold shadow-lg flex items-center gap-2"
        >
          <span>Check In Now</span>
          <Flame className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// ============================================
// COMBINED ENGAGEMENT SECTION
// ============================================

interface EngagementBannersProps {
  onReengagementAction?: () => void;
  onChallengeAction?: () => void;
  onCheckIn?: () => void;
  onDismissReengagement?: () => void;
}

export function EngagementBanners({
  onReengagementAction,
  onChallengeAction,
  onCheckIn,
  onDismissReengagement,
}: EngagementBannersProps) {
  return (
    <div className="space-y-0">
      <ReEngagementBanner
        onAction={onReengagementAction}
        onDismiss={onDismissReengagement}
      />
      <StreakAtRiskBanner onCheckIn={onCheckIn} />
      <WeeklyChallengeBanner onChallengeClick={onChallengeAction} />
    </div>
  );
}

export default EngagementBanners;
