// Viral Coefficient (K-Factor) - Admin Analytics Component
import React, { useState, useEffect } from 'react';
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
import { Share2, TrendingUp, Loader, Users, UserPlus, Zap, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { analyticsApi } from '../../../services/analyticsApi';

interface ViralCoefficientProps {
  timeRange?: '7d' | '30d' | '90d';
}

interface ViralData {
  date: string;
  kFactor: number;
  invitesSent: number;
  invitesAccepted: number;
  conversionRate: number;
  viralReach: number;
}

interface ViralStats {
  currentK: number;
  targetK: number;
  avgInvitesPerUser: number;
  avgConversionRate: number;
  totalViralUsers: number;
  viralGrowth: number;
  organicGrowth: number;
  networkEffect: number;
}

export const ViralCoefficient: React.FC<ViralCoefficientProps> = ({
  timeRange = '30d',
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ViralData[]>([]);
  const [stats, setStats] = useState<ViralStats>({
    currentK: 0,
    targetK: 0.7,
    avgInvitesPerUser: 0,
    avgConversionRate: 0,
    totalViralUsers: 0,
    viralGrowth: 0,
    organicGrowth: 0,
    networkEffect: 0,
  });
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const [viewMode, setViewMode] = useState<'kfactor' | 'invites' | 'conversion'>('kfactor');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const apiData = await analyticsApi.getAdminViralCoefficient(selectedRange);
        setData(apiData.timeSeries || []);
        setStats(apiData.stats);
      } catch (err) {
        setData([]);
        setError(err instanceof Error ? err.message : 'Failed to load viral coefficient data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedRange]);

  const isViral = stats.currentK >= 1;
  const isApproachingViral = stats.currentK >= 0.7;

  const getStatCardClass = (): string => {
    if (isViral) return 'bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200';
    if (isApproachingViral) return 'bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200';
    return 'bg-gray-50';
  };

  const getStatTextClass = (): string => {
    if (isViral) return 'text-green-700';
    if (isApproachingViral) return 'text-yellow-700';
    return 'text-gray-600';
  };

  const getKValueClass = (): string => {
    if (isViral) return 'text-green-700';
    if (isApproachingViral) return 'text-yellow-700';
    return 'text-gray-900';
  };

  const timeRanges = [
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Share2 className="h-5 w-5 text-purple-600" />
            Viral Coefficient (K-Factor)
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Measure organic growth through user referrals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('kfactor')}
              className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                viewMode === 'kfactor'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              K-Factor
            </button>
            <button
              onClick={() => setViewMode('invites')}
              className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                viewMode === 'invites'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Invites
            </button>
            <button
              onClick={() => setViewMode('conversion')}
              className={`px-3 py-1 text-sm rounded-md transition-colors capitalize ${
                viewMode === 'conversion'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Conversion
            </button>
          </div>

          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as typeof selectedRange)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          >
            {timeRanges.map((range) => (
              <option key={range.key} value={range.key}>
                {range.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-lg p-4 ${getStatCardClass()}`}>
          <div className="flex items-center gap-2 mb-1">
            <Zap className={`h-4 w-4 ${getStatTextClass()}`} />
            <p className={`text-sm ${getStatTextClass()}`}>K-Factor</p>
          </div>
          <p className={`text-2xl font-bold ${getKValueClass()}`}>
            {stats.currentK.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500">Target: {stats.targetK}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Avg Invites/User
          </p>
          <p className="text-2xl font-bold text-gray-900">{stats.avgInvitesPerUser}</p>
          <p className="text-xs text-gray-500">Invites sent</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Conversion Rate
          </p>
          <p className="text-2xl font-bold text-green-600">{stats.avgConversionRate.toFixed(1)}%</p>
          <p className="text-xs text-gray-500">Invite acceptance</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-500 mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Viral Users
          </p>
          <p className="text-2xl font-bold text-purple-600">{stats.totalViralUsers.toLocaleString()}</p>
          <p className="text-xs text-green-600">+{stats.viralGrowth}% growth</p>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader className="h-8 w-8 text-purple-600 animate-spin" />
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="viralGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6B7280' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} />
              <Tooltip />
              <ReferenceLine
                y={1}
                stroke="#10B981"
                strokeDasharray="5 5"
                label={{ value: 'Viral (K=1)', fill: '#10B981', fontSize: 10 }}
              />
              <ReferenceLine
                y={stats.targetK}
                stroke="#F59E0B"
                strokeDasharray="5 5"
                label={{ value: 'Target', fill: '#F59E0B', fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey={viewMode === 'kfactor' ? 'kFactor' : viewMode === 'invites' ? 'invitesSent' : 'conversionRate'}
                stroke="#7C3AED"
                strokeWidth={2}
                fill="url(#viralGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-xs text-gray-600">Viral threshold (K=1)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-xs text-gray-600">Target threshold</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-xs text-gray-600">Current K-Factor</span>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Growth Attribution</h4>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-purple-600">{Math.round(stats.networkEffect * 100)}%</p>
            <p className="text-sm text-purple-700">Network Effect</p>
            <p className="text-xs text-gray-500 mt-1">Growth from viral loop</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{stats.viralGrowth}%</p>
            <p className="text-sm text-blue-700">Viral Growth</p>
            <p className="text-xs text-gray-500 mt-1">Organic referrals</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{stats.organicGrowth}%</p>
            <p className="text-sm text-green-700">Organic Growth</p>
            <p className="text-xs text-gray-500 mt-1">Direct signups</p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3">Understanding K-Factor</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-3">
            <strong>K-Factor = Invites Sent x Conversion Rate</strong>
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <span><strong>K &gt;= 1:</strong> Viral loop - each user brings in at least one new user</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 flex-shrink-0" />
              <span><strong>K &gt;= 0.7:</strong> Approaching viral - strong organic growth</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
              <span><strong>K &lt; 0.7:</strong> Below threshold - rely on paid acquisition</span>
            </li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default ViralCoefficient;
