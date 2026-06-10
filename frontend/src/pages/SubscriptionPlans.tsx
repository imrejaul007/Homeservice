
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import Breadcrumb from '../components/common/Breadcrumb';
import { useAuthStore } from '../stores/authStore';
import {
  subscriptionApi,
  type SubscriptionPlan,
  type Subscription,
  type UsageStats,
  type Membership,
  type PlanType,
  type BillingCycle,
  type BillingHistoryItem,
  type PaymentMethod,
} from '../services/subscriptionApi';

// ============================================
// Plan Configuration
// ============================================

const PLANS: Record<string, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    currency: 'AED',
    features: [
      'Basic service browsing',
      'Book appointments',
      'View provider profiles',
      'Basic search filters',
      'Standard customer support',
    ],
    limits: {
      bookingsPerMonth: 2,
      maxAddresses: 1,
      maxPaymentMethods: 1,
    },
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: 29,
    currency: 'AED',
    features: [
      'Everything in Free',
      'Unlimited bookings',
      'Save favorite providers',
      'Receive booking reminders',
      'Email support',
      'View booking history',
    ],
    limits: {
      bookingsPerMonth: -1,
      maxAddresses: 3,
      maxPaymentMethods: 2,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    price: 79,
    currency: 'AED',
    features: [
      'Everything in Basic',
      'Featured listings priority',
      'Exclusive deals & discounts',
      'Priority customer support',
      'Early access to new features',
      'Save unlimited favorites',
      'Share experiences',
    ],
    limits: {
      bookingsPerMonth: -1,
      featuredListings: 3,
      commissionDiscount: 5,
      maxAddresses: 5,
      maxPaymentMethods: 5,
      prioritySupport: true,
      exclusiveOffers: true,
      earlyAccess: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: 199,
    currency: 'AED',
    features: [
      'Everything in Premium',
      'Dedicated account manager',
      'VIP concierge service',
      'Exclusive partner benefits',
      'Priority provider matching',
      'Custom notifications',
      'Advanced analytics',
    ],
    limits: {
      bookingsPerMonth: -1,
      featuredListings: -1,
      commissionDiscount: 10,
      prioritySupport: true,
      exclusiveOffers: true,
      earlyAccess: true,
    },
  },
};

const PLAN_ICONS: Record<PlanType, React.ReactNode> = {
  free: <Star className="w-6 h-6" />,
  basic: <TrendingUp className="w-6 h-6" />,
  premium: <Crown className="w-6 h-6" />,
  enterprise: <Award className="w-6 h-6" />,
};

const PLAN_COLORS: Record<PlanType, { bg: string; border: string; text: string; gradient: string }> = {
  free: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-600',
    gradient: 'from-gray-400 to-gray-500',
  },
  basic: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    gradient: 'from-blue-400 to-blue-600',
  },
  premium: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-600',
    gradient: 'from-purple-500 to-purple-700',
  },
  enterprise: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-600',
    gradient: 'from-amber-500 to-amber-700',
  },
};

// ============================================
// Component
// ============================================

