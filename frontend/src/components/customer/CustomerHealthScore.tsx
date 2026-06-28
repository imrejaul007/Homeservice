import React, { useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, Heart, Star, Calendar, CreditCard, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { authService } from '../../services/AuthService';

// =============================================================================
// NILIN Customer Dashboard - Customer Health Score Component
// Displays customer engagement and health metrics
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface CustomerHealthScoreProps {
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Compact mode for dashboard cards */
  compact?: boolean;
  /** Callback when improvement tips are clicked */
  onImproveScore?: () => void;
  /** Additional CSS classes */
  className?: string;
}

interface ScoreMetric {
  id: string;
  label: string;
  description: string;
  value: number;
  maxValue: number;
  weight: number;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: number;
  color: string;
  bgColor: string;
}

interface HealthScoreData {
  overall: number;
  metrics: ScoreMetric[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  insights: string[];
  recommendations: string[];
}

// =============================================================================
// Score Ring Component
// =============================================================================

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  showLabel?: boolean;
  label?: string;
}

const ScoreRing: React.FC<ScoreRingProps> = ({
  score,
  size = 120,
  strokeWidth = 8,
  color = '#E8604C',
  bgColor = '#F5EBE7',
  showLabel = true,
  label,
}) => {
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    // Trigger animation after mount
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (mounted ? (score / 100) * circumference : 0);

  const getScoreColor = (value: number): string => {
    if (value >= 80) return '#22C55E'; // Green
    if (value >= 60) return '#3B82F6'; // Blue
    if (value >= 40) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const displayColor = color || getScoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />

        {/* Progress Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={displayColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>

      {/* Score Label */}
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-nilin-charcoal">
            {mounted ? Math.round(score) : 0}
          </span>
          <span className="text-xs text-nilin-warmGray">out of 100</span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Metric Card Component
// =============================================================================

interface MetricCardProps {
  metric: ScoreMetric;
  compact?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ metric, compact }) => {
  const percentage = (metric.value / metric.maxValue) * 100;

  const getTrendIcon = () => {
    switch (metric.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-nilin-blush/30">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', metric.bgColor)}>
          <span className={metric.color}>{metric.icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-nilin-charcoal truncate">
              {metric.label}
            </span>
            {metric.trend && (
              <span className="flex items-center gap-0.5 text-xs">
                {getTrendIcon()}
                {metric.trendValue !== undefined && (
                  <span className={
                    metric.trend === 'up' ? 'text-green-600' :
                    metric.trend === 'down' ? 'text-red-600' : 'text-gray-500'
                  }>
                    {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : ''}{metric.trendValue}%
                  </span>
                )}
              </span>
            )}
          </div>

          <div className="mt-1 h-1.5 bg-nilin-blush/30 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', metric.color.replace('text-', 'bg-'))}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'bg-white rounded-2xl p-4 border border-nilin-blush/30',
      'hover:shadow-md transition-all'
    )}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', metric.bgColor)}>
            <span className={cn('text-xl', metric.color)}>{metric.icon}</span>
          </div>

          <div>
            <h4 className="font-semibold text-nilin-charcoal">{metric.label}</h4>
            <p className="text-xs text-nilin-warmGray mt-0.5">{metric.description}</p>
          </div>
        </div>

        {metric.trend && (
          <div className={cn(
            'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
            metric.trend === 'up' ? 'bg-green-100 text-green-700' :
            metric.trend === 'down' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {getTrendIcon()}
            {metric.trendValue !== undefined && (
              <span>
                {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : ''}{metric.trendValue}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-sm font-medium text-nilin-charcoal">
            {metric.value} / {metric.maxValue}
          </span>
          <span className="text-sm text-nilin-warmGray">
            {Math.round(percentage)}%
          </span>
        </div>

        <div className="h-3 bg-nilin-blush/30 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', metric.color.replace('text-', 'bg-'))}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Default Health Score (shown while loading)
// =============================================================================

const getDefaultHealthScoreData = (): HealthScoreData => ({
  overall: 0,
  metrics: [
    {
      id: 'booking_frequency',
      label: 'Booking Frequency',
      description: 'How often you book services',
      value: 0,
      maxValue: 10,
      weight: 0.2,
      icon: <Calendar className="h-6 w-6" />,
      trend: 'neutral',
      trendValue: 0,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'satisfaction',
      label: 'Satisfaction Score',
      description: 'Based on your reviews and ratings',
      value: 0,
      maxValue: 10,
      weight: 0.25,
      icon: <Star className="h-6 w-6" />,
      trend: 'neutral',
      trendValue: 0,
      color: 'text-amber-500',
      bgColor: 'bg-amber-50',
    },
    {
      id: 'engagement',
      label: 'Engagement',
      description: 'Recent activity and interaction',
      value: 0,
      maxValue: 10,
      weight: 0.2,
      icon: <Activity className="h-6 w-6" />,
      trend: 'neutral',
      trendValue: 0,
      color: 'text-purple-500',
      bgColor: 'bg-purple-50',
    },
    {
      id: 'payment_history',
      label: 'Payment Reliability',
      description: 'Payment history and disputes',
      value: 10,
      maxValue: 10,
      weight: 0.2,
      icon: <CreditCard className="h-6 w-6" />,
      trend: 'up',
      trendValue: 0,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
    },
    {
      id: 'loyalty',
      label: 'Loyalty Tenure',
      description: 'How long you\'ve been a customer',
      value: 0,
      maxValue: 10,
      weight: 0.15,
      icon: <Heart className="h-6 w-6" />,
      trend: 'neutral',
      trendValue: 0,
      color: 'text-pink-500',
      bgColor: 'bg-pink-50',
    },
  ],
  tier: 'bronze',
  insights: [],
  recommendations: [],
});

// =============================================================================
// Main Component
// =============================================================================

export const CustomerHealthScore: React.FC<CustomerHealthScoreProps> = ({
  showDetails = true,
  compact = false,
  onImproveScore,
  className,
}) => {
  const [mounted, setMounted] = useState(false);
  const [healthData, setHealthData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch health score data from API
  React.useEffect(() => {
    const loadHealthScore = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await authService.get<{ success: boolean; data: HealthScoreData }>('/customers/health-score');

        if (response.success && response.data) {
          // Add icons to metrics from API
          const dataWithIcons: HealthScoreData = {
            ...response.data,
            metrics: response.data.metrics.map((metric) => {
              let icon: React.ReactNode;
              switch (metric.id) {
                case 'booking_frequency':
                  icon = <Calendar className="h-6 w-6" />;
                  break;
                case 'satisfaction':
                  icon = <Star className="h-6 w-6" />;
                  break;
                case 'engagement':
                  icon = <Activity className="h-6 w-6" />;
                  break;
                case 'payment_history':
                  icon = <CreditCard className="h-6 w-6" />;
                  break;
                case 'loyalty':
                  icon = <Heart className="h-6 w-6" />;
                  break;
                default:
                  icon = <Activity className="h-6 w-6" />;
              }

              let color: string;
              let bgColor: string;
              switch (metric.id) {
                case 'booking_frequency':
                  color = 'text-blue-500';
                  bgColor = 'bg-blue-50';
                  break;
                case 'satisfaction':
                  color = 'text-amber-500';
                  bgColor = 'bg-amber-50';
                  break;
                case 'engagement':
                  color = 'text-purple-500';
                  bgColor = 'bg-purple-50';
                  break;
                case 'payment_history':
                  color = 'text-green-500';
                  bgColor = 'bg-green-50';
                  break;
                case 'loyalty':
                  color = 'text-pink-500';
                  bgColor = 'bg-pink-50';
                  break;
                default:
                  color = 'text-gray-500';
                  bgColor = 'bg-gray-50';
              }

              return {
                ...metric,
                icon,
                color,
                bgColor,
              };
            }),
          };

          setHealthData(dataWithIcons);
        } else {
          // Fallback to default data
          setHealthData(getDefaultHealthScoreData());
        }
      } catch (err) {
        console.error('Failed to fetch health score:', err);
        setError('Failed to load health score');
        // Use default data on error
        setHealthData(getDefaultHealthScoreData());
      } finally {
        setLoading(false);
        // Trigger animation after data is loaded
        setTimeout(() => setMounted(true), 100);
      }
    };

    loadHealthScore();
  }, []);

  // Get tier color
  const getTierColor = (tier: HealthScoreData['tier']): string => {
    switch (tier) {
      case 'diamond': return 'text-sky-600 bg-sky-50 border-sky-200';
      case 'platinum': return 'text-slate-700 bg-slate-50 border-slate-300';
      case 'gold': return 'text-yellow-600 bg-yellow-50 border-yellow-400';
      case 'silver': return 'text-gray-600 bg-gray-50 border-gray-300';
      default: return 'text-amber-700 bg-amber-50 border-amber-200';
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-sm border border-nilin-blush/30', className)}>
        <div className="flex flex-col items-center">
          <Skeleton className="w-32 h-32 rounded-full" />
          <Skeleton className="h-6 w-24 mt-4" />
          <Skeleton className="h-4 w-32 mt-2" />
        </div>
      </div>
    );
  }

  // Error State - show with default data
  if (error && !healthData) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-sm border border-nilin-blush/30', className)}>
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="w-12 h-12 text-nilin-warmGray mb-4" />
          <p className="text-nilin-warmGray">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Compact Mode
  if (compact) {
    return (
      <div className={cn(
        'flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm border border-nilin-blush/30',
        className
      )}>
        <ScoreRing score={healthData.overall} size={80} strokeWidth={6} />

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-nilin-charcoal">Health Score</h3>
            <Badge className={getTierColor(healthData.tier)} size="sm">
              {healthData.tier}
            </Badge>
          </div>

          <div className="mt-2 space-y-1">
            {healthData.metrics.slice(0, 3).map((metric) => (
              <MetricCard key={metric.id} metric={metric} compact />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-nilin-blush/30">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Score Ring */}
          <div className="flex-shrink-0">
            <ScoreRing score={mounted ? healthData.overall : 0} size={140} strokeWidth={10} />
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <h2 className="text-2xl font-bold text-nilin-charcoal">
                Customer Health Score
              </h2>
              <Badge className={getTierColor(healthData.tier)}>
                {healthData.tier.charAt(0).toUpperCase() + healthData.tier.slice(1)} Tier
              </Badge>
            </div>

            <p className="text-nilin-warmGray mt-2">
              Based on your booking activity, satisfaction, and engagement
            </p>

            {/* Insights */}
            {healthData.insights.length > 0 && (
              <div className="mt-4 space-y-2">
                {healthData.insights.slice(0, 2).map((insight, index) => (
                  <div
                    key={index}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 text-green-700 text-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {insight}
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <Button
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={onImproveScore}
              leftIcon={<TrendingUp className="h-4 w-4" />}
            >
              Improve Your Score
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      {showDetails && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthData.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </div>
      )}

      {/* Recommendations */}
      {showDetails && healthData.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-200">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-nilin-charcoal">Ways to Improve</h3>
          </div>

          <ul className="space-y-3">
            {healthData.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-amber-300 flex items-center justify-center text-xs font-medium text-amber-600">
                  {index + 1}
                </span>
                <span className="text-sm text-nilin-charcoal">{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default CustomerHealthScore;
