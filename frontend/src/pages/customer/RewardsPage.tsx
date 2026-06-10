import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Award,
  TrendingUp,
  Zap,
  Crown,
  Star,
  ChevronRight,
  Clock,
  CheckCircle,
  Coins,
  Target,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { loyaltyApi, type LoyaltyStatus, type TierBenefits } from '../../services/loyaltyApi';
import { api } from '../../services/api';

const RewardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [tierBenefits, setTierBenefits] = useState<TierBenefits | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referrerReward, setReferrerReward] = useState(500);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/rewards' } });
      return;
    }
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statusRes, benefitsRes, referralRes] = await Promise.all([
        loyaltyApi.getStatus(),
        loyaltyApi.getTierBenefits(),
        api.get('/referrals/my-code').catch(() => null),
      ]);
      setLoyaltyStatus(statusRes.data);

      if (referralRes?.data?.data?.referrerReward) {
        setReferrerReward(referralRes.data.data.referrerReward);
      }

      // Get current tier benefits
      const currentTier = statusRes.data.tier;
      setTierBenefits(benefitsRes.data[currentTier]);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load rewards data');
    } finally {
      setIsLoading(false);
    }
  };

  const tierColors = {
    bronze: { from: 'from-amber-700', to: 'to-amber-600', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
    silver: { from: 'from-gray-400', to: 'to-gray-300', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' },
    gold: { from: 'from-yellow-500', to: 'to-amber-400', bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300' },
    platinum: { from: 'from-slate-700', to: 'to-slate-500', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
  };

  const currentTier = loyaltyStatus?.tier || 'bronze';
  const colors = tierColors[currentTier];

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

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Empty State - if no loyalty data */}
          {!isLoading && !loyaltyStatus && !error && (
            <div className="glass-nilin rounded-nilin-lg p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-10 h-10 text-nilin-coral" />
              </div>
              <h3 className="text-xl font-serif text-nilin-charcoal mb-2">Start earning rewards</h3>
              <p className="text-nilin-warmGray mb-6 max-w-md mx-auto">
                Book your first service to start earning coins and unlock exclusive tier benefits.
              </p>
              <button
                onClick={() => navigate('/search')}
                className="btn-nilin"
              >
                Book a Service
              </button>
            </div>
          )}

          {/* Header with Coins */}
          <div className={`bg-gradient-to-br ${colors.from} ${colors.to} rounded-nilin-xl p-8 mb-8 text-white shadow-nilin-warm`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Gift className="w-6 h-6" />
                  <span className="text-white/80 text-sm">Your Rewards</span>
                </div>
                <div className="flex items-center gap-3">
                  <Coins className="w-8 h-8" />
                  <span className="text-4xl font-bold">{loyaltyStatus?.coins?.toLocaleString() || 0}</span>
                  <span className="text-white/80">coins</span>
                </div>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm`}>
                  <Crown className="w-5 h-5" />
                  <span className="font-medium capitalize">{currentTier}</span>
                </div>
                {loyaltyStatus?.nextTier && (
                  <p className="text-sm text-white/80 mt-2">
                    {loyaltyStatus.pointsToNextTier.toLocaleString()} points to {loyaltyStatus.nextTier}
                  </p>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {loyaltyStatus?.nextTier && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-white/80 mb-2">
                  <span>{currentTier}</span>
                  <span>{loyaltyStatus.nextTier}</span>
                </div>
                <div className="h-3 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${loyaltyStatus.progressToNext}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-nilin rounded-nilin-lg p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-2">
                <Coins className="w-5 h-5 text-nilin-coral" />
              </div>
              <p className="text-2xl font-bold text-nilin-charcoal">{loyaltyStatus?.totalEarned?.toLocaleString() || 0}</p>
              <p className="text-xs text-nilin-warmGray">Total Earned</p>
            </div>
            <div className="glass-nilin rounded-nilin-lg p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-nilin-charcoal">{loyaltyStatus?.streakDays || 0}</p>
              <p className="text-xs text-nilin-warmGray">Day Streak</p>
            </div>
            <div className="glass-nilin rounded-nilin-lg p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-nilin-charcoal">{loyaltyStatus?.totalSpent?.toLocaleString() || 0}</p>
              <p className="text-xs text-nilin-warmGray">Points Redeemed</p>
            </div>
            <div className="glass-nilin rounded-nilin-lg p-4 text-center">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-2">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-nilin-charcoal capitalize">{tierBenefits?.pointsMultiplier || 1}x</p>
              <p className="text-xs text-nilin-warmGray">Points Multiplier</p>
            </div>
          </div>

          {/* Tier Benefits */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Current Tier Benefits */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center`}>
                  <Award className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-nilin-charcoal capitalize">{currentTier} Benefits</h3>
                  <p className="text-sm text-nilin-warmGray">Your current tier perks</p>
                </div>
              </div>

              <div className="space-y-3">
                {tierBenefits?.benefits?.map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className={`w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <CheckCircle className={`w-4 h-4 ${colors.text}`} />
                    </div>
                    <span className="text-nilin-charcoal">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tier Tiers Overview */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                  <Target className="w-6 h-6 text-nilin-coral" />
                </div>
                <div>
                  <h3 className="font-serif text-xl text-nilin-charcoal">Tier Progress</h3>
                  <p className="text-sm text-nilin-warmGray">Reach the next level</p>
                </div>
              </div>

              <div className="space-y-4">
                {['bronze', 'silver', 'gold', 'platinum'].map((tier, index) => {
                  const isActive = tier === currentTier;
                  const isCompleted = ['bronze', 'silver', 'gold', 'platinum'].indexOf(currentTier) > index;
                  const tierColor = tierColors[tier as keyof typeof tierColors];

                  return (
                    <div
                      key={tier}
                      className={`flex items-center gap-4 p-3 rounded-nilin ${isActive ? 'bg-nilin-coral/10 border border-nilin-coral/30' : ''}`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCompleted
                          ? 'bg-gradient-to-br ' + tierColor.from + ' ' + tierColor.to
                          : 'bg-nilin-muted'
                      }`}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <span className="text-sm font-medium text-nilin-warmGray capitalize">{tier[0]}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-nilin-charcoal capitalize">{tier}</span>
                          <span className="text-sm text-nilin-warmGray">
                            {tier === 'bronze' ? '0' : tier === 'silver' ? '1,000' : tier === 'gold' ? '5,000' : '10,000'}+ pts
                          </span>
                        </div>
                        <p className="text-xs text-nilin-warmGray">
                          {tier === currentTier ? 'Your current tier' : isCompleted ? 'Unlocked' : 'Locked'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* How to Earn */}
          <div className="glass-nilin rounded-nilin-lg p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-serif text-xl text-nilin-charcoal">How to Earn Points</h3>
                <p className="text-sm text-nilin-warmGray">Start earning rewards today</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-nilin-muted rounded-nilin-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                    <Star className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <div>
                    <p className="font-medium text-nilin-charcoal">Book Services</p>
                    <p className="text-xs text-nilin-warmGray">Earn 1 point per AED 10</p>
                  </div>
                </div>
                <p className="text-sm text-nilin-warmGray">
                  Every booking you make earns you points. More expensive services = more points!
                </p>
              </div>

              <div className="bg-nilin-muted rounded-nilin-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-nilin-charcoal">Refer Friends</p>
                    <p className="text-xs text-nilin-warmGray">Get {referrerReward.toLocaleString()} coins per referral</p>
                  </div>
                </div>
                <p className="text-sm text-nilin-warmGray">
                  Share your code with friends. You both earn rewards when they complete their first booking!
                </p>
              </div>

              <div className="bg-nilin-muted rounded-nilin-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-nilin-charcoal">Special Bonuses</p>
                    <p className="text-xs text-nilin-warmGray">Earn bonus points</p>
                  </div>
                </div>
                <p className="text-sm text-nilin-warmGray">
                  Complete streaks, write reviews, and celebrate birthdays for bonus points!
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate('/customer/profile?tab=referral')}
              className="btn-nilin"
            >
              <Gift className="w-5 h-5 mr-2" />
              Refer Friends
            </button>
            <button
              onClick={() => navigate('/search')}
              className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center"
            >
              <Star className="w-5 h-5 mr-2" />
              Book a Service
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default RewardsPage;