const SubscriptionPlansPage: React.FC = () => {
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
  const [activeTab, setActiveTab] = useState<'plans' | 'membership' | 'billing'>('plans');
  const [billingHistory, setBillingHistory] = useState<BillingHistoryItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<PaymentMethod | null>(null);

  // Fetch data on mount
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { returnTo: '/subscriptions' } });
      return;
    }
    fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [subRes, usageRes, membershipRes, historyRes, paymentMethodsRes] = await Promise.allSettled([
        subscriptionApi.getSubscription(),
        subscriptionApi.getUsageStats(),
        subscriptionApi.getMembership(),
        subscriptionApi.getBillingHistory(),
        subscriptionApi.getPaymentMethods(),
      ]);

      if (subRes.status === 'fulfilled') {
        setCurrentSubscription(subRes.value.data);
      }

      if (usageRes.status === 'fulfilled') {
        setUsageStats(usageRes.value.data);
      }

      if (membershipRes.status === 'fulfilled') {
        setMembershipTier(membershipRes.value.data);
      }

      if (historyRes.status === 'fulfilled') {
        setBillingHistory(historyRes.value.data.subscriptions || []);
      }

      if (paymentMethodsRes.status === 'fulfilled') {
        setPaymentMethods(paymentMethodsRes.value.data.paymentMethods);
        setDefaultPaymentMethod(paymentMethodsRes.value.data.defaultMethod);
      }
    } catch (err) {
      // Don't show error for missing subscription (user might not have one)
      const error = err as { response?: { status?: number; data?: { message?: string } } };
      if (error.response?.status !== 404) {
        setError(error.response?.data?.message || 'Failed to load subscription data');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async (plan: PlanType) => {
    if (plan === 'free') {
      // Downgrade to free
      await handleChangePlan(plan);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // In a real implementation, this would redirect to Stripe checkout
      // or open a payment modal
      const response = await subscriptionApi.createSubscription({
        plan,
        billingCycle,
        trialDays: plan === 'basic' ? 7 : 0, // 7-day trial for basic plan
      });

      setCurrentSubscription(response.data);
      setSuccessMessage(`Successfully subscribed to ${PLANS[plan].name} plan!`);
      toast.success(response.data.message || `Successfully subscribed to ${PLANS[plan].name} plan!`);

      // Refresh usage stats
      const usageRes = await subscriptionApi.getUsageStats();
      setUsageStats(usageRes.data);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage = error.response?.data?.message || 'Failed to create subscription';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChangePlan = async (newPlan: PlanType) => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await subscriptionApi.changePlan(newPlan, {
        immediate: true,
        reason: 'User initiated change',
      });

      setCurrentSubscription(response.data);
      setSuccessMessage(`Successfully changed to ${PLANS[newPlan].name} plan!`);
      toast.success(response.data.message || `Successfully changed to ${PLANS[newPlan].name} plan!`);

      // Refresh usage stats
      const usageRes = await subscriptionApi.getUsageStats();
      setUsageStats(usageRes.data);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage = error.response?.data?.message || 'Failed to change plan';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

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
      toast.success(response.data.message || 'Your subscription will be cancelled at the end of the billing period.');

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage = error.response?.data?.message || 'Failed to cancel subscription';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReactivate = async () => {
    setIsProcessing(true);
    setError(null);

    try {
      const response = await subscriptionApi.reactivateSubscription();
      setCurrentSubscription(response.data);
      setSuccessMessage('Your subscription has been reactivated!');
      toast.success(response.data.message || 'Your subscription has been reactivated!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      const errorMessage = error.response?.data?.message || 'Failed to reactivate subscription';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate price with yearly discount
  const getPrice = (plan: PlanType): number => {
    const basePrice = PLANS[plan].price;
    if (billingCycle === 'yearly') {
      return Math.round(basePrice * 12 * 0.83); // ~17% discount
    }
    return basePrice;
  };

  // ============================================
  // Render Helpers
  // ============================================

  const renderPlanCard = (plan: PlanType, isCurrentPlan: boolean) => {
    const planData = PLANS[plan];
    const colors = PLAN_COLORS[plan];
    const icon = PLAN_ICONS[plan];
    const price = getPrice(plan);
    const isPopular = plan === 'premium';

    return (
      <div
        key={plan}
        className={`
          relative rounded-2xl border-2 p-6 transition-all duration-300
          ${colors.bg} ${colors.border}
          ${isCurrentPlan ? 'ring-2 ring-offset-2 ring-nilin-coral' : ''}
          ${isPopular ? 'transform scale-105 shadow-xl' : 'hover:shadow-lg'}
        `}
      >
        {/* Popular badge */}
        {isPopular && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-gradient-to-r from-purple-500 to-purple-700 text-white text-xs font-semibold px-4 py-1 rounded-full">
              Most Popular
            </span>
          </div>
        )}

        {/* Current plan badge */}
        {isCurrentPlan && (
          <div className="absolute top-4 right-4">
            <span className="bg-nilin-coral text-white text-xs font-semibold px-3 py-1 rounded-full">
              Current Plan
            </span>
          </div>
        )}

        {/* Plan header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r ${colors.gradient} text-white mb-4`}>
            {icon}
          </div>
          <h3 className="text-xl font-bold text-gray-900">{planData.name}</h3>
          <div className="mt-2">
            <span className="text-4xl font-bold text-gray-900">
              {price === 0 ? 'Free' : `AED ${price}`}
            </span>
            {price > 0 && (
              <span className="text-gray-500 ml-1">
                /{billingCycle === 'yearly' ? 'year' : 'month'}
              </span>
            )}
          </div>
          {billingCycle === 'yearly' && price > 0 && (
            <p className="text-sm text-green-600 mt-1">
              Save AED {(PLANS[plan].price * 12 - price).toFixed(0)} per year
            </p>
          )}
        </div>

        {/* Features list */}
        <ul className="space-y-3 mb-6">
          {planData.features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3">
              <Check className={`w-5 h-5 ${colors.text} flex-shrink-0 mt-0.5`} />
              <span className="text-sm text-gray-700">{feature}</span>
            </li>
          ))}
          {plan === 'free' && (
            <li className="flex items-start gap-3">
              <X className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-500">No premium features</span>
            </li>
          )}
        </ul>

        {/* Limits summary */}
        <div className="border-t border-gray-200 pt-4 mb-6">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Limits</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-600">
              <Calendar className="w-4 h-4 inline mr-1" />
              {planData.limits.bookingsPerMonth === -1 ? 'Unlimited' : planData.limits.bookingsPerMonth} bookings/mo
            </div>
            <div className="text-gray-600">
              <CreditCard className="w-4 h-4 inline mr-1" />
              {planData.limits.maxPaymentMethods || 1} payment methods
            </div>
            {planData.limits.featuredListings !== undefined && (
              <div className="text-gray-600">
                <Star className="w-4 h-4 inline mr-1" />
                {planData.limits.featuredListings === -1 ? 'Unlimited' : planData.limits.featuredListings} featured
              </div>
            )}
          </div>
        </div>

        {/* Action button */}
        <button
          onClick={() => handleSubscribe(plan)}
          disabled={isProcessing || isCurrentPlan}
          className={`
            w-full py-3 px-4 rounded-lg font-semibold transition-all duration-200
            ${isCurrentPlan
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : isPopular
                ? 'bg-gradient-to-r from-purple-500 to-purple-700 text-white hover:shadow-lg hover:scale-105'
                : `bg-gradient-to-r ${colors.gradient} text-white hover:shadow-lg hover:scale-105`
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : plan === 'free' ? (
            'Downgrade to Free'
          ) : (
            `Subscribe to ${planData.name}`
          )}
        </button>
      </div>
    );
  };

  const renderMembershipCard = () => {
    if (!membershipTier) {
      return (
        <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-6 text-white">
          <h3 className="text-lg font-bold mb-4">Premium Membership</h3>
          <p className="text-purple-100 mb-4">
            Upgrade your experience with exclusive benefits, cashback rewards, and priority access.
          </p>
          <button className="bg-white text-purple-700 font-semibold py-2 px-4 rounded-lg hover:bg-purple-50 transition-colors">
            Learn More
          </button>
        </div>
      );
    }

    const tierColors = {
      standard: 'from-gray-400 to-gray-500',
      silver: 'from-gray-300 to-gray-400',
      gold: 'from-yellow-400 to-amber-500',
      platinum: 'from-slate-600 to-slate-800',
      vip: 'from-purple-500 to-pink-500',
    };

    return (
      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold capitalize">{membershipTier.tier} Membership</h3>
            <p className="text-purple-100 text-sm">
              {membershipTier.status === 'active' ? 'Active' : membershipTier.status}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${tierColors[membershipTier.tier]} flex items-center justify-center`}>
            <Crown className="w-6 h-6" />
          </div>
        </div>

        {/* Benefits summary */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {membershipTier.benefits.cashbackPercentage > 0 && (
            <div className="bg-white/20 rounded-lg p-3">
              <Percent className="w-5 h-5 mb-1" />
              <p className="text-sm font-medium">{membershipTier.benefits.cashbackPercentage}% Cashback</p>
            </div>
          )}
          {membershipTier.benefits.prioritySupport && (
            <div className="bg-white/20 rounded-lg p-3">
              <Zap className="w-5 h-5 mb-1" />
              <p className="text-sm font-medium">Priority Support</p>
            </div>
          )}
          {membershipTier.benefits.bookingPriority && (
            <div className="bg-white/20 rounded-lg p-3">
              <Calendar className="w-5 h-5 mb-1" />
              <p className="text-sm font-medium">Priority Booking</p>
            </div>
          )}
          {membershipTier.benefits.exclusiveDiscounts && (
            <div className="bg-white/20 rounded-lg p-3">
              <Gift className="w-5 h-5 mb-1" />
              <p className="text-sm font-medium">Exclusive Discounts</p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="border-t border-white/20 pt-4">
          <div className="flex justify-between text-sm">
            <div>
              <p className="text-purple-200">Total Cashback Earned</p>
              <p className="text-xl font-bold">AED {membershipTier.totalCashbackEarned.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-purple-200">Total Savings</p>
              <p className="text-xl font-bold">AED {membershipTier.totalDiscountsReceived.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderUsageCard = () => {
    if (!usageStats) return null;

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Usage This Month</h3>

        <div className="space-y-4">
          {/* Bookings */}
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
                className={`h-full rounded-full transition-all duration-300 ${
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

          {/* Featured Listings */}
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
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${(usageStats.featuredListingsUsed / usageStats.featuredListingLimit) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
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

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {activeTab === 'plans' && 'Choose Your Plan'}
              {activeTab === 'membership' && 'Premium Membership'}
              {activeTab === 'billing' && 'Billing & History'}
            </h1>
            <p className="mt-2 text-gray-600">
              {activeTab === 'plans' && 'Select the plan that best fits your needs'}
              {activeTab === 'membership' && 'Unlock exclusive benefits and rewards'}
              {activeTab === 'billing' && 'Manage your subscription and view payment history'}
            </p>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500" />
              <span className="text-green-800">{successMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          {/* Current Subscription Status */}
          {currentSubscription && currentSubscription.cancelAtPeriodEnd && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="font-medium text-amber-800">Subscription scheduled for cancellation</p>
                    <p className="text-sm text-amber-600">
                      Your {PLANS[currentSubscription.plan]?.name} plan will end on{' '}
                      {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReactivate}
                  disabled={isProcessing}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                >
                  Reactivate
                </button>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('plans')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'plans'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Star className="w-4 h-4 inline mr-2" />
                Plans
              </button>
              <button
                onClick={() => setActiveTab('membership')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'membership'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Crown className="w-4 h-4 inline mr-2" />
                Membership
              </button>
              <button
                onClick={() => setActiveTab('billing')}
                className={`px-4 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'billing'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CreditCard className="w-4 h-4 inline mr-2" />
                Billing
              </button>
            </div>
          </div>

          {/* Plans Tab */}
          {activeTab === 'plans' && (
            <>
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
                {(['free', 'basic', 'premium', 'enterprise'] as PlanType[]).map((plan) =>
                  renderPlanCard(plan, currentSubscription?.plan === plan)
                )}
              </div>

              {/* Usage Card */}
              {renderUsageCard()}
            </>
          )}

          {/* Membership Tab */}
          {activeTab === 'membership' && (
            <div className="max-w-2xl mx-auto">
              {renderMembershipCard()}

              {/* Benefits Breakdown */}
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Membership Tiers</h3>
                <div className="space-y-4">
                  {[
                    { tier: 'standard', name: 'Standard', desc: 'Basic membership for all users', icon: Star },
                    { tier: 'silver', name: 'Silver', desc: '1% cashback + exclusive discounts', icon: Award },
                    { tier: 'gold', name: 'Gold', desc: '2% cashback + priority booking + early access', icon: Crown },
                    { tier: 'platinum', name: 'Platinum', desc: '3% cashback + exclusive providers + analytics', icon: Sparkles },
                    { tier: 'vip', name: 'VIP', desc: '5% cashback + concierge service + unlimited everything', icon: Gift },
                  ].map((item) => (
                    <div
                      key={item.tier}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4"
                    >
                      <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${
                        item.tier === 'standard' ? 'from-gray-400 to-gray-500' :
                        item.tier === 'silver' ? 'from-gray-300 to-gray-400' :
                        item.tier === 'gold' ? 'from-yellow-400 to-amber-500' :
                        item.tier === 'platinum' ? 'from-slate-600 to-slate-800' :
                        'from-purple-500 to-pink-500'
                      } flex items-center justify-center`}>
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{item.name}</h4>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                      {membershipTier?.tier === item.tier && (
                        <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Billing Tab */}
          {activeTab === 'billing' && (
            <div className="max-w-3xl mx-auto">
              {/* Current Plan Info */}
              {currentSubscription && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Current Subscription</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {PLANS[currentSubscription.plan]?.name} Plan
                      </p>
                      <p className="text-gray-500">
                        {currentSubscription.billingCycle === 'monthly' ? 'Billed monthly' : 'Billed yearly'} •{' '}
                        AED {currentSubscription.price}/{currentSubscription.billingCycle === 'monthly' ? 'mo' : 'yr'}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Next billing date: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        currentSubscription.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : currentSubscription.status === 'cancelled'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {currentSubscription.status}
                      </span>
                    </div>
                  </div>

                  {currentSubscription.plan !== 'free' && !currentSubscription.cancelAtPeriodEnd && (
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
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Method</h3>
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-4">
                    <CreditCard className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 mb-3">No payment method saved</p>
                    <button
                      onClick={() => navigate('/customer/payment-methods')}
                      className="text-nilin-coral hover:text-nilin-coral/80 text-sm font-medium"
                    >
                      Add Payment Method
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentMethods.map((method) => (
                      <div key={method.id} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-gray-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {method.brand
                                ? `${method.brand.charAt(0).toUpperCase() + method.brand.slice(1)} ending in ****${method.last4}`
                                : `Card ending in ****${method.last4}`}
                            </p>
                            {method.expMonth && method.expYear && (
                              <p className="text-sm text-gray-500">
                                Expires {String(method.expMonth).padStart(2, '0')}/{method.expYear}
                              </p>
                            )}
                            {method.isDefault && (
                              <span className="text-xs text-nilin-coral font-medium">Default</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/customer/payment-methods')}
                          className="text-nilin-coral hover:text-nilin-coral/80 text-sm font-medium"
                        >
                          Update
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Billing History */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Billing History</h3>
                {billingHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No billing history yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {billingHistory.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="font-medium text-gray-900">{item.description}</p>
                          <p className="text-sm text-gray-500">{new Date(item.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">AED {item.amount.toFixed(2)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            item.status === 'paid' ? 'bg-green-100 text-green-700' :
                            item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelSubscription}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isProcessing ? 'Processing...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default SubscriptionPlansPage;
