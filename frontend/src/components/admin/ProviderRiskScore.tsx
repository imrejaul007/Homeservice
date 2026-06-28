import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Shield,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  Eye,
  ChevronDown,
  ChevronUp,
  User,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Star,
  Calendar,
  Ban,
  Flag,
  BarChart3
} from 'lucide-react';
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
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

/** Mutation endpoints are not implemented for this widget — actions are read-only. */
const WIDGET_MUTATIONS_READ_ONLY = true;

interface ProviderRiskData {
  id: string;
  providerId: string;
  providerName: string;
  email: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'suspended' | 'under_review' | 'terminated';
  factors: {
    compliance: number;
    financial: number;
    behavioral: number;
    quality: number;
    historical: number;
  };
  flags: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    detectedAt: string;
  }>;
  trend: Array<{ date: string; score: number }>;
  totalBookings: number;
  totalRevenue: number;
  avgRating: number;
  avgResponseTime: number;
  completionRate: number;
  disputeRate: number;
  lastActive: string;
  joinedAt: string;
}

interface RiskStats {
  totalProviders: number;
  highRisk: number;
  criticalRisk: number;
  underReview: number;
  avgRiskScore: number;
  riskDistribution: Array<{ level: string; count: number; color: string }>;
  topRiskFactors: Array<{ factor: string; count: number; trend: number }>;
  recentEscalations: number;
}

interface ProviderRiskScoreProps {
  embedded?: boolean;
  onClose?: () => void;
}

const RISK_LEVEL_CONFIG = {
  low: { label: 'Low Risk', color: 'bg-green-100 text-green-700 border-green-200', score: [0, 30] },
  medium: { label: 'Medium Risk', color: 'bg-amber-100 text-amber-700 border-amber-200', score: [30, 60] },
  high: { label: 'High Risk', color: 'bg-orange-100 text-orange-700 border-orange-200', score: [60, 80] },
  critical: { label: 'Critical Risk', color: 'bg-red-100 text-red-700 border-red-200', score: [80, 100] }
};

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  suspended: { label: 'Suspended', color: 'bg-red-100 text-red-700' },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700' },
  terminated: { label: 'Terminated', color: 'bg-gray-100 text-gray-700' }
};

const getRiskColor = (score: number): string => {
  if (score < 30) return '#10B981';
  if (score < 60) return '#F59E0B';
  if (score < 80) return '#F97316';
  return '#EF4444';
};

