import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import authService from '../../services/AuthService';
import PageLayout from '../layout/PageLayout';
import {
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  PieChart,
  LineChart,
  ChevronRight,
  Loader2
} from 'lucide-react';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

// Types
type PeriodType = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';
type TabType = 'overview' | 'revenue' | 'bookings' | 'users';

interface AnalyticsOverview {
  bookings: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    pendingBookings: number;
    completionRate: number;
  };
  providers: {
    totalProviders: number;
    activeProviders: number;
    newProvidersThisMonth: number;
  };
  customers: {
    totalCustomers: number;
    activeCustomers: number;
    newCustomersThisMonth: number;
  };
  revenue: {
    totalRevenue: number;
    revenueThisMonth: number;
    revenueLastMonth: number;
    monthOverMonthGrowth: number;
    averageOrderValue: number;
  };
}

interface BookingTrend {
  date: string;
  bookings: number;
  completed: number;
  cancelled: number;
}

interface RevenueTrend {
  date: string;
  revenue: number;
  category: string;
}

interface CategoryRevenue {
  name: string;
  value: number;
  color: string;
}

interface UserGrowth {
  date: string;
  customers: number;
  providers: number;
}

// Chart colors
const CHART_COLORS = ['#E8B4A8', '#C9A87C', '#8B7355', '#6B5344', '#4A3728'];

// Stat Card Component
interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  iconBgColor: string;
  iconTextColor: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  iconBgColor,
  iconTextColor,
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <div className="glass glass-blur overflow-hidden rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d">
        <div className="p-5">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-nilin-blush/30 animate-pulse"></div>
            <div className="ml-5 w-0 flex-1">
              <div className="h-4 bg-nilin-blush/30 rounded w-3/4 mb-2 animate-pulse"></div>
              <div className="h-8 bg-nilin-blush/30 rounded w-1/2 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass glass-blur overflow-hidden rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d">
      <div className="p-5">
        <div className="flex items-center">
          <div className={`w-12 h-12 rounded-xl ${iconBgColor} flex items-center justify-center flex-shrink-0 shimmer`}>
            {icon}
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-nilin-warmGray truncate font-sans">{title}</dt>
              <dd className="text-lg font-serif font-light text-nilin-charcoal">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </dd>
            </dl>
          </div>
        </div>
        {change !== undefined && (
          <div className="mt-3 flex items-center">
            {change >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500 mr-1" />
            )}
            <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change >= 0 ? '+' : ''}{change}%
            </span>
            <span className="text-xs text-nilin-warmGray ml-2 font-sans">vs last period</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Period Selector Component
