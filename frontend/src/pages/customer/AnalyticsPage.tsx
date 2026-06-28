import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp, Calendar, Star, BarChart3, Clock, Loader2,
  AlertCircle, DollarSign, RefreshCw, Search, Heart,
  Award, ChevronRight, Sparkles, Zap, Target, Trophy, Check
} from 'lucide-react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import { loyaltyApi, type LoyaltyStatus } from '../../services/loyaltyApi';
import { customerApi } from '../../services/customerApi';
import { showDeduplicatedError } from '../../utils/toastUtils';
import CustomerHealthScore from '../../components/customer/CustomerHealthScore';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';

// Animated counter hook
const useAnimatedCounter = (value: number) => {
  const spring = useSpring(0, { stiffness: 75, damping: 15 });
  const display = useTransform(spring, (current) => current);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return display;
};

type CounterFormat = 'number' | 'currency' | 'decimal' | 'hours';

const formatAnimatedValue = (val: number, format: CounterFormat = 'number') => {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', minimumFractionDigits: 0 }).format(val);
    case 'decimal':
      return val.toFixed(1);
    case 'hours':
      return `${Math.round(val)}h`;
    default:
      return val.toLocaleString();
  }
};

const AnimatedCounter: React.FC<{ value: number; format?: CounterFormat }> = ({ value, format = 'number' }) => {
  const motionValue = useAnimatedCounter(value);
  const [display, setDisplay] = useState(() => formatAnimatedValue(value, format));

  useEffect(() => {
    const update = (v: number) => {
      const normalized = format === 'decimal' ? v : Math.round(v);
      setDisplay(formatAnimatedValue(normalized, format));
    };
    update(value);
    return motionValue.on('change', update);
  }, [motionValue, value, format]);

  return <span>{display}</span>;
};

// Skeleton component
const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded-lg ${className}`} />
);

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
};

interface CustomerAnalytics {
  totalBookings: number;
  totalSpent: number;
  averageRating: number;
  totalHours: number;
  completedBookings: number;
  pendingBookings: number;
  monthlyBookings: Array<{ month: string; bookings: number }>;
  categoryBreakdown: Array<{ category: string; count: number }>;
  topServices: Array<{ name: string; count: number }>;
  favoriteCategory: string;
  lastBookingDate: string | null;
}

interface StatCardProps {
  label: string;
  value: number;
  format?: 'number' | 'currency' | 'decimal' | 'hours';
  icon: React.ElementType;
  gradient: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, format = 'number', icon: Icon, gradient, delay = 0 }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative group"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300`} />
      <div className="relative bg-white/80 backdrop-blur-lg rounded-2xl p-5 border border-white/50 shadow-nilin-warm hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient.replace('from-', 'from-').replace('to-', 'to-')} flex items-center justify-center shadow-lg`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-nilin-charcoal tabular-nums">
              <AnimatedCounter value={value} format={format} />
            </span>
            {format === 'decimal' && <span className="text-lg text-nilin-warmGray">/5</span>}
          </div>
        </div>
        <p className="text-sm font-medium text-nilin-warmGray uppercase tracking-wide">{label}</p>
      </div>
    </motion.div>
  );
};

interface BarChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}

