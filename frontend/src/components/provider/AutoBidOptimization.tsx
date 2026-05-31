/**
 * Auto-Bid Optimization - Automated bidding rules and performance tracking
 * Provider Dashboard Component
 */
import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Zap,
  Settings,
  Plus,
  Minus,
  Trash2,
  Save,
  RotateCcw,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  Clock,
  BarChart3,
  Eye,
  EyeOff,
  ToggleLeft,
  ToggleRight,
  DollarSignIcon,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// =============================================================================
// Type Definitions
// =============================================================================

export interface BidRule {
  id: string;
  name: string;
  description: string;
  /** Minimum price to bid */
  minPrice: number;
  /** Maximum price to bid */
  maxPrice: number;
  /** Maximum daily budget */
  dailyBudget: number;
  /** Enable/disable rule */
  isActive: boolean;
  /** Conditions for rule activation */
  conditions: {
    /** Minimum customer rating */
    minCustomerRating?: number;
    /** Service categories this applies to */
    categories?: string[];
    /** Time of day (hour) */
    timeSlots?: number[];
    /** Distance range */
    maxDistance?: number;
  };
  /** Auto-adjust settings */
  autoAdjust: {
    enabled: boolean;
    /** Performance threshold to trigger adjustment */
    performanceThreshold: number;
    /** Adjustment percentage */
    adjustmentPercent: number;
    /** Days to evaluate performance */
    evaluationDays: number;
  };
}

export interface BidPerformance {
  date: string;
  bids: number;
  wins: number;
  spending: number;
  conversionRate: number;
}

export interface AutoBidSettings {
  /** Enable auto-bidding globally */
  isEnabled: boolean;
  /** Default bid rules */
  rules: BidRule[];
  /** Daily spending limit */
  dailySpendingLimit: number;
  /** Pause bidding when balance below */
  pauseWhenBalanceBelow: number;
}

