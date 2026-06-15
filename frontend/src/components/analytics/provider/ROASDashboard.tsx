// ROAS Dashboard - Return on Ad Spend - Provider Analytics Component
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { Target, TrendingUp, Loader, DollarSign, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  analyticsApi,
  type ROASData,
  type ROASMetricsData,
} from '../../../services/analyticsApi';
import { EmptyState } from '../../common/EmptyState';

interface ROASDashboardProps {
  providerId?: string;
  timeRange?: '7d' | '30d' | '90d';
  hidePeriodSelector?: boolean;
}

const EMPTY_STATS = {
  totalAdSpend: 0,
  totalRevenue: 0,
  overallROAS: 0,
  averageROAS: 0,
  totalBookings: 0,
  costPerBooking: 0,
  bestCampaign: '',
  worstCampaign: '',
  targetROAS: 5.0,
};

export const ROASDashboard: React.FC<ROASDashboardProps> = ({
  providerId,
  timeRange = '30d',
  hidePeriodSelector = false,
}) => {
  const navigate = useNavigate();
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'roas' | 'spend' | 'combined'>('combined');
  const [apiData, setApiData] = useState<ROASMetricsData | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    setSelectedRange(timeRange);
  }, [timeRange]);

  useEffect(() => {
    if (!providerId) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(false);

    analyticsApi
      .getROASMetrics(providerId, selectedRange)
      .then((data) => {
        if (!cancelled) {
          setApiData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setApiData(undefined);
          setFetchError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [providerId, selectedRange]);

  const stats = apiData?.stats ?? EMPTY_STATS;
  const roasData = apiData?.roasData ?? [];
  const campaigns = apiData?.campaigns ?? [];
  const hasAdSpend = stats.totalAdSpend > 0 && !fetchError;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(value);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ payload: ROASData }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-nilin-border">
          <p className="font-semibold text-nilin-charcoal mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            <p className="text-blue-600">
              Ad Spend: <span className="font-medium">{formatCurrency(item.adSpend)}</span>
            </p>
            <p className="text-green-600">
              Revenue: <span className="font-medium">{formatCurrency(item.revenue)}</span>
            </p>
            <p className="text-purple-600">
              ROAS: <span className="font-medium">{item.roas.toFixed(2)}x</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const timeRanges = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ] as const;

  const isAboveTarget = stats.overallROAS >= stats.targetROAS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-nilin rounded-nilin-lg p-6 hover-lift"
    >
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-600" />
            ROAS Dashboard
          </h3>
          <p className="text-sm text-nilin-warmGray mt-1">Return on Advertising Spend</p>
        </div>

        {hasAdSpend && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-nilin-muted rounded-nilin p-1">
              {(['roas', 'spend', 'combined'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-sm rounded-nilin transition-colors capitalize ${
                    viewMode === mode
                      ? 'bg-white text-nilin-charcoal shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {!hidePeriodSelector && (
              <select
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
                className="px-3 py-1.5 text-sm border border-nilin-border rounded-nilin focus:ring-2 focus:ring-nilin-coral focus:border-nilin-coral"
              >
                {timeRanges.map((range) => (
                  <option key={range.key} value={range.key}>
                    {range.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : !hasAdSpend ? (
        <EmptyState
          icon={<Megaphone className="w-8 h-8" />}
          title="No ad campaigns yet"
          description="Promote your services to reach more customers and track return on ad spend."
          action={{
            label: 'Create campaign',
            onClick: () => navigate('/provider/ads'),
          }}
          compact
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div
              className={`rounded-nilin p-4 ${
                isAboveTarget ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp
                  className={`h-4 w-4 ${isAboveTarget ? 'text-green-600' : 'text-red-600'}`}
                />
                <p className={`text-sm ${isAboveTarget ? 'text-green-700' : 'text-red-700'}`}>
                  Overall ROAS
                </p>
              </div>
              <p
                className={`text-2xl font-bold ${isAboveTarget ? 'text-green-700' : 'text-red-700'}`}
              >
                {stats.overallROAS.toFixed(2)}x
              </p>
              <p className="text-xs text-nilin-warmGray">Target: {stats.targetROAS}x</p>
            </div>

            <div className="bg-nilin-muted rounded-nilin p-4">
              <p className="text-sm text-nilin-warmGray mb-1 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Spend
              </p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {formatCurrency(stats.totalAdSpend)}
              </p>
              <p className="text-xs text-nilin-warmGray">{stats.totalBookings} bookings</p>
            </div>

            <div className="bg-nilin-muted rounded-nilin p-4">
              <p className="text-sm text-nilin-warmGray mb-1 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Revenue
              </p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(stats.totalRevenue)}
              </p>
              <p className="text-xs text-nilin-warmGray">From ads</p>
            </div>

            <div className="bg-nilin-muted rounded-nilin p-4">
              <p className="text-sm text-nilin-warmGray mb-1 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Cost per Booking
              </p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {formatCurrency(stats.costPerBooking)}
              </p>
              <p className="text-xs text-nilin-warmGray">Target: AED 15</p>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={roasData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="roasGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v: string) => {
                    const d = new Date(v);
                    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(v) => `AED ${v}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  yAxisId="left"
                  y={stats.targetROAS}
                  stroke="#EF4444"
                  strokeDasharray="5 5"
                  label={{ value: `Target ${stats.targetROAS}x`, fill: '#EF4444', fontSize: 10 }}
                />
                {(viewMode === 'roas' || viewMode === 'combined') && (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="roas"
                    stroke="#7C3AED"
                    strokeWidth={2}
                    fill="url(#roasGradient)"
                    name="ROAS"
                  />
                )}
                {(viewMode === 'spend' || viewMode === 'combined') && (
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#spendGradient)"
                    name="Revenue"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-600" />
              <span className="text-xs text-nilin-warmGray">ROAS (x)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-nilin-warmGray">Revenue (AED)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-xs text-nilin-warmGray">Target ROAS</span>
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="mt-6 pt-6 border-t border-nilin-border">
              <h4 className="text-sm font-medium text-nilin-charcoal mb-4">Campaign Performance</h4>
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.name}
                    className="flex items-center justify-between p-4 bg-nilin-muted rounded-nilin"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-8 rounded-full ${
                          campaign.status === 'active' ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                      />
                      <div>
                        <p className="font-medium text-nilin-charcoal">{campaign.name}</p>
                        <p className="text-xs text-nilin-warmGray">
                          {formatCurrency(campaign.spend)} spend
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-sm font-medium text-nilin-charcoal">
                          {formatCurrency(campaign.revenue)}
                        </p>
                        <p className="text-xs text-nilin-warmGray">Revenue</p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-sm font-bold ${
                            campaign.roas >= stats.targetROAS ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {campaign.roas.toFixed(2)}x
                        </p>
                        <p className="text-xs text-nilin-warmGray">ROAS</p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          campaign.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ROASDashboard;
