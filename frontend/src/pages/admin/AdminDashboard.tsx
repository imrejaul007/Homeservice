import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, DollarSign, Calendar, TrendingUp, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { Skeleton, StatsCardSkeleton } from '../../components/common/Skeleton';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';

// Types
interface DashboardStats {
  totalUsers: number;
  activeProviders: number;
  todayBookings: number;
  revenue: number;
  pendingVerifications: number;
  activeIncidents: number;
}

interface AnalyticsData {
  customers: {
    total: number;
    active: number;
    newThisMonth: number;
  };
  providers: {
    total: number;
    active: number;
    pending: number;
    newThisMonth: number;
  };
  bookings: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
  revenue: {
    thisMonth: number;
    lastMonth: number;
    monthOverMonthGrowth: number;
  };
}

interface ChurnData {
  totalAtRisk: number;
  churnRate: number;
  byRiskLevel: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

interface FunnelData {
  views: number;
  search: number;
  service_view: number;
  booking_request: number;
  booking_confirmed: number;
  booking_completed: number;
  conversionRates: {
    viewToSearch: number;
    searchToServiceView: number;
    serviceViewToRequest: number;
    requestToConfirmed: number;
    confirmedToCompleted: number;
    overall: number;
  };
}

interface GeographicData {
  byCity: Array<{
    city: string;
    bookings: number;
    revenue: number;
    percentage: number;
  }>;
  summary: {
    totalBookings: number;
    totalRevenue: number;
    topCity: string;
  };
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeProviders: 0,
    todayBookings: 0,
    revenue: 0,
    pendingVerifications: 0,
    activeIncidents: 0,
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [geographicData, setGeographicData] = useState<GeographicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Real-time notification state
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'provider' | 'service' | 'dispute' | 'withdrawal';
    message: string;
    timestamp: Date;
  }>>([]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true);
    }

    try {
      const [
        statsRes,
        overviewRes,
        churnRes,
        funnelRes,
        geoRes
      ] = await Promise.allSettled([
        api.get('/admin/stats'),
        api.get('/analytics/overview'),
        api.get('/admin/churn/stats'),
        api.get('/admin/analytics/funnel'),
        api.get('/admin/analytics/geographic'),
      ]);

      // Process stats
      if (statsRes.status === 'fulfilled' && statsRes.value.status === 200) {
        const response = statsRes.value.data;
        if (response?.success && response.data) {
          const data = response.data;
          setStats({
            totalUsers: data.totalUsers || data.customers?.total || 0,
            activeProviders: data.activeProviders || data.providers?.active || 0,
            todayBookings: data.todayBookings || data.bookings?.today || 0,
            revenue: data.revenue || data.revenue?.total || 0,
            pendingVerifications: data.pendingVerifications || data.providers?.pending || 0,
            activeIncidents: data.activeIncidents || 0,
          });
        }
      }

      // Process overview analytics
      if (overviewRes.status === 'fulfilled' && overviewRes.value.status === 200) {
        const response = overviewRes.value.data;
        if (response?.success && response.data) {
          const data = response.data;
          setAnalytics({
            customers: {
              total: data.customers?.total || 0,
              active: data.customers?.active || 0,
              newThisMonth: data.customers?.newThisMonth || 0,
            },
            providers: {
              total: data.providers?.total || 0,
              active: data.providers?.active || 0,
              pending: data.providers?.pending || 0,
              newThisMonth: data.providers?.newThisMonth || 0,
            },
            bookings: {
              total: data.bookings?.total || 0,
              completed: data.bookings?.completed || 0,
              pending: data.bookings?.pending || 0,
              cancelled: data.bookings?.cancelled || 0,
            },
            revenue: {
              thisMonth: data.revenue?.thisMonth || 0,
              lastMonth: data.revenue?.lastMonth || 0,
              monthOverMonthGrowth: data.revenue?.monthOverMonthGrowth || 0,
            },
          });
        }
      }

      // Process churn data
      if (churnRes.status === 'fulfilled' && churnRes.value.status === 200) {
        const response = churnRes.value.data;
        if (response?.success && response.data) {
          const data = response.data;
          setChurnData({
            totalAtRisk: data.totalAtRisk || data.atRiskCustomers || 0,
            churnRate: data.churnRate || 0,
            byRiskLevel: {
              critical: data.byRiskLevel?.critical || 0,
              high: data.byRiskLevel?.high || 0,
              medium: data.byRiskLevel?.medium || 0,
              low: data.byRiskLevel?.low || 0,
            },
          });
        }
      }

      // Process funnel data
      if (funnelRes.status === 'fulfilled' && funnelRes.value.status === 200) {
        const response = funnelRes.value.data;
        if (response?.success && response.data) {
          const data = response.data;
          setFunnelData(data);
        }
      }

      // Process geographic data
      if (geoRes.status === 'fulfilled' && geoRes.value.status === 200) {
        const response = geoRes.value.data;
        if (response?.success && response.data) {
          const data = response.data;
          setGeographicData(data);
        }
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Socket listeners for real-time updates
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // New provider submission
    const unsubProvider = socketService.onNewProviderSubmission((data) => {
      setStats((prev) => ({
        ...prev,
        pendingVerifications: prev.pendingVerifications + 1,
      }));
      setNotifications((prev) => [
        {
          id: `provider-${data.providerId}-${Date.now()}`,
          type: 'provider',
          message: `New provider submission from ${data.providerName}`,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    });
    unsubscribers.push(unsubProvider);

    // New service pending
    const unsubService = socketService.onNewServicePending((data) => {
      setNotifications((prev) => [
        {
          id: `service-${data.serviceId}-${Date.now()}`,
          type: 'service',
          message: `New pending service: ${data.serviceName}`,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    });
    unsubscribers.push(unsubService);

    // New dispute
    const unsubDispute = socketService.onNewDispute((data) => {
      setStats((prev) => ({
        ...prev,
        activeIncidents: prev.activeIncidents + 1,
      }));
      setNotifications((prev) => [
        {
          id: `dispute-${data.disputeId}-${Date.now()}`,
          type: 'dispute',
          message: `New dispute #${data.disputeNumber}: ${data.category}`,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    });
    unsubscribers.push(unsubDispute);

    // New withdrawal request
    const unsubWithdrawal = socketService.onNewWithdrawalRequest((data) => {
      setNotifications((prev) => [
        {
          id: `withdrawal-${data.withdrawalId}-${Date.now()}`,
          type: 'withdrawal',
          message: `New withdrawal request from ${data.providerName}: ${data.currency} ${data.amount.toFixed(2)}`,
          timestamp: new Date(),
        },
        ...prev,
      ]);
    });
    unsubscribers.push(unsubWithdrawal);

    // Connect to socket
    socketService.connect().catch((error) => {
      console.error('Failed to connect to socket:', error);
    });

    // Cleanup
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, []);

  // Handle refresh
  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="w-48 h-8" />
          <Skeleton className="w-32 h-10 rounded-lg" />
        </div>

        {/* Stats Grid Skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
          <StatsCardSkeleton />
        </div>

        {/* Alert Section Skeleton */}
        <Skeleton className="w-full h-16 rounded-xl mb-6" />

        {/* Quick Actions Skeletons */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <Skeleton className="w-20 h-4 mb-2" />
            <Skeleton className="w-16 h-3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Operations Dashboard</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subValue={analytics ? `${analytics.customers.active.toLocaleString()} active` : undefined}
          color="blue"
        />
        <StatCard
          icon={CheckCircle}
          label="Active Providers"
          value={stats.activeProviders.toLocaleString()}
          subValue={stats.pendingVerifications > 0 ? `${stats.pendingVerifications} pending` : undefined}
          color="green"
        />
        <StatCard
          icon={Calendar}
          label="Today's Bookings"
          value={stats.todayBookings.toLocaleString()}
          subValue={analytics ? `${analytics.bookings.completed} completed` : undefined}
          color="purple"
        />
        <StatCard
          icon={DollarSign}
          label="Revenue (This Month)"
          value={`AED ${(stats.revenue > 0 ? stats.revenue : analytics?.revenue?.thisMonth || 0).toLocaleString()}`}
          subValue={analytics?.revenue?.monthOverMonthGrowth !== undefined
            ? `${analytics.revenue.monthOverMonthGrowth > 0 ? '+' : ''}${analytics.revenue.monthOverMonthGrowth.toFixed(1)}% vs last month`
            : undefined}
          color="yellow"
        />
      </div>

      {/* Alerts Section */}
      {stats.pendingVerifications > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle size={20} />
            <span className="font-medium">{stats.pendingVerifications} providers pending verification</span>
          </div>
        </div>
      )}

      {/* Real-time Notifications */}
      {notifications.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${
                    notification.type === 'provider' ? 'bg-blue-500' :
                    notification.type === 'service' ? 'bg-green-500' :
                    notification.type === 'dispute' ? 'bg-red-500' :
                    'bg-purple-500'
                  }`} />
                  <span className="text-blue-800">{notification.message}</span>
                  <span className="text-blue-500 text-xs ml-auto">
                    {notification.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setNotifications([])}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Additional Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Churn Stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <span className="font-medium text-gray-700">At-Risk Customers</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">
            {churnData?.totalAtRisk || 0}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-gray-500">Churn rate:</span>
            <span className="text-xs font-medium text-gray-700">
              {(churnData?.churnRate || 0).toFixed(1)}%
            </span>
          </div>
          {churnData && (
            <div className="flex gap-2 mt-2">
              {churnData.byRiskLevel.critical > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                  {churnData.byRiskLevel.critical} critical
                </span>
              )}
              {churnData.byRiskLevel.high > 0 && (
                <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                  {churnData.byRiskLevel.high} high
                </span>
              )}
            </div>
          )}
        </div>

        {/* Booking Stats */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-gray-700">Bookings</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {analytics?.bookings.total || stats.todayBookings || 0}
          </p>
          <div className="flex gap-2 mt-2">
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              {analytics?.bookings.completed || 0} completed
            </span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
              {analytics?.bookings.pending || 0} pending
            </span>
          </div>
        </div>

        {/* Conversion Rate */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-indigo-500" />
            <span className="font-medium text-gray-700">Conversion</span>
          </div>
          <p className="text-2xl font-bold text-indigo-600">
            {funnelData?.conversionRates?.overall?.toFixed(2) || 0}%
          </p>
          <span className="text-xs text-gray-500">Overall funnel</span>
          {funnelData?.booking_completed > 0 && (
            <div className="mt-2 text-xs text-gray-600">
              {funnelData.booking_completed.toLocaleString()} completed bookings
            </div>
          )}
        </div>

        {/* Geographic - Top City */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-5 h-5 text-teal-500" />
            <span className="font-medium text-gray-700">Top City</span>
          </div>
          <p className="text-2xl font-bold text-teal-600">
            {geographicData?.summary?.topCity || 'N/A'}
          </p>
          <span className="text-xs text-gray-500">
            {geographicData?.summary?.totalBookings?.toLocaleString() || 0} total bookings
          </span>
          {geographicData?.byCity && geographicData.byCity[0] && (
            <div className="mt-1 text-xs text-gray-600">
              {geographicData.byCity[0].percentage?.toFixed(1)}% of all bookings
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionCard title="Users" link="/admin/customers" description="Manage customers" />
        <ActionCard title="Providers" link="/admin/providers" description="Provider management" />
        <ActionCard title="Analytics" link="/admin/analytics" description="View reports" />
        <ActionCard title="Disputes" link="/admin/disputes" description="Handle disputes" />
      </div>

      {/* Additional Quick Links */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        <ActionCard title="Churn Report" link="/admin/churn" description="Customer retention" />
        <ActionCard title="Fraud Report" link="/admin/fraud" description="Fraud detection" />
        <ActionCard title="SLA Report" link="/admin/sla" description="Service metrics" />
        <ActionCard title="Scheduled Reports" link="/admin/reports" description="Manage reports" />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, subValue, color }: StatCardProps) {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
    green: { bg: 'bg-green-100', text: 'text-green-600' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
    yellow: { bg: 'bg-yellow-100', text: 'text-yellow-600' },
    orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
    red: { bg: 'bg-red-100', text: 'text-red-600' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600' },
    teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
  };

  const { bg, text } = colorClasses[color] || { bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <Icon className={`w-5 h-5 ${text}`} />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
      {subValue && (
        <p className="text-xs text-gray-400 mt-1">{subValue}</p>
      )}
    </div>
  );
}

interface ActionCardProps {
  title: string;
  link: string;
  description?: string;
}

function ActionCard({ title, link, description }: ActionCardProps) {
  return (
    <a
      href={link}
      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow block"
    >
      <p className="font-medium text-gray-900">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      )}
      <p className="text-sm text-pink-500 mt-2">Manage</p>
    </a>
  );
}

export default AdminDashboard;
