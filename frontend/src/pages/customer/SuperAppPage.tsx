// SuperAppPage - Customer engagement hub with streaks, achievements, and rewards
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Gift,
  Target,
  Zap,
  Crown,
  Star,
  TrendingUp,
  ChevronRight,
  Award,
  Flame,
  Wallet,
  Percent,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { showDeduplicatedError } from '../../utils/toastUtils';
import { superAppApi, StreakData, Achievement } from '../../services/superappApi';
import { loyaltyApi, LoyaltyStatus } from '../../services/loyaltyApi';
import { StreakWidget } from '../../components/superapp/AchievementBadges';
import { SmartQuickActions } from '../../components/superapp/SmartQuickActions';
import { SpendingInsights } from '../../components/superapp/SpendingInsights';
import { motion, AnimatePresence } from 'framer-motion';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action: string;
  context?: 'time' | 'location' | 'history';
}

interface SuperAppPageState {
  streak: StreakData | null;
  achievements: Achievement[];
  loyalty: LoyaltyStatus | null;
  transactions: Array<{ date: string; amount: number; category: string }>;
}

interface ApiError {
  message: string;
  code?: string;
}

const SuperAppPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<SuperAppPageState>({
    streak: null,
    achievements: [],
    loyalty: null,
    transactions: [],
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({
    streak: true,
    habits: true,
    loyalty: true,
  });
  const [errors, setErrors] = useState<Record<string, ApiError | null>>({
    streak: null,
    habits: null,
    loyalty: null,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch streak data
  const fetchStreak = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, streak: true }));
      setErrors(prev => ({ ...prev, streak: null }));
      const response = await superAppApi.getStreak();
      if (response.success && response.data) {
        setState(prev => ({ ...prev, streak: response.data }));
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosErr.response?.data?.message || axiosErr.message || 'Failed to fetch streak data';
      setErrors(prev => ({ ...prev, streak: { message: errorMessage } }));
      showDeduplicatedError('Failed to load streak', errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, streak: false }));
    }
  }, []);

  // Fetch habits/achievements
  const fetchHabits = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, habits: true }));
      setErrors(prev => ({ ...prev, habits: null }));
      const response = await superAppApi.getHabits();
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          achievements: response.data.achievements || [],
        }));
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosErr.response?.data?.message || axiosErr.message || 'Failed to fetch achievements';
      setErrors(prev => ({ ...prev, habits: { message: errorMessage } }));
      showDeduplicatedError('Failed to load achievements', errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, habits: false }));
    }
  }, []);

  // Fetch loyalty status
  const fetchLoyalty = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, loyalty: true }));
      setErrors(prev => ({ ...prev, loyalty: null }));
      const response = await loyaltyApi.getStatus();
      if (response.success && response.data) {
        setState(prev => ({ ...prev, loyalty: response.data }));
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = axiosErr.response?.data?.message || axiosErr.message || 'Failed to fetch loyalty status';
      setErrors(prev => ({ ...prev, loyalty: { message: errorMessage } }));
      showDeduplicatedError('Failed to load loyalty status', errorMessage);
    } finally {
      setLoading(prev => ({ ...prev, loyalty: false }));
    }
  }, []);

  // Fetch all data on mount
  useEffect(() => {
    fetchStreak();
    fetchHabits();
    fetchLoyalty();
  }, [fetchStreak, fetchHabits, fetchLoyalty]);

  // Refresh all data
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStreak(), fetchHabits(), fetchLoyalty()]);
    setIsRefreshing(false);
  }, [fetchStreak, fetchHabits, fetchLoyalty]);

  // Check-in handler
  const handleCheckIn = useCallback(async () => {
    try {
      const response = await superAppApi.checkIn();
      if (response.success && response.data) {
        await fetchStreak();
        await fetchLoyalty();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Check-in failed';
      showDeduplicatedError('Check-in failed', errorMessage);
    }
  }, [fetchStreak, fetchLoyalty]);

  // Quick action handler
  const handleQuickAction = useCallback((action: QuickAction) => {
    if (action.action.startsWith('service:')) {
      const service = action.action.replace('service:', '');
      navigate(`/search?service=${service}`);
    } else if (action.action.startsWith('bookings:')) {
      const type = action.action.replace('bookings:', '');
      navigate(`/customer/bookings?status=${type}`);
    } else if (action.action === 'search:nearby') {
      navigate('/search?nearby=true');
    }
  }, [navigate]);

  // Get time context for quick actions
  const getTimeContext = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  };

  // Derived values
  const currentStreak = state.streak?.currentStreak || 0;
  const longestStreak = state.streak?.longestStreak || 0;
  const totalCheckIns = state.streak?.totalCheckIns || 0;
  const points = state.loyalty?.coins || 0;
  const cashbackBalance = 0; // Could be fetched from another API
  const loyaltyTier = state.loyalty?.tier || 'bronze';
  const unlockedAchievements = state.achievements.filter(a => a.unlockedAt);
  const lockedAchievements = state.achievements.filter(a => !a.unlockedAt);

  // Quick actions config
  const quickActions: Array<{
    icon: typeof Gift;
    title: string;
    description: string;
    href: string;
  }> = [
    {
      icon: Gift,
      title: 'Rewards & Offers',
      description: 'View cashback and promotions',
      href: '/customer/rewards',
    },
    {
      icon: Target,
      title: 'My Claims',
      description: 'Track pending rewards',
      href: '/customer/my-claims',
    },
    {
      icon: Zap,
      title: 'Refer & Earn',
      description: 'Invite friends, earn rewards',
      href: '/customer/profile?tab=referral',
    },
  ];

  // Tier list
  const tiers = [
    { name: 'Bronze', icon: '🍊', pts: 0 },
    { name: 'Silver', icon: '🥈', pts: 500 },
    { name: 'Gold', icon: '🥇', pts: 2000 },
    { name: 'Platinum', icon: '💎', pts: 5000 },
  ];

  // Get current tier index
  const getCurrentTierIndex = (): number => {
    const tierNames = ['bronze', 'silver', 'gold', 'platinum'];
    return tierNames.indexOf(loyaltyTier);
  };

  const currentTierIndex = getCurrentTierIndex();
  const progressToNextTier = (): number => {
    const nextTier = tiers[currentTierIndex + 1];
    if (!nextTier) return 100;
    const currentTier = tiers[currentTierIndex];
    const progress = ((points - currentTier.pts) / (nextTier.pts - currentTier.pts)) * 100;
    return Math.min(Math.max(progress, 0), 100);
  };

  return (
    <div className="min-h-screen bg-nilin-cream">
      {/* Desktop Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">

        {/* Back Button and Refresh */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-nilin-charcoal hover:text-nilin-coral transition-colors group"
          >
            <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
              <ArrowLeft className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">Back</span>
          </button>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-full transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>

        {/* Header Badge */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-blush/40 rounded-full">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm font-medium text-nilin-charcoal">SuperApp</span>
          </div>
        </div>

        {/* Loading States */}
        <AnimatePresence mode="wait">
          {loading.streak && loading.habits && loading.loyalty ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
            >
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
                <p className="text-nilin-warmGray text-sm">Loading your progress...</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Error States */}
              {errors.streak && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{errors.streak.message}</p>
                </div>
              )}

              {/* Hero Streak Card - NILIN Brand */}
              <div className="relative bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-3xl p-6 lg:p-8 text-white mb-8 overflow-hidden">
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
                <div className="absolute bottom-0 left-1/4 w-16 h-16 bg-white/10 rounded-full translate-y-1/2" />

                <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-18 h-18 lg:w-20 lg:h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shadow-lg">
                      <span className="text-4xl lg:text-5xl">🔥</span>
                    </div>
                    <div>
                      <p className="text-white/70 text-xs font-semibold uppercase tracking-wider mb-1">Current Streak</p>
                      <p className="text-5xl lg:text-6xl font-bold leading-none">
                        {currentStreak}
                        <span className="text-xl font-normal text-white/80 ml-2">days</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="text-center px-5 py-3 bg-white/15 backdrop-blur-sm rounded-xl">
                      <p className="text-2xl font-bold">{longestStreak}</p>
                      <p className="text-xs text-white/70 uppercase tracking-wide">Best</p>
                    </div>
                    <div className="text-center px-5 py-3 bg-white/15 backdrop-blur-sm rounded-xl">
                      <p className="text-2xl font-bold">{totalCheckIns}</p>
                      <p className="text-xs text-white/70 uppercase tracking-wide">Check-ins</p>
                    </div>
                    <div className="text-center px-5 py-3 bg-white/15 backdrop-blur-sm rounded-xl">
                      <p className="text-2xl font-bold">{unlockedAchievements.length}</p>
                      <p className="text-xs text-white/70 uppercase tracking-wide">Badges</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid - NILIN Brand Colors */}
              <div className="grid grid-cols-3 gap-3 lg:gap-5">
                {/* Points Card */}
                <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow text-center">
                  <div className="w-10 h-10 rounded-xl bg-nilin-blush/50 flex items-center justify-center mx-auto mb-3">
                    <Star className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <p className="text-2xl lg:text-3xl font-bold text-nilin-charcoal">
                    {loading.loyalty ? '...' : points.toLocaleString()}
                  </p>
                  <p className="text-xs text-nilin-warmGray mt-1">Points</p>
                </div>

                {/* Cashback Card */}
                <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow text-center">
                  <div className="w-10 h-10 rounded-xl bg-nilin-blush/50 flex items-center justify-center mx-auto mb-3">
                    <Wallet className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <p className="text-2xl lg:text-3xl font-bold text-nilin-charcoal">
                    {loading.loyalty ? '...' : `₹${cashbackBalance.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-nilin-warmGray mt-1">Cashback</p>
                </div>

                {/* Tier Card */}
                <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow text-center">
                  <div className="w-10 h-10 rounded-xl bg-nilin-blush/50 flex items-center justify-center mx-auto mb-3">
                    <Crown className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <p className="text-2xl lg:text-3xl font-bold capitalize text-nilin-coral">
                    {loading.loyalty ? '...' : loyaltyTier}
                  </p>
                  <p className="text-xs text-nilin-warmGray mt-1">Tier</p>
                </div>
              </div>

              {/* Achievements Section */}
              <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-nilin-blush/40 flex items-center justify-center">
                      <Award className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-nilin-charcoal">Achievements</h2>
                      <p className="text-sm text-nilin-warmGray">
                        {loading.habits ? '...' : `${unlockedAchievements.length} unlocked`}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/customer/rewards"
                    className="flex items-center gap-1 text-sm font-medium text-nilin-coral hover:text-nilin-coral/80 transition-colors"
                  >
                    View All
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>

                {loading.habits ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                  </div>
                ) : errors.habits ? (
                  <div className="text-center py-4 text-nilin-warmGray text-sm">
                    Unable to load achievements
                  </div>
                ) : state.achievements.length > 0 ? (
                  <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {state.achievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className={cn(
                          'flex-shrink-0 flex flex-col items-center text-center w-20',
                          !achievement.unlockedAt && 'opacity-40'
                        )}
                      >
                        <div className={cn(
                          'w-14 h-14 rounded-2xl flex items-center justify-center mb-2 transition-transform hover:scale-105',
                          achievement.unlockedAt
                            ? 'bg-nilin-blush/50 shadow-sm'
                            : 'bg-gray-100'
                        )}>
                          <span className="text-2xl">{achievement.icon}</span>
                        </div>
                        <p className="text-xs font-medium text-nilin-charcoal">{achievement.title}</p>
                        {!achievement.unlockedAt && (
                          <p className="text-xs text-nilin-warmGray mt-0.5">
                            {achievement.progress}/{achievement.requirement}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-nilin-warmGray text-sm">
                    No achievements yet. Keep booking services to earn badges!
                  </div>
                )}
              </div>

              {/* Quick Actions - NILIN Brand */}
              <div>
                <h2 className="text-base font-bold text-nilin-charcoal mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-nilin-coral" />
                  Quick Actions
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {quickActions.map((action) => (
                    <Link
                      key={action.title}
                      to={action.href}
                      className="group flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all hover:scale-[1.02]"
                    >
                      <div className="w-12 h-12 rounded-xl bg-nilin-blush/40 flex items-center justify-center group-hover:bg-nilin-blush/60 transition-colors">
                        <action.icon className="w-6 h-6 text-nilin-coral" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-nilin-charcoal mb-0.5">{action.title}</p>
                        <p className="text-xs text-nilin-warmGray truncate">{action.description}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-nilin-warmGray group-hover:translate-x-1 group-hover:text-nilin-coral transition-all flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Smart Quick Actions Component */}
              <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm">
                <h2 className="text-base font-bold text-nilin-charcoal mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-nilin-coral" />
                  Quick Book
                </h2>
                <SmartQuickActions
                  onAction={handleQuickAction}
                  timeContext={getTimeContext()}
                />
              </div>

              {/* Loyalty Progress - NILIN Brand */}
              <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm">
                <h2 className="text-base font-bold text-nilin-charcoal mb-5 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-nilin-coral" />
                  Loyalty Progress
                </h2>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-nilin-charcoal">
                      {loading.loyalty ? '...' : `Current: ${points.toLocaleString()} pts`}
                    </span>
                    <span className="text-xs text-nilin-warmGray">
                      {currentTierIndex < 3 ? `Next tier: ${tiers[currentTierIndex + 1].pts} pts` : 'Max tier reached!'}
                    </span>
                  </div>
                  <div className="h-3 bg-nilin-blush/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full transition-all"
                      style={{ width: `${loading.loyalty ? 0 : progressToNextTier()}%` }}
                    />
                  </div>
                </div>

                {/* Tier List */}
                <div className="space-y-3">
                  {tiers.map((tier, index) => {
                    const isCurrentTier = index === currentTierIndex;
                    const isUnlocked = index <= currentTierIndex;

                    return (
                      <div key={tier.name} className="flex items-center gap-4">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          isUnlocked ? 'bg-nilin-blush/50' : 'bg-gray-100'
                        )}>
                          <span className="text-lg">{tier.icon}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className={cn(
                              'text-sm font-semibold',
                              isCurrentTier ? 'text-nilin-coral' : 'text-nilin-charcoal'
                            )}>
                              {tier.name}
                            </span>
                            <span className="text-xs text-nilin-warmGray">{tier.pts} pts</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                isUnlocked ? 'bg-nilin-coral' : 'bg-gray-200'
                              )}
                              style={{ width: isUnlocked ? '100%' : '0%' }}
                            />
                          </div>
                        </div>
                        {isCurrentTier && (
                          <span className="text-xs font-medium text-nilin-coral bg-nilin-blush/30 px-2 py-1 rounded-full">
                            Current
                          </span>
                        )}
                        {!isUnlocked && (
                          <span className="text-xs text-nilin-warmGray">
                            {tier.pts - points} more
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Spending Insights */}
              <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm">
                <h2 className="text-base font-bold text-nilin-charcoal mb-4 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-nilin-coral" />
                  Spending Insights
                </h2>
                <SpendingInsights transactions={state.transactions} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer spacing for mobile nav */}
        <div className="h-20" />
      </div>
    </div>
  );
};

export default SuperAppPage;
