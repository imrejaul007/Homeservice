import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  BarChart3,
  MapPin,
  Activity,
  ChevronRight,
  Shield,
  Wallet,
  Star,
  Gift,
  Ticket,
  Layers,
  Settings,
  Zap,
  UserPlus,
  Building2,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { Skeleton } from '../../components/common/Skeleton';
import { ServiceApprovalPanel } from '../../components/admin/ServiceApprovalPanel';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { PageErrorBoundary } from '../../components/common/PageErrorBoundary';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import { api } from '../../services/api';
import { socketService } from '../../services/socket';

const CHART_COLORS = ['#E8B4A8', '#C9A87C', '#8B7355', '#6B5344', '#4A3728'];

interface DashboardStats {
  totalUsers: number;
  activeProviders: number;
  todayBookings: number;
  revenue: number;
  pendingVerifications: number;
  activeIncidents: number;
}

/** Response shape from GET /admin/stats
 * NOTE: Backend may return either 'monthlyRevenue' or 'revenue' field
 * Frontend normalizes both using: data.monthlyRevenue ?? data.revenue ?? 0
 */
interface AdminStatsResponse {
  totalUsers?: number;
  activeProviders?: number;
  todayBookings?: number;
  monthlyRevenue?: number;  // Primary field (backend uses this)
  revenue?: number;          // Fallback field (for compatibility)
  pendingVerifications?: number;
  activeIncidents?: number;
  customers?: { total?: number };
  providers?: { active?: number; pending?: number };
  bookings?: { today?: number };
}

interface AnalyticsData {
  customers: { total: number; active: number; newThisMonth: number };
  providers: { total: number; active: number; pending: number; newThisMonth: number };
  bookings: { total: number; completed: number; pending: number; cancelled: number };
  revenue: { thisMonth: number; lastMonth: number; monthOverMonthGrowth: number | null };
}

interface BookingsSummary {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
}

interface ChurnData {
  totalAtRisk: number;
  churnRate: number;
  byRiskLevel: { critical: number; high: number; medium: number; low: number };
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
  byCity: Array<{ city: string; bookings: number; revenue: number; percentage: number }>;
  summary: { totalBookings: number; totalRevenue: number; topCity: string };
}

interface LiveNotification {
  id: string;
  type: 'provider' | 'service' | 'dispute' | 'withdrawal';
  message: string;
  timestamp: Date;
}

function formatAED(amount: number) {
  return `AED ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatRevenueGrowthSub(
  thisMonth: number,
  lastMonth: number,
  growth: number | null | undefined
): string {
  if (thisMonth === 0 && lastMonth === 0) {
    return 'No revenue recorded yet';
  }
  if (growth === null || growth === undefined) {
    return lastMonth > 0 ? `Last month ${formatAED(lastMonth)}` : 'No revenue this month';
  }
  return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% vs last month`;
}

function mapOverviewToAnalytics(data: Record<string, unknown>): AnalyticsData {
  const customers = (data.customers ?? {}) as Record<string, number>;
  const providers = (data.providers ?? {}) as Record<string, unknown>;
  const providersByStatus = (providers.providersByStatus ?? {}) as Record<string, number>;
  const bookings = (data.bookings ?? {}) as Record<string, number>;
  const revenue = (data.revenue ?? {}) as Record<string, number | null>;

  return {
    customers: {
      total: customers.totalCustomers ?? customers.total ?? 0,
      active: customers.activeCustomers ?? customers.active ?? 0,
      newThisMonth: customers.newCustomersThisMonth ?? customers.newThisMonth ?? 0,
    },
    providers: {
      total: (providers.totalProviders as number) ?? (providers.total as number) ?? 0,
      active: (providers.activeProviders as number) ?? (providers.active as number) ?? 0,
      pending: providersByStatus.pending ?? (providers.pending as number) ?? 0,
      newThisMonth: (providers.newProvidersThisMonth as number) ?? (providers.newThisMonth as number) ?? 0,
    },
    bookings: {
      total: bookings.totalBookings ?? bookings.total ?? 0,
      completed: bookings.completedBookings ?? bookings.completed ?? 0,
      pending: bookings.pendingBookings ?? bookings.pending ?? 0,
      cancelled: bookings.cancelledBookings ?? bookings.cancelled ?? 0,
    },
    revenue: {
      thisMonth: revenue.revenueThisMonth ?? revenue.totalRevenue ?? revenue.thisMonth ?? 0,
      lastMonth: revenue.revenueLastMonth ?? revenue.lastMonth ?? 0,
      monthOverMonthGrowth: revenue.monthOverMonthGrowth ?? null,
    },
  };
}

