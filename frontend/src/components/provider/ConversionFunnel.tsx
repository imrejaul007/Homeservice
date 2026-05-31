/**
 * ConversionFunnel - Conversion funnel visualization
 * Provider Dashboard Component
 */
import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Filter as FunnelIcon,
  Users,
  Eye,
  MessageSquare,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface FunnelStage {
  /** Stage name */
  name: string;
  /** Number of users/prospects at this stage */
  count: number;
  /** Stage icon */
  icon?: React.ElementType;
  /** Color for the stage bar */
  color?: string;
  /** Additional description */
  description?: string;
}

export interface ConversionFunnelData {
  /** All funnel stages in order */
  stages: FunnelStage[];
  /** Conversion rates between stages */
  conversionRates: number[];
  /** Drop-off points */
  dropOffs: number[];
}

export interface ConversionFunnelProps {
  /** Funnel data */
  data: ConversionFunnelData;
  /** Loading state */
  isLoading?: boolean;
  /** Time period label */
  period?: string;
  /** Funnel title */
  title?: string;
  /** Show drop-off indicators */
  showDropOffs?: boolean;
  /** Show percentage labels */
  showPercentages?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when stage is clicked */
  onStageClick?: (stage: FunnelStage, index: number) => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function calculateConversionRate(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to / from) * 100).toFixed(1) as unknown as number;
}

function calculateDropOff(from: number, to: number): number {
  if (from === 0) return 0;
  return ((from - to) / from) * 100;
}

// =============================================================================
// Funnel Stage Bar Component
// =============================================================================

interface FunnelStageBarProps {
  stage: FunnelStage;
  maxCount: number;
  index: number;
  conversionRate?: number;
  dropOff?: number;
  showDropOff: boolean;
  showPercentage: boolean;
  onClick?: () => void;
  isLast: boolean;
}

