import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Gift,
  Award,
  TrendingUp,
  TrendingDown,
  Zap,
  Crown,
  Star,
  ChevronRight,
  Clock,
  CheckCircle,
  Coins,
  Target,
  Sparkles,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import { loyaltyApi, type LoyaltyStatus, type TierBenefits, type TierBenefitsResponse, type PointsHistoryEntry } from '../../services/loyaltyApi';
import { api } from '../../services/api';

const RewardsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [allTierBenefits, setAllTierBenefits] = useState<TierBenefitsResponse['data'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referrerReward, setReferrerReward] = useState(500);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pointsHistory, setPointsHistory] = useState<PointsHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState<{ amount: number; newBalance: number } | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const fetchData = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    try {
      const [statusRes, benefitsRes, referralRes, historyRes] = await Promise.all([
        loyaltyApi.getStatus(),
        loyaltyApi.getTierBenefits(),
        api.get('/referrals/my-code').catch(() => null),
        loyaltyApi.getHistory({ limit: 10 }).catch(() => null),
      ]);
      setLoyaltyStatus(statusRes.data);

      if (referralRes?.data?.data) {
        setReferrerReward(referralRes.data.data.referrerReward ?? 500);
        setReferralCode(referralRes.data.data.referralCode ?? referralRes.data.data.code ?? null);
      }

      setAllTierBenefits(benefitsRes.data);

      if (historyRes?.data?.history) {
        setPointsHistory(historyRes.data.history);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load rewards data';
      setError(message);
      if (refresh) toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/customer/rewards' } });
      return;
    }
    fetchData();
  }, [isAuthenticated, fetchData]);

  const handleCopyCode = () => {
    const code = referralCode || loyaltyStatus?.referralCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCodeCopied(false), 2000);
    }).catch(() => toast.error('Failed to copy code'));
  };

  const handleRedeem = async () => {
    if (redeemAmount < 100) {
      setRedeemError('Minimum redemption is 100 coins');
      return;
    }
    if (redeemAmount > (loyaltyStatus?.coins ?? 0)) {
      setRedeemError('Insufficient coins');
      return;
    }

    setIsRedeeming(true);
    setRedeemError(null);

    try {
      const result = await loyaltyApi.redeemPoints(redeemAmount);
      if (result.success) {
        const newBalance = result.newBalance ?? (loyaltyStatus?.coins ?? 0) - redeemAmount;
        setRedeemSuccess({ amount: redeemAmount, newBalance });
        setLoyaltyStatus(prev => prev ? { ...prev, coins: newBalance } : null);
        toast.success(`Successfully redeemed ${redeemAmount} coins!`);

        setTimeout(() => {
          setShowRedeemModal(false);
          setRedeemSuccess(null);
          setRedeemAmount(0);
        }, 2000);
      } else {
        setRedeemError(result.message || 'Failed to redeem coins');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to redeem coins';
      setRedeemError(message);
    } finally {
      setIsRedeeming(false);
    }
  };

  const openRedeemModal = () => {
    setRedeemAmount(0);
    setRedeemError(null);
    setRedeemSuccess(null);
    setShowRedeemModal(true);
  };

  const closeRedeemModal = () => {
    setShowRedeemModal(false);
    setRedeemAmount(0);
    setRedeemError(null);
    setRedeemSuccess(null);
  };

  // Helper to get relative time
  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // NILIN-adjacent tier colors (warm, not cold metallics)
  const tierColors = {
    bronze: {
      from: 'from-nilin-coral',
      to: 'to-nilin-rose',
      bg: 'bg-nilin-coral/20',
      text: 'text-nilin-coral',
      border: 'border-nilin-coral/30',
    },
    silver: {
      from: 'from-gray-400',
      to: 'to-gray-300',
      bg: 'bg-gray-200',
      text: 'text-gray-500',
      border: 'border-gray-300',
    },
    gold: {
      from: 'from-amber-400',
      to: 'to-yellow-400',
      bg: 'bg-amber-100',
      text: 'text-amber-600',
      border: 'border-amber-300',
    },
    platinum: {
      from: 'from-gray-600',
      to: 'to-gray-400',
      bg: 'bg-gray-200',
      text: 'text-gray-600',
      border: 'border-gray-400',
    },
  };

  const ALL_TIERS = ['bronze', 'silver', 'gold', 'platinum'] as const;
  const currentTier = loyaltyStatus?.tier || 'bronze';
  const colors = tierColors[currentTier];
  const tierIndex = ALL_TIERS.indexOf(currentTier as typeof ALL_TIERS[number]);
  const currentTierBenefits = allTierBenefits?.[currentTier as keyof typeof allTierBenefits] ?? null;

  // Skeleton shimmer bar
  const SkeletonBar = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 bg-[length:200%_100%] rounded ${className}`} />
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 space-y-8 animate-pulse">
          {/* Header skeleton */}
          <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-nilin-xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <SkeletonBar className="h-4 w-24 bg-white/20 mb-3" />
                <SkeletonBar className="h-8 w-32 bg-white/20" />
              </div>
              <SkeletonBar className="h-10 w-28 rounded-full bg-white/20" />
            </div>
            <SkeletonBar className="h-2.5 w-full mt-6 bg-white/20" />
          </div>

          {/* Quick Stats skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-nilin rounded-nilin-lg p-4 text-center">
                <SkeletonBar className="w-10 h-10 rounded-full mx-auto mb-2" />
                <SkeletonBar className="h-7 w-16 mx-auto mb-1" />
                <SkeletonBar className="h-3 w-20 mx-auto" />
              </div>
            ))}
          </div>

          {/* Tier Benefits + Progress skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="glass-nilin rounded-nilin-lg p-6">
                <div className="flex items-center gap-3 mb-5">
                  <SkeletonBar className="w-12 h-12 rounded-full" />
                  <div>
                    <SkeletonBar className="h-5 w-28 mb-2" />
                    <SkeletonBar className="h-3 w-20" />
                  </div>
                </div>
                <div className="space-y-3">
                  <SkeletonBar className="h-3 w-full" />
                  <SkeletonBar className="h-3 w-5/6" />
                  <SkeletonBar className="h-3 w-4/6" />
                </div>
              </div>
            ))}
          </div>
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
            <div className="mb-6 p-4 rounded-nilin-lg bg-nilin-error/10 border border-nilin-error/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-nilin-error flex-shrink-0" />
                <span className="text-nilin-charcoal">{error}</span>
              </div>
              <button
                onClick={() => fetchData(true)}
                disabled={isRefreshing}
                className="flex-shrink-0 p-1.5 hover:bg-nilin-error/10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-error/40"
                aria-label="Retry loading rewards"
              >
                <RefreshCw className={`w-4 h-4 text-nilin-error ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Empty State - if no loyalty data */}
          {!isLoading && !loyaltyStatus && !error && (
            <div className="glass-nilin-strong rounded-nilin-lg p-12 text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                <Gift className="w-10 h-10 text-nilin-coral" />
              </div>
              <h2 className="text-xl font-serif text-nilin-charcoal mb-2">Start earning rewards</h2>
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

          {loyaltyStatus && (
            <>
              {/* Header with Coins */}
              <div className={`bg-gradient-to-br ${colors.from} ${colors.to} rounded-nilin-xl p-6 md:p-8 mb-8 text-white shadow-nilin-warm`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Gift className="w-5 h-5 text-white/80" />
                      <span className="text-white/80 text-sm">Your Rewards</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Coins className="w-7 h-7" />
                      <span className="text-3xl md:text-4xl font-bold tabular-nums">{(loyaltyStatus.coins ?? 0).toLocaleString()}</span>
                      <span className="text-white/80">coins</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm`}>
                      <Crown className="w-5 h-5" />
                      <span className="font-medium capitalize">{currentTier}</span>
                    </div>
                    {loyaltyStatus.nextTier && (
                      <p className="text-sm text-white/80">
                        {Math.max(0, loyaltyStatus.pointsToNextTier ?? 0).toLocaleString()} pts to {loyaltyStatus.nextTier}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                {loyaltyStatus.nextTier && (
                  <div className="mt-5">
                    <div className="flex justify-between text-xs text-white/80 mb-1.5">
                      <span className="capitalize">{currentTier}</span>
                      <span className="capitalize">{loyaltyStatus.nextTier}</span>
                    </div>
                    <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, loyaltyStatus.progressToNext ?? 0))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Redeem Coins Banner */}
              <div className="bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-nilin-xl p-5 mb-6 text-white shadow-nilin-warm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                      <TrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif text-lg font-semibold">Redeem Coins</h3>
                      <p className="text-sm text-white/80">Convert your coins to AED credit</p>
                    </div>
                  </div>
                  <button
                    onClick={openRedeemModal}
                    disabled={(loyaltyStatus?.coins ?? 0) < 100}
                    className="px-6 py-3 bg-white text-nilin-coral font-semibold rounded-nilin-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    Redeem Now
                  </button>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="glass-nilin rounded-nilin-lg p-4 text-center hover:shadow-nilin-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-2">
                    <Coins className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <p className="text-2xl font-bold text-nilin-charcoal tabular-nums">{(loyaltyStatus.totalEarned ?? 0).toLocaleString()}</p>
                  <p className="text-xs text-nilin-warmGray">Total Earned</p>
                </div>
                <div className="glass-nilin rounded-nilin-lg p-4 text-center hover:shadow-nilin-sm transition-shadow">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${
                    (loyaltyStatus.streakDays ?? 0) > 0 ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    <TrendingUp className={`w-5 h-5 ${(loyaltyStatus.streakDays ?? 0) > 0 ? 'text-amber-600' : 'text-gray-400'}`} />
                  </div>
                  <p className="text-2xl font-bold text-nilin-charcoal tabular-nums">{loyaltyStatus.streakDays ?? 0}</p>
                  <p className="text-xs text-nilin-warmGray">Day Streak</p>
                  {(loyaltyStatus.streakDays ?? 0) === 0 && (
                    <p className="text-xs text-nilin-warning mt-1">Streak broken!</p>
                  )}
                </div>
                <div className="glass-nilin rounded-nilin-lg p-4 text-center hover:shadow-nilin-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-nilin-success/20 flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-5 h-5 text-nilin-success" />
                  </div>
                  <p className="text-2xl font-bold text-nilin-charcoal tabular-nums">{loyaltyStatus.totalSpent?.toLocaleString() ?? 0}</p>
                  <p className="text-xs text-nilin-warmGray">AED Redeemed</p>
                </div>
                <div className="glass-nilin rounded-nilin-lg p-4 text-center hover:shadow-nilin-sm transition-shadow">
                  <div className="w-10 h-10 rounded-full bg-nilin-rose/20 flex items-center justify-center mx-auto mb-2">
                    <Zap className="w-5 h-5 text-nilin-rose" />
                  </div>
                  <p className="text-2xl font-bold text-nilin-charcoal capitalize tabular-nums">{currentTierBenefits?.pointsMultiplier ?? 1}x</p>
                  <p className="text-xs text-nilin-warmGray">Earning Rate</p>
                </div>
              </div>

              {/* Tier Benefits + Tier Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Current Tier Benefits */}
                <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-sm transition-shadow">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${colors.from} ${colors.to} flex items-center justify-center`}>
                      <Award className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="font-serif text-xl text-nilin-charcoal capitalize">{currentTier} Benefits</h2>
                      <p className="text-sm text-nilin-warmGray">Your current tier perks</p>
                    </div>
                  </div>

                  {currentTierBenefits?.benefits && currentTierBenefits.benefits.length > 0 ? (
                    <div className="space-y-3">
                      {currentTierBenefits.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full ${colors.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <CheckCircle className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <span className="text-nilin-charcoal">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-nilin-warmGray">Keep earning to unlock your tier benefits!</p>
                  )}
                </div>

                {/* Tier Progress Overview */}
                <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-sm transition-shadow">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                      <Target className="w-6 h-6 text-nilin-coral" />
                    </div>
                    <div>
                      <h2 className="font-serif text-xl text-nilin-charcoal">Tier Progress</h2>
                      <p className="text-sm text-nilin-warmGray">Reach the next level</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {ALL_TIERS.map((tier, index) => {
                      const isActive = tier === currentTier;
                      const isCompleted = tierIndex > index;
                      const tierColor = tierColors[tier];
                      const tierReq = allTierBenefits?.[tier as keyof typeof allTierBenefits]?.minPoints;

                      return (
                        <div
                          key={tier}
                          className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-nilin-coral/10 border border-nilin-coral/20' : ''}`}
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isCompleted
                              ? `bg-gradient-to-br ${tierColor.from} ${tierColor.to}`
                              : isActive
                                ? `bg-gradient-to-br ${colors.from} ${colors.to}`
                                : 'bg-nilin-muted'
                          }`}>
                            {isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-white" />
                            ) : (
                              <span className="text-sm font-semibold text-white capitalize">{tier[0]}</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-nilin-charcoal capitalize">{tier}</span>
                              <span className="text-xs text-nilin-warmGray tabular-nums">
                                {tierReq ? `${tierReq.toLocaleString()}+ pts` : tier === 'bronze' ? '0 pts' : ''}
                              </span>
                            </div>
                            <p className="text-xs text-nilin-warmGray">
                              {isActive ? 'Your current tier' : isCompleted ? 'Unlocked' : 'Locked'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Referral Code + How to Earn */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Referral Code Card */}
                {(referralCode || loyaltyStatus.referralCode) && (
                  <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-sm transition-shadow">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                        <Gift className="w-5 h-5 text-nilin-coral" />
                      </div>
                      <div>
                        <h2 className="font-serif text-lg text-nilin-charcoal">Your Referral Code</h2>
                        <p className="text-xs text-nilin-warmGray">Share & earn {referrerReward.toLocaleString()} coins</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-4 py-3 bg-nilin-muted rounded-xl font-mono text-lg text-nilin-charcoal text-center tracking-widest">
                        {referralCode || loyaltyStatus.referralCode}
                      </code>
                      <button
                        onClick={handleCopyCode}
                        aria-label="Copy referral code"
                        className={`p-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 ${
                          codeCopied
                            ? 'bg-nilin-success text-white'
                            : 'bg-nilin-coral/20 text-nilin-coral hover:bg-nilin-coral/30'
                        }`}
                      >
                        {codeCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                    <button
                      onClick={() => navigate('/customer/profile?tab=referral')}
                      className="mt-3 text-xs text-nilin-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded px-1"
                    >
                      View referral stats →
                    </button>
                  </div>
                )}

                {/* How to Earn */}
                <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-sm transition-shadow">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-nilin-success/20 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-nilin-success" />
                    </div>
                    <div>
                      <h2 className="font-serif text-lg text-nilin-charcoal">How to Earn</h2>
                      <p className="text-xs text-nilin-warmGray">Start earning rewards today</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-nilin-coral/20 flex items-center justify-center flex-shrink-0">
                        <Star className="w-4 h-4 text-nilin-coral" />
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal text-sm">Book Services</p>
                        <p className="text-xs text-nilin-warmGray">Earn {(currentTierBenefits?.pointsMultiplier ?? 1)} coins per AED 10 spent</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-nilin-rose/20 flex items-center justify-center flex-shrink-0">
                        <Gift className="w-4 h-4 text-nilin-rose" />
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal text-sm">Refer Friends</p>
                        <p className="text-xs text-nilin-warmGray">Earn {referrerReward.toLocaleString()} coins per referral</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal text-sm">Maintain Streaks</p>
                        <p className="text-xs text-nilin-warmGray">Earn bonus coins for consecutive bookings</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Points History Section */}
              <div className="glass-nilin rounded-nilin-lg p-6 hover:shadow-nilin-sm transition-shadow mb-8">
                <button
                  onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                  className="w-full flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded-lg p-1 -m-1 hover:bg-nilin-muted/50 transition-colors"
                  aria-expanded={isHistoryExpanded}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div className="text-left">
                      <h2 className="font-serif text-lg text-nilin-charcoal">Recent Activity</h2>
                      <p className="text-xs text-nilin-warmGray">
                        {isHistoryLoading ? 'Loading history...' : `${pointsHistory.length} recent entries`}
                      </p>
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-nilin-warmGray transition-transform duration-200 ${
                      isHistoryExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isHistoryExpanded && (
                  <div className="mt-4 pt-4 border-t border-nilin-border">
                    {isHistoryLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
                        <span className="ml-2 text-sm text-nilin-warmGray">Loading history...</span>
                      </div>
                    ) : pointsHistory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-nilin-muted flex items-center justify-center mb-3">
                          <Clock className="w-6 h-6 text-nilin-warmGray" />
                        </div>
                        <p className="text-nilin-warmGray text-sm">No activity yet</p>
                        <p className="text-xs text-nilin-warmGray/70">Start booking services to earn coins</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {pointsHistory.map((entry, index) => {
                          const isPositive = entry.type !== 'spent';
                          const displayAmount = isPositive ? `+${entry.amount.toLocaleString()}` : `-${Math.abs(entry.amount).toLocaleString()}`;

                          let IconComponent = TrendingUp;
                          let iconBgClass = 'bg-nilin-coral/10';
                          let iconColorClass = 'text-nilin-coral';

                          if (entry.type === 'spent') {
                            IconComponent = TrendingDown;
                            iconBgClass = 'bg-nilin-error/10';
                            iconColorClass = 'text-nilin-error';
                          } else if (entry.type === 'bonus' || entry.type === 'referral') {
                            IconComponent = Gift;
                            iconBgClass = 'bg-nilin-success/10';
                            iconColorClass = 'text-nilin-success';
                          }

                          return (
                            <div key={index} className="flex items-center gap-3 p-3 rounded-xl hover:bg-nilin-muted/30 transition-colors">
                              <div className={`w-10 h-10 rounded-full ${iconBgClass} flex items-center justify-center flex-shrink-0`}>
                                <IconComponent className={`w-5 h-5 ${iconColorClass}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-nilin-charcoal font-medium truncate">{entry.description}</p>
                                <p className="text-xs text-nilin-warmGray">{getRelativeTime(entry.date)}</p>
                              </div>
                              <div className={`text-sm font-semibold tabular-nums ${
                                isPositive ? 'text-nilin-success' : 'text-nilin-error'
                              }`}>
                                {displayAmount}
                              </div>
                            </div>
                          );
                        })}

                        <button
                          onClick={() => navigate('/customer/profile?tab=rewards')}
                          className="w-full mt-4 py-2 text-sm text-nilin-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 rounded"
                        >
                          View all activity →
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleCopyCode}
                  className="btn-nilin flex items-center justify-center gap-2"
                >
                  <Gift className="w-5 h-5" />
                  {(referralCode || loyaltyStatus.referralCode) ? 'Share My Code' : 'Refer Friends'}
                </button>
                <button
                  onClick={() => navigate('/search')}
                  className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                >
                  <Star className="w-5 h-5" />
                  Book a Service
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />

      {/* Redeem Modal */}
      {showRedeemModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="redeem-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-nilin-lg">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 id="redeem-modal-title" className="font-serif text-xl text-nilin-charcoal">Redeem Coins</h2>
              <button
                onClick={closeRedeemModal}
                className="p-2 hover:bg-nilin-muted rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-nilin-warmGray" />
              </button>
            </div>

            {/* Current Balance */}
            <div className="bg-nilin-cream rounded-nilin-lg p-4 mb-6 text-center">
              <p className="text-sm text-nilin-warmGray mb-1">Your Balance</p>
              <p className="text-3xl font-bold text-nilin-charcoal tabular-nums">
                {(loyaltyStatus?.coins ?? 0).toLocaleString()} <span className="text-lg font-normal">coins</span>
              </p>
            </div>

            {/* Success State */}
            {redeemSuccess ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-nilin-success/20 flex items-center justify-center mx-auto mb-4">
                  <Check className="w-8 h-8 text-nilin-success" />
                </div>
                <p className="text-lg font-semibold text-nilin-success mb-2">Redemption Successful!</p>
                <p className="text-nilin-charcoal mb-4">
                  You redeemed <span className="font-bold tabular-nums">{redeemSuccess.amount.toLocaleString()}</span> coins
                </p>
                <p className="text-sm text-nilin-warmGray">
                  New balance: <span className="font-bold tabular-nums">{redeemSuccess.newBalance.toLocaleString()}</span> coins
                </p>
              </div>
            ) : (
              <>
                {/* Preset Amount Buttons */}
                <div className="mb-4">
                  <p className="text-sm text-nilin-warmGray mb-2">Select amount to redeem</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[100, 250, 500].map(amount => {
                      const isDisabled = amount > (loyaltyStatus?.coins ?? 0);
                      return (
                        <button
                          key={amount}
                          onClick={() => {
                            setRedeemAmount(amount);
                            setRedeemError(null);
                          }}
                          disabled={isDisabled}
                          className={`py-3 px-4 rounded-nilin-lg font-medium text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40 ${
                            redeemAmount === amount
                              ? 'bg-nilin-coral text-white'
                              : isDisabled
                                ? 'bg-nilin-muted text-nilin-warmGray cursor-not-allowed'
                                : 'bg-nilin-cream text-nilin-charcoal hover:bg-nilin-coral/10'
                          }`}
                        >
                          {amount.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Amount Display */}
                {redeemAmount > 0 && (
                  <div className="bg-nilin-success/10 rounded-nilin-lg p-4 mb-4 text-center">
                    <p className="text-sm text-nilin-warmGray mb-1">You will receive</p>
                    <p className="text-2xl font-bold text-nilin-success tabular-nums">
                      AED {(redeemAmount / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-nilin-warmGray mt-1">
                      ({redeemAmount.toLocaleString()} coins)
                    </p>
                  </div>
                )}

                {/* Minimum Note */}
                <p className="text-xs text-nilin-warmGray text-center mb-4">
                  Minimum redemption: 100 coins (AED 1.00)
                </p>

                {/* Error Message */}
                {redeemError && (
                  <div className="mb-4 p-3 bg-nilin-error/10 rounded-nilin-lg text-sm text-nilin-error">
                    {redeemError}
                  </div>
                )}

                {/* Confirm Button */}
                <button
                  onClick={handleRedeem}
                  disabled={redeemAmount < 100 || isRedeeming}
                  className="w-full btn-nilin flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRedeeming ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-5 h-5" />
                      Redeem {redeemAmount.toLocaleString()} Coins
                    </>
                  )}
                </button>

                {/* Cancel Button */}
                <button
                  onClick={closeRedeemModal}
                  className="w-full mt-2 px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/40"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardsPage;
