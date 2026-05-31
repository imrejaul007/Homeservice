/**
 * AITipsAlerts - AI-generated tips and alerts
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Clock,
  Target,
  Star,
  DollarSign,
  Calendar,
  Users,
  CheckCircle,
  Info,
  ChevronRight,
  X,
  Sparkles,
  Bell,
  BellOff,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type TipPriority = 'high' | 'medium' | 'low';
export type TipCategory = 'revenue' | 'efficiency' | 'rating' | 'bookings' | 'general';

export interface AITip {
  /** Unique tip ID */
  id: string;
  /** Tip title */
  title: string;
  /** Detailed description */
  description: string;
  /** Priority level */
  priority: TipPriority;
  /** Category */
  category: TipCategory;
  /** Potential impact (e.g., "up to $500/month") */
  potentialImpact?: string;
  /** Suggested action */
  actionLabel?: string;
  /** Icon to display */
  icon?: React.ElementType;
  /** Whether tip has been read */
  isRead?: boolean;
  /** Whether tip has been dismissed */
  isDismissed?: boolean;
  /** AI confidence score (0-100) */
  confidence?: number;
  /** Time saved (e.g., "2 hours/week") */
  timeSaved?: string;
}

export interface AITipsAlertsProps {
  /** Array of AI tips */
  tips: AITip[];
  /** Loading state */
  isLoading?: boolean;
  /** Maximum tips to show */
  maxVisible?: number;
  /** Callback when tip action is clicked */
  onTipAction?: (tip: AITip) => void;
  /** Callback when tip is dismissed */
  onDismiss?: (tipId: string) => void;
  /** Callback when tip is marked as read */
  onMarkAsRead?: (tipId: string) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Priority Colors and Icons
// =============================================================================

const priorityConfig: Record<
  TipPriority,
  { color: string; bgColor: string; icon: React.ElementType; label: string }
> = {
  high: {
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    icon: AlertTriangle,
    label: 'Important',
  },
  medium: {
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: Info,
    label: 'Suggestion',
  },
  low: {
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
    icon: Lightbulb,
    label: 'Tip',
  },
};

const categoryConfig: Record<
  TipCategory,
  { icon: React.ElementType; color: string }
> = {
  revenue: { icon: DollarSign, color: 'text-green-600' },
  efficiency: { icon: Clock, color: 'text-purple-600' },
  rating: { icon: Star, color: 'text-yellow-600' },
  bookings: { icon: Calendar, color: 'text-blue-600' },
  general: { icon: Sparkles, color: 'text-nilin-coral' },
};

// =============================================================================
// Individual Tip Card
// =============================================================================

interface TipCardProps {
  tip: AITip;
  onAction?: () => void;
  onDismiss?: () => void;
}

const TipCard: React.FC<TipCardProps> = ({ tip, onAction, onDismiss }) => {
  const priority = priorityConfig[tip.priority];
  const category = categoryConfig[tip.category];
  const PriorityIcon = tip.icon || priority.icon;
  const CategoryIcon = category.icon;

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all duration-200',
        priority.bgColor,
        !tip.isRead && 'border-l-4 border-l-nilin-coral'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm">
            <PriorityIcon className={cn('w-5 h-5', priority.color)} />
          </div>
          <div>
            <h4 className="font-semibold text-nilin-charcoal">{tip.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                  priority.color,
                  priority.bgColor
                )}
              >
                <CategoryIcon className="w-3 h-3" />
                {tip.category}
              </span>
              {tip.confidence !== undefined && (
                <span className="text-xs text-nilin-lightGray">
                  {tip.confidence}% confidence
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 text-nilin-lightGray hover:text-nilin-charcoal hover:bg-white/50 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-nilin-warmGray mb-3">{tip.description}</p>

      {/* Impact & Time Saved */}
      {(tip.potentialImpact || tip.timeSaved) && (
        <div className="flex items-center gap-4 mb-3">
          {tip.potentialImpact && (
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-green-700 font-medium">
                {tip.potentialImpact}
              </span>
            </div>
          )}
          {tip.timeSaved && (
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700">{tip.timeSaved} saved</span>
            </div>
          )}
        </div>
      )}

      {/* Action Button */}
      {tip.actionLabel && (
        <button
          onClick={onAction}
          className="w-full py-2.5 rounded-lg bg-white text-nilin-charcoal font-medium text-sm border border-nilin-border hover:bg-nilin-blush transition-colors flex items-center justify-center gap-2"
        >
          <Target className="w-4 h-4" />
          {tip.actionLabel}
          <ChevronRight className="w-4 h-4 ml-auto" />
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Stats Summary Component
// =============================================================================

interface StatsSummaryProps {
  tips: AITip[];
  unreadCount: number;
}

const StatsSummary: React.FC<StatsSummaryProps> = ({ tips, unreadCount }) => {
  const byCategory = tips.reduce(
    (acc, tip) => {
      acc[tip.category] = (acc[tip.category] || 0) + 1;
      return acc;
    },
    {} as Record<TipCategory, number>
  );

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Unread Tips */}
      <div className="bg-nilin-blush rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-nilin-coral" />
          <span className="text-xs text-nilin-warmGray">Unread</span>
        </div>
        <p className="text-2xl font-bold text-nilin-charcoal">{unreadCount}</p>
      </div>

      {/* Actionable */}
      <div className="bg-green-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-green-600" />
          <span className="text-xs text-green-600">Actionable</span>
        </div>
        <p className="text-2xl font-bold text-green-700">
          {tips.filter((t) => t.actionLabel).length}
        </p>
      </div>

      {/* High Priority */}
      <div className="bg-red-50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span className="text-xs text-red-600">High Priority</span>
        </div>
        <p className="text-2xl font-bold text-red-700">
          {tips.filter((t) => t.priority === 'high').length}
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// Empty State
// =============================================================================

const EmptyState: React.FC = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
      <CheckCircle className="w-8 h-8 text-green-600" />
    </div>
    <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
      All caught up!
    </h3>
    <p className="text-sm text-nilin-warmGray">
      No new tips or alerts. Check back later for AI insights.
    </p>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export const AITipsAlerts: React.FC<AITipsAlertsProps> = ({
  tips,
  isLoading = false,
  maxVisible = 5,
  onTipAction,
  onDismiss,
  onMarkAsRead,
  className,
}) => {
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<TipCategory | 'all'>('all');

  const activeTips = tips.filter((t) => !t.isDismissed);
  const unreadCount = activeTips.filter((t) => !t.isRead).length;

  const filteredTips = categoryFilter === 'all'
    ? activeTips
    : activeTips.filter((t) => t.category === categoryFilter);

  const visibleTips = filteredTips.slice(0, maxVisible);

  // Sort by priority and read status
  const sortedTips = [...visibleTips].sort((a, b) => {
    // Unread first
    if (!a.isRead && b.isRead) return -1;
    if (a.isRead && !b.isRead) return 1;
    // Then by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  const handleDismiss = (tipId: string) => {
    onDismiss?.(tipId);
  };

  const handleAction = (tip: AITip) => {
    if (!tip.isRead) {
      onMarkAsRead?.(tip.id);
    }
    onTipAction?.(tip);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              AI Insights
            </h3>
            <p className="text-sm text-nilin-warmGray">
              Smart tips for your business
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
            className="text-sm border border-nilin-border rounded-lg px-3 py-1.5 text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          >
            <option value="all">All Categories</option>
            <option value="revenue">Revenue</option>
            <option value="efficiency">Efficiency</option>
            <option value="rating">Rating</option>
            <option value="bookings">Bookings</option>
            <option value="general">General</option>
          </select>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundsEnabled(!soundsEnabled)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              soundsEnabled
                ? 'bg-nilin-coral/10 text-nilin-coral'
                : 'bg-nilin-muted text-nilin-lightGray'
            )}
            title={soundsEnabled ? 'Notifications on' : 'Notifications off'}
          >
            {soundsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      {activeTips.length > 0 && <StatsSummary tips={activeTips} unreadCount={unreadCount} />}

      {/* Tips List */}
      {sortedTips.length > 0 ? (
        <div className="space-y-4">
          {sortedTips.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              onAction={() => handleAction(tip)}
              onDismiss={() => handleDismiss(tip.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Show More */}
      {filteredTips.length > maxVisible && (
        <div className="mt-6 text-center">
          <button className="text-nilin-coral hover:text-nilin-rose text-sm font-medium transition-colors">
            View all {filteredTips.length} insights
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default AITipsAlerts;