export const ProviderRiskScore: React.FC<ProviderRiskScoreProps> = ({
  embedded = false,
  onClose
}) => {
  const [providers, setProviders] = useState<ProviderRiskData[]>([]);
  const [stats, setStats] = useState<RiskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<ProviderRiskData | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/providers/risk');

      if (response.data?.success) {
        setProviders(response.data.data.providers || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching risk data:', err);
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

  const handleSuspend = async (providerId: string) => {
    if (WIDGET_MUTATIONS_READ_ONLY) return;
    setActionLoading(providerId);
    try {
      await api.post(`/admin/providers/${providerId}/suspend`, {
        reason: 'Suspended from provider risk score dashboard',
      });
      setProviders(prev => prev.map(p =>
        p.providerId === providerId ? { ...p, status: 'suspended' as const } : p
      ));
    } catch (err) {
      console.error('Error suspending provider:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredProviders = providers.filter(provider => {
    const matchesSearch = provider.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          provider.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === 'all' || provider.riskLevel === riskFilter;
    const matchesStatus = statusFilter === 'all' || provider.status === statusFilter;
    return matchesSearch && matchesRisk && matchesStatus;
  });

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Risk Data</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
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

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Provider Risk Score</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Identify and monitor high-risk providers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <XCircle className="w-5 h-5 text-nilin-warmGray" />
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalProviders || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Providers</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">
            {Math.round(((stats?.riskDistribution?.find(d => d.level === 'Low')?.count || 0) / (stats?.totalProviders || 1)) * 100)}%
          </p>
          <p className="text-xs text-nilin-warmGray">Low Risk</p>
        </div>
        <div className="glass rounded-xl border border-orange-200/50 p-4 text-center">
          <AlertTriangle className="w-6 h-6 text-orange-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-orange-600">{stats?.highRisk || 0}</p>
          <p className="text-xs text-nilin-warmGray">High Risk</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <Shield className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.criticalRisk || 0}</p>
          <p className="text-xs text-nilin-warmGray">Critical</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.underReview || 0}</p>
          <p className="text-xs text-nilin-warmGray">Under Review</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Risk Distribution */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Risk Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.riskDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="level"
                >
                  {stats?.riskDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats?.riskDistribution?.map(item => (
              <div key={item.level} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-nilin-warmGray">{item.level}</span>
                <span className="text-xs font-medium text-nilin-charcoal ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Risk Factors */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Top Risk Factors</h3>
          <div className="space-y-3">
            {stats?.topRiskFactors?.map((factor, index) => (
              <div key={factor.factor} className="flex items-center gap-4">
                <span className="text-xs text-nilin-warmGray w-6">{index + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-nilin-charcoal">{factor.factor}</span>
                    <span className="text-sm font-medium text-nilin-coral">{factor.count}</span>
                  </div>
                  <div className="h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-nilin-rose to-nilin-coral rounded-full"
                      style={{ width: `${(factor.count / (stats?.topRiskFactors?.[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
                <div className={cn('flex items-center gap-1 text-xs', factor.trend > 0 ? 'text-red-500' : 'text-green-500')}>
                  {factor.trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(factor.trend)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search providers..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Risk Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="under_review">Under Review</option>
          <option value="terminated">Terminated</option>
        </select>
      </div>

      {/* Provider List */}
      <div className="space-y-4">
        {filteredProviders.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No providers match your filters</p>
          </div>
        ) : (
          filteredProviders.map(provider => {
            const riskConfig = RISK_LEVEL_CONFIG[provider.riskLevel];
            const statusConfig = STATUS_CONFIG[provider.status];
            const isSelected = selectedProvider?.id === provider.id;
            const riskColor = getRiskColor(provider.riskScore);

            return (
              <div
                key={provider.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  provider.riskLevel === 'critical' ? 'border-red-200 bg-red-50/30' :
                  provider.riskLevel === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-nilin-blush flex items-center justify-center">
                      <User className="w-6 h-6 text-nilin-coral" />
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: riskColor }}
                    >
                      {provider.riskScore}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{provider.providerName}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{
                        borderColor: riskColor,
                        color: riskColor,
                        backgroundColor: `${riskColor}15`
                      }}>
                        {riskConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        {statusConfig.label}
                      </span>
                      {provider.flags.length > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium flex items-center gap-1">
                          <Flag className="w-3 h-3" />
                          {provider.flags.length} flags
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-nilin-warmGray">{provider.email}</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-nilin-warmGray">Bookings:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">{provider.totalBookings}</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Revenue:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">AED {provider.totalRevenue.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Rating:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">{provider.avgRating}/5</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Completion:</span>
                        <span className="ml-1 font-medium text-nilin-charcoal">{provider.completionRate}%</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Disputes:</span>
                        <span className={cn('ml-1 font-medium', provider.disputeRate > 5 ? 'text-red-600' : 'text-nilin-charcoal')}>
                          {provider.disputeRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(provider.status === 'active' && provider.riskLevel !== 'low') && (
                      <button
                        onClick={() => handleSuspend(provider.providerId)}
                        disabled={WIDGET_MUTATIONS_READ_ONLY || actionLoading === provider.providerId}
                        title={WIDGET_MUTATIONS_READ_ONLY ? 'Read-only' : 'Suspend provider'}
                        className="px-3 py-1.5 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedProvider(isSelected ? null : provider)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    {/* Risk Factors Radar */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Risk Factor Breakdown</h4>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={[
                              { factor: 'Compliance', value: provider.factors.compliance },
                              { factor: 'Financial', value: provider.factors.financial },
                              { factor: 'Behavioral', value: provider.factors.behavioral },
                              { factor: 'Quality', value: provider.factors.quality },
                              { factor: 'Historical', value: provider.factors.historical }
                            ]}>
                              <PolarGrid stroke="#E5E7EB" />
                              <PolarAngleAxis dataKey="factor" stroke="#6B7280" fontSize={11} />
                              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#6B7280" fontSize={10} />
                              <Radar name="Score" dataKey="value" stroke="#E8B4A8" fill="#E8B4A8" fillOpacity={0.5} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Risk Flags</h4>
                        {provider.flags.length === 0 ? (
                          <p className="text-sm text-green-600 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            No risk flags detected
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {provider.flags.map((flag, index) => (
                              <div key={index} className={cn(
                                'p-3 rounded-xl text-sm',
                                flag.severity === 'high' ? 'bg-red-50 border border-red-200' :
                                flag.severity === 'medium' ? 'bg-amber-50 border border-amber-200' :
                                'bg-blue-50 border border-blue-200'
                              )}>
                                <div className="flex items-center gap-2">
                                  <Flag className="w-4 h-4" style={{
                                    color: flag.severity === 'high' ? '#EF4444' :
                                           flag.severity === 'medium' ? '#F59E0B' : '#3B82F6'
                                  }} />
                                  <span className="font-medium capitalize">{flag.type.replace(/_/g, ' ')}</span>
                                </div>
                                <p className="text-nilin-warmGray mt-1">{flag.description}</p>
                                <p className="text-xs text-nilin-warmGray mt-1">
                                  Detected: {new Date(flag.detectedAt).toLocaleString()}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProviderRiskScore;