const ANALYTICS_RANGE = {
  startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date().toISOString(),
};

function normalizeGeographicResponse(payload: unknown): GeographicData | null {
  if (!payload || typeof payload !== 'object') return null;

  const root = payload as Record<string, unknown>;
  const data = root.data ?? root;

  if (typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>).byCity)) {
    const geo = data as GeographicData;
    return {
      byCity: geo.byCity,
      summary: geo.summary ?? {
        totalBookings: geo.byCity.reduce((s, c) => s + c.bookings, 0),
        totalRevenue: geo.byCity.reduce((s, c) => s + c.revenue, 0),
        topCity: geo.byCity[0]?.city || '—',
      },
    };
  }

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(root.data)
      ? (root.data as unknown[])
      : null;
  if (!rows || rows.length === 0) return null;

  const summary = root.summary as Record<string, unknown> | undefined;

  const byCity = rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      city: String(r.city || r.region || r.country || 'Unknown'),
      bookings: Number(r.bookings ?? r.count ?? 0),
      revenue: Number(r.revenue ?? 0),
      percentage: Number(r.percentage ?? 0),
    };
  });

  const totalBookings = Number(summary?.totalBookings ?? byCity.reduce((s, c) => s + c.bookings, 0));
  return {
    byCity,
    summary: {
      totalBookings,
      totalRevenue: Number(summary?.totalRevenue ?? byCity.reduce((s, c) => s + c.revenue, 0)),
      topCity: byCity[0]?.city || '—',
    },
  };
}