const FunnelStageBar: React.FC<FunnelStageBarProps> = ({
  stage,
  maxCount,
  index,
  conversionRate,
  dropOff,
  showDropOff,
  showPercentage,
  onClick,
  isLast,
}) => {
  const widthPercentage = (stage.count / maxCount) * 100;
  const StageIcon = stage.icon || Users;

  const stageColors = [
    'bg-nilin-coral',
    'bg-nilin-rose',
    'bg-purple-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-amber-500',
  ];

  const barColor = stage.color || stageColors[index % stageColors.length];

  return (
    <div className="relative">
      <div
        className={cn(
          'flex items-center gap-4 py-3 cursor-pointer group',
          onClick && 'hover:bg-nilin-muted rounded-lg px-2 -mx-2 transition-colors'
        )}
        onClick={onClick}
      >
        {/* Stage Number */}
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-nilin-muted flex items-center justify-center">
          <span className="text-sm font-semibold text-nilin-charcoal">
            {index + 1}
          </span>
        </div>

        {/* Icon & Name */}
        <div className="flex items-center gap-2 w-40 flex-shrink-0">
          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', `${barColor}/10`)}>
            <StageIcon className={cn('w-4 h-4', barColor.replace('bg-', 'text-'))} />
          </div>
          <span className="text-sm font-medium text-nilin-charcoal truncate">
            {stage.name}
          </span>
        </div>

        {/* Funnel Bar */}
        <div className="flex-1 relative">
          <div className="h-10 bg-nilin-muted rounded-lg overflow-hidden">
            <div
              className={cn('h-full rounded-lg transition-all duration-500 group-hover:opacity-80', barColor)}
              style={{ width: `${Math.max(widthPercentage, 5)}%` }}
            />
          </div>

          {/* Count Label inside bar */}
          <div className="absolute inset-0 flex items-center justify-end pr-3">
            <span className="text-sm font-semibold text-white drop-shadow-sm">
              {stage.count.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Percentage */}
        {showPercentage && (
          <div className="w-20 flex-shrink-0 text-right">
            <span className="text-sm font-semibold text-nilin-charcoal">
              {((stage.count / maxCount) * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {/* Arrow */}
        {!isLast && (
          <div className="flex-shrink-0">
            <ArrowRight className="w-4 h-4 text-nilin-lightGray" />
          </div>
        )}
      </div>

      {/* Drop-off Indicator */}
      {showDropOff && dropOff !== undefined && !isLast && (
        <div className="ml-12 mb-4 flex items-center gap-2 text-xs text-red-500">
          <TrendingDown className="w-3 h-3" />
          <span>
            {dropOff.toFixed(1)}% dropped off ({Math.round((dropOff / 100) * stage.count).toLocaleString()} users)
          </span>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Stats Summary Component
// =============================================================================

interface StatsSummaryProps {
  data: ConversionFunnelData;
  maxCount: number;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ data, maxCount }) => {
  const firstStage = data.stages[0];
  const lastStage = data.stages[data.stages.length - 1];
  const overallConversion = calculateConversionRate(firstStage.count, lastStage.count);
  const totalDropOff = calculateDropOff(firstStage.count, lastStage.count);

  // Calculate average conversion rate
  const avgConversionRate =
    data.conversionRates.length > 0
      ? data.conversionRates.reduce((a, b) => a + b, 0) / data.conversionRates.length
      : 0;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Overall Conversion */}
      <div className="bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 rounded-xl p-4 border border-nilin-coral/20">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-4 h-4 text-nilin-coral" />
          <span className="text-xs text-nilin-coral font-medium">Overall Conversion</span>
        </div>
        <p className="text-2xl font-bold text-nilin-charcoal">
          {overallConversion.toFixed(1)}%
        </p>
        <p className="text-xs text-nilin-warmGray mt-1">
          {lastStage.count.toLocaleString()} of {firstStage.count.toLocaleString()}
        </p>
      </div>

      {/* Total Drop-off */}
      <div className="bg-red-50 rounded-xl p-4 border border-red-100">
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className="w-4 h-4 text-red-600" />
          <span className="text-xs text-red-600 font-medium">Total Drop-off</span>
        </div>
        <p className="text-2xl font-bold text-red-700">{totalDropOff.toFixed(1)}%</p>
        <p className="text-xs text-red-600/70 mt-1">
          {(totalDropOff / 100 * firstStage.count).toLocaleString()} users lost
        </p>
      </div>

      {/* Avg Stage Conversion */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <FunnelIcon className="w-4 h-4 text-blue-600" />
          <span className="text-xs text-blue-600 font-medium">Avg Stage Rate</span>
        </div>
        <p className="text-2xl font-bold text-blue-700">{avgConversionRate.toFixed(1)}%</p>
        <p className="text-xs text-blue-600/70 mt-1">Per stage average</p>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const ConversionFunnel: React.FC<ConversionFunnelProps> = ({
  data,
  isLoading = false,
  period = 'Last 30 days',
  title = 'Conversion Funnel',
  showDropOffs = true,
  showPercentages = true,
  className,
  onStageClick,
}) => {
  const maxCount = useMemo(
    () => Math.max(...data.stages.map((s) => s.count), 1),
    [data.stages]
  );

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-nilin-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!data.stages || data.stages.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="text-center py-12">
          <FunnelIcon className="w-12 h-12 text-nilin-lightGray mx-auto mb-4" />
          <p className="text-nilin-warmGray">No funnel data available</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Data will appear once you start getting views and bookings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">{title}</h3>
          <p className="text-sm text-nilin-warmGray">{period}</p>
        </div>
        <FunnelIcon className="w-6 h-6 text-nilin-coral" />
      </div>

      {/* Stats Summary */}
      <StatsSummary data={data} maxCount={maxCount} />

      {/* Funnel Stages */}
      <div className="space-y-1">
        {data.stages.map((stage, index) => (
          <FunnelStageBar
            key={index}
            stage={stage}
            maxCount={maxCount}
            index={index}
            conversionRate={data.conversionRates[index]}
            dropOff={data.dropOffs[index]}
            showDropOff={showDropOffs}
            showPercentage={showPercentages}
            onClick={onStageClick ? () => onStageClick(stage, index) : undefined}
            isLast={index === data.stages.length - 1}
          />
        ))}
      </div>

      {/* Insights */}
      {data.stages.length > 1 && (
        <div className="mt-6 pt-6 border-t border-nilin-border">
          <h4 className="text-sm font-medium text-nilin-charcoal mb-3">
            Key Insights
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {/* Biggest Drop */}
            <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-red-600 font-medium mb-1">Biggest Drop</p>
              <p className="text-sm text-nilin-charcoal">
                {(() => {
                  const maxDropIndex = data.dropOffs.indexOf(
                    Math.max(...data.dropOffs)
                  );
                  if (maxDropIndex >= 0 && maxDropIndex < data.stages.length - 1) {
                    return `${data.stages[maxDropIndex].name} → ${data.stages[maxDropIndex + 1].name}`;
                  }
                  return 'N/A';
                })()}
              </p>
            </div>

            {/* Best Conversion */}
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-green-600 font-medium mb-1">Best Conversion</p>
              <p className="text-sm text-nilin-charcoal">
                {(() => {
                  const maxConvIndex = data.conversionRates.indexOf(
                    Math.max(...data.conversionRates)
                  );
                  if (maxConvIndex >= 0 && maxConvIndex < data.stages.length - 1) {
                    return `${data.stages[maxConvIndex].name} → ${data.stages[maxConvIndex + 1].name}`;
                  }
                  return 'N/A';
                })()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default ConversionFunnel;
