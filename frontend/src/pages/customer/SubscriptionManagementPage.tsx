import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Crown,
  Check,
  X,
  Star,
  Zap,
  Shield,
  Gift,
  Clock,
  CreditCard,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Sparkles,
  Award,
  Briefcase,
  Users,
  Calendar,
  Percent,
  BarChart3,
  Download,
  RefreshCw,
  ExternalLink,
  Lock,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import {
  subscriptionApi,
  type Subscription,
  type UsageStats,
  type Membership,
  type PlanType,
  type BillingCycle,
  type MembershipTier,
} from '../../services/subscriptionApi';

// ============================================
// Plan Configuration
// ============================================

const PLANS: Record<PlanType, { name: string; price: number; features: string[] }> = {
  free: {
    name: 'Free',
    price: 0,
    features: ['Basic service browsing', 'Book appointments', 'View provider profiles'],
  },
  basic: {
    name: 'Basic',
    price: 29,
    features: ['Everything in Free', 'Unlimited bookings', 'Save favorite providers', 'Email support'],
  },
  premium: {
    name: 'Premium',
    price: 79,
    features: ['Everything in Basic', 'Featured listings priority', 'Exclusive deals', 'Priority support'],
  },
  enterprise: {
    name: 'Enterprise',
    price: 199,
    features: ['Everything in Premium', 'Dedicated account manager', 'VIP concierge', 'Custom integrations'],
  },
};

const PLAN_COLORS: Record<PlanType, string> = {
  free: 'from-gray-400 to-gray-500',
  basic: 'from-blue-400 to-blue-600',
  premium: 'from-purple-500 to-purple-700',
  enterprise: 'from-amber-500 to-amber-700',
};

const MEMBERSHIP_TIERS: { tier: MembershipTier; name: string; icon: any; color: string; benefits: string[] }[] = [
  {
    tier: 'standard',
    name: 'Standard',
    icon: Star,
    color: 'from-gray-400 to-gray-500',
    benefits: ['Basic membership for all users', 'Access to platform features'],
  },
  {
    tier: 'silver',
    name: 'Silver',
    icon: Award,
    color: 'from-gray-300 to-gray-400',
    benefits: ['1% cashback on bookings', 'Exclusive discounts'],
  },
  {
    tier: 'gold',
    name: 'Gold',
    icon: Crown,
    color: 'from-yellow-400 to-amber-500',
    benefits: ['2% cashback', 'Priority booking', 'Early access to features'],
  },
  {
    tier: 'platinum',
    name: 'Platinum',
    icon: Sparkles,
    color: 'from-slate-600 to-slate-800',
    benefits: ['3% cashback', 'Exclusive providers', 'Advanced analytics'],
  },
  {
    tier: 'vip',
    name: 'VIP',
    icon: Gift,
    color: 'from-purple-500 to-pink-500',
    benefits: ['5% cashback', 'Concierge service', 'Unlimited everything'],
  },
];

// ============================================
// Component
// ============================================

const SubscriptionManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  // State
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [membershipTier, setMembershipTier] = useState<Membership | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'plans' | 'membership' | 'billing'>('overview');

  // Auth check
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/subscriptions/manage' } });
      return;
    }
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [subRes, usageRes, membershipRes] = await Promise.allSettled([
        subscriptionApi.getSubscription(),
        subscriptionApi.getUsageStats(),
        subscriptionApi.getMembership(),
      ]);

      if (subRes.status === 'fulfilled' && subRes.value.data) {
        setCurrentSubscription(subRes.value.data);
      }

      if (usageRes.status === 'fulfilled' && usageRes.value.data) {
        setUsageStats(usageRes.value.data);
      }

      if (membershipRes.status === 'fulfilled' && membershipRes.value.data) {
        setMembershipTier(membershipRes.value.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch subscription data:', err);
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Failed to load subscription data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle plan change
  const handleChangePlan = async (newPlan: PlanType) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await subscriptionApi.changePlan(newPlan, {
        billingCycle,
        immediate: true,
        reason: 'User initiated change',
      });

      setCurrentSubscription(response.data);
      setSuccessMessage(`Successfully changed to ${PLANS[newPlan].name} plan!`);

      // Refresh usage stats
      const usageRes = await subscriptionApi.getUsageStats();
      setUsageStats(usageRes.data);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change plan');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle cancel
  const handleCancelSubscription = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await subscriptionApi.cancelSubscription({
        immediate: false,
        reason: cancelReason,
      });

      setCurrentSubscription(response.data);
      setShowCancelModal(false);
      setCancelReason('');
      setSuccessMessage('Your subscription will be cancelled at the end of the billing period.');

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle reactivate
  const handleReactivate = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await subscriptionApi.reactivateSubscription();
      setCurrentSubscription(response.data);
      setSuccessMessage('Your subscription has been reactivated!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to reactivate subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate price with yearly discount
  const getPrice = (plan: PlanType): number => {
    const basePrice = PLANS[plan].price;
    if (billingCycle === 'yearly') {
      return Math.round(basePrice * 12 * 0.83);
    }
    return basePrice;
  };

  // ============================================
  // Render
  // ============================================

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-nilin-coral animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  const currentPlan = currentSubscription?.plan || 'free';

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Subscription</h1>
              <p className="mt-1 text-gray-600">Manage your subscription and membership benefits</p>
            </div>
            <button
              onClick={fetchData}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-green-800">{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              {[
                { key: 'overview', label: 'Overview', icon: BarChart3 },
                { key: 'plans', label: 'Plans', icon: Star },
                { key: 'membership', label: 'Membership', icon: Crown },
                { key: 'billing', label: 'Billing', icon: CreditCard },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                    activeTab === tab.key
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Plan Card */}
              <div className={`bg-gradient-to-r ${PLAN_COLORS[currentPlan]} rounded-2xl p-6 text-white`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white/80 text-sm">Current Plan</p>
                    <h2 className="text-2xl font-bold">{PLANS[currentPlan]?.name}</h2>
                    <p className="text-white/80 mt-1">
                      {currentSubscription?.status === 'active' ? 'Active' : currentSubscription?.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold">
                      {PLANS[currentPlan]?.price === 0 ? 'Free' : `AED ${currentSubscription?.price || PLANS[currentPlan]?.price}`}
                    </p>
                    {PLANS[currentPlan]?.price > 0 && (
                      <p className="text-white/80 text-sm">per month</p>
                    )}
                  </div>
                </div>

                {currentSubscription && currentSubscription.cancelAtPeriodEnd && (
                  <div className="mt-4 p-3 bg-white/20 rounded-lg flex items-center gap-3">
                    <Clock className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Cancelling soon</p>
                      <p className="text-sm text-white/80">
                        Ends on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={handleReactivate}
                      disabled={isProcessing}
                      className="ml-auto px-4 py-1 bg-white text-gray-900 rounded-lg text-sm font-medium hover:bg-white/90"
                    >
                      Reactivate
                    </button>
                  </div>
                )}
              </div>

              {/* Usage Card */}
              {usageStats && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage This Month</h3>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Bookings</span>
                        <span className="font-medium text-gray-900">
                          {usageStats.bookingsThisMonth}
                          {usageStats.bookingLimit !== -1 && ` / ${usageStats.bookingLimit}`}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usageStats.isUnderLimit ? 'bg-green-500' : 'bg-red-500'
                          }`}
                          style={{
                            width: usageStats.bookingLimit === -1
                              ? '100%'
                              : `${Math.min(100, (usageStats.bookingsThisMonth / usageStats.bookingLimit) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {usageStats.featuredListingLimit > 0 && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Featured Listings</span>
                          <span className="font-medium text-gray-900">
                            {usageStats.featuredListingsUsed} / {usageStats.featuredListingLimit}
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{
                              width: `${(usageStats.featuredListingsUsed / usageStats.featuredListingLimit) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Membership Card */}
              {membershipTier && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Membership</h3>
                    <span className={`px-3 py-1 bg-gradient-to-r ${
                      MEMBERSHIP_TIERS.find(t => t.tier === membershipTier.tier)?.color
                    } text-white rounded-full text-sm font-medium capitalize`}>
                      {membershipTier.tier}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {membershipTier.benefits.cashbackPercentage > 0 && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <Percent className="w-6 h-6 text-green-500 mx-auto mb-1" />
                        <p className="text-2xl font-bold text-gray-900">{membershipTier.benefits.cashbackPercentage}%</p>
                        <p className="text-xs text-gray-500">Cashback</p>
                      </div>
                    )}
                    {membershipTier.benefits.prioritySupport && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <Zap className="w-6 h-6 text-yellow-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-900">Priority</p>
                        <p className="text-xs text-gray-500">Support</p>
                      </div>
                    )}
                    {membershipTier.benefits.bookingPriority && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <Calendar className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-900">Priority</p>
                        <p className="text-xs text-gray-500">Booking</p>
                      </div>
                    )}
                    {membershipTier.benefits.exclusiveDiscounts && (
                      <div className="text-center p-3 bg-gray-50 rounded-lg">
                        <Gift className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                        <p className="text-sm font-bold text-gray-900">Exclusive</p>
                        <p className="text-xs text-gray-500">Discounts</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Plans Tab */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              {/* Billing Cycle Toggle */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      billingCycle === 'monthly'
                        ? 'bg-white text-gray-900 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      billingCycle === 'yearly'
                        ? 'bg-white text-gray-900 shadow'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Yearly
                    <span className="ml-2 text-xs text-green-600 font-semibold">Save 17%</span>
                  </button>
                </div>
              </div>

              {/* Plan Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(['free', 'basic', 'premium', 'enterprise'] as PlanType[]).map((plan) => {
                  const isCurrentPlan = currentPlan === plan;
                  const price = getPrice(plan);

                  return (
                    <div
                      key={plan}
                      className={`relative rounded-2xl border-2 p-6 transition-all ${
                        isCurrentPlan ? 'border-nilin-coral ring-2 ring-nilin-coral ring-offset-2' : 'border-gray-200'
                      } ${plan === 'premium' ? 'transform scale-105 shadow-xl' : ''}`}
                    >
                      {plan === 'premium' && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xs font-semibold px-4 py-1 rounded-full">
                            Most Popular
                          </span>
                        </div>
                      )}

                      {isCurrentPlan && (
                        <div className="absolute top-4 right-4">
                          <span className="bg-nilin-coral text-white text-xs font-semibold px-3 py-1 rounded-full">
                            Current
                          </span>
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">{PLANS[plan].name}</h3>
                        <div className="mt-2">
                          <span className="text-3xl font-bold text-gray-900">
                            {price === 0 ? 'Free' : `AED ${price}`}
                          </span>
                          {price > 0 && (
                            <span className="text-gray-500 text-sm">/{billingCycle === 'yearly' ? 'year' : 'month'}</span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-2 mb-6">
                        {PLANS[plan].features.map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-600">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleChangePlan(plan)}
                        disabled={isProcessing || isCurrentPlan}
                        className={`w-full py-3 rounded-lg font-semibold transition-all ${
                          isCurrentPlan
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : plan === 'premium'
                              ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white hover:shadow-lg'
                              : 'bg-nilin-coral text-white hover:shadow-lg'
                        }`}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                        ) : isCurrentPlan ? (
                          'Current Plan'
                        ) : (
                          `Switch to ${PLANS[plan].name}`
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Membership Tab */}
          {activeTab === 'membership' && (
            <div className="space-y-6">
              {/* Current Membership Card */}
              {membershipTier && (
                <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-6 text-white">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-purple-100 text-sm">Your Membership</p>
                      <h2 className="text-2xl font-bold capitalize">{membershipTier.tier}</h2>
                    </div>
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${
                      MEMBERSHIP_TIERS.find(t => t.tier === membershipTier.tier)?.color
                    } flex items-center justify-center`}>
                      {React.createElement(
                        MEMBERSHIP_TIERS.find(t => t.tier === membershipTier.tier)?.icon || Star,
                        { className: 'w-8 h-8 text-white' }
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-white/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold">AED {membershipTier.totalCashbackEarned.toFixed(0)}</p>
                      <p className="text-xs text-white/80">Cashback Earned</p>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold">AED {membershipTier.totalDiscountsReceived.toFixed(0)}</p>
                      <p className="text-xs text-white/80">Total Savings</p>
                    </div>
                    <div className="bg-white/20 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold">{membershipTier.metrics?.totalBookings || 0}</p>
                      <p className="text-xs text-white/80">Total Bookings</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Membership Tiers */}
              <h3 className="text-lg font-semibold text-gray-900">Membership Tiers</h3>
              <div className="space-y-4">
                {MEMBERSHIP_TIERS.map((tier) => {
                  const isCurrent = membershipTier?.tier === tier.tier;
                  const isUnlocked = membershipTier && (
                    MEMBERSHIP_TIERS.findIndex(t => t.tier === membershipTier.tier) >=
                    MEMBERSHIP_TIERS.findIndex(t => t.tier === tier.tier)
                  );

                  return (
                    <div
                      key={tier.tier}
                      className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${
                        isCurrent ? 'border-nilin-coral ring-2 ring-nilin-coral/20' : 'border-gray-200'
                      }`}
                    >
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${tier.color} flex items-center justify-center`}>
                        {React.createElement(tier.icon, { className: 'w-6 h-6 text-white' })}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900">{tier.name}</h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral text-xs rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">{tier.benefits[0]}</p>
                      </div>
                      <div className="text-right">
                        {isUnlocked ? (
                          <Check className="w-6 h-6 text-green-500" />
                        ) : (
                          <Lock className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Current Plan Info */}
              {currentSubscription && currentSubscription.plan !== 'free' && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {PLANS[currentSubscription.plan]?.name} Plan
                      </p>
                      <p className="text-gray-500">
                        {currentSubscription.billingCycle === 'monthly' ? 'Billed monthly' : 'Billed yearly'} - AED {currentSubscription.price}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {currentSubscription.cancelAtPeriodEnd ? (
                          <span className="text-red-500">Cancels on {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}</span>
                        ) : (
                          <>Next billing date: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        currentSubscription.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {currentSubscription.status}
                      </span>
                    </div>
                  </div>

                  {!currentSubscription.cancelAtPeriodEnd && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <button
                        onClick={() => setShowCancelModal(true)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Cancel Subscription
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Method */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Credit Card</p>
                      <p className="text-sm text-gray-500">Manage your payment methods</p>
                    </div>
                  </div>
                  <button className="text-nilin-coral hover:text-nilin-coral/80 text-sm font-medium">
                    Update
                  </button>
                </div>
              </div>

              {/* Download Invoice */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h3>
                <div className="text-center py-8 text-gray-500">
                  <Download className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No invoices available yet</p>
                  <p className="text-sm mt-1">Invoices will appear here after your first payment</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Cancel Subscription</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel? You'll lose access to premium features at the end of your billing period.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for cancellation (optional)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nilin-coral focus:border-transparent resize-none"
                rows={3}
                placeholder="Let us know how we can improve..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default SubscriptionManagementPage;
