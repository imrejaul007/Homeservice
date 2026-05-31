/**
 * CompetitorPricing - Market pricing analysis and recommendations
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Target,
  BarChart3,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Check,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Edit3,
  Lightbulb,
  Shield,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { formatPrice } from '../../lib/utils';

// =============================================================================
// Type Definitions
// =============================================================================

export interface CompetitorData {
  /** Provider name (anonymized) */
  name: string;
  /** Average price */
  avgPrice: number;
  /** Number of reviews */
  reviewCount: number;
  /** Rating */
  rating: number;
  /** Service count */
  serviceCount: number;
  /** Price range (min-max) */
  priceRange: { min: number; max: number };
}

export interface ServicePricingAnalysis {
  /** Service ID */
  id: string;
  /** Service name */
  name: string;
  /** Your current price */
  yourPrice: number;
  /** Market average */
  marketAverage: number;
  /** Market low */
  marketLow: number;
  /** Market high */
  marketHigh: number;
  /** Suggested price */
  suggestedPrice: number;
  /** Price position: 'below' | 'at' | 'above' */
  position: 'below' | 'at' | 'above';
  /** Competitive score (0-100) */
  competitiveScore: number;
  /** Recommendation */
  recommendation: string;
  /** Competitor count */
  competitorCount: number;
}

