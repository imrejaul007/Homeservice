/**
 * ServiceAnalytics - Deep dive into per-service performance
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Star,
  Users,
  Clock,
  ChevronDown,
  ChevronRight,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Trophy,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { formatPrice } from '../../lib/utils';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ServicePerformance {
  /** Service ID */
  id: string;
  /** Service name */
  name: string;
  /** Service category */
  category: string;
  /** Total bookings in period */
  totalBookings: number;
  /** Total revenue */
  totalRevenue: number;
  /** Average rating */
  averageRating: number;
  /** Total reviews */
  totalReviews: number;
  /** Completion rate */
  completionRate: number;
  /** Cancellation rate */
  cancellationRate: number;
  /** Average booking value */
  averageBookingValue: number;
  /** Revenue trend (last 7 days) */
  revenueTrend: number[];
  /** Views count */
  views: number;
  /** Conversion rate (views to bookings) */
  conversionRate: number;
  /** Popularity rank */
  rank?: number;
}

export interface ServiceAnalyticsProps {
  /** Service performance data */
  services: ServicePerformance[];
  /** Market average data for comparison */
  marketAverages?: {
    averageRating: number;
    averageRevenue: number;
    averageConversionRate: number;
  };
  /** Loading state */
  isLoading?: boolean;
  /** Callback when service is clicked */
  onServiceClick?: (serviceId: string) => void;
  /** Callback when refreshing */
  onRefresh?: () => void;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

const COLORS = ['#E8B4A8', '#D4A5A0', '#C09590', '#A88580', '#8C7570', '#6B5A55'];

// =============================================================================
// Custom Tooltip Components
// =============================================================================

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
  }>;
  label?: string;
  currency?: string;
}

const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  currency = 'AED',
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-nilin-md border border-nilin-border p-3">
      <p className="text-sm font-medium text-nilin-charcoal mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-nilin-warmGray">{entry.name}:</span>
          <span className="font-medium text-nilin-charcoal">
            {entry.name.toLowerCase().includes('revenue')
              ? formatPrice(entry.value, currency)
              : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Stats Card Component
// =============================================================================

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon,
  trend,
  color = 'coral',
}) => {
  const colorClasses: Record<string, { bg: string; icon: string }> = {
    coral: { bg: 'bg-nilin-coral/10', icon: 'text-nilin-coral' },
    success: { bg: 'bg-green-100', icon: 'text-green-600' },
    warning: { bg: 'bg-amber-100', icon: 'text-amber-600' },
    info: { bg: 'bg-blue-100', icon: 'text-blue-600' },
  };

  const classes = colorClasses[color] || colorClasses.coral;

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-nilin-warmGray">{title}</span>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', classes.bg)}>
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold text-nilin-charcoal">{value}</p>
      {change !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-xs',
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-nilin-warmGray'
          )}
        >
          {trend === 'up' ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : trend === 'down' ? (
            <ArrowDownRight className="w-3 h-3" />
          ) : null}
          <span>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-nilin-lightGray">vs last period</span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Service Ranking Table Component
// =============================================================================

interface RankingTableProps {
  services: ServicePerformance[];
  sortBy: 'revenue' | 'bookings' | 'rating' | 'conversion';
  sortOrder: 'asc' | 'desc';
  onSort: (field: 'revenue' | 'bookings' | 'rating' | 'conversion') => void;
  onServiceClick?: (serviceId: string) => void;
  currency?: string;
}