interface PeriodSelectorProps {
  selected: PeriodType;
  onChange: (period: PeriodType) => void;
  isLoading?: boolean;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ selected, onChange, isLoading }) => {
  const periods: { value: PeriodType; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All Time' }
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {periods.map((period) => (
        <button
          key={period.value}
          onClick={() => onChange(period.value)}
          disabled={isLoading}
          className={`px-4 py-2 rounded-xl text-sm font-medium font-sans transition-all ${
            selected === period.value
              ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-nilin-warm btn-3d'
              : 'glass glass-blur border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/50'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
};

// Tab Navigation Component
interface TabNavProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
  isLoading?: boolean;
}

const TabNav: React.FC<TabNavProps> = ({ activeTab, onChange, isLoading }) => {
  const tabs: { value: TabType; label: string; icon: React.ReactNode }[] = [
    { value: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
    { value: 'revenue', label: 'Revenue', icon: <DollarSign className="h-4 w-4" /> },
    { value: 'bookings', label: 'Bookings', icon: <Calendar className="h-4 w-4" /> },
    { value: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> }
  ];

  return (
    <div className="flex items-center space-x-1 glass glass-blur rounded-xl p-1 border border-nilin-border/50">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          disabled={isLoading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium font-sans transition-all ${
            activeTab === tab.value
              ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-nilin-warm'
              : 'text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/30'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

// Empty State Component
interface EmptyStateProps {
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="w-16 h-16 rounded-full bg-nilin-blush/50 flex items-center justify-center mb-4">
      <BarChart3 className="h-8 w-8 text-nilin-coral" />
    </div>
    <h3 className="text-lg font-serif text-nilin-charcoal mb-2">{title}</h3>
    <p className="text-sm text-nilin-warmGray text-center max-w-md">{description}</p>
  </div>
);

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass glass-blur p-6 rounded-2xl border border-nilin-border/50 animate-pulse">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-nilin-blush/30"></div>
            <div className="ml-5 flex-1">
              <div className="h-4 bg-nilin-blush/30 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-nilin-blush/30 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
    <div className="glass glass-blur p-6 rounded-2xl border border-nilin-border/50 h-80 animate-pulse">
      <div className="h-full bg-nilin-blush/20 rounded"></div>
    </div>
  </div>
);

// Custom Tooltip Component for Charts
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  prefix?: string;
  suffix?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, prefix = '', suffix = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-nilin-border rounded-xl p-3 shadow-lg">
        <p className="text-sm font-medium text-nilin-charcoal mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {prefix}{entry.value?.toLocaleString()}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Pie Charts
interface PieTooltipProps {
  active?: boolean;
  payload?: any[];
}

const PieTooltip: React.FC<PieTooltipProps> = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white/95 backdrop-blur-sm border border-nilin-border rounded-xl p-3 shadow-lg">
        <p className="text-sm font-medium text-nilin-charcoal mb-1">{payload[0].name}</p>
        <p className="text-sm" style={{ color: payload[0].payload.color }}>
          {`AED ${(payload[0].value as number)?.toLocaleString()}`}
        </p>
      </div>
    );
  }
  return null;
};

// Main AdminReports Component
const AdminReports: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // State
  const [period, setPeriod] = useState<PeriodType>('month');
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Data State
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenueByDay, setRevenueByDay] = useState<Array<{ date: string; revenue: number; bookings: number; completed?: number; cancelled?: number }>>([]);
  const [categoryRevenue, setCategoryRevenue] = useState<Array<{ name: string; value: number; percentage: number }>>([]);
  const [customers, setCustomers] = useState<{ totalCustomers: number; activeCustomers: number; newCustomersThisMonth: number } | null>(null);
  const [providers, setProviders] = useState<{ totalProviders: number; activeProviders: number; newProvidersThisMonth: number } | null>(null);

  // Error State
  const [error, setError] = useState<string | null>(null);

  // Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch overview data - this contains all the data we need
      const overviewResponse = await authService.get<{
        success: boolean;
        data: {
          bookings: AnalyticsOverview['bookings'];
          providers: { totalProviders: number; activeProviders: number; newProvidersThisMonth: number };
          customers: { totalCustomers: number; activeCustomers: number; newCustomersThisMonth: number };
          revenue: AnalyticsOverview['revenue'];
        };
      }>(`/analytics/overview?period=${period}`);

      if (overviewResponse.success && overviewResponse.data) {
        setOverview({
          bookings: overviewResponse.data.bookings,
          providers: overviewResponse.data.providers,
          customers: overviewResponse.data.customers,
          revenue: overviewResponse.data.revenue,
        });
        setProviders(overviewResponse.data.providers);
        setCustomers(overviewResponse.data.customers);
      }

      // Fetch revenue data with trends
      const revenueResponse = await authService.get<{
        success: boolean;
        data: {
          revenueByDay: Array<{ date: string; revenue: number; bookings: number; completed?: number; cancelled?: number }>;
          revenueByCategory: Array<{ name: string; value: number; percentage: number }>;
          totalRevenue: number;
          revenueThisMonth: number;
          averageOrderValue: number;
        };
      }>(`/analytics/revenue?period=${period}`);

      if (revenueResponse.success && revenueResponse.data) {
        setRevenueByDay(revenueResponse.data.revenueByDay || []);
        setCategoryRevenue(revenueResponse.data.revenueByCategory || []);
      }
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      // Don't show error for missing data - just log it
      // This allows the page to render with partial data
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // Initial fetch and refetch on period change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle refresh
  const handleRefresh = () => {
    fetchAnalytics();
  };

  // Handle export
  const handleExport = async (type: 'pdf' | 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const response = await authService.get<{
        success: boolean;
        data: unknown;
        metadata?: { recordCount: number };
      }>(`/analytics/export/${type}?period=${period}&format=bookings`);

      if (response.success && response.data) {
        // Backend returns the file directly based on type (csv, json, pdf)
        // For JSON responses, we need to parse and create a downloadable file
        if (type === 'json' || type === 'pdf') {
          // Backend returns JSON data - convert to blob and download
          const jsonStr = JSON.stringify(response.data, null, 2);
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `analytics-report-${period}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        } else if (type === 'csv') {
          // For CSV, backend sends text/csv directly
          // Re-fetch as blob to handle CSV format properly
          const httpClient = authService.getHttpClient();
          const csvResponse = await httpClient.get(`/analytics/export/csv?period=${period}&format=bookings`, {
            responseType: 'blob',
          });
          const blob = new Blob([csvResponse.data], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `analytics-report-${period}.csv`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Render Overview Tab
  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={`AED ${(overview?.revenue.totalRevenue || 0).toLocaleString()}`}
          change={overview?.revenue.monthOverMonthGrowth}
          icon={<DollarSign className="h-6 w-6 text-nilin-coral" />}
          iconBgColor="bg-nilin-coral/20"
          iconTextColor="text-nilin-coral"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Bookings"
          value={overview?.bookings.totalBookings || 0}
          change={Math.round(((overview?.bookings.totalBookings || 0) / Math.max(overview?.bookings.totalBookings || 1, 1) - 1) * 100)}
          icon={<Calendar className="h-6 w-6 text-nilin-rose" />}
          iconBgColor="bg-nilin-rose/20"
          iconTextColor="text-nilin-rose"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Providers"
          value={overview?.providers.activeProviders || 0}
          change={overview?.providers.newProvidersThisMonth}
          icon={<Users className="h-6 w-6 text-green-500" />}
          iconBgColor="bg-green-500/20"
          iconTextColor="text-green-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Completion Rate"
          value={`${Math.round(overview?.bookings.completionRate || 0)}%`}
          icon={<CheckCircle className="h-6 w-6 text-green-500" />}
          iconBgColor="bg-green-500/20"
          iconTextColor="text-green-500"
          isLoading={isLoading}
        />
      </div>

      {/* Mini Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend Mini Chart */}
        <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue Trend</h3>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
          ) : revenueByDay && revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RechartsLineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomTooltip prefix="AED " />} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#E8B4A8"
                  strokeWidth={3}
                  dot={{ fill: '#E8B4A8', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#E8B4A8' }}
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No revenue data"
              description="Revenue data will appear here once bookings are completed."
            />
          )}
        </div>

        {/* Bookings Trend Mini Chart */}
        <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Booking Trends</h3>
          {isLoading ? (
            <div className="h-64 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
          ) : revenueByDay && revenueByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RechartsLineChart data={revenueByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  stroke="#6B7280"
                  fontSize={12}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                  name="Completed"
                />
                <Line
                  type="monotone"
                  dataKey="cancelled"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
                  name="Cancelled"
                />
              </RechartsLineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState
              title="No booking data"
              description="Booking trends will appear here once bookings are made."
            />
          )}
        </div>
      </div>

      {/* Category Distribution */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue by Category</h3>
        {isLoading ? (
          <div className="h-64 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
        ) : categoryRevenue.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie
                  data={categoryRevenue}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  {categoryRevenue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  wrapperStyle={{ paddingLeft: '20px' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center">
              {categoryRevenue.map((cat, index) => (
                <div key={cat.name} className="flex items-center justify-between py-2 border-b border-nilin-border/30 last:border-0">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-3"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    ></div>
                    <span className="text-sm text-nilin-charcoal font-sans">{cat.name}</span>
                  </div>
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">
                    AED {cat.value.toLocaleString()} ({cat.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No category data"
            description="Category breakdown will appear here once you have revenue data."
          />
        )}
      </div>
    </div>
  );

  // Render Revenue Tab
  const renderRevenueTab = () => (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="This Month"
          value={`AED ${(overview?.revenue.revenueThisMonth || 0).toLocaleString()}`}
          icon={<DollarSign className="h-6 w-6 text-nilin-coral" />}
          iconBgColor="bg-nilin-coral/20"
          iconTextColor="text-nilin-coral"
          isLoading={isLoading}
        />
        <StatCard
          title="Last Month"
          value={`AED ${(overview?.revenue.revenueLastMonth || 0).toLocaleString()}`}
          icon={<Calendar className="h-6 w-6 text-nilin-rose" />}
          iconBgColor="bg-nilin-rose/20"
          iconTextColor="text-nilin-rose"
          isLoading={isLoading}
        />
        <StatCard
          title="Average Order Value"
          value={`AED ${(overview?.revenue.averageOrderValue || 0).toLocaleString()}`}
          change={overview?.revenue.monthOverMonthGrowth}
          icon={<TrendingUp className="h-6 w-6 text-green-500" />}
          iconBgColor="bg-green-500/20"
          iconTextColor="text-green-500"
          isLoading={isLoading}
        />
      </div>

      {/* Revenue Chart */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue Over Time</h3>
        {isLoading ? (
          <div className="h-96 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
        ) : revenueByDay && revenueByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsLineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip prefix="AED " />} />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#E8B4A8"
                strokeWidth={3}
                dot={{ fill: '#E8B4A8', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: '#E8B4A8' }}
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No revenue data"
            description="Revenue data will appear here once bookings generate revenue."
          />
        )}
      </div>

      {/* Category Breakdown */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue by Category</h3>
        {isLoading ? (
          <div className="h-96 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
        ) : categoryRevenue.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={categoryRevenue} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                type="number"
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => `AED ${(value / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="name"
                stroke="#6B7280"
                fontSize={12}
                width={120}
              />
              <Tooltip content={<CustomTooltip prefix="AED " />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {categoryRevenue.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No category data"
            description="Category breakdown will appear here once you have revenue data."
          />
        )}
      </div>
    </div>
  );

  // Render Bookings Tab
  const renderBookingsTab = () => (
    <div className="space-y-6">
      {/* Booking Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Bookings"
          value={overview?.bookings.totalBookings || 0}
          icon={<Calendar className="h-6 w-6 text-nilin-coral" />}
          iconBgColor="bg-nilin-coral/20"
          iconTextColor="text-nilin-coral"
          isLoading={isLoading}
        />
        <StatCard
          title="Completed"
          value={overview?.bookings.completedBookings || 0}
          icon={<CheckCircle className="h-6 w-6 text-green-500" />}
          iconBgColor="bg-green-500/20"
          iconTextColor="text-green-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Pending"
          value={overview?.bookings.pendingBookings || 0}
          icon={<Calendar className="h-6 w-6 text-amber-500" />}
          iconBgColor="bg-amber-500/20"
          iconTextColor="text-amber-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Completion Rate"
          value={`${Math.round(overview?.bookings.completionRate || 0)}%`}
          icon={<TrendingUp className="h-6 w-6 text-nilin-rose" />}
          iconBgColor="bg-nilin-rose/20"
          iconTextColor="text-nilin-rose"
          isLoading={isLoading}
        />
      </div>

      {/* Booking Volume Chart */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Booking Volume</h3>
        {isLoading ? (
          <div className="h-96 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
        ) : revenueByDay && revenueByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="bookings" fill="#E8B4A8" radius={[4, 4, 0, 0]} name="Total Bookings" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No booking data"
            description="Booking volume will appear here once bookings are made."
          />
        )}
      </div>

      {/* Booking Trends Chart */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Booking Status Trends</h3>
        {isLoading ? (
          <div className="h-96 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
        ) : revenueByDay && revenueByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <RechartsLineChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={12}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                name="Completed"
              />
              <Line
                type="monotone"
                dataKey="cancelled"
                stroke="#EF4444"
                strokeWidth={2}
                dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
                name="Cancelled"
              />
              <Line
                type="monotone"
                dataKey="bookings"
                stroke="#E8B4A8"
                strokeWidth={3}
                dot={{ fill: '#E8B4A8', strokeWidth: 2, r: 4 }}
                name="Total"
              />
            </RechartsLineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            title="No trend data"
            description="Trend data will appear here as bookings are made and completed."
          />
        )}
      </div>
    </div>
  );

  // Render Users Tab
  const renderUsersTab = () => (
    <div className="space-y-6">
      {/* User Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Total Customers"
          value={overview?.customers.totalCustomers || 0}
          icon={<Users className="h-6 w-6 text-nilin-coral" />}
          iconBgColor="bg-nilin-coral/20"
          iconTextColor="text-nilin-coral"
          isLoading={isLoading}
        />
        <StatCard
          title="Active Customers"
          value={overview?.customers.activeCustomers || 0}
          icon={<CheckCircle className="h-6 w-6 text-green-500" />}
          iconBgColor="bg-green-500/20"
          iconTextColor="text-green-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Total Providers"
          value={overview?.providers.totalProviders || 0}
          icon={<Users className="h-6 w-6 text-nilin-rose" />}
          iconBgColor="bg-nilin-rose/20"
          iconTextColor="text-nilin-rose"
          isLoading={isLoading}
        />
        <StatCard
          title="New This Month"
          value={(overview?.customers.newCustomersThisMonth || 0) + (overview?.providers.newProvidersThisMonth || 0)}
          icon={<TrendingUp className="h-6 w-6 text-green-500" />}
          iconBgColor="bg-green-500/20"
          iconTextColor="text-green-500"
          isLoading={isLoading}
        />
      </div>

      {/* User Stats */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">User Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-nilin-blush/20 rounded-xl">
            <p className="text-2xl font-serif text-nilin-charcoal">
              {customers?.totalCustomers?.toLocaleString() || overview?.customers?.totalCustomers?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-nilin-warmGray mt-1">Total Customers</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-2xl font-serif text-green-600">
              {customers?.activeCustomers?.toLocaleString() || overview?.customers?.activeCustomers?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-nilin-warmGray mt-1">Active Customers</p>
          </div>
          <div className="text-center p-4 bg-nilin-blush/20 rounded-xl">
            <p className="text-2xl font-serif text-nilin-charcoal">
              {providers?.totalProviders?.toLocaleString() || overview?.providers?.totalProviders?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-nilin-warmGray mt-1">Total Providers</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-xl">
            <p className="text-2xl font-serif text-green-600">
              {providers?.activeProviders?.toLocaleString() || overview?.providers?.activeProviders?.toLocaleString() || 0}
            </p>
            <p className="text-sm text-nilin-warmGray mt-1">Active Providers</p>
          </div>
        </div>
      </div>

      {/* Pie Chart for Distribution */}
      <div className="glass glass-blur rounded-2xl border border-nilin-border/50 inner-glow p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Service Category Distribution</h3>
        {isLoading ? (
          <div className="h-64 animate-pulse bg-nilin-blush/20 rounded-xl"></div>
        ) : categoryRevenue && categoryRevenue.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={280}>
              <RechartsPieChart>
                <Pie
                  data={[
                    { name: 'Customers', value: overview?.customers.totalCustomers || 0, color: CHART_COLORS[0] },
                    { name: 'Providers', value: overview?.providers.totalProviders || 0, color: CHART_COLORS[1] }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  nameKey="name"
                >
                  <Cell fill={CHART_COLORS[0]} />
                  <Cell fill={CHART_COLORS[1]} />
                </Pie>
                <Tooltip content={<PieTooltip />} />
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  wrapperStyle={{ paddingLeft: '20px' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="flex flex-col justify-center">
              <div className="flex items-center justify-between py-3 border-b border-nilin-border/30">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: CHART_COLORS[0] }}></div>
                  <span className="text-sm text-nilin-charcoal font-sans">Customers</span>
                </div>
                <span className="text-sm font-medium text-nilin-charcoal font-sans">
                  {(overview?.customers.totalCustomers || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-nilin-border/30">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: CHART_COLORS[1] }}></div>
                  <span className="text-sm text-nilin-charcoal font-sans">Providers</span>
                </div>
                <span className="text-sm font-medium text-nilin-charcoal font-sans">
                  {(overview?.providers.totalProviders || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-3" style={{ backgroundColor: CHART_COLORS[2] }}></div>
                  <span className="text-sm text-nilin-charcoal font-sans">Total</span>
                </div>
                <span className="text-sm font-medium text-nilin-charcoal font-sans">
                  {((overview?.customers.totalCustomers || 0) + (overview?.providers.totalProviders || 0)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No distribution data"
            description="User distribution data will appear here once users join the platform."
          />
        )}
      </div>
    </div>
  );

  return (
    <PageLayout
      title="Admin Reports & Analytics"
      subtitle={`Analytics for ${user?.firstName || 'Admin'}`}
      showBreadcrumb={true}
      breadcrumbItems={[
        { label: 'Dashboard', href: '/admin/dashboard' },
        { label: 'Reports', current: true }
      ]}
      headerActions={
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className={`inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl shadow-sm text-sm font-medium text-nilin-charcoal glass hover:bg-nilin-blush/50 font-sans transition-colors ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <div className="relative group">
            <button
              disabled={isExporting}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-nilin-rose to-nilin-coral hover:shadow-nilin-warm font-sans transition-all btn-3d ${
                isExporting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </button>
            {/* Export Dropdown */}
            <div className="absolute right-0 mt-2 w-40 rounded-xl shadow-lg bg-white border border-nilin-border/50 hidden group-hover:block z-10">
              <div className="py-1">
                <button
                  onClick={() => handleExport('pdf')}
                  className="block w-full text-left px-4 py-2 text-sm text-nilin-charcoal hover:bg-nilin-blush/50 font-sans"
                >
                  Export as PDF
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="block w-full text-left px-4 py-2 text-sm text-nilin-charcoal hover:bg-nilin-blush/50 font-sans"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="block w-full text-left px-4 py-2 text-sm text-nilin-charcoal hover:bg-nilin-blush/50 font-sans"
                >
                  Export as JSON
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {/* Error Alert */}
      {error && (
        <div className="rounded-xl p-4 mb-6 bg-red-50 border border-red-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <TrendingDown className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 font-sans">Error Loading Analytics</h3>
              <p className="text-sm mt-1 text-red-700 font-sans">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Period Selector */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PeriodSelector
          selected={period}
          onChange={setPeriod}
          isLoading={isLoading}
        />
        <TabNav
          activeTab={activeTab}
          onChange={setActiveTab}
          isLoading={isLoading}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'revenue' && renderRevenueTab()}
          {activeTab === 'bookings' && renderBookingsTab()}
          {activeTab === 'users' && renderUsersTab()}
        </>
      )}
    </PageLayout>
  );
};

export default AdminReports;
