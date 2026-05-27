
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, Gift, Target, Zap, Crown, Star, TrendingUp, ChevronRight, Award, Flame, Wallet, Percent, ArrowLeft } from 'lucide-react';
import { useHabitStore, useHabits } from '../../services/superapp/HabitEngine';
import { useRewardsStore } from '../../services/superapp/RewardsEngine';
import { cn } from '../../lib/utils';

const SuperAppPage: React.FC = () => {
  const navigate = useNavigate();
  const habitStore = useHabitStore();
  const rewardsStore = useRewardsStore();
  const habits = useHabits();

  // Achievements data
  const achievements = [
    { id: '1', icon: '🍓', title: 'First Steps', unlocked: true },
    { id: '2', icon: '⭐', title: 'Regular', unlocked: true },
    { id: '3', icon: '💎', title: 'Loyal', unlocked: true },
    { id: '4', icon: '👑', title: 'VIP', unlocked: false },
    { id: '5', icon: '🏆', title: 'Legendary', unlocked: false },
    { id: '6', icon: '💫', title: 'Super', unlocked: false },
  ];

  const quickActions = [
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

  return (
    <div className="min-h-screen bg-nilin-cream">
      {/* Desktop Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-nilin-charcoal hover:text-nilin-coral transition-colors mb-4 group"
        >
          <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:shadow-md transition-shadow">
            <ArrowLeft className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header Badge */}
        <div className="flex items-center justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-blush/40 rounded-full">
            <Sparkles className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm font-medium text-nilin-charcoal">SuperApp</span>
          </div>
        </div>

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
                  {habits.currentStreak}
                  <span className="text-xl font-normal text-white/80 ml-2">days</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="text-center px-5 py-3 bg-white/15 backdrop-blur-sm rounded-xl">
                <p className="text-2xl font-bold">{habits.longestStreak}</p>
                <p className="text-xs text-white/70 uppercase tracking-wide">Best</p>
              </div>
              <div className="text-center px-5 py-3 bg-white/15 backdrop-blur-sm rounded-xl">
                <p className="text-2xl font-bold">{habits.achievements.length}</p>
                <p className="text-xs text-white/70 uppercase tracking-wide">Badges</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid - NILIN Brand Colors */}
        <div className="grid grid-cols-3 gap-3 lg:gap-5 mb-8">
          {/* Points Card */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow text-center">
            <div className="w-10 h-10 rounded-xl bg-nilin-blush/50 flex items-center justify-center mx-auto mb-3">
              <Star className="w-5 h-5 text-nilin-coral" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-nilin-charcoal">{rewardsStore.points}</p>
            <p className="text-xs text-nilin-warmGray mt-1">Points</p>
          </div>

          {/* Cashback Card */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow text-center">
            <div className="w-10 h-10 rounded-xl bg-nilin-blush/50 flex items-center justify-center mx-auto mb-3">
              <Wallet className="w-5 h-5 text-nilin-coral" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold text-nilin-charcoal">₹{rewardsStore.cashbackBalance}</p>
            <p className="text-xs text-nilin-warmGray mt-1">Cashback</p>
          </div>

          {/* Tier Card */}
          <div className="bg-white rounded-2xl p-4 lg:p-5 shadow-sm hover:shadow-md transition-shadow text-center">
            <div className="w-10 h-10 rounded-xl bg-nilin-blush/50 flex items-center justify-center mx-auto mb-3">
              <Crown className="w-5 h-5 text-nilin-coral" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold capitalize text-nilin-coral">{rewardsStore.loyaltyTier}</p>
            <p className="text-xs text-nilin-warmGray mt-1">Tier</p>
          </div>
        </div>

        {/* Achievements Section */}
        <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-nilin-blush/40 flex items-center justify-center">
                <Award className="w-5 h-5 text-nilin-coral" />
              </div>
              <div>
                <h2 className="text-base font-bold text-nilin-charcoal">Achievements</h2>
                <p className="text-sm text-nilin-warmGray">{habits.achievements.length} unlocked</p>
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

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center text-center w-20',
                  !achievement.unlocked && 'opacity-40'
                )}
              >
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center mb-2 transition-transform hover:scale-105',
                  achievement.unlocked
                    ? 'bg-nilin-blush/50 shadow-sm'
                    : 'bg-gray-100'
                )}>
                  <span className="text-2xl">{achievement.icon}</span>
                </div>
                <p className="text-xs font-medium text-nilin-charcoal">{achievement.title}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions - NILIN Brand */}
        <div className="mb-8">
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

        {/* Loyalty Progress - NILIN Brand */}
        <div className="bg-white rounded-2xl p-5 lg:p-6 shadow-sm mb-8">
          <h2 className="text-base font-bold text-nilin-charcoal mb-5 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-nilin-coral" />
            Loyalty Progress
          </h2>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-nilin-charcoal">Current: {rewardsStore.points} pts</span>
              <span className="text-xs text-nilin-warmGray">Next tier: 500 pts</span>
            </div>
            <div className="h-3 bg-nilin-blush/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full transition-all"
                style={{ width: `${Math.min((rewardsStore.points / 500) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* Tier List */}
          <div className="space-y-3">
            {[
              { name: 'Bronze', icon: '🍊', current: true, pts: 0 },
              { name: 'Silver', icon: '🥈', current: false, pts: 500 },
              { name: 'Gold', icon: '🥇', current: false, pts: 2000 },
              { name: 'Platinum', icon: '💎', current: false, pts: 5000 },
            ].map((tier, index) => (
              <div key={tier.name} className="flex items-center gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center',
                  tier.current ? 'bg-nilin-blush/50' : 'bg-gray-100'
                )}>
                  <span className="text-lg">{tier.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn(
                      'text-sm font-semibold',
                      tier.current ? 'text-nilin-coral' : 'text-nilin-charcoal'
                    )}>
                      {tier.name}
                    </span>
                    <span className="text-xs text-nilin-warmGray">{tier.pts} pts</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        tier.current ? 'bg-nilin-coral' : 'bg-gray-200'
                      )}
                      style={{ width: tier.current ? '100%' : '0%' }}
                    />
                  </div>
                </div>
                {tier.current && (
                  <span className="text-xs font-medium text-nilin-coral bg-nilin-blush/30 px-2 py-1 rounded-full">
                    Current
                  </span>
                )}
                {!tier.current && (
                  <span className="text-xs text-nilin-warmGray">
                    {tier.pts - rewardsStore.points} more
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer spacing for mobile nav */}
        <div className="h-20" />
      </div>
    </div>
  );
};

export default SuperAppPage;
