import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Calendar,
  ArrowRight,
  Globe,
  Building2
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
  ComposedChart
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface CityData {
  cityId: string;
  cityName: string;
  region: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  providers: number;
  customers: number;
  bookings: number;
  completedBookings: number;
  cancelledBookings: number;
  revenue: number;
  avgOrderValue: number;
  growthRate: number;
  marketShare: number;
  activeProviders: number;
  newProvidersThisMonth: number;
  newCustomersThisMonth: number;
  avgRating: number;
  avgWaitTime: number;
  trend: Array<{ month: string; bookings: number; revenue: number }>;
}

interface CityStats {
  totalCities: number;
  topCities: number;
  totalRevenue: number;
  avgMarketShare: number;
  totalProviders: number;
  totalCustomers: number;
  topCity: string;
  fastestGrowing: string;
  geographicDistribution: Array<{ region: string; count: number; revenue: number; color: string }>;
  monthlyTrend: Array<{ month: string; cities: number; revenue: number }>;
  topPerformers: Array<{ city: string; revenue: number; growth: number }>;
}

interface CityPerformanceProps {
  embedded?: boolean;
  onClose?: () => void;
}

const REGION_COLORS: Record<string, string> = {
  'Dubai': '#10B981',
  'Abu Dhabi': '#3B82F6',
  'Northern Emirates': '#8B5CF6',
  'Central': '#F59E0B'
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(amount);
};

export const CityPerformance: React.FC<CityPerformanceProps> = ({
  embedded = false,
  onClose
}) => {
  const [cities, setCities] = useState<CityData[]>([]);
  const [stats, setStats] = useState<CityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'revenue' | 'bookings' | 'growth'>('revenue');
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/geographic/performance');

      if (response.data?.success) {
        setCities(response.data.data.cities || []);
        setStats(response.data.data.stats);
      } else {
        setError('No data available from the server');
      }
    } catch (err) {
      console.error('Error fetching geographic data:', err);
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

  const filteredCities = cities.filter(city => {
    const matchesSearch = city.cityName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          city.region.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRegion = regionFilter === 'all' || city.region === regionFilter;
    return matchesSearch && matchesRegion;
  }).sort((a, b) => {
    if (sortBy === 'revenue') return b.revenue - a.revenue;
    if (sortBy === 'bookings') return b.bookings - a.bookings;
    return b.growthRate - a.growthRate;
  });

  const uniqueRegions = [...new Set(cities.map(c => c.region))];

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
          <MapPin className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load City Data</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
            <Globe className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">City Performance</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Geographic market analysis</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <MapPin className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCities || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Total Cities</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <DollarSign className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatCurrency(stats?.totalRevenue || 0)}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Total Revenue</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalProviders || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Total Providers</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <TrendingUp className="w-6 h-6 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.fastestGrowing || '-'}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Fastest Growing</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Trend */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue Trend by City</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.monthlyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} name="Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Region</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.geographicDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="revenue"
                  nameKey="region"
                >
                  {stats?.geographicDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.geographicDistribution?.map(item => (
              <div key={item.region} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-nilin-warmGray">{item.region}</span>
                </div>
                <span className="text-xs font-medium text-nilin-charcoal">{formatCurrency(item.revenue)}</span>
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
            placeholder="Search cities..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Regions</option>
          {uniqueRegions.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'revenue' | 'bookings' | 'growth')}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="revenue">Sort by Revenue</option>
          <option value="bookings">Sort by Bookings</option>
          <option value="growth">Sort by Growth</option>
        </select>
      </div>

      {/* Cities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCities.map(city => {
          const regionColor = REGION_COLORS[city.region] || '#6B7280';
          const isSelected = selectedCity?.cityId === city.cityId;

          return (
            <div
              key={city.cityId}
              onClick={() => setSelectedCity(isSelected ? null : city)}
              className={cn(
                'glass rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md',
                isSelected ? 'border-nilin-coral shadow-nilin-warm' : 'border-nilin-border/50'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${regionColor}20` }}>
                  <MapPin className="w-5 h-5" style={{ color: regionColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-nilin-charcoal truncate">{city.cityName}</p>
                  <p className="text-xs text-nilin-warmGray">{city.region}</p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-sm font-semibold',
                    city.growthRate > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {city.growthRate > 0 ? '+' : ''}{city.growthRate}%
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-nilin-warmGray">Revenue</p>
                  <p className="font-semibold text-nilin-charcoal">{formatCurrency(city.revenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-warmGray">Bookings</p>
                  <p className="font-semibold text-nilin-charcoal">{city.bookings.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-warmGray">Providers</p>
                  <p className="font-semibold text-nilin-charcoal">{city.providers}</p>
                </div>
                <div>
                  <p className="text-xs text-nilin-warmGray">Market Share</p>
                  <p className="font-semibold text-nilin-charcoal">{city.marketShare}%</p>
                </div>
              </div>

              {isSelected && (
                <div className="mt-4 pt-4 border-t border-nilin-border/50">
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={city.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                        <XAxis dataKey="month" stroke="#6B7280" fontSize={10} />
                        <YAxis stroke="#6B7280" fontSize={10} />
                        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="revenue" fill={regionColor} radius={[4, 4, 0, 0]} name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="text-center">
                      <p className="text-nilin-warmGray">AOV</p>
                      <p className="font-medium text-nilin-charcoal">{formatCurrency(city.avgOrderValue)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-nilin-warmGray">Rating</p>
                      <p className="font-medium text-nilin-charcoal">{city.avgRating}/5</p>
                    </div>
                    <div className="text-center">
                      <p className="text-nilin-warmGray">Wait Time</p>
                      <p className="font-medium text-nilin-charcoal">{city.avgWaitTime}min</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CityPerformance;
