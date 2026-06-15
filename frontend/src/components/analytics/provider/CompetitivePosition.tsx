// Competitive Position - Provider Analytics Component
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Trophy, TrendingUp, TrendingDown, Loader, Users, Star, Target, Lightbulb } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi, type CompetitivePositionData } from '../../../services/analyticsApi';

interface CompetitivePositionProps {
  providerId?: string;
}

const PRIORITY_COLORS = {
  high: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-200' },
  low: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
};

export const CompetitivePosition: React.FC<CompetitivePositionProps> = ({
  providerId,
}) => {
  const [viewMode, setViewMode] = useState<'radar' | 'comparison'>('radar');
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<CompetitivePositionData | null>(null);
  const [isError, setIsError] = useState(false);

  // Use API if providerId is available, otherwise show empty state
  const shouldFetch = Boolean(providerId);
  const effectiveProviderId = providerId || '';

  useEffect(() => {
    if (!shouldFetch) return;

    let cancelled = false;
    setLoading(true);
    setIsError(false);

    analyticsApi
      .getCompetitivePosition(effectiveProviderId)
      .then((data) => {
        if (!cancelled) {
          setApiData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsError(true);
          setApiData(null);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [shouldFetch, effectiveProviderId]);

  if (!shouldFetch) {
    return null;
  }

  if (loading) {
    return (
      <div className="glass-nilin rounded-nilin-lg p-6 flex items-center justify-center min-h-[280px]">
        <Loader className="h-8 w-8 animate-spin text-nilin-coral" />
      </div>
    );
  }

  if (isError || !apiData) {
    return (
      <div className="glass-nilin rounded-nilin-lg p-6 text-center min-h-[280px] flex flex-col items-center justify-center">
        <Trophy className="h-10 w-10 text-nilin-warmGray mb-3 opacity-60" />
        <h3 className="text-lg font-semibold text-nilin-charcoal">Competitive position unavailable</h3>
        <p className="text-sm text-nilin-warmGray mt-1 max-w-sm">
          {isError
            ? 'Unable to load ranking data right now. Please try again shortly.'
            : 'Complete more bookings to unlock market ranking and comparison data.'}
        </p>
      </div>
    );
  }

  const rankingData = apiData.rankingData ?? [];
  const comparisonData = apiData.comparisonData ?? [];
  const radarData = apiData.radarData ?? [];
  const suggestions = apiData.suggestions ?? [];
  const stats = apiData.stats;

  const formatCurrency = (value: number) => {
    if (value >= 1000) {
      return `AED ${(value / 1000).toFixed(1)}K`;
    }
    return `AED ${value}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          <div className="space-y-1 text-sm">
            {payload.map((entry: any, index: number) => (
              <p key={index} style={{ color: entry.color }}>
                {entry.name}: <span className="font-medium">{entry.value}</span>
              </p>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-red-600" />;
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Competitive Position
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Your ranking among service providers
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('radar')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'radar'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Radar
            </button>
            <button
              onClick={() => setViewMode('comparison')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                viewMode === 'comparison'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg p-4 border border-yellow-100">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-700">Overall Rank</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">#{stats.overallRank}</p>
          <p className="text-xs text-gray-500">of {stats.totalProviders} providers</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Percentile</p>
          <p className="text-3xl font-bold text-blue-600">Top {100 - stats.percentile}%</p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3 text-green-600" />
            <span className="text-xs text-green-600">+{stats.trend} this month</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Star className="h-4 w-4 text-yellow-500" />
            <p className="text-sm text-gray-500">Your Rating</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.rating}</p>
          <p className="text-xs text-gray-500">{stats.reviews} reviews</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1">Market Share</p>
          <p className="text-3xl font-bold text-green-600">{stats.marketShare}%</p>
          <p className="text-xs text-gray-500">of active market</p>
        </div>
      </div>

      {/* Ranking Breakdown */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Rankings by Metric</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {rankingData.map((rank) => (
            <div key={rank.metric} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{rank.metric}</span>
                {getTrendIcon(rank.change)}
              </div>
              <p className="text-xl font-bold text-gray-900">
                #{rank.yourRank}
                <span className="text-sm font-normal text-gray-500 ml-1">
                  / {rank.totalProviders}
                </span>
              </p>
              <p className="text-xs text-blue-600 font-medium">
                Top {100 - rank.percentile}%ile
              </p>
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center">
          <Loader className="h-8 w-8 text-yellow-600 animate-spin" />
        </div>
      ) : viewMode === 'radar' ? (
        <>
          {/* Radar Chart */}
          <div className="h-72 min-h-[288px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Radar
                  name="Your Score"
                  dataKey="value"
                  stroke="#2563EB"
                  fill="#2563EB"
                  fillOpacity={0.3}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Performance Metrics */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            {radarData.map((item) => (
              <div key={item.metric} className="text-center">
                <p className="text-xs text-gray-500">{item.metric}</p>
                <p className="text-lg font-bold text-gray-900">{item.value}%</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Comparison Bar Chart */}
          <div className="h-72 min-h-[288px] w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={288}>
              <BarChart data={comparisonData} layout="vertical" margin={{ top: 10, right: 30, left: 80, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={true} vertical={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="you" name="You" fill="#2563EB" radius={[0, 4, 4, 0]} />
                <Bar dataKey="average" name="Average" fill="#9CA3AF" radius={[0, 4, 4, 0]} />
                <Bar dataKey="top10" name="Top 10%" fill="#10B981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-600" />
              <span className="text-sm text-gray-600">You</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-sm text-gray-600">Average</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-600" />
              <span className="text-sm text-gray-600">Top 10%</span>
            </div>
          </div>
        </>
      )}

      {/* Improvement Suggestions */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500" />
          Improvement Suggestions
        </h4>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            const colors = PRIORITY_COLORS[suggestion.priority];
            return (
              <div
                key={index}
                className={`border rounded-lg p-4 ${colors.border}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} mb-1`}>
                      {suggestion.priority.toUpperCase()} PRIORITY
                    </span>
                    <h5 className="font-medium text-gray-900">{suggestion.title}</h5>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">+{suggestion.potential}%</p>
                    <p className="text-xs text-gray-500">potential gain</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{suggestion.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Key Insights</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
            <p className="text-gray-600">
              You're in the <span className="font-medium text-gray-900">top 5%</span> of all providers,
              ranking #{stats.overallRank} out of {stats.totalProviders}.
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
            <p className="text-gray-600">
              Your <span className="font-medium text-gray-900">completion rate</span> is your strongest metric
              at #28 (top 3%).
            </p>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-red-400 mt-1.5" />
            <p className="text-gray-600">
              Focus on improving <span className="font-medium text-gray-900">repeat customer rate</span>
              to climb higher rankings.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CompetitivePosition;
