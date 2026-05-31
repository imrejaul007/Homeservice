/**
 * ProfileViewsWidget - Profile views analytics
 * Provider Dashboard Component
 */
import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Heart,
  Share2,
  Bookmark,
  MapPin,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ProfileViewDataPoint {
  date: string;
  views: number;
  uniqueVisitors: number;
}

export interface ProfileViewsData {
  /** Total profile views */
  totalViews: number;
  /** Unique visitors */
  uniqueVisitors: number;
  /** Views trend data */
  trendData: ProfileViewDataPoint[];
  /** Average time on profile (seconds) */
  avgTimeOnProfile: number;
  /** Profile click-through rate */
  clickThroughRate: number;
  /** Search appearances */
  searchAppearances: number;
  /** Favorite adds */
  favoritesAdded: number;
  /** Shares */
  shares: number;
  /** Top locations */
  topLocations: Array<{ location: string; count: number; percentage: number }>;
}

export interface ProfileViewsWidgetProps {
  /** Profile views data */
  data: ProfileViewsData;
  /** Loading state */
  isLoading?: boolean;
  /** Time period label */
  period?: string;
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when widget is clicked */
  onClick?: () => void;
}

// =============================================================================
// Custom Tooltip
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-nilin-md border border-nilin-border p-3">
      <p className="text-sm font-medium text-nilin-charcoal mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-nilin-warmGray capitalize">
            {entry.dataKey === 'views' ? 'Views' : 'Unique'}:
          </span>
          <span className="font-semibold text-nilin-charcoal">
            {entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Mini Stat Card
// =============================================================================

interface MiniStatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  trend?: number;
  color: string;
  bgColor: string;
}

const MiniStatCard: React.FC<MiniStatCardProps> = ({
  icon: Icon,
  label,
  value,
  trend,
  color,
  bgColor,
}) => {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-nilin-charcoal">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-nilin-warmGray mt-1">{label}</p>
    </div>
  );
};

// =============================================================================
// Main Widget Component
// =============================================================================

export const ProfileViewsWidget: React.FC<ProfileViewsWidgetProps> = ({
  data,
  isLoading = false,
  period = 'Last 30 days',
  showDetails = true,
  compact = false,
  className,
  onClick,
}) => {
  const formattedData = useMemo(() => {
    return data.trendData.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data.trendData]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-4" />
          <div className="h-64 bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          'bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border cursor-pointer hover:shadow-nilin-md transition-shadow',
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-nilin-coral" />
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Profile Views</p>
              <p className="text-lg font-bold text-nilin-charcoal">
                {data.totalViews.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <TrendingUp className="w-3 h-3" />
            <span>+12.5%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-6 shadow-nilin-sm',
        onClick && 'cursor-pointer hover:shadow-nilin-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Profile Views
          </h3>
          <p className="text-sm text-nilin-warmGray">{period}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
            <Eye className="w-4 h-4 text-nilin-coral" />
          </div>
          <span className="text-sm text-nilin-warmGray">
            {data.totalViews.toLocaleString()} total
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MiniStatCard
          icon={Eye}
          label="Total Views"
          value={data.totalViews}
          trend={12.5}
          color="text-nilin-coral"
          bgColor="bg-nilin-coral/10"
        />
        <MiniStatCard
          icon={Users}
          label="Unique Visitors"
          value={data.uniqueVisitors}
          trend={8.3}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <MiniStatCard
          icon={Clock}
          label="Avg. Time"
          value={`${Math.floor(data.avgTimeOnProfile / 60)}m ${data.avgTimeOnProfile % 60}s`}
          trend={15.2}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
        <MiniStatCard
          icon={ArrowUpRight}
          label="Click Rate"
          value={`${data.clickThroughRate.toFixed(1)}%`}
          trend={-2.1}
          color="text-amber-600"
          bgColor="bg-amber-50"
        />
      </div>

      {/* Chart */}
      {showDetails && (
        <>
          <div className="h-48 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={formattedData}>
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E8B4A8" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#E8B4A8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B6B6B', fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#6B6B6B', fontSize: 11 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#E8B4A8"
                  strokeWidth={2}
                  fill="url(#viewsGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Additional Stats */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-nilin-border">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-nilin-coral mb-1">
                <Heart className="w-4 h-4" />
                <span className="text-lg font-bold text-nilin-charcoal">
                  {data.favoritesAdded}
                </span>
              </div>
              <p className="text-xs text-nilin-warmGray">Favorited</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <Share2 className="w-4 h-4" />
                <span className="text-lg font-bold text-nilin-charcoal">
                  {data.shares}
                </span>
              </div>
              <p className="text-xs text-nilin-warmGray">Shares</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                <Bookmark className="w-4 h-4" />
                <span className="text-lg font-bold text-nilin-charcoal">
                  {data.searchAppearances}
                </span>
              </div>
              <p className="text-xs text-nilin-warmGray">In Searches</p>
            </div>
          </div>

          {/* Top Locations */}
          {data.topLocations.length > 0 && (
            <div className="mt-6 pt-6 border-t border-nilin-border">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-nilin-warmGray" />
                <span className="text-sm font-medium text-nilin-charcoal">
                  Top Locations
                </span>
              </div>
              <div className="space-y-2">
                {data.topLocations.slice(0, 3).map((loc, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-nilin-warmGray">{loc.location}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-nilin-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-nilin-coral rounded-full"
                          style={{ width: `${loc.percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-nilin-charcoal w-8 text-right">
                        {loc.percentage}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ProfileViewsWidget;
