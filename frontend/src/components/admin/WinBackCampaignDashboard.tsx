import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Gift,
  Mail,
  MessageSquare,
  Smartphone,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  Calendar,
  DollarSign,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Eye,
  Send,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  Zap,
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
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface Campaign {
  _id: string;
  campaignId: string;
  campaignType: 'dormant_30' | 'dormant_60' | 'dormant_90' | 'churn_risk' | 'win_back';
  status: 'pending' | 'engaged' | 'converted' | 'failed' | 'skipped';
  userId: string;
  userName: string;
  userEmail: string;
  offerValue: number;
  offerCode: string;
  expiresAt: string;
  channels: Array<{
    channel: 'email' | 'push' | 'sms';
    status: 'pending' | 'sent' | 'opened' | 'clicked' | 'failed';
  }>;
  conversion?: {
    convertedAt: string;
    bookingId: string;
    revenue: number;
  };
  detectionDate: string;
  createdAt: string;
}

interface WinBackStats {
  totalCampaigns: number;
  byStatus: Record<string, number>;
  byType: Record<string, { total: number; converted: number; conversionRate: number }>;
  averageConversionTime: number;
  totalRevenue: number;
  roi: number;
  campaignsTrend: Array<{ date: string; sent: number; converted: number }>;
  channelPerformance: Array<{ channel: string; sent: number; opened: number; clicked: number; rate: number }>;
}

interface WinBackCampaignDashboardProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CAMPAIGN_TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  dormant_30: { label: 'Dormant 30 Days', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  dormant_60: { label: 'Dormant 60 Days', color: 'text-amber-600', bgColor: 'bg-amber-100' },
  dormant_90: { label: 'Dormant 90 Days', color: 'text-orange-600', bgColor: 'bg-orange-100' },
  churn_risk: { label: 'Churn Risk', color: 'text-red-600', bgColor: 'bg-red-100' },
  win_back: { label: 'Win Back', color: 'text-purple-600', bgColor: 'bg-purple-100' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Clock },
  engaged: { label: 'Engaged', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Eye },
  converted: { label: 'Converted', color: 'text-green-600', bgColor: 'bg-green-100', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'text-red-600', bgColor: 'bg-red-100', icon: XCircle },
  skipped: { label: 'Skipped', color: 'text-gray-600', bgColor: 'bg-gray-100', icon: XCircle },
};

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  push: Smartphone,
  sms: MessageSquare,
};

