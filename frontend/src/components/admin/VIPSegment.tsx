import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown,
  Star,
  Users,
  TrendingUp,
  DollarSign,
  Gift,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  Heart,
  Award,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
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
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface VIPCustomer {
  id: string;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  lifetimeValue: number;
  totalBookings: number;
  avgOrderValue: number;
  lastBooking: string;
  joinedAt: string;
  preferences: string[];
  engagement: number;
  upgradePotential: 'low' | 'medium' | 'high';
}

interface VIPStats {
  totalVIP: number;
  byTier: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };
  totalRevenue: number;
  avgLifetimeValue: number;
  avgOrderValue: number;
  avgBookings: number;
  retentionRate: number;
  growthRate: number;
  tierDistribution: Array<{ tier: string; count: number; revenue: number; color: string }>;
  monthlyTrend: Array<{ month: string; vipCount: number; revenue: number }>;
  topCategories: Array<{ category: string; percentage: number }>;
}

interface VIPSegmentProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TIER_CONFIG = {
  bronze: { label: 'Bronze VIP', color: '#CD7F32', bgColor: 'bg-amber-700', textColor: 'text-amber-100' },
  silver: { label: 'Silver VIP', color: '#C0C0C0', bgColor: 'bg-gray-400', textColor: 'text-gray-100' },
  gold: { label: 'Gold VIP', color: '#FFD700', bgColor: 'bg-yellow-500', textColor: 'text-yellow-900' },
  platinum: { label: 'Platinum VIP', color: '#E5E4E2', bgColor: 'bg-purple-500', textColor: 'text-purple-100' }
};

const UPGRADE_CONFIG = {
  low: { label: 'Low Potential', color: 'bg-blue-100 text-blue-700' },
  medium: { label: 'Medium Potential', color: 'bg-amber-100 text-amber-700' },
  high: { label: 'High Potential', color: 'bg-green-100 text-green-700' }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
};

export const VIPSegment: React.FC<VIPSegmentProps> = ({
  embedded = false,
  onClose
}) => {
  const [customers, setCustomers] = useState<VIPCustomer[]>([]);
  const [stats, setStats] = useState<VIPStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<VIPCustomer | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/vip/segment');

      if (response.data?.success) {
        setCustomers(response.data.data.customers || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching VIP data:', err);
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

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          customer.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || customer.tier === tierFilter;
    return matchesSearch && matchesTier;
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
          <Crown className="w-12 h-12 text-amber-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load VIP Data</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center">
            <Crown className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">VIP Customer Segment</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Premium customer analytics and management</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Crown className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalVIP || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total VIPs</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <DollarSign className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{formatCurrency(stats?.totalRevenue || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Revenue</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Award className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{formatCurrency(stats?.avgLifetimeValue || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Avg LTV</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.retentionRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Retention Rate</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <ArrowUpRight className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">+{stats?.growthRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Growth Rate</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* VIP Growth Trend */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">VIP Growth Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <defs>
                  <linearGradient id="vipGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area yAxisId="left" type="monotone" dataKey="vipCount" stroke="#FFD700" fill="url(#vipGradient)" strokeWidth={2} name="VIP Count" />
                <Area yAxisId="right" type="monotone" dataKey="revenue" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tier Distribution */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Tier Distribution</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.tierDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="tier"
                >
                  {stats?.tierDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.tierDistribution?.map(item => (
              <div key={item.tier} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-nilin-warmGray">{item.tier}</span>
                </div>
                <span className="text-xs font-medium text-nilin-charcoal">{item.count}</span>
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
            placeholder="Search VIP customers..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Tiers</option>
          <option value="platinum">Platinum</option>
          <option value="gold">Gold</option>
          <option value="silver">Silver</option>
          <option value="bronze">Bronze</option>
        </select>
      </div>

      {/* VIP Customers Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-nilin-blush/30">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Tier</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">LTV</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Bookings</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray uppercase">Avg Order</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Engagement</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray uppercase">Upgrade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nilin-border/50">
            {filteredCustomers.map(customer => {
              const tierConfig = TIER_CONFIG[customer.tier];
              const upgradeConfig = UPGRADE_CONFIG[customer.upgradePotential];

              return (
                <tr
                  key={customer.id}
                  className="hover:bg-nilin-blush/20 transition-colors cursor-pointer"
                  onClick={() => setSelectedCustomer(selectedCustomer?.id === customer.id ? null : customer)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
                        <span className="text-white font-semibold text-sm">{customer.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="font-medium text-nilin-charcoal">{customer.name}</p>
                        <p className="text-xs text-nilin-warmGray">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-3 py-1 rounded-full text-xs font-semibold', tierConfig.bgColor, tierConfig.textColor)}>
                      {tierConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-nilin-charcoal">
                    {formatCurrency(customer.lifetimeValue)}
                  </td>
                  <td className="px-4 py-3 text-right text-nilin-warmGray">
                    {customer.totalBookings}
                  </td>
                  <td className="px-4 py-3 text-right text-nilin-warmGray">
                    {formatCurrency(customer.avgOrderValue)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-nilin-blush/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
                          style={{ width: `${customer.engagement}%` }}
                        />
                      </div>
                      <span className="text-sm text-nilin-charcoal">{customer.engagement}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded text-xs font-medium', upgradeConfig.color)}>
                      {upgradeConfig.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedCustomer && (
        <div className="mt-6 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Customer Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-nilin-warmGray">Phone</p>
              <p className="text-sm text-nilin-charcoal font-medium">{selectedCustomer.phone}</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Last Booking</p>
              <p className="text-sm text-nilin-charcoal font-medium">{new Date(selectedCustomer.lastBooking).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Member Since</p>
              <p className="text-sm text-nilin-charcoal font-medium">{new Date(selectedCustomer.joinedAt).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Preferences</p>
              <p className="text-sm text-nilin-charcoal font-medium">{selectedCustomer.preferences.join(', ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VIPSegment;