const AnimatedBarChart: React.FC<BarChartProps> = ({ data, height = 200 }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="flex items-end justify-between gap-2 h-[200px]" style={{ minHeight: height }}>
      {data.map((item, index) => {
        const heightPercent = (item.value / maxValue) * 100;
        return (
          <motion.div
            key={item.label}
            initial={{ height: 0 }}
            animate={{ height: `${heightPercent}%` }}
            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex-1 flex flex-col items-center"
          >
            <div
              className={`w-full rounded-t-xl bg-gradient-to-t ${item.color || 'from-nilin-coral to-nilin-rose'} shadow-lg relative overflow-hidden group hover:brightness-110 transition-all duration-300 cursor-pointer`}
              style={{ minHeight: '8px' }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-nilin-charcoal text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {item.value}
              </div>
            </div>
            <span className="text-xs text-nilin-warmGray mt-3 font-medium">{item.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
};

interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ data, size = 160 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
        />
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const dashLength = (percentage / 100) * circumference;
          const dashOffset = -offset;
          offset += dashLength;

          return (
            <motion.circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${dashLength} ${circumference - dashLength}` }}
              transition={{ duration: 1, delay: index * 0.2 }}
            />
          );
        })}
      </svg>
      <div className="flex-1 space-y-2">
        {data.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.1 }}
            className="flex items-center gap-2"
          >
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-nilin-charcoal flex-1">{item.label}</span>
            <span className="text-sm font-semibold text-nilin-warmGray">{item.value}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { customerBookings, getCustomerBookings, isLoading: bookingsLoading } = useBookingStore();

  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'spending'>('overview');

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setLoyaltyError(null);

    try {
      const [stats, periodAnalytics, loyaltyResult] = await Promise.all([
        customerApi.getCustomerStats(),
        customerApi.getCustomerAnalytics('year'),
        loyaltyApi.getStatus().catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to load loyalty status';
          setLoyaltyError(message);
          showDeduplicatedError('Loyalty unavailable', message, 'analytics-loyalty-error');
          return null;
        }),
      ]);

      if (loyaltyResult?.data) {
        setLoyaltyStatus(loyaltyResult.data);
      } else {
        setLoyaltyStatus(null);
      }

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyBookings = (periodAnalytics?.monthly ?? []).map((m: { month: number; bookings: number }) => ({
        month: monthNames[m.month - 1] || `M${m.month}`,
        bookings: m.bookings,
      })).slice(-6);

      const categoryBreakdown = (stats?.topCategories ?? []).map((c: { category: string; count: number }) => ({
        category: c.category || 'Other',
        count: c.count,
      }));

      const recentBookings = stats?.recentBookings ?? [];
      const lastBooking = recentBookings[0];

      setAnalytics({
        totalBookings: stats?.overview?.totalBookings ?? 0,
        totalSpent: stats?.spending?.totalSpent ?? 0,
        averageRating: stats?.overview?.averageRating ?? 0,
        totalHours: stats?.overview?.totalHours ?? 0,
        completedBookings: stats?.overview?.completedBookings ?? 0,
        pendingBookings: stats?.overview?.pendingBookings ?? 0,
        monthlyBookings,
        categoryBreakdown,
        topServices: recentBookings.slice(0, 5).map((b: { service: string }) => ({
          name: b.service,
          count: 1,
        })),
        favoriteCategory: categoryBreakdown[0]?.category ?? null,
        lastBookingDate: lastBooking?.date
          ? new Date(lastBooking.date).toLocaleDateString('en-AE', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      setError(message);
      showDeduplicatedError('Unable to load analytics', message, 'analytics-fetch-error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    getCustomerBookings({ limit: 100 });
    fetchData();
  }, [getCustomerBookings, fetchData]);

  const handleRefresh = () => {
    getCustomerBookings({ limit: 100 });
    fetchData(true);
  };

  // Category colors - distinctive, warm palette avoiding AI-slop colors
  const categoryColors = [
    'from-rose-500 to-pink-500',
    'from-orange-500 to-red-500',
    'from-cyan-500 to-blue-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-yellow-500',
  ];

  const hasData = analytics && analytics.totalBookings > 0;

  // Loading state
  if ((loading || bookingsLoading) && !analytics) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl space-y-6">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-nilin-charcoal mb-3">Unable to Load Analytics</h2>
            <p className="text-nilin-warmGray mb-6">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
            >
              Try Again
            </button>
          </motion.div>
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
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-br from-nilin-primary via-nilin-coral to-nilin-rose" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white/80 text-sm font-medium uppercase tracking-wider">My Activity</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
                  Welcome back, {user?.firstName || 'Explorer'}! 👋
                </h1>
                <p className="text-white/80 text-lg">
                  {hasData
                    ? `${analytics.totalBookings} bookings • AED ${analytics.totalSpent.toLocaleString()} spent`
                    : 'Start your journey with our services'
                  }
                </p>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-50"
                aria-label="Refresh analytics"
              >
                <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
              </motion.button>
            </div>

            {/* Tab Navigation */}
            {hasData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex gap-2 mt-8"
              >
                {[
                  { id: 'overview', label: 'Overview', icon: Target },
                  { id: 'bookings', label: 'Bookings', icon: Calendar },
                  { id: 'pending', label: 'Pending', icon: Clock },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'bg-white text-nilin-coral shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                    {tab.id === 'pending' && analytics.pendingBookings > 0 && (
                      <span className="px-2 py-0.5 bg-nilin-coral text-white text-xs rounded-full">
                        {analytics.pendingBookings}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10">
          <div className="mb-6">
            <CustomerHealthScore compact />
          </div>
          {!hasData ? (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-xl p-8 md:p-12 text-center"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-12 h-12 text-nilin-coral" />
              </div>
              <h2 className="text-2xl font-bold text-nilin-charcoal mb-3">Your Journey Awaits!</h2>
              <p className="text-nilin-warmGray max-w-md mx-auto mb-8">
                Book your first service to start tracking your activity and earning rewards.
              </p>
              <button
                onClick={() => navigate('/search')}
                className="px-8 py-4 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl font-semibold hover:shadow-lg transition-all inline-flex items-center gap-2"
              >
                <Search className="w-5 h-5" />
                Explore Services
              </button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <StatCard
                        label="Total Bookings"
                        value={analytics.totalBookings}
                        icon={Calendar}
                        gradient="from-nilin-coral to-nilin-rose"
                        delay={0.1}
                      />
                      <StatCard
                        label="Total Spent"
                        value={analytics.totalSpent}
                        format="currency"
                        icon={DollarSign}
                        gradient="from-emerald-500 to-teal-500"
                        delay={0.2}
                      />
                      <StatCard
                        label="Avg Rating"
                        value={analytics.averageRating}
                        format="decimal"
                        icon={Star}
                        gradient="from-amber-500 to-orange-500"
                        delay={0.3}
                      />
                      <StatCard
                        label="Hours Booked"
                        value={analytics.totalHours}
                        format="hours"
                        icon={Clock}
                        gradient="from-blue-500 to-cyan-500"
                        delay={0.4}
                      />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Monthly Bookings */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white rounded-2xl shadow-lg p-6"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-nilin-charcoal">Monthly Bookings</h3>
                            <p className="text-sm text-nilin-warmGray">Your booking trend</p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-nilin-coral" />
                          </div>
                        </div>
                        {analytics.monthlyBookings.length > 0 ? (
                          <AnimatedBarChart
                            data={analytics.monthlyBookings.map((m, i) => ({
                              label: m.month,
                              value: m.bookings,
                              color: `from-nilin-coral to-nilin-rose`
                            }))}
                          />
                        ) : (
                          <div className="h-48 flex items-center justify-center text-white/60">
                            No monthly data yet
                          </div>
                        )}
                      </motion.div>

                      {/* Category Breakdown */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                        className="bg-white rounded-2xl shadow-lg p-6"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <h3 className="text-lg font-bold text-nilin-charcoal">Categories</h3>
                            <p className="text-sm text-nilin-warmGray">Services breakdown</p>
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-500" />
                          </div>
                        </div>
                        {analytics.categoryBreakdown.length > 0 ? (
                          <DonutChart
                            data={analytics.categoryBreakdown.map((c, i) => ({
                              label: c.category,
                              value: c.count,
                              color: ['#f43f5e', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'][i % 5]
                            }))}
                          />
                        ) : (
                          <div className="h-48 flex items-center justify-center text-white/60">
                            No category data yet
                          </div>
                        )}
                      </motion.div>
                    </div>

                    {/* Health Score & Loyalty Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                      <CustomerHealthScore showDetails compact className="h-full" />
                      {loyaltyError && !loyaltyStatus && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="bg-amber-50 rounded-2xl border border-amber-200/50 p-6"
                        >
                          <p className="text-sm text-amber-800">{loyaltyError}</p>
                        </motion.div>
                      )}
                      {loyaltyStatus && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.7 }}
                          className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl border border-amber-200/50 p-6 relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-200/40 to-orange-200/40 rounded-full -translate-y-1/2 translate-x-1/2" />
                          <div className="relative">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
                                <Award className="w-7 h-7 text-white" />
                              </div>
                              <div>
                                <span className="text-sm text-amber-600 font-medium uppercase tracking-wider">{loyaltyStatus.tier} Member</span>
                                <p className="text-2xl font-bold text-nilin-charcoal">{loyaltyStatus.coins?.toLocaleString()} coins</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-amber-600/70">Progress to next tier</p>
                                <div className="w-48 h-2 bg-amber-200 rounded-full mt-1 overflow-hidden">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, loyaltyStatus.progressToNext || 0)}%` }}
                                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                                  />
                                </div>
                              </div>
                              <button
                                onClick={() => navigate('/customer/rewards')}
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium rounded-xl hover:shadow-lg transition-all flex items-center gap-1"
                              >
                                View Rewards <ChevronRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}

                      {/* Insights Card */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8 }}
                        className="bg-gradient-to-br from-nilin-primary/5 to-nilin-coral/5 rounded-2xl border border-nilin-primary/10 p-6"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-nilin-primary/10 flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-nilin-primary" />
                          </div>
                          <div>
                            <h3 className="font-bold text-nilin-charcoal">Insights</h3>
                            <p className="text-xs text-nilin-warmGray">Your activity highlights</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {analytics.totalBookings >= 5 && (
                            <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                              <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                                <Trophy className="w-4 h-4 text-rose-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-nilin-charcoal">Super Customer!</p>
                                <p className="text-xs text-nilin-warmGray">{analytics.totalBookings} bookings completed</p>
                              </div>
                            </div>
                          )}
                          {analytics.favoriteCategory && (
                            <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                                <Heart className="w-4 h-4 text-violet-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-nilin-charcoal">Favorite Category</p>
                                <p className="text-xs text-nilin-warmGray">{analytics.favoriteCategory}</p>
                              </div>
                            </div>
                          )}
                          {analytics.lastBookingDate && (
                            <div className="flex items-start gap-3 p-3 bg-white/60 rounded-xl">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-4 h-4 text-blue-500" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-nilin-charcoal">Last Activity</p>
                                <p className="text-xs text-nilin-warmGray">{analytics.lastBookingDate}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </div>

                    {/* Quick Actions */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.9 }}
                      className="bg-white rounded-2xl shadow-lg p-6"
                    >
                      <h3 className="font-bold text-nilin-charcoal mb-4">Quick Actions</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { icon: Search, label: 'Book Again', color: 'from-nilin-coral to-nilin-rose', action: () => navigate('/search') },
                          { icon: Heart, label: 'Favorites', color: 'from-rose-500 to-pink-500', action: () => navigate('/customer/favorites') },
                          { icon: Award, label: 'Rewards', color: 'from-amber-500 to-orange-500', action: () => navigate('/customer/rewards') },
                          { icon: Star, label: 'Reviews', color: 'from-orange-500 to-rose-500', action: () => navigate('/customer/reviews') },
                        ].map((action, i) => (
                          <motion.button
                            key={action.label}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 1 + i * 0.1 }}
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={action.action}
                            className={`p-4 bg-gradient-to-br ${action.color} rounded-xl text-white text-center hover:shadow-lg transition-all`}
                          >
                            <action.icon className="w-6 h-6 mx-auto mb-2" />
                            <span className="text-sm font-medium">{action.label}</span>
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  </div>
                )}

                {activeTab === 'bookings' && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-lg font-bold text-nilin-charcoal mb-4">Booking History</h3>
                    <div className="space-y-3">
                      {customerBookings.slice(0, 10).map((booking, i) => (
                        <motion.div
                          key={booking._id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between p-4 bg-nilin-cream/50 rounded-xl hover:bg-nilin-cream transition-colors cursor-pointer"
                          onClick={() => navigate(`/booking/${booking._id}`)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              booking.status === 'completed' ? 'bg-emerald-100' :
                              booking.status === 'pending' ? 'bg-amber-100' : 'bg-gray-100'
                            }`}>
                              <Calendar className={`w-5 h-5 ${
                                booking.status === 'completed' ? 'text-emerald-500' :
                                booking.status === 'pending' ? 'text-amber-500' : 'text-gray-500'
                              }`} />
                            </div>
                            <div>
                              <p className="font-medium text-nilin-charcoal">{booking.service?.name || 'Service'}</p>
                              <p className="text-xs text-nilin-warmGray">
                                {new Date(booking.scheduledDate || booking.createdAt).toLocaleDateString('en-AE')}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-nilin-charcoal">
                              AED {(booking.pricing?.totalAmount || booking.pricing?.total || 0).toLocaleString()}
                            </p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              booking.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              booking.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                    {customerBookings.length > 10 && (
                      <button
                        onClick={() => navigate('/customer/bookings')}
                        className="w-full mt-4 py-3 text-nilin-coral font-medium hover:bg-nilin-coral/5 rounded-xl transition-colors"
                      >
                        View All {customerBookings.length} Bookings
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'pending' && (
                  <div className="bg-white rounded-2xl shadow-lg p-6">
                    <h3 className="text-lg font-bold text-nilin-charcoal mb-4">
                      Pending Bookings ({analytics.pendingBookings})
                    </h3>
                    {analytics.pendingBookings > 0 ? (
                      <div className="space-y-3">
                        {customerBookings.filter(b => b.status === 'pending').map((booking, i) => (
                          <motion.div
                            key={booking._id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="flex items-center justify-between p-4 bg-amber-50/50 rounded-xl border border-amber-200"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-amber-500" />
                              </div>
                              <div>
                                <p className="font-medium text-nilin-charcoal">{booking.service?.name || 'Service'}</p>
                                <p className="text-xs text-amber-600">
                                  Scheduled: {new Date(booking.scheduledDate).toLocaleDateString('en-AE', {
                                    weekday: 'short', month: 'short', day: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => navigate(`/booking/${booking._id}`)}
                              className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                            >
                              View Details
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                          <Check className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="text-nilin-charcoal font-medium">All caught up!</p>
                        <p className="text-sm text-nilin-warmGray">No pending bookings</p>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default AnalyticsPage;