export const WinBackCampaignDashboard: React.FC<WinBackCampaignDashboardProps> = ({
  embedded = false,
  onClose,
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<WinBackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'offers' | 'segments'>('overview');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/automation/winback');

      if (response.data?.success) {
        setCampaigns(response.data.data.campaigns || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching win-back data:', err);
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

  const handleResendCampaign = async (campaignId: string) => {
    try {
      await api.post(`/admin/automation/winback/${campaignId}/resend`);
      await handleRefresh();
    } catch (err) {
      console.error('Error resending campaign:', err);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch =
      campaign.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      campaign.campaignId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter;
    const matchesType = typeFilter === 'all' || campaign.campaignType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: string): string => {
    return new Date(date).toLocaleDateString('en-AE', {
      month: 'short',
      day: 'numeric',
    });
  };

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
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Campaign Data</h3>
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

  const totalConverted = stats?.byStatus.converted || 0;
  const conversionRate = stats?.totalCampaigns
    ? ((totalConverted / stats.totalCampaigns) * 100).toFixed(1)
    : '0';

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
            <Target className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Win-Back Campaigns</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Re-engage inactive customers</p>
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

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-nilin-blush/20 rounded-xl mb-6 w-fit">
        {(['overview', 'campaigns', 'offers', 'segments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              activeTab === tab
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
              <Target className="w-6 h-6 text-purple-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCampaigns || 0}</p>
              <p className="text-xs text-nilin-warmGray">Total Campaigns</p>
            </div>
            <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-green-600">{totalConverted}</p>
              <p className="text-xs text-nilin-warmGray">Converted</p>
            </div>
            <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
              <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-blue-600">{conversionRate}%</p>
              <p className="text-xs text-nilin-warmGray">Conversion Rate</p>
            </div>
            <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
              <DollarSign className="w-6 h-6 text-amber-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-amber-600">{formatCurrency(stats?.totalRevenue || 0)}</p>
              <p className="text-xs text-nilin-warmGray">Revenue</p>
            </div>
            <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
              <BarChart3 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-emerald-600">{stats?.roi || 0}x</p>
              <p className="text-xs text-nilin-warmGray">ROI</p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Campaign Trend */}
            <div className="glass rounded-2xl border border-nilin-border/50 p-6">
              <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Campaign Performance Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.campaignsTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                    <YAxis stroke="#6B7280" fontSize={11} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                    <defs>
                      <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="convertedGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="sent" stroke="#8B5CF6" fill="url(#sentGradient)" strokeWidth={2} name="Sent" />
                    <Area type="monotone" dataKey="converted" stroke="#10B981" fill="url(#convertedGradient)" strokeWidth={2} name="Converted" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Channel Performance */}
            <div className="glass rounded-2xl border border-nilin-border/50 p-6">
              <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Channel Performance</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats?.channelPerformance || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" stroke="#6B7280" fontSize={11} />
                    <YAxis dataKey="channel" type="category" stroke="#6B7280" fontSize={11} width={60} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                    <Bar dataKey="sent" fill="#8B5CF6" name="Sent" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="opened" fill="#10B981" name="Opened" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="clicked" fill="#F59E0B" name="Clicked" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Campaign Type Performance */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Performance by Campaign Type</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-nilin-blush/30">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Campaign Type</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Converted</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nilin-border/50">
                  {Object.entries(stats?.byType || {}).map(([type, data]) => {
                    const config = CAMPAIGN_TYPE_CONFIG[type] || { label: type, color: 'text-gray-600', bgColor: 'bg-gray-100' };
                    return (
                      <tr key={type} className="hover:bg-nilin-blush/20 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn('px-3 py-1 rounded-full text-xs font-medium', config.bgColor, config.color)}>
                            {config.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">{data.total}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{data.converted}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${data.conversionRate}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium text-green-600">{data.conversionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'campaigns' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campaigns..."
                className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="engaged">Engaged</option>
              <option value="converted">Converted</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            >
              <option value="all">All Types</option>
              <option value="dormant_30">Dormant 30 Days</option>
              <option value="dormant_60">Dormant 60 Days</option>
              <option value="dormant_90">Dormant 90 Days</option>
              <option value="churn_risk">Churn Risk</option>
              <option value="win_back">Win Back</option>
            </select>
          </div>

          {/* Campaigns List */}
          <div className="space-y-4">
            {filteredCampaigns.length === 0 ? (
              <div className="text-center py-12 text-nilin-warmGray">
                <Target className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="font-medium">No campaigns match your filters</p>
              </div>
            ) : (
              filteredCampaigns.map(campaign => {
                const typeConfig = CAMPAIGN_TYPE_CONFIG[campaign.campaignType] || CAMPAIGN_TYPE_CONFIG.dormant_30;
                const statusConfig = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;
                const isSelected = selectedCampaign?._id === campaign._id;

                return (
                  <div
                    key={campaign._id}
                    className={cn(
                      'glass rounded-xl border p-4 transition-all cursor-pointer',
                      isSelected ? 'border-nilin-coral bg-nilin-blush/20' : 'border-nilin-border/50 hover:border-nilin-coral/50'
                    )}
                    onClick={() => setSelectedCampaign(isSelected ? null : campaign)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-nilin-charcoal">{campaign.userName}</span>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium', typeConfig.bgColor, typeConfig.color)}>
                            {typeConfig.label}
                          </span>
                          <span className={cn('px-2 py-0.5 rounded text-xs font-medium flex items-center gap-1', statusConfig.bgColor, statusConfig.color)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusConfig.label}
                          </span>
                        </div>
                        <p className="text-sm text-nilin-warmGray">{campaign.userEmail}</p>
                        <div className="flex items-center gap-4 text-sm mt-2">
                          <span className="text-nilin-warmGray">
                            Offer: <span className="font-medium text-nilin-charcoal">{campaign.offerValue}% off</span>
                          </span>
                          <span className="text-nilin-warmGray">
                            Code: <span className="font-mono text-nilin-coral">{campaign.offerCode}</span>
                          </span>
                          <span className="text-nilin-warmGray">
                            Expires: <span className="font-medium">{formatDate(campaign.expiresAt)}</span>
                          </span>
                        </div>
                        {/* Channels */}
                        <div className="flex items-center gap-2 mt-3">
                          {campaign.channels.map(ch => {
                            const ChannelIcon = CHANNEL_ICONS[ch.channel] || Mail;
                            const channelColors = ch.status === 'opened' || ch.status === 'clicked'
                              ? 'bg-green-100 text-green-600'
                              : ch.status === 'sent'
                              ? 'bg-blue-100 text-blue-600'
                              : ch.status === 'failed'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-gray-100 text-gray-600';
                            return (
                              <span
                                key={ch.channel}
                                className={cn('px-2 py-1 rounded text-xs font-medium flex items-center gap-1', channelColors)}
                                title={`${ch.channel}: ${ch.status}`}
                              >
                                <ChannelIcon className="w-3 h-3" />
                                {ch.channel}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {campaign.status === 'pending' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResendCampaign(campaign._id);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                          >
                            Resend
                          </button>
                        )}
                        {campaign.conversion && (
                          <div className="text-right">
                            <p className="text-sm font-medium text-green-600">
                              +{formatCurrency(campaign.conversion.revenue)}
                            </p>
                            <p className="text-xs text-nilin-warmGray">Revenue</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {activeTab === 'offers' && (
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Offer Management</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(CAMPAIGN_TYPE_CONFIG).map(([type, config]) => (
              <div key={type} className="p-4 border border-nilin-border rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Gift className="w-5 h-5" style={{ color: config.color.replace('text-', '') }} />
                  <span className="font-medium text-nilin-charcoal">{config.label}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-nilin-warmGray">Discount</span>
                    <span className="font-medium text-nilin-charcoal">
                      {type === 'dormant_30' ? '10%' : type === 'dormant_60' ? '15%' : type === 'dormant_90' ? '20%' : type === 'churn_risk' ? '25%' : 'Free Service'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-nilin-warmGray">Validity</span>
                    <span className="font-medium text-nilin-charcoal">7 days</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-nilin-warmGray">Conversion</span>
                    <span className="font-medium text-green-600">
                      {stats?.byType[type]?.conversionRate || 0}%
                    </span>
                  </div>
                </div>
                <button className="w-full mt-4 py-2 rounded-lg border border-nilin-border text-sm font-medium text-nilin-warmGray hover:bg-nilin-blush/30 transition-colors">
                  Edit Offer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'segments' && (
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Target Segments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800">Dormant 30 Days</p>
                  <p className="text-sm text-blue-600">{stats?.byType.dormant_30?.total || 0} users</p>
                </div>
              </div>
              <p className="text-sm text-blue-700">Users inactive for 30+ days</p>
              <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Create Campaign
              </button>
            </div>
            <div className="p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-xl border border-red-200">
              <div className="flex items-center gap-3 mb-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <div>
                  <p className="font-medium text-red-800">High Churn Risk</p>
                  <p className="text-sm text-red-600">{stats?.byType.churn_risk?.total || 0} users</p>
                </div>
              </div>
              <p className="text-sm text-red-700">Users with high churn probability</p>
              <button className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
                Create Campaign
              </button>
            </div>
            <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-xl border border-amber-200">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800">Dormant 60 Days</p>
                  <p className="text-sm text-amber-600">{stats?.byType.dormant_60?.total || 0} users</p>
                </div>
              </div>
              <p className="text-sm text-amber-700">Users inactive for 60+ days</p>
              <button className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors">
                Create Campaign
              </button>
            </div>
            <div className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl border border-purple-200">
              <div className="flex items-center gap-3 mb-3">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="font-medium text-purple-800">Win-Back Candidates</p>
                  <p className="text-sm text-purple-600">{stats?.byType.win_back?.total || 0} users</p>
                </div>
              </div>
              <p className="text-sm text-purple-700">Previously churned users who may return</p>
              <button className="mt-3 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors">
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WinBackCampaignDashboard;