export interface AutoBidOptimizationProps {
  /** Current settings */
  settings: AutoBidSettings;
  /** Performance history */
  performance: BidPerformance[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when settings are saved */
  onSave: (settings: AutoBidSettings) => Promise<void>;
  /** Callback when rule is added/removed */
  onUpdateRules?: (rules: BidRule[]) => Promise<void>;
  /** Callback to refresh data */
  onRefresh?: () => void;
  /** Current balance */
  currentBalance?: number;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Default Settings
// =============================================================================

export const DEFAULT_BID_SETTINGS: AutoBidSettings = {
  isEnabled: false,
  rules: [],
  dailySpendingLimit: 100,
  pauseWhenBalanceBelow: 50,
};

// =============================================================================
// Rule Card Component
// =============================================================================

interface RuleCardProps {
  rule: BidRule;
  onUpdate: (rule: BidRule) => void;
  onDelete: () => void;
  currency?: string;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, onUpdate, onDelete, currency = 'AED' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleActive = () => {
    onUpdate({ ...rule, isActive: !rule.isActive });
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border overflow-hidden transition-all',
        rule.isActive ? 'border-nilin-coral/30' : 'border-nilin-border opacity-75'
      )}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleActive}
            className={cn(
              'w-10 h-6 rounded-full flex items-center transition-colors',
              rule.isActive ? 'bg-nilin-coral' : 'bg-nilin-border'
            )}
          >
            <span
              className={cn(
                'w-4 h-4 rounded-full bg-white shadow transition-transform mx-1',
                rule.isActive && 'translate-x-4'
              )}
            />
          </button>
          <div>
            <h4 className="font-medium text-nilin-charcoal">{rule.name}</h4>
            <p className="text-xs text-nilin-warmGray">{rule.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'px-2 py-1 rounded-full text-xs font-medium',
              rule.isActive
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {rule.isActive ? 'Active' : 'Paused'}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 pb-3 flex items-center gap-6">
        <div>
          <p className="text-xs text-nilin-warmGray">Bid Range</p>
          <p className="text-sm font-medium text-nilin-charcoal">
            {new Intl.NumberFormat('en-AE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(rule.minPrice)} -{' '}
            {new Intl.NumberFormat('en-AE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(rule.maxPrice)}
          </p>
        </div>
        <div>
          <p className="text-xs text-nilin-warmGray">Daily Budget</p>
          <p className="text-sm font-medium text-nilin-charcoal">
            {new Intl.NumberFormat('en-AE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(rule.dailyBudget)}
          </p>
        </div>
        <div>
          <p className="text-xs text-nilin-warmGray">Auto-Adjust</p>
          <p className="text-sm font-medium text-nilin-charcoal">
            {rule.autoAdjust.enabled ? `${rule.autoAdjust.adjustmentPercent}%` : 'Off'}
          </p>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-nilin-border pt-4 space-y-4">
          {/* Conditions */}
          <div>
            <h5 className="text-xs font-semibold text-nilin-charcoal mb-2">Conditions</h5>
            <div className="flex flex-wrap gap-2">
              {rule.conditions.minCustomerRating && (
                <span className="px-2 py-1 bg-nilin-muted rounded text-xs text-nilin-charcoal">
                  Min Rating: {rule.conditions.minCustomerRating}+
                </span>
              )}
              {rule.conditions.maxDistance && (
                <span className="px-2 py-1 bg-nilin-muted rounded text-xs text-nilin-charcoal">
                  Max Distance: {rule.conditions.maxDistance}km
                </span>
              )}
              {rule.conditions.categories && rule.conditions.categories.length > 0 && (
                <span className="px-2 py-1 bg-nilin-muted rounded text-xs text-nilin-charcoal">
                  {rule.conditions.categories.length} categories
                </span>
              )}
              {rule.conditions.timeSlots && rule.conditions.timeSlots.length > 0 && (
                <span className="px-2 py-1 bg-nilin-muted rounded text-xs text-nilin-charcoal">
                  {rule.conditions.timeSlots.length} time slots
                </span>
              )}
              {!rule.conditions.minCustomerRating &&
                !rule.conditions.maxDistance &&
                (!rule.conditions.categories || rule.conditions.categories.length === 0) &&
                (!rule.conditions.timeSlots || rule.conditions.timeSlots.length === 0) && (
                  <span className="text-xs text-nilin-warmGray">No conditions set</span>
                )}
            </div>
          </div>

          {/* Auto-Adjust Settings */}
          <div>
            <h5 className="text-xs font-semibold text-nilin-charcoal mb-2">Auto-Adjust Settings</h5>
            {rule.autoAdjust.enabled ? (
              <div className="bg-green-50 rounded-lg p-3 text-sm">
                <p className="text-green-800">
                  Adjust by {rule.autoAdjust.adjustmentPercent}% when performance drops below{' '}
                  {rule.autoAdjust.performanceThreshold}% over {rule.autoAdjust.evaluationDays} days
                </p>
              </div>
            ) : (
              <p className="text-xs text-nilin-warmGray">Auto-adjust disabled</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Add Rule Modal Component
// =============================================================================

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Omit<BidRule, 'id'>) => void;
  categories?: string[];
}

const AddRuleModal: React.FC<AddRuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  categories = [],
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minPrice, setMinPrice] = useState(50);
  const [maxPrice, setMaxPrice] = useState(150);
  const [dailyBudget, setDailyBudget] = useState(50);
  const [minCustomerRating, setMinCustomerRating] = useState<number | undefined>(undefined);
  const [maxDistance, setMaxDistance] = useState<number | undefined>(undefined);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(true);
  const [adjustmentPercent, setAdjustmentPercent] = useState(10);
  const [performanceThreshold, setPerformanceThreshold] = useState(30);

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      description: description.trim(),
      minPrice,
      maxPrice,
      dailyBudget,
      isActive: true,
      conditions: {
        minCustomerRating,
        maxDistance,
      },
      autoAdjust: {
        enabled: autoAdjustEnabled,
        performanceThreshold,
        adjustmentPercent,
        evaluationDays: 7,
      },
    });

    // Reset form
    setName('');
    setDescription('');
    setMinPrice(50);
    setMaxPrice(150);
    setDailyBudget(50);
    setMinCustomerRating(undefined);
    setMaxDistance(undefined);
    setAutoAdjustEnabled(true);
    setAdjustmentPercent(10);
    setPerformanceThreshold(30);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Create Bid Rule
            </h3>
            <button
              onClick={onClose}
              className="p-2 text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Rule Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Premium Customers"
                className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this rule"
                className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Min Bid Price
                </label>
                <div className="relative">
                  <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(parseInt(e.target.value, 10) || 0)}
                    min={0}
                    className="w-full pl-9 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Max Bid Price
                </label>
                <div className="relative">
                  <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(parseInt(e.target.value, 10) || 0)}
                    min={minPrice}
                    className="w-full pl-9 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>
              </div>
            </div>

            {/* Daily Budget */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Daily Budget
              </label>
              <div className="relative">
                <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                <input
                  type="number"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(parseInt(e.target.value, 10) || 0)}
                  min={0}
                  className="w-full pl-9 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Min Customer Rating
                </label>
                <select
                  value={minCustomerRating ?? ''}
                  onChange={(e) => setMinCustomerRating(e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                >
                  <option value="">Any rating</option>
                  <option value="3">3+ stars</option>
                  <option value="4">4+ stars</option>
                  <option value="4.5">4.5+ stars</option>
                  <option value="4.8">4.8+ stars</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                  Max Distance (km)
                </label>
                <input
                  type="number"
                  value={maxDistance ?? ''}
                  onChange={(e) => setMaxDistance(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="No limit"
                  min={1}
                  className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
            </div>

            {/* Auto-Adjust Toggle */}
            <div className="flex items-center justify-between p-3 bg-nilin-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-nilin-charcoal">Auto-Adjust Bids</p>
                <p className="text-xs text-nilin-warmGray">
                  Automatically adjust bids based on performance
                </p>
              </div>
              <button
                onClick={() => setAutoAdjustEnabled(!autoAdjustEnabled)}
                className={cn(
                  'w-10 h-6 rounded-full flex items-center transition-colors',
                  autoAdjustEnabled ? 'bg-nilin-coral' : 'bg-nilin-border'
                )}
              >
                <span
                  className={cn(
                    'w-4 h-4 rounded-full bg-white shadow transition-transform mx-1',
                    autoAdjustEnabled && 'translate-x-4'
                  )}
                />
              </button>
            </div>

            {/* Auto-Adjust Settings */}
            {autoAdjustEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Adjustment %
                  </label>
                  <input
                    type="number"
                    value={adjustmentPercent}
                    onChange={(e) => setAdjustmentPercent(parseInt(e.target.value, 10) || 0)}
                    min={1}
                    max={50}
                    className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                    Performance Threshold
                  </label>
                  <input
                    type="number"
                    value={performanceThreshold}
                    onChange={(e) => setPerformanceThreshold(parseInt(e.target.value, 10) || 0)}
                    min={1}
                    max={100}
                    className="w-full px-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-nilin-border rounded-xl text-nilin-charcoal font-medium hover:bg-nilin-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="flex-1 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors disabled:opacity-50"
            >
              Create Rule
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Performance Chart Component
// =============================================================================

interface PerformanceChartProps {
  data: BidPerformance[];
  currency?: string;
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data, currency = 'AED' }) => {
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E8B4A8" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#E8B4A8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B6B6B', fontSize: 12 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6B6B6B', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #E8E4E0',
              borderRadius: '8px',
            }}
            formatter={(value: number, name: string) => [
              name === 'spending'
                ? new Intl.NumberFormat('en-AE', { style: 'currency', currency, minimumFractionDigits: 0 }).format(value)
                : value,
              name === 'spending' ? 'Spending' : name.charAt(0).toUpperCase() + name.slice(1),
            ]}
          />
          <Area
            type="monotone"
            dataKey="spending"
            name="spending"
            stroke="#E8B4A8"
            strokeWidth={2}
            fill="url(#spendingGradient)"
          />
          <Line
            type="monotone"
            dataKey="bids"
            name="bids"
            stroke="#6B6B6B"
            strokeWidth={1}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const AutoBidOptimization: React.FC<AutoBidOptimizationProps> = ({
  settings,
  performance,
  isLoading = false,
  onSave,
  onRefresh,
  currentBalance = 0,
  currency = 'AED',
  className,
}) => {
  const [showAddRule, setShowAddRule] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);

  // Sync with props
  React.useEffect(() => {
    setLocalSettings(settings);
    setIsDirty(false);
  }, [settings]);

  const handleToggleEnabled = useCallback(() => {
    const newSettings = { ...localSettings, isEnabled: !localSettings.isEnabled };
    setLocalSettings(newSettings);
    setIsDirty(true);
  }, [localSettings]);

  const handleAddRule = useCallback((rule: Omit<BidRule, 'id'>) => {
    const newRule: BidRule = {
      ...rule,
      id: `rule_${Date.now()}`,
    };
    const newRules = [...localSettings.rules, newRule];
    setLocalSettings({ ...localSettings, rules: newRules });
    setIsDirty(true);
  }, [localSettings]);

  const handleUpdateRule = useCallback((updatedRule: BidRule) => {
    const newRules = localSettings.rules.map((r) =>
      r.id === updatedRule.id ? updatedRule : r
    );
    setLocalSettings({ ...localSettings, rules: newRules });
    setIsDirty(true);
  }, [localSettings]);

  const handleDeleteRule = useCallback((ruleId: string) => {
    const newRules = localSettings.rules.filter((r) => r.id !== ruleId);
    setLocalSettings({ ...localSettings, rules: newRules });
    setIsDirty(true);
  }, [localSettings]);

  const handleSave = useCallback(async () => {
    await onSave(localSettings);
    setIsDirty(false);
  }, [localSettings, onSave]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalSpending = performance.reduce((sum, p) => sum + p.spending, 0);
    const totalBids = performance.reduce((sum, p) => sum + p.bids, 0);
    const totalWins = performance.reduce((sum, p) => sum + p.wins, 0);
    const avgConversion = totalBids > 0 ? (totalWins / totalBids) * 100 : 0;

    return { totalSpending, totalBids, totalWins, avgConversion };
  }, [performance]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="h-24 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
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
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Auto-Bid Optimization
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Set automated bidding rules to win more jobs
          </p>
        </div>
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          {isDirty && (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Global Toggle */}
      <div className="flex items-center justify-between p-4 bg-nilin-muted/30 rounded-xl mb-6">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-nilin-coral" />
          <div>
            <p className="font-medium text-nilin-charcoal">Enable Auto-Bidding</p>
            <p className="text-xs text-nilin-warmGray">
              Automatically bid on matching jobs
            </p>
          </div>
        </div>
        <button
          onClick={handleToggleEnabled}
          className={cn(
            'w-12 h-7 rounded-full flex items-center transition-colors',
            localSettings.isEnabled ? 'bg-nilin-coral' : 'bg-nilin-border'
          )}
        >
          <span
            className={cn(
              'w-5 h-5 rounded-full bg-white shadow transition-transform mx-1',
              localSettings.isEnabled && 'translate-x-5'
            )}
          />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-nilin-warmGray">Total Spent</span>
            <DollarSign className="w-4 h-4 text-nilin-coral" />
          </div>
          <p className="text-xl font-bold text-nilin-charcoal">
            {formatCurrency(stats.totalSpending)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-nilin-warmGray">Total Bids</span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold text-nilin-charcoal">{stats.totalBids}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-nilin-warmGray">Wins</span>
            <Check className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-xl font-bold text-nilin-charcoal">{stats.totalWins}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-nilin-warmGray">Win Rate</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-nilin-charcoal">
            {stats.avgConversion.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Spending Limits */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Daily Spending Limit
          </label>
          <div className="relative">
            <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
            <input
              type="number"
              value={localSettings.dailySpendingLimit}
              onChange={(e) => {
                setLocalSettings({
                  ...localSettings,
                  dailySpendingLimit: parseInt(e.target.value, 10) || 0,
                });
                setIsDirty(true);
              }}
              className="w-full pl-9 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Pause When Balance Below
          </label>
          <div className="relative">
            <DollarSignIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
            <input
              type="number"
              value={localSettings.pauseWhenBalanceBelow}
              onChange={(e) => {
                setLocalSettings({
                  ...localSettings,
                  pauseWhenBalanceBelow: parseInt(e.target.value, 10) || 0,
                });
                setIsDirty(true);
              }}
              className="w-full pl-9 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
            />
          </div>
        </div>
      </div>

      {/* Performance Chart */}
      {performance.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-nilin-charcoal mb-3">
            Bidding Performance
          </h4>
          <PerformanceChart data={performance} currency={currency} />
        </div>
      )}

      {/* Rules Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-nilin-charcoal">
            Bid Rules ({localSettings.rules.length})
          </h4>
          <button
            onClick={() => setShowAddRule(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        {localSettings.rules.length > 0 ? (
          <div className="space-y-3">
            {localSettings.rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onUpdate={handleUpdateRule}
                onDelete={() => handleDeleteRule(rule.id)}
                currency={currency}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-nilin-muted/30 rounded-xl">
            <Zap className="w-10 h-10 text-nilin-lightGray mx-auto mb-3" />
            <p className="text-nilin-warmGray mb-2">No bid rules configured</p>
            <p className="text-sm text-nilin-lightGray">
              Create rules to automatically bid on jobs
            </p>
          </div>
        )}
      </div>

      {/* Add Rule Modal */}
      <AddRuleModal
        isOpen={showAddRule}
        onClose={() => setShowAddRule(false)}
        onSave={handleAddRule}
      />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default AutoBidOptimization;