const RankingTable: React.FC<RankingTableProps> = ({
  services,
  sortBy,
  sortOrder,
  onSort,
  onServiceClick,
  currency = 'AED',
}) => {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronDown className="w-4 h-4 text-nilin-lightGray" />;
    return sortOrder === 'asc' ? (
      <ChevronDown className="w-4 h-4 text-nilin-coral rotate-180" />
    ) : (
      <ChevronDown className="w-4 h-4 text-nilin-coral" />
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-nilin-border">
      <table className="w-full">
        <thead className="bg-nilin-muted/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider w-12">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Service
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider cursor-pointer hover:text-nilin-coral" onClick={() => onSort('revenue')}>
              <div className="flex items-center gap-1">
                Revenue <SortIcon field="revenue" />
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider cursor-pointer hover:text-nilin-coral" onClick={() => onSort('bookings')}>
              <div className="flex items-center gap-1">
                Bookings <SortIcon field="bookings" />
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider cursor-pointer hover:text-nilin-coral" onClick={() => onSort('rating')}>
              <div className="flex items-center gap-1">
                Rating <SortIcon field="rating" />
              </div>
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
              Views
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-nilin-warmGray uppercase tracking-wider cursor-pointer hover:text-nilin-coral" onClick={() => onSort('conversion')}>
              <div className="flex items-center gap-1">
                Conv. <SortIcon field="conversion" />
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-nilin-border">
          {services.map((service, index) => (
            <tr
              key={service.id}
              className="hover:bg-nilin-muted/30 transition-colors cursor-pointer"
              onClick={() => onServiceClick?.(service.id)}
            >
              <td className="px-4 py-3">
                {index === 0 ? (
                  <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-amber-600" />
                  </div>
                ) : index === 1 ? (
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-600">{index + 1}</span>
                  </div>
                ) : index === 2 ? (
                  <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center">
                    <span className="text-xs font-bold text-orange-600">{index + 1}</span>
                  </div>
                ) : (
                  <span className="text-sm text-nilin-warmGray">{index + 1}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-nilin-charcoal">{service.name}</p>
                  <p className="text-xs text-nilin-warmGray">{service.category}</p>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-nilin-charcoal">
                  {formatPrice(service.totalRevenue, currency)}
                </p>
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-nilin-charcoal">{service.totalBookings}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="font-medium text-nilin-charcoal">
                    {service.averageRating.toFixed(1)}
                  </span>
                  <span className="text-xs text-nilin-warmGray">
                    ({service.totalReviews})
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <p className="text-nilin-charcoal">{service.views.toLocaleString()}</p>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-nilin-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nilin-coral rounded-full"
                      style={{ width: `${Math.min(service.conversionRate * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-nilin-charcoal w-12 text-right">
                    {(service.conversionRate * 100).toFixed(1)}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =============================================================================
// Revenue Comparison Chart Component
// =============================================================================

interface RevenueChartProps {
  services: ServicePerformance[];
  marketAverage?: number;
  currency?: string;
}

const RevenueChart: React.FC<RevenueChartProps> = ({
  services,
  marketAverage,
  currency = 'AED',
}) => {
  const data = useMemo(() => {
    return services
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map((s) => ({
        name: s.name.length > 15 ? s.name.substring(0, 15) + '...' : s.name,
        fullName: s.name,
        revenue: s.totalRevenue,
        bookings: s.totalBookings,
      }));
  }, [services]);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 100, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B6B6B', fontSize: 12 }}
            tickFormatter={(value) => `${value / 1000}k`}
          />
          <YAxis
            type="category"
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B6B6B', fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip currency={currency} />} />
          <Bar
            dataKey="revenue"
            name="Revenue"
            fill="#E8B4A8"
            radius={[0, 4, 4, 0]}
            barSize={24}
          />
          {marketAverage && (
            <Line
              type="monotone"
              dataKey={() => marketAverage}
              stroke="#94A3B8"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Market Avg"
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// =============================================================================
// Category Distribution Component
// =============================================================================

interface CategoryChartProps {
  services: ServicePerformance[];
}

const CategoryChart: React.FC<CategoryChartProps> = ({ services }) => {
  const data = useMemo(() => {
    const categoryMap = new Map<string, { revenue: number; bookings: number }>();
    services.forEach((s) => {
      const existing = categoryMap.get(s.category) || { revenue: 0, bookings: 0 };
      categoryMap.set(s.category, {
        revenue: existing.revenue + s.totalRevenue,
        bookings: existing.bookings + s.totalBookings,
      });
    });

    return Array.from(categoryMap.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [services]);

  return (
    <div className="flex items-center gap-4">
      <div className="w-48 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-sm text-nilin-charcoal">{item.name}</span>
            </div>
            <span className="text-sm font-medium text-nilin-charcoal">
              {formatPrice(item.revenue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Service Comparison Table Component
// =============================================================================

interface ComparisonTableProps {
  services: ServicePerformance[];
  marketAverages?: ServiceAnalyticsProps['marketAverages'];
  currency?: string;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  services,
  marketAverages,
  currency = 'AED',
}) => {
  const topServices = services.slice(0, 5);

  return (
    <div className="space-y-3">
      {topServices.map((service) => (
        <div
          key={service.id}
          className="bg-nilin-muted/30 rounded-lg p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-nilin-charcoal">{service.name}</p>
            <span className="text-xs text-nilin-warmGray">{service.category}</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">vs Market Avg</p>
              <div className="flex items-center gap-1">
                {marketAverages && service.averageRating > marketAverages.averageRating ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-nilin-charcoal">
                  {(service.averageRating - (marketAverages?.averageRating || 0)).toFixed(1)}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">Revenue Gap</p>
              <div className="flex items-center gap-1">
                {marketAverages && service.totalRevenue > marketAverages.averageRevenue ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-nilin-charcoal">
                  {formatPrice(Math.abs(service.totalRevenue - (marketAverages?.averageRevenue || 0)))}
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray mb-1">Conversion</p>
              <div className="flex items-center gap-1">
                {marketAverages && service.conversionRate > marketAverages.averageConversionRate ? (
                  <TrendingUp className="w-4 h-4 text-green-600" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-medium text-nilin-charcoal">
                  {((service.conversionRate - (marketAverages?.averageConversionRate || 0)) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ServiceAnalytics: React.FC<ServiceAnalyticsProps> = ({
  services,
  marketAverages,
  isLoading = false,
  onServiceClick,
  onRefresh,
  currency = 'AED',
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'ranking' | 'comparison'>('overview');
  const [sortBy, setSortBy] = useState<'revenue' | 'bookings' | 'rating' | 'conversion'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Calculate totals
  const totals = useMemo(() => {
    return services.reduce(
      (acc, s) => ({
        totalRevenue: acc.totalRevenue + s.totalRevenue,
        totalBookings: acc.totalBookings + s.totalBookings,
        totalViews: acc.totalViews + s.views,
        averageRating:
          acc.averageRating * acc.totalReviews +
          s.averageRating * s.totalReviews,
        totalReviews: acc.totalReviews + s.totalReviews,
      }),
      { totalRevenue: 0, totalBookings: 0, totalViews: 0, averageRating: 0, totalReviews: 0 }
    );
  }, [services]);

  const averageRating = totals.totalReviews > 0 ? totals.averageRating / totals.totalReviews : 0;

  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'revenue':
          comparison = a.totalRevenue - b.totalRevenue;
          break;
        case 'bookings':
          comparison = a.totalBookings - b.totalBookings;
          break;
        case 'rating':
          comparison = a.averageRating - b.averageRating;
          break;
        case 'conversion':
          comparison = a.conversionRate - b.conversionRate;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [services, sortBy, sortOrder]);

  const handleSort = (field: 'revenue' | 'bookings' | 'rating' | 'conversion') => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Service Analytics
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Performance insights for your services
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Revenue"
          value={formatPrice(totals.totalRevenue, currency)}
          icon={<DollarSign className="w-4 h-4 text-nilin-coral" />}
          color="coral"
        />
        <StatsCard
          title="Total Bookings"
          value={totals.totalBookings.toLocaleString()}
          icon={<Calendar className="w-4 h-4 text-green-600" />}
          color="success"
        />
        <StatsCard
          title="Average Rating"
          value={averageRating.toFixed(1)}
          icon={<Star className="w-4 h-4 text-amber-500" />}
          color="warning"
        />
        <StatsCard
          title="Total Views"
          value={totals.totalViews.toLocaleString()}
          icon={<Eye className="w-4 h-4 text-blue-600" />}
          color="info"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6 border-b border-nilin-border">
        {(['overview', 'ranking', 'comparison'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'pb-3 px-1 text-sm font-medium transition-colors capitalize',
              activeTab === tab
                ? 'text-nilin-coral border-b-2 border-nilin-coral'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Revenue Chart */}
          <div className="bg-nilin-muted/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
              Revenue by Service (Top 10)
            </h4>
            <RevenueChart services={services} marketAverage={marketAverages?.averageRevenue} currency={currency} />
          </div>

          {/* Category Distribution */}
          <div className="bg-nilin-muted/30 rounded-xl p-4">
            <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
              Revenue by Category
            </h4>
            <CategoryChart services={services} />
          </div>
        </div>
      )}

      {activeTab === 'ranking' && (
        <RankingTable
          services={sortedServices}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onServiceClick={onServiceClick}
          currency={currency}
        />
      )}

      {activeTab === 'comparison' && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-nilin-charcoal mb-4">
              Your Services vs Market Average
            </h4>
            <ComparisonTable services={services} marketAverages={marketAverages} currency={currency} />
          </div>

          {marketAverages && (
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-medium text-blue-900 mb-2">
                    Market Insights
                  </h5>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>Market average rating: {marketAverages.averageRating.toFixed(1)}</li>
                    <li>Market average revenue: {formatPrice(marketAverages.averageRevenue, currency)}</li>
                    <li>Market average conversion: {(marketAverages.averageConversionRate * 100).toFixed(1)}%</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ServiceAnalytics;
