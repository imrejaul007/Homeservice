
import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import ProviderHubNav from '../../components/provider/ProviderHubNav';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { providerOpsApiService } from '../../services/providerOpsApi';
import { TravelTimeTracking } from '../../components/analytics/provider/TravelTimeTracking';
import { PeakHoursRevenue } from '../../components/analytics/provider/PeakHoursRevenue';
import { useAuthStore } from '../../stores/authStore';

interface ProviderOpsStats {
  totalEarnings: number;
  pendingPayout: number;
  completedBookings: number;
  avgRating: number;
  responseRate: number;
  acceptanceRate: number;
  qualityScore: number;
  earningsGrowthPct: number;
  bookingsGrowthPct: number;
}

export function ProviderOperationsDashboard() {
  const { user, providerProfile } = useAuthStore();
  const [stats, setStats] = useState<ProviderOpsStats>({
    totalEarnings: 0,
    pendingPayout: 0,
    completedBookings: 0,
    avgRating: 0,
    responseRate: 0,
    acceptanceRate: 0,
    qualityScore: 0,
    earningsGrowthPct: 0,
    bookingsGrowthPct: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const verificationAlert = useMemo(() => {
    const status = providerProfile?.verificationStatus;
    if (!status) return null;

    if (status.overall === 'pending' || status.documents === 'pending' || status.businessVerification === 'pending') {
      return {
        tone: 'warning' as const,
        message: 'Your account verification is pending. Complete verification to unlock all provider features.',
      };
    }
    if (status.overall === 'rejected' || status.documents === 'rejected' || status.businessVerification === 'rejected') {
      return {
        tone: 'error' as const,
        message: 'Verification was rejected. Review your documents and resubmit from the Verification page.',
      };
    }
    if (status.overall === 'suspended') {
      return {
        tone: 'error' as const,
        message: 'Your provider account is suspended. Contact support for assistance.',
      };
    }
    return null;
  }, [providerProfile?.verificationStatus]);

  const fetchStats = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const response = await providerOpsApiService.getDashboardStats();
      if (response.success && response.data) {
        const { metrics, growth } = response.data;
        setStats({
          totalEarnings: metrics?.totalEarnings || 0,
          pendingPayout: metrics?.pendingPayout || 0,
          completedBookings: metrics?.completedBookings || 0,
          avgRating: metrics?.avgRating || 0,
          responseRate: metrics?.responseRate || 0,
          acceptanceRate: metrics?.acceptanceRate || 0,
          qualityScore: metrics?.qualityScore || 0,
          earningsGrowthPct: growth?.earnings ?? 0,
          bookingsGrowthPct: growth?.bookings ?? 0,
        });
      } else {
        throw new Error('Failed to fetch dashboard stats');
      }
    } catch (err) {
      const isNetworkError = !navigator.onLine ||
        err instanceof TypeError ||
        (err as { message?: string })?.message?.includes('NetworkError') ||
        (err as { message?: string })?.message?.includes('Failed to fetch');

      const status = (err as { response?: { status?: number } })?.response?.status;

      let message: string;
      if (isNetworkError) {
        message = 'Connection error. Please check your internet connection and try again.';
      } else if (status === 401) {
        message = 'Session expired. Please log in again.';
      } else if (status === 403) {
        message = 'Access denied. You do not have permission to view this data.';
      } else if (status === 404) {
        message = 'Dashboard data not found.';
      } else if (status === 429) {
        message = 'Too many requests. Please wait a moment and try again.';
      } else if (status && status >= 500) {
        message = 'Server error. Please try again later.';
      } else {
        message = err instanceof Error ? err.message : 'Failed to load dashboard';
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (error) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <ProviderHubNav />
        <div className="p-8 flex-1">
          <div className="glass-nilin rounded-nilin-lg p-10 border border-nilin-border text-center max-w-lg mx-auto">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <h3 className="text-xl font-serif text-nilin-charcoal mb-2">Error Loading Dashboard</h3>
            <p className="text-nilin-warmGray mb-6 font-sans">{error}</p>
            <button
              onClick={fetchStats}
              className="btn-nilin inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <ProviderHubNav />
        <div className="p-8 flex-1 flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-nilin-coral animate-spin mx-auto mb-4" />
            <p className="text-nilin-warmGray font-sans">Loading your operations dashboard...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <ProviderHubNav />

        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg focus:shadow-lg"
        >
          Skip to main content
        </a>

        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          Operations dashboard loaded
        </div>

        <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-serif text-nilin-charcoal">Operations Dashboard</h1>
            <p className="text-nilin-warmGray font-sans">Your business performance at a glance</p>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-nilin-border">
              <p className="text-sm text-gray-500 mb-1">Total Earnings</p>
              <p className="text-3xl font-bold text-green-600">AED {stats.totalEarnings.toLocaleString()}</p>
              <div className={`flex items-center gap-2 mt-2 text-sm ${stats.earningsGrowthPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                <TrendingUp size={16} className={stats.earningsGrowthPct < 0 ? 'rotate-180' : ''} />
                <span>
                  {stats.earningsGrowthPct >= 0 ? '+' : ''}{stats.earningsGrowthPct}% from previous 30 days
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Completed" value={stats.completedBookings} />
              <StatCard label="Rating" value={`${stats.avgRating} ★`} />
              <StatCard label="Response" value={`${stats.responseRate}%`} />
              <StatCard label="Acceptance" value={`${stats.acceptanceRate}%`} />
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-border">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Quality Score</span>
                <span className="text-2xl font-bold text-nilin-coral">{stats.qualityScore}/100</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div
                  className="h-full bg-nilin-coral rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(stats.qualityScore, 100)}%` }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-border">
              <div className="flex items-center justify-between">
                <span className="font-medium">Pending Payout</span>
                <span className="text-xl font-bold text-orange-500">AED {stats.pendingPayout.toLocaleString()}</span>
              </div>
            </div>

            {verificationAlert && (
              <div className={`rounded-xl p-4 border ${
                verificationAlert.tone === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className={`flex items-center gap-2 ${
                  verificationAlert.tone === 'warning' ? 'text-yellow-800' : 'text-red-800'
                }`}>
                  <AlertCircle size={20} />
                  <span className="font-medium">{verificationAlert.message}</span>
                </div>
              </div>
            )}

            <TravelTimeTracking providerId={user?._id} timeRange="30d" />
            <PeakHoursRevenue providerId={user?._id} timeRange="30d" />
          </div>
        </main>

        <Footer />
      </div>
    </ErrorBoundary>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm text-center border border-nilin-border">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default ProviderOperationsDashboard;