function normalizeFunnelResponse(payload: unknown): FunnelData | null {
  if (!payload || typeof payload !== 'object') return null;

  const data = payload as Record<string, unknown>;

  // Marketplace route shape: { funnel: { views, searches, ... } }
  if (data.funnel && typeof data.funnel === 'object') {
    const f = data.funnel as Record<string, number>;
    const views = f.views ?? 0;
    const search = f.searches ?? f.search ?? 0;
    const service_view = f.bookingStarts ?? f.service_view ?? 0;
    const booking_request = f.bookings ?? f.booking_request ?? 0;
    const booking_confirmed = f.booking_confirmed ?? 0;
    const booking_completed = f.completions ?? f.booking_completed ?? 0;
    const overall = f.conversion ?? f.completionRate ?? 0;

    return {
      views,
      search,
      service_view,
      booking_request,
      booking_confirmed,
      booking_completed,
      conversionRates: {
        viewToSearch: views > 0 ? (search / views) * 100 : 0,
        searchToServiceView: search > 0 ? (service_view / search) * 100 : 0,
        serviceViewToRequest: service_view > 0 ? (booking_request / service_view) * 100 : 0,
        requestToConfirmed: booking_request > 0 ? (booking_confirmed / booking_request) * 100 : 0,
        confirmedToCompleted: booking_confirmed > 0 ? (booking_completed / booking_confirmed) * 100 : 0,
        overall,
      },
    };
  }

  // analytics.service flat shape
  if ('views' in data || 'booking_completed' in data) {
    const num = (key: string) => Number(data[key] ?? 0);
    const rates =
      data.conversionRates && typeof data.conversionRates === 'object'
        ? (data.conversionRates as Record<string, unknown>)
        : null;

    return {
      views: num('views'),
      search: num('search'),
      service_view: num('service_view'),
      booking_request: num('booking_request'),
      booking_confirmed: num('booking_confirmed'),
      booking_completed: num('booking_completed'),
      conversionRates: {
        viewToSearch: rates ? Number(rates.viewToSearch ?? 0) : 0,
        searchToServiceView: rates ? Number(rates.searchToServiceView ?? 0) : 0,
        serviceViewToRequest: rates ? Number(rates.serviceViewToRequest ?? 0) : 0,
        requestToConfirmed: rates ? Number(rates.requestToConfirmed ?? 0) : 0,
        confirmedToCompleted: rates ? Number(rates.confirmedToCompleted ?? 0) : 0,
        overall: rates ? Number(rates.overall ?? 0) : 0,
      },
    };
  }

  return null;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  subValue,
  accent = 'coral',
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  accent?: 'coral' | 'gold' | 'sage' | 'rose';
  to?: string;
}) {
  const accents = {
    coral: 'from-nilin-rose/20 to-nilin-coral/10 text-nilin-coral',
    gold: 'from-amber-100/80 to-nilin-gold/20 text-amber-800',
    sage: 'from-emerald-100/80 to-nilin-sage/20 text-emerald-800',
    rose: 'from-nilin-blush to-nilin-rose/20 text-nilin-charcoal',
  };

  const content = (
    <>
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-serif font-semibold text-nilin-charcoal">{value}</p>
      <p className="text-sm font-semibold text-nilin-charcoal/80 font-sans mt-1">{label}</p>
      {subValue && <p className="text-xs font-medium text-nilin-warmGray mt-1.5 font-sans">{subValue}</p>}
      {to && (
        <p className="text-xs font-medium text-nilin-coral mt-2 font-sans flex items-center gap-0.5">
          View details <ChevronRight className="w-3 h-3" />
        </p>
      )}
    </>
  );

  const className =
    'glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d p-5 block transition-all hover:border-nilin-coral/50 hover:shadow-nilin-warm';

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d overflow-hidden ${className}`}
    >
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-nilin-border/40">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">{title}</h2>
          {subtitle && <p className="text-sm text-nilin-warmGray font-sans mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const QUICK_ACTIONS = [
  { title: 'Reports & Analytics', description: 'Revenue, bookings, exports', to: '/admin/reports', icon: BarChart3 },
  { title: 'Provider queue', description: 'Pending verifications', to: '/admin/providers?tab=pending', icon: Shield },
  { title: 'Payouts', description: 'Provider withdrawals', to: '/admin/payouts', icon: Wallet },
  { title: 'Churn & Retention', description: 'At-risk customers', to: '/admin/churn', icon: TrendingDown },
  { title: 'Categories', description: 'Service taxonomy', to: '/admin/categories', icon: Layers },
  { title: 'Offers', description: 'Promotions & campaigns', to: '/admin/offers', icon: Gift },
  { title: 'Coupons', description: 'Discount codes', to: '/admin/coupons', icon: Ticket },
  { title: 'Reviews', description: 'Moderate feedback', to: '/admin/reviews', icon: Star },
  { title: 'Settings', description: 'Platform configuration', to: '/admin/settings', icon: Settings },
];

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeProviders: 0,
    todayBookings: 0,
    revenue: 0,
    pendingVerifications: 0,
    activeIncidents: 0,
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [bookingsAllTime, setBookingsAllTime] = useState<BookingsSummary | null>(null);
  const [churnData, setChurnData] = useState<ChurnData | null>(null);
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [geographicData, setGeographicData] = useState<GeographicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const fetchDashboardData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      if (showRefresh) {
        try {
          await authService.post('/analytics/refresh');
        } catch {
          // Non-blocking cache clear
        }
      }

      const [statsRes, overviewMonthRes, overviewAllRes, churnRes, funnelRes, geoRes] =
        await Promise.allSettled([
          api.get('/admin/stats'),
          api.get('/analytics/overview', { params: { period: 'month' } }),
          api.get('/analytics/overview', { params: { period: 'all' } }),
          api.get('/admin/churn/stats'),
          api.get('/analytics/funnel', { params: ANALYTICS_RANGE }),
          api.get('/analytics/geographic', { params: ANALYTICS_RANGE }),
        ]);

      if (statsRes.status === 'fulfilled' && statsRes.value.status === 200) {
        const response = statsRes.value.data;
        if (response?.success && response.data) {
          const data = response.data as AdminStatsResponse;
          setStats({
            totalUsers: data.totalUsers || data.customers?.total || 0,
            activeProviders: data.activeProviders || data.providers?.active || 0,
            todayBookings: data.todayBookings || data.bookings?.today || 0,
            revenue: data.monthlyRevenue ?? data.revenue ?? 0,
            pendingVerifications: data.pendingVerifications || data.providers?.pending || 0,
            activeIncidents: data.activeIncidents || 0,
          });
        }
      }

      if (overviewMonthRes.status === 'fulfilled' && overviewMonthRes.value.status === 200) {
        const response = overviewMonthRes.value.data;
        if (response?.success && response.data) {
          setAnalytics(mapOverviewToAnalytics(response.data as Record<string, unknown>));
        }
      }

      if (overviewAllRes.status === 'fulfilled' && overviewAllRes.value.status === 200) {
        const response = overviewAllRes.value.data;
        if (response?.success && response.data) {
          const mapped = mapOverviewToAnalytics(response.data as Record<string, unknown>);
          setBookingsAllTime(mapped.bookings);
        }
      }

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

      if (funnelRes.status === 'fulfilled' && funnelRes.value.status === 200) {
        const response = funnelRes.value.data;
        if (response?.success && response.data) {
          const normalized = normalizeFunnelResponse(response.data);
          if (normalized) setFunnelData(normalized);
        }
      }

      if (geoRes.status === 'fulfilled' && geoRes.value.status === 200) {
        const response = geoRes.value.data;
        const normalized = normalizeGeographicResponse(response);
        if (normalized) {
          setGeographicData(normalized);
        }
      }

      setLastUpdated(new Date());
      if (showRefresh) toast.success('Dashboard updated');
    } catch {
      toast.error('Failed to refresh dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    unsubscribers.push(
      socketService.onNewProviderSubmission((data) => {
        setStats((prev) => ({ ...prev, pendingVerifications: prev.pendingVerifications + 1 }));
        setNotifications((prev) => [
          {
            id: `provider-${data.providerId}-${Date.now()}`,
            type: 'provider',
            message: `New provider submission from ${data.providerName}`,
            timestamp: new Date(),
          },
          ...prev,
        ]);
      })
    );

    unsubscribers.push(
      socketService.onNewServicePending((data: any) => {
        const serviceId = data.serviceId || data._id;
        const serviceName = data.serviceName || data.name;
        setNotifications((prev) => [
          {
            id: `service-${serviceId}-${Date.now()}`,
            type: 'service',
            message: `New pending service: ${serviceName}`,
            timestamp: new Date(),
          },
          ...prev,
        ]);
      })
    );

    unsubscribers.push(
      socketService.onNewDispute((data) => {
        setStats((prev) => ({ ...prev, activeIncidents: prev.activeIncidents + 1 }));
        setNotifications((prev) => [
          {
            id: `dispute-${data.disputeId}-${Date.now()}`,
            type: 'dispute',
            message: `New dispute #${data.disputeNumber}: ${data.category}`,
            timestamp: new Date(),
          },
          ...prev,
        ]);
      })
    );

    unsubscribers.push(
      socketService.onNewWithdrawalRequest((data) => {
        setNotifications((prev) => [
          {
            id: `withdrawal-${data.withdrawalId}-${Date.now()}`,
            type: 'withdrawal',
            message: `Withdrawal from ${data.providerName}: ${data.currency} ${data.amount.toFixed(2)}`,
            timestamp: new Date(),
          },
          ...prev,
        ]);
      })
    );

    socketService.connect().catch((error) => {
      console.warn('Socket connection failed:', error);
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  }, []);

  const funnelChartData = useMemo(() => {
    if (funnelData) {
      const stages = [
        { stage: 'Views', count: funnelData.views },
        { stage: 'Search', count: funnelData.search },
        { stage: 'Service view', count: funnelData.service_view },
        { stage: 'Request', count: funnelData.booking_request },
        { stage: 'Confirmed', count: funnelData.booking_confirmed },
        { stage: 'Completed', count: funnelData.booking_completed },
      ];
      if (stages.some((s) => s.count > 0)) return stages;
    }

    if (analytics?.bookings) {
      const { total, completed, pending, cancelled } = analytics.bookings;
      if (total > 0) {
        return [
          { stage: 'Total', count: total },
          { stage: 'Completed', count: completed },
          { stage: 'Pending', count: pending },
          { stage: 'Cancelled', count: cancelled },
        ];
      }
    }

    return [];
  }, [funnelData, analytics]);

  // Primary source: stats.revenue (from /admin/stats), fallback: analytics.revenue.thisMonth (from /analytics/overview)
  const revenueThisMonth = stats.revenue > 0 ? stats.revenue : (analytics?.revenue?.thisMonth ?? 0);
  const revenueLastMonth = analytics?.revenue?.lastMonth ?? 0;
  const growth = analytics?.revenue?.monthOverMonthGrowth;
  const approvedProviders = Math.max(
    stats.activeProviders,
    analytics?.providers.active ?? 0
  );
  const allTimeBookingsTotal =
    bookingsAllTime?.total ?? geographicData?.summary?.totalBookings ?? analytics?.bookings.total ?? 0;
  const monthBookingsTotal = analytics?.bookings.total ?? 0;
  const showHistoricalContext =
    revenueThisMonth === 0 && revenueLastMonth > 0 && monthBookingsTotal === 0 && allTimeBookingsTotal > 0;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {lastUpdated && (
        <span className="text-xs text-nilin-warmGray font-sans hidden sm:inline">
          Updated {lastUpdated.toLocaleTimeString('en-AE')}
        </span>
      )}
      <button
        type="button"
        onClick={() => fetchDashboardData(true)}
        disabled={refreshing}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl glass glass-blur border border-nilin-border/50 text-nilin-charcoal text-sm font-sans hover:bg-nilin-blush/40 transition-all disabled:opacity-50"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
      <Link
        to="/admin/reports"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm btn-3d hover:opacity-95"
      >
        <BarChart3 className="w-4 h-4" />
        Full reports
      </Link>
    </div>
  );

  if (loading) {
    return (
      <AdminPageShell
        wideLayout
        title="Operations Dashboard"
        subtitle="Real-time platform health and admin actions"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Operations', current: true },
        ]}
        headerActions={headerActions}
        pendingVerifications={stats.pendingVerifications}
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-48 rounded-2xl" />
          <div className="grid lg:grid-cols-2 gap-6">
            <Skeleton className="h-72 rounded-2xl" />
            <Skeleton className="h-72 rounded-2xl" />
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <PageErrorBoundary pageName="AdminDashboard">
    <AdminPageShell
      wideLayout
      title="Operations Dashboard"
      subtitle="Monitor bookings, revenue, risk, and take action across the platform"
      breadcrumbItems={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Operations', current: true },
      ]}
      headerActions={headerActions}
      pendingVerifications={stats.pendingVerifications}
    >
      <div className="space-y-6">
          {/* Priority alerts */}
          {(stats.pendingVerifications > 0 || stats.activeIncidents > 0) && (
            <div className="space-y-3">
              {stats.pendingVerifications > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50 to-nilin-blush/30 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="font-medium text-nilin-charcoal font-sans">
                        {stats.pendingVerifications} provider{stats.pendingVerifications !== 1 ? 's' : ''} awaiting verification
                      </p>
                      <p className="text-sm text-nilin-warmGray font-sans">Review applications before they go live</p>
                    </div>
                  </div>
                  <Link
                    to="/admin/providers?tab=pending"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-nilin-coral hover:text-nilin-rose font-sans whitespace-nowrap"
                  >
                    Review queue <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
              {stats.activeIncidents > 0 && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-200/80 bg-red-50/80 px-5 py-4">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-red-900 font-sans">
                    {stats.activeIncidents} active incident{stats.activeIncidents !== 1 ? 's' : ''} need attention
                  </p>
                </div>
              )}
            </div>
          )}

          {showHistoricalContext && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/80 px-5 py-4">
              <p className="text-sm font-medium text-sky-900">Historical activity, quiet this month</p>
              <p className="text-sm text-sky-800 mt-1">
                {formatAED(revenueLastMonth)} was earned last month and {allTimeBookingsTotal.toLocaleString()}{' '}
                booking{allTimeBookingsTotal !== 1 ? 's' : ''} exist platform-wide, but nothing is scheduled for this
                calendar month yet. Month KPIs show 0; geographic and funnel reflect longer windows.
              </p>
              <Link
                to="/admin/reports?tab=bookings&period=all"
                className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-sky-700 hover:text-sky-900"
              >
                View all-time reports <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* Primary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Users}
              label="Total users"
              value={(stats.totalUsers || analytics?.customers.total || 0).toLocaleString()}
              subValue={analytics ? `${analytics.customers.active} active customers` : undefined}
              accent="rose"
              to="/admin/reports"
            />
            <KpiCard
              icon={CheckCircle}
              label="Approved providers"
              value={approvedProviders.toLocaleString()}
              subValue={
                stats.pendingVerifications > 0
                  ? `${stats.pendingVerifications} awaiting verification`
                  : analytics
                    ? `${analytics.providers.newThisMonth} new this month`
                    : undefined
              }
              accent="sage"
              to={stats.pendingVerifications > 0 ? '/admin/providers?tab=pending' : '/admin/providers'}
            />
            <KpiCard
              icon={Calendar}
              label="Today's bookings"
              value={stats.todayBookings.toLocaleString()}
              subValue={
                monthBookingsTotal > 0
                  ? `${monthBookingsTotal} created this month`
                  : allTimeBookingsTotal > 0
                    ? `${allTimeBookingsTotal} all-time · none today`
                    : 'No bookings yet'
              }
              accent="coral"
              to="/admin/reports?tab=bookings"
            />
            <KpiCard
              icon={DollarSign}
              label="Revenue this month"
              value={formatAED(revenueThisMonth)}
              subValue={formatRevenueGrowthSub(revenueThisMonth, revenueLastMonth, growth)}
              accent="gold"
              to="/admin/reports?tab=revenue"
            />
          </div>

          {/* Secondary metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={TrendingDown}
              label="At-risk customers"
              value={churnData?.totalAtRisk ?? 0}
              subValue={`Churn rate ${(churnData?.churnRate ?? 0).toFixed(1)}%`}
              accent="rose"
              to="/admin/churn"
            />
            <KpiCard
              icon={Calendar}
              label="Bookings (all time)"
              value={allTimeBookingsTotal}
              subValue={`${monthBookingsTotal} this month · ${bookingsAllTime?.pending ?? analytics?.bookings.pending ?? 0} pending`}
              accent="coral"
              to="/admin/reports?tab=bookings&period=all"
            />
            <KpiCard
              icon={TrendingUp}
              label="Funnel conversion"
              value={`${(funnelData?.conversionRates?.overall ?? 0).toFixed(1)}%`}
              subValue="View to completed booking"
              accent="gold"
              to="/admin/reports"
            />
            <KpiCard
              icon={MapPin}
              label="Top city"
              value={geographicData?.summary?.topCity || '—'}
              subValue={`${geographicData?.summary?.totalBookings?.toLocaleString() ?? 0} bookings · last 12 months`}
              accent="sage"
              to="/admin/reports?tab=bookings&period=year"
            />
          </div>

          {/* Service Approval Panel */}
          <ServiceApprovalPanel defaultVisible={true} />

          {/* Platform snapshot + live feed */}
          <div className="grid lg:grid-cols-5 gap-6">
            <SectionCard
              title="Platform snapshot"
              subtitle="Growth and supply this month"
              className="lg:col-span-3"
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <SnapshotTile
                  icon={UserPlus}
                  label="New customers"
                  value={analytics?.customers.newThisMonth ?? 0}
                  detail={`${analytics?.customers.total ?? 0} total`}
                />
                <SnapshotTile
                  icon={Building2}
                  label="New providers"
                  value={analytics?.providers.newThisMonth ?? 0}
                  detail={`${analytics?.providers.active ?? 0} active`}
                />
                <SnapshotTile
                  icon={CheckCircle}
                  label="Completed bookings"
                  value={analytics?.bookings.completed ?? 0}
                  detail={`${analytics?.bookings.total ?? 0} this month`}
                />
                <SnapshotTile
                  icon={DollarSign}
                  label="Last month revenue"
                  value={formatAED(analytics?.revenue.lastMonth ?? 0)}
                  detail="Source: analytics overview (period=all)"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Live activity"
              subtitle="Real-time admin alerts"
              className="lg:col-span-2"
              action={
                notifications.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setNotifications([])}
                    className="text-xs text-nilin-coral hover:text-nilin-rose font-sans"
                  >
                    Clear all
                  </button>
                ) : undefined
              }
            >
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="w-10 h-10 text-nilin-border mb-3" />
                  <p className="text-sm text-nilin-warmGray font-sans">No new alerts</p>
                  <p className="text-xs text-nilin-warmGray/80 mt-1 font-sans">Updates appear when providers, disputes, or payouts change</p>
                </div>
              ) : (
                <ul className="space-y-3 max-h-64 overflow-y-auto">
                  {notifications.slice(0, 8).map((n) => (
                    <li key={n.id} className="flex gap-3 text-sm font-sans">
                      <span
                        className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                          n.type === 'provider'
                            ? 'bg-nilin-coral'
                            : n.type === 'service'
                              ? 'bg-emerald-500'
                              : n.type === 'dispute'
                                ? 'bg-red-500'
                                : 'bg-violet-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-nilin-charcoal leading-snug">{n.message}</p>
                        <p className="text-xs text-nilin-warmGray mt-0.5">{n.timestamp.toLocaleTimeString('en-AE')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Churn breakdown */}
          {churnData && (
            <SectionCard title="Churn risk breakdown" subtitle="Customers by risk tier">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <RiskPill level="Critical" count={churnData.byRiskLevel.critical} color="bg-red-100 text-red-800 border-red-200" />
                <RiskPill level="High" count={churnData.byRiskLevel.high} color="bg-orange-100 text-orange-800 border-orange-200" />
                <RiskPill level="Medium" count={churnData.byRiskLevel.medium} color="bg-amber-100 text-amber-800 border-amber-200" />
                <RiskPill level="Low" count={churnData.byRiskLevel.low} color="bg-nilin-blush text-nilin-charcoal border-nilin-border" />
              </div>
              <Link
                to="/admin/churn"
                className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-nilin-coral hover:text-nilin-rose font-sans"
              >
                Open churn dashboard <ChevronRight className="w-4 h-4" />
              </Link>
            </SectionCard>
          )}

          {/* Funnel + Geographic */}
          <div className="grid lg:grid-cols-2 gap-6">
            <SectionCard
              title="Booking funnel"
              subtitle="Marketing funnel (last 12 months) — may differ from booking DB totals"
              action={
                <Link to="/admin/reports" className="text-xs text-nilin-coral hover:text-nilin-rose font-sans">
                  Details
                </Link>
              }
            >
              {funnelChartData.length > 0 && funnelChartData.some((d) => d.count > 0) ? (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={funnelChartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#6B5344' }} />
                        <YAxis type="category" dataKey="stage" width={88} tick={{ fontSize: 11, fill: '#4A3728' }} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid #E8E0D8',
                            fontFamily: 'system-ui',
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                          {funnelChartData.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {funnelData?.conversionRates && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-sans text-nilin-warmGray">
                      <span>View → Search: {(funnelData.conversionRates.viewToSearch ?? 0).toFixed(1)}%</span>
                      <span>Request → Confirmed: {(funnelData.conversionRates.requestToConfirmed ?? 0).toFixed(1)}%</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-nilin-warmGray font-sans py-8 text-center">
                  Funnel data will appear as users browse and book services.
                </p>
              )}
            </SectionCard>

            <SectionCard title="Geographic performance" subtitle="Completed bookings by city (last 12 months)">
              {geographicData?.byCity && geographicData.byCity.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-sans">
                    <thead>
                      <tr className="text-left text-nilin-warmGray border-b border-nilin-border/50">
                        <th className="pb-2 font-medium">City</th>
                        <th className="pb-2 font-medium text-right">Bookings</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                        <th className="pb-2 font-medium text-right">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {geographicData.byCity.slice(0, 6).map((row) => (
                        <tr key={row.city} className="border-b border-nilin-border/30 last:border-0">
                          <td className="py-2.5 text-nilin-charcoal font-medium">{row.city}</td>
                          <td className="py-2.5 text-right text-nilin-warmGray">{row.bookings.toLocaleString()}</td>
                          <td className="py-2.5 text-right text-nilin-warmGray">{formatAED(row.revenue)}</td>
                          <td className="py-2.5 text-right">
                            <span className="inline-block min-w-[3rem] px-2 py-0.5 rounded-full bg-nilin-blush/60 text-nilin-charcoal text-xs">
                              {(row.percentage ?? 0).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-nilin-warmGray font-sans py-8 text-center">
                  No geographic breakdown yet.
                </p>
              )}
            </SectionCard>
          </div>

          {/* Quick actions */}
          <SectionCard title="Quick actions" subtitle="Jump to common admin workflows">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-start gap-3 rounded-xl border border-nilin-border/50 bg-white/40 p-4 hover:border-nilin-coral/40 hover:bg-nilin-blush/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-rose/15 to-nilin-coral/10 flex items-center justify-center flex-shrink-0 group-hover:from-nilin-rose/25 group-hover:to-nilin-coral/20">
                    <action.icon className="w-5 h-5 text-nilin-coral" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-nilin-charcoal text-sm font-sans">{action.title}</p>
                    <p className="text-xs text-nilin-warmGray mt-0.5">{action.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-nilin-border group-hover:text-nilin-coral mt-1 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </SectionCard>

          {/* System strip */}
          <div className="grid sm:grid-cols-3 gap-4">
            <Link
              to="/admin/api-keys"
              className="glass glass-blur rounded-xl border border-nilin-border/50 p-4 flex items-center gap-3 hover:bg-nilin-blush/30 transition-colors"
            >
              <Zap className="w-5 h-5 text-nilin-coral" />
              <div>
                <p className="text-sm font-medium text-nilin-charcoal font-sans">API keys</p>
                <p className="text-xs text-nilin-warmGray">Integrations</p>
              </div>
            </Link>
            <Link
              to="/admin/maintenance"
              className="glass glass-blur rounded-xl border border-nilin-border/50 p-4 flex items-center gap-3 hover:bg-nilin-blush/30 transition-colors"
            >
              <Clock className="w-5 h-5 text-nilin-coral" />
              <div>
                <p className="text-sm font-medium text-nilin-charcoal font-sans">Maintenance</p>
                <p className="text-xs text-nilin-warmGray">Platform mode</p>
              </div>
            </Link>
            <Link
              to="/admin/providers?tab=pending"
              className="glass glass-blur rounded-xl border border-nilin-border/50 p-4 flex items-center gap-3 hover:bg-nilin-blush/30 transition-colors"
            >
              <Shield className="w-5 h-5 text-nilin-coral" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-nilin-charcoal font-sans">Review queue</p>
                <p className="text-xs text-nilin-warmGray">
                  {stats.pendingVerifications > 0
                    ? `${stats.pendingVerifications} awaiting verification`
                    : 'Provider verifications'}
                </p>
              </div>
              {stats.pendingVerifications > 0 && (
                <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold bg-nilin-coral text-white flex items-center justify-center">
                  {stats.pendingVerifications}
                </span>
              )}
            </Link>
          </div>
      </div>
    </AdminPageShell>
    </PageErrorBoundary>
  );
}

function SnapshotTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-nilin-border/40 bg-white/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-nilin-coral" />
        <span className="text-xs font-medium uppercase tracking-wide text-nilin-warmGray font-sans">{label}</span>
      </div>
      <p className="text-xl font-serif text-nilin-charcoal">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-nilin-warmGray mt-1 font-sans">{detail}</p>
    </div>
  );
}

function RiskPill({ level, count, color }: { level: string; count: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-center ${color}`}>
      <p className="text-2xl font-serif font-light">{count}</p>
      <p className="text-xs font-medium font-sans mt-1">{level}</p>
    </div>
  );
}

export default AdminDashboard;