export interface CompetitorPricingProps {
  /** Service pricing analyses */
  services: ServicePricingAnalysis[];
  /** Competitor data */
  competitors?: CompetitorData[];
  /** Market averages */
  marketAverages?: {
    avgPrice: number;
    avgRating: number;
    avgReviews: number;
  };
  /** Loading state */
  isLoading?: boolean;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Callback when price is updated */
  onUpdatePrice?: (serviceId: string, newPrice: number) => Promise<void>;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const formatCurrency = (amount: number, currency = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// =============================================================================
// Position Badge Component
// =============================================================================

interface PositionBadgeProps {
  position: 'below' | 'at' | 'above';
}

const PositionBadge: React.FC<PositionBadgeProps> = ({ position }) => {
  const config = {
    below: {
      label: 'Below Market',
      color: 'bg-green-100 text-green-700',
      icon: ArrowDownRight,
    },
    at: {
      label: 'At Market',
      color: 'bg-blue-100 text-blue-700',
      icon: Check,
    },
    above: {
      label: 'Above Market',
      color: 'bg-amber-100 text-amber-700',
      icon: ArrowUpRight,
    },
  };

  const { label, color, icon: Icon } = config[position];

  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', color)}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

// =============================================================================
// Score Indicator Component
// =============================================================================

interface ScoreIndicatorProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const ScoreIndicator: React.FC<ScoreIndicatorProps> = ({ score, size = 'md' }) => {
  const getColor = (s: number) => {
    if (s >= 70) return 'text-green-600 bg-green-100';
    if (s >= 40) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div className={cn('rounded-full flex items-center justify-center font-bold', sizes[size], getColor(score))}>
      {score}
    </div>
  );
};

// =============================================================================
// Service Card Component
// =============================================================================

interface ServiceCardProps {
  service: ServicePricingAnalysis;
  onUpdatePrice: (serviceId: string, newPrice: number) => Promise<void>;
  currency?: string;
}

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onUpdatePrice, currency = 'AED' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditPrice, setShowEditPrice] = useState(false);
  const [newPrice, setNewPrice] = useState(service.suggestedPrice.toString());

  const handleUpdatePrice = async () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    setIsUpdating(true);
    try {
      await onUpdatePrice(service.id, price);
      setShowEditPrice(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const priceDiff = service.yourPrice - service.marketAverage;
  const priceDiffPercent = ((priceDiff / service.marketAverage) * 100).toFixed(0);

  return (
    <div className="bg-white rounded-xl border border-nilin-border overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-semibold text-nilin-charcoal">{service.name}</h4>
            <p className="text-xs text-nilin-warmGray mt-1">
              Based on {service.competitorCount} competitors
            </p>
          </div>
          <ScoreIndicator score={service.competitiveScore} />
        </div>

        {/* Price Info */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="text-center p-2 bg-nilin-muted/30 rounded-lg">
            <p className="text-xs text-nilin-warmGray mb-1">Your Price</p>
            <p className="text-lg font-bold text-nilin-charcoal">
              {formatCurrency(service.yourPrice, currency)}
            </p>
          </div>
          <div className="text-center p-2 bg-nilin-muted/30 rounded-lg">
            <p className="text-xs text-nilin-warmGray mb-1">Market Avg</p>
            <p className="text-lg font-bold text-nilin-charcoal">
              {formatCurrency(service.marketAverage, currency)}
            </p>
          </div>
          <div className="text-center p-2 bg-nilin-muted/30 rounded-lg">
            <p className="text-xs text-nilin-warmGray mb-1">Suggested</p>
            <p className="text-lg font-bold text-nilin-coral">
              {formatCurrency(service.suggestedPrice, currency)}
            </p>
          </div>
        </div>

        {/* Position */}
        <div className="flex items-center justify-between">
          <PositionBadge position={service.position} />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
          >
            {isExpanded ? 'Less' : 'More'} details
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-nilin-border pt-4">
          {/* Price Range */}
          <div className="mb-4">
            <p className="text-xs text-nilin-warmGray mb-2">Market Range</p>
            <div className="relative h-4 bg-nilin-muted rounded-full">
              <div
                className="absolute left-0 h-full bg-green-200 rounded-full"
                style={{ width: `${((service.marketAverage - service.marketLow) / (service.marketHigh - service.marketLow)) * 100}%` }}
              />
              <div
                className="absolute top-0 w-1 h-full bg-nilin-coral rounded-full"
                style={{ left: `${((service.yourPrice - service.marketLow) / (service.marketHigh - service.marketLow)) * 100}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-nilin-warmGray">
              <span>{formatCurrency(service.marketLow, currency)}</span>
              <span>You: {formatCurrency(service.yourPrice, currency)}</span>
              <span>{formatCurrency(service.marketHigh, currency)}</span>
            </div>
          </div>

          {/* Comparison */}
          <div className="flex items-center gap-2 mb-4 p-2 bg-nilin-muted/30 rounded-lg">
            {priceDiff < 0 ? (
              <TrendingDown className="w-4 h-4 text-green-600" />
            ) : priceDiff > 0 ? (
              <TrendingUp className="w-4 h-4 text-amber-600" />
            ) : (
              <Check className="w-4 h-4 text-blue-600" />
            )}
            <span className="text-sm text-nilin-charcoal">
              {priceDiff < 0 ? (
                <>
                  You are {Math.abs(Number(priceDiffPercent))}% below market average
                </>
              ) : priceDiff > 0 ? (
                <>
                  You are {priceDiffPercent}% above market average
                </>
              ) : (
                'Your price matches the market average'
              )}
            </span>
          </div>

          {/* Recommendation */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">{service.recommendation}</p>
            </div>
          </div>

          {/* Update Price */}
          {showEditPrice ? (
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
                <input
                  type="number"
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
              <button
                onClick={handleUpdatePrice}
                disabled={isUpdating}
                className="px-4 py-2 bg-nilin-coral text-white rounded-lg font-medium hover:bg-nilin-coral/90 transition-colors disabled:opacity-50"
              >
                {isUpdating ? 'Updating...' : 'Update'}
              </button>
              <button
                onClick={() => {
                  setShowEditPrice(false);
                  setNewPrice(service.suggestedPrice.toString());
                }}
                className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowEditPrice(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-nilin-border rounded-lg text-nilin-charcoal hover:bg-nilin-muted transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Update Price to {formatCurrency(service.suggestedPrice, currency)}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Price Distribution Chart Component
// =============================================================================

interface PriceChartProps {
  services: ServicePricingAnalysis[];
  currency?: string;
}

const PriceChart: React.FC<PriceChartProps> = ({ services, currency = 'AED' }) => {
  const data = services.slice(0, 8).map((s) => ({
    name: s.name.length > 12 ? s.name.substring(0, 12) + '...' : s.name,
    yourPrice: s.yourPrice,
    marketAvg: s.marketAverage,
    suggested: s.suggestedPrice,
  }));

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Price Comparison</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 100, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B6B6B', fontSize: 12 }}
              tickFormatter={(value) => `${value}`}
            />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#6B6B6B', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value, currency)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #E8E4E0',
                borderRadius: '8px',
              }}
            />
            <Bar dataKey="yourPrice" name="Your Price" fill="#E8B4A8" radius={[0, 4, 4, 0]} barSize={16} />
            <Bar dataKey="marketAvg" name="Market Avg" fill="#94A3B8" radius={[0, 4, 4, 0]} barSize={16} />
            <Bar dataKey="suggested" name="Suggested" fill="#4CAF50" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-nilin-coral" />
          <span className="text-xs text-nilin-warmGray">Your Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-400" />
          <span className="text-xs text-nilin-warmGray">Market Avg</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-nilin-warmGray">Suggested</span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Market Overview Component
// =============================================================================

interface MarketOverviewProps {
  services: ServicePricingAnalysis[];
  marketAverages?: CompetitorPricingProps['marketAverages'];
  currency?: string;
}

const MarketOverview: React.FC<MarketOverviewProps> = ({ services, marketAverages, currency = 'AED' }) => {
  const stats = useMemo(() => {
    const avgYourPrice = services.reduce((sum, s) => sum + s.yourPrice, 0) / services.length;
    const avgMarketPrice = services.reduce((sum, s) => sum + s.marketAverage, 0) / services.length;
    const avgScore = services.reduce((sum, s) => sum + s.competitiveScore, 0) / services.length;
    const belowMarket = services.filter((s) => s.position === 'below').length;
    const atMarket = services.filter((s) => s.position === 'at').length;
    const aboveMarket = services.filter((s) => s.position === 'above').length;

    return {
      avgYourPrice,
      avgMarketPrice,
      avgScore,
      belowMarket,
      atMarket,
      aboveMarket,
    };
  }, [services]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Market Overview</h4>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-nilin-muted/30 rounded-lg text-center">
          <p className="text-xs text-nilin-warmGray mb-1">Your Avg Price</p>
          <p className="text-lg font-bold text-nilin-charcoal">
            {formatCurrency(stats.avgYourPrice, currency)}
          </p>
        </div>
        <div className="p-3 bg-nilin-muted/30 rounded-lg text-center">
          <p className="text-xs text-nilin-warmGray mb-1">Market Avg</p>
          <p className="text-lg font-bold text-nilin-charcoal">
            {formatCurrency(stats.avgMarketPrice, currency)}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs text-nilin-warmGray mb-2">Competitive Score</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-nilin-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-nilin-coral rounded-full"
              style={{ width: `${stats.avgScore}%` }}
            />
          </div>
          <span className="text-sm font-bold text-nilin-coral">{stats.avgScore.toFixed(0)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-green-600">Below Market</span>
          <span className="text-sm font-medium text-nilin-charcoal">{stats.belowMarket} services</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-blue-600">At Market</span>
          <span className="text-sm font-medium text-nilin-charcoal">{stats.atMarket} services</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-amber-600">Above Market</span>
          <span className="text-sm font-medium text-nilin-charcoal">{stats.aboveMarket} services</span>
        </div>
      </div>

      {marketAverages && (
        <div className="mt-4 pt-4 border-t border-nilin-border">
          <p className="text-xs text-nilin-warmGray mb-2">Market Benchmarks</p>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-nilin-warmGray">Avg Rating</span>
              <span className="text-nilin-charcoal">{marketAverages.avgRating.toFixed(1)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nilin-warmGray">Avg Reviews</span>
              <span className="text-nilin-charcoal">{marketAverages.avgReviews}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Recommendations Panel Component
// =============================================================================

interface RecommendationsPanelProps {
  services: ServicePricingAnalysis[];
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ services }) => {
  const recommendations = useMemo(() => {
    const items: Array<{ type: 'increase' | 'decrease' | 'info'; message: string; service: string }> = [];

    services.forEach((s) => {
      if (s.position === 'above' && s.competitiveScore < 50) {
        items.push({
          type: 'decrease',
          message: `Consider lowering price to ${formatCurrency(s.suggestedPrice)} to be more competitive`,
          service: s.name,
        });
      } else if (s.position === 'below' && s.competitiveScore > 70) {
        items.push({
          type: 'increase',
          message: `You have room to increase price to ${formatCurrency(s.suggestedPrice)}`,
          service: s.name,
        });
      } else if (s.competitiveScore < 40) {
        items.push({
          type: 'info',
          message: `Review pricing strategy for ${s.name}`,
          service: s.name,
        });
      }
    });

    return items.slice(0, 5);
  }, [services]);

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <h4 className="text-sm font-semibold text-nilin-charcoal mb-4">Action Items</h4>

      {recommendations.length > 0 ? (
        <div className="space-y-3">
          {recommendations.map((rec, index) => (
            <div
              key={index}
              className={cn(
                'p-3 rounded-lg',
                rec.type === 'decrease' && 'bg-amber-50',
                rec.type === 'increase' && 'bg-green-50',
                rec.type === 'info' && 'bg-blue-50'
              )}
            >
              <div className="flex items-start gap-2">
                {rec.type === 'decrease' && (
                  <ArrowDownRight className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                )}
                {rec.type === 'increase' && (
                  <ArrowUpRight className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                )}
                {rec.type === 'info' && (
                  <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-nilin-charcoal">{rec.service}</p>
                  <p className="text-xs text-nilin-warmGray mt-0.5">{rec.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-nilin-warmGray">Your pricing looks great!</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const CompetitorPricing: React.FC<CompetitorPricingProps> = ({
  services,
  competitors,
  marketAverages,
  isLoading = false,
  onRefresh,
  onUpdatePrice,
  currency = 'AED',
  className,
}) => {
  const [view, setView] = useState<'cards' | 'chart'>('cards');

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
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-48 bg-nilin-muted rounded-xl" />
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
            Competitor Pricing Analysis
          </h3>
          <p className="text-sm text-nilin-warmGray">
            Compare your prices with the market
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-nilin-border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('cards')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                view === 'cards'
                  ? 'bg-nilin-coral text-white'
                  : 'text-nilin-warmGray hover:bg-nilin-muted'
              )}
            >
              Cards
            </button>
            <button
              onClick={() => setView('chart')}
              className={cn(
                'px-3 py-1.5 text-sm transition-colors',
                view === 'chart'
                  ? 'bg-nilin-coral text-white'
                  : 'text-nilin-warmGray hover:bg-nilin-muted'
              )}
            >
              Chart
            </button>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={view === 'cards' ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'space-y-6'}>
        {view === 'cards' ? (
          <>
            <div className="lg:col-span-2 space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onUpdatePrice={onUpdatePrice || (() => Promise.resolve())}
                  currency={currency}
                />
              ))}
            </div>
            <div className="space-y-4">
              <MarketOverview services={services} marketAverages={marketAverages} currency={currency} />
              <RecommendationsPanel services={services} />
            </div>
          </>
        ) : (
          <>
            <PriceChart services={services} currency={currency} />
            <div className="grid grid-cols-2 gap-6">
              <MarketOverview services={services} marketAverages={marketAverages} currency={currency} />
              <RecommendationsPanel services={services} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default CompetitorPricing;
