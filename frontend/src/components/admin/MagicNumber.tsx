import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  Calculator,
  DollarSign,
  Users,
  BarChart3,
  Target,
  Zap,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface MagicNumberData {
  currentValue: number;
  previousValue: number;
  change: number;
  changePercent: number;
  isGood: boolean;
  components: {
    newMRR: number;
    expansionMRR: number;
    contractionMRR: number;
    churnedMRR: number;
  };
  salesEfficiency: number;
  netRevenueRetention: number;
  grossRevenueRetention: number;
}

interface MagicNumberStats {
  currentQuarter: string;
  magicNumber: number;
  previousMagicNumber: number;
  targetMagicNumber: number;
  benchmark: number;
  efficiency: 'excellent' | 'good' | 'fair' | 'poor';
  trend: Array<{ quarter: string; magicNumber: number; target: number }>;
  breakdown: {
    newBusiness: number;
    expansion: number;
    contraction: number;
    churn: number;
    netNew: number;
  };
  recommendations: string[];
}

interface MagicNumberProps {
  embedded?: boolean;
  onClose?: () => void;
}

const EFFICIENCY_CONFIG = {
  excellent: { label: 'Excellent', color: '#10B981', bgColor: 'bg-green-100', description: 'Well above target' },
  good: { label: 'Good', color: '#22C55E', bgColor: 'bg-green-50', description: 'Meeting expectations' },
  fair: { label: 'Fair', color: '#F59E0B', bgColor: 'bg-amber-100', description: 'Below target' },
  poor: { label: 'Poor', color: '#EF4444', bgColor: 'bg-red-100', description: 'Needs immediate attention' }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
};

export const MagicNumber: React.FC<MagicNumberProps> = ({
  embedded = false,
  onClose
}) => {
  const [data, setData] = useState<MagicNumberData | null>(null);
  const [stats, setStats] = useState<MagicNumberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/saas/magic-number');

      if (response.data?.success) {
        setData(response.data.data);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching magic number data:', err);
      setError(getAdminFetchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="h-64 bg-nilin-blush/30 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calculator className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Magic Number</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error || 'Please try again later'}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const efficiencyConfig = EFFICIENCY_CONFIG[stats?.efficiency || 'good'];
  const isPositive = data.change > 0;

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <Calculator className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Magic Number</h2>
            <p className="text-sm text-nilin-warmGray mt-1">SaaS Sales Efficiency Metric</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <AlertCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Main Metric */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Magic Number Display */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={cn('px-3 py-1.5 rounded-full text-xs font-semibold', efficiencyConfig.bgColor)} style={{ color: efficiencyConfig.color }}>
              {efficiencyConfig.label}
            </div>
            <span className="text-sm text-nilin-warmGray">{stats?.currentQuarter}</span>
          </div>

          <div className="relative inline-block">
            <div className="text-8xl font-serif font-bold" style={{ color: efficiencyConfig.color }}>
              {data.currentValue.toFixed(2)}
            </div>
            <div className={cn(
              'absolute -right-4 top-0 flex items-center gap-1 text-lg font-semibold',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}>
              {isPositive ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
              {Math.abs(data.changePercent).toFixed(1)}%
            </div>
          </div>

          <p className="text-lg text-nilin-charcoal mt-2">Magic Number</p>
          <p className="text-sm text-nilin-warmGray mt-1">New ARR from Sales & Marketing / Previous Quarter S&M Spend</p>

          {/* Target Indicator */}
          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-nilin-coral" />
              <span className="text-sm text-nilin-warmGray">Target: <strong className="text-nilin-charcoal">{stats?.targetMagicNumber.toFixed(2)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-nilin-warmGray">Benchmark: <strong className="text-nilin-charcoal">{stats?.benchmark.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="glass rounded-xl border border-green-200/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <span className="text-sm text-nilin-warmGray">Net Revenue Retention</span>
            </div>
            <p className="text-3xl font-serif text-green-600">{data.netRevenueRetention}%</p>
          </div>
          <div className="glass rounded-xl border border-nilin-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-purple-500" />
              <span className="text-sm text-nilin-warmGray">Gross Revenue Retention</span>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal">{data.grossRevenueRetention}%</p>
          </div>
          <div className="glass rounded-xl border border-nilin-border/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <span className="text-sm text-nilin-warmGray">Sales Efficiency</span>
            </div>
            <p className="text-3xl font-serif text-nilin-charcoal">{data.salesEfficiency.toFixed(2)}x</p>
          </div>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Magic Number Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={stats?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="quarter" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={11} domain={[0, 2]} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              <Area
                type="monotone"
                dataKey="magicNumber"
                stroke="#10B981"
                fill="#10B98120"
                strokeWidth={3}
                name="Magic Number"
              />
              <Line
                type="monotone"
                dataKey="target"
                stroke="#EF4444"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Target"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span className="text-xs text-nilin-warmGray">Actual Magic Number</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span className="text-xs text-nilin-warmGray">Target</span>
          </div>
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* MRR Components */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">MRR Components</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-xl">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <span className="text-sm text-nilin-charcoal">New Business</span>
              </div>
              <span className="text-lg font-semibold text-green-600">+{formatCurrency(data.components.newMRR)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50/50 rounded-xl">
              <div className="flex items-center gap-3">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
                <span className="text-sm text-nilin-charcoal">Expansion</span>
              </div>
              <span className="text-lg font-semibold text-green-600">+{formatCurrency(data.components.expansionMRR)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl">
              <div className="flex items-center gap-3">
                <TrendingDown className="w-5 h-5 text-amber-500" />
                <span className="text-sm text-nilin-charcoal">Contraction</span>
              </div>
              <span className="text-lg font-semibold text-amber-600">{formatCurrency(data.components.contractionMRR)}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl">
              <div className="flex items-center gap-3">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
                <span className="text-sm text-nilin-charcoal">Churn</span>
              </div>
              <span className="text-lg font-semibold text-red-600">{formatCurrency(data.components.churnedMRR)}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Quarterly Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-nilin-warmGray">New Business</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '65%' }} />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal w-20 text-right">{formatCurrency(stats?.breakdown.newBusiness || 0)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nilin-warmGray">Expansion</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full" style={{ width: '18%' }} />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal w-20 text-right">{formatCurrency(stats?.breakdown.expansion || 0)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nilin-warmGray">Contraction</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '7%' }} />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal w-20 text-right">{formatCurrency(stats?.breakdown.contraction || 0)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-nilin-warmGray">Churn</span>
              <div className="flex items-center gap-2">
                <div className="w-32 h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: '11%' }} />
                </div>
                <span className="text-sm font-medium text-nilin-charcoal w-20 text-right">{formatCurrency(stats?.breakdown.churn || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {stats?.recommendations && stats.recommendations.length > 0 && (
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Insights & Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats.recommendations.map((rec, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-nilin-blush/30 rounded-xl">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{index + 1}</span>
                </div>
                <p className="text-sm text-nilin-charcoal">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MagicNumber;
