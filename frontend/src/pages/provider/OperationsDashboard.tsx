
import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { providerOpsApiService } from '../../services/providerOpsApi';

interface ProviderOpsStats {
  totalEarnings: number;
  pendingPayout: number;
  completedBookings: number;
  avgRating: number;
  responseRate: number;
  acceptanceRate: number;
  qualityScore: number;
  pendingVerifications: number;
}

export function ProviderOperationsDashboard() {
  const [stats, setStats] = useState<ProviderOpsStats>({
    totalEarnings: 0,
    pendingPayout: 0,
    completedBookings: 0,
    avgRating: 0,
    responseRate: 0,
    acceptanceRate: 0,
    qualityScore: 0,
    pendingVerifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      // Use the existing providerOpsApiService instead of direct fetch
      const response = await providerOpsApiService.getDashboardStats();
      if (response.success && response.data) {
        const { metrics } = response.data;
        // Map service data to component interface
        setStats({
          totalEarnings: 0, // Not available in dashboard stats
          pendingPayout: 0, // Not available in dashboard stats
          completedBookings: metrics.totalBookings,
          avgRating: metrics.avgRating,
          responseRate: 0, // Not available in dashboard stats
          acceptanceRate: 0, // Not available in dashboard stats
          qualityScore: metrics.avgQualityScore,
          pendingVerifications: response.data.providers.pending,
        });
      } else {
        throw new Error('Failed to fetch dashboard stats');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Error state with retry
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose text-white p-6">
          <h1 className="text-xl font-bold">Provider Dashboard</h1>
          <p className="text-white/80">Your business at a glance</p>
        </div>
        <div className="p-8">
          <div className="glass-nilin rounded-nilin-lg p-10 border border-nilin-border text-center">
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
      </div>
    );
  }

  return (
    <ErrorBoundary>
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-gradient-to-br from-nilin-coral to-nilin-rose text-white p-6">
        <h1 className="text-xl font-bold">Provider Dashboard</h1>
        <p className="text-white/80">Your business at a glance</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Earnings */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <p className="text-sm text-gray-500 mb-1">Total Earnings</p>
          <p className="text-3xl font-bold text-green-600">AED {stats.totalEarnings.toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <TrendingUp size={16} />
            <span>+12% from last month</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Completed" value={stats.completedBookings} />
          <StatCard label="Rating" value={`${stats.avgRating} ★`} />
          <StatCard label="Response" value={`${stats.responseRate}%`} />
          <StatCard label="Acceptance" value={`${stats.acceptanceRate}%`} />
        </div>

        {/* Quality Score */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Quality Score</span>
            <span className="text-2xl font-bold text-nilin-coral">{stats.qualityScore}</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full">
            <div
              className="h-full bg-nilin-coral rounded-full transition-all duration-500"
              style={{ width: `${stats.qualityScore}%` }}
            />
          </div>
        </div>

        {/* Pending Payout */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Pending Payout</span>
            <span className="text-xl font-bold text-orange-500">AED {stats.pendingPayout.toLocaleString()}</span>
          </div>
        </div>

        {/* Alerts */}
        {stats.pendingVerifications > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle size={20} />
              <span className="font-medium">{stats.pendingVerifications} items need verification</span>
            </div>
          </div>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm text-center">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default ProviderOperationsDashboard;
