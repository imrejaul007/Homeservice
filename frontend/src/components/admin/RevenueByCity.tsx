import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronUp,
  Globe,
  Users,
  Building,
  ArrowUpDown,
  Download,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface CityData {
  cityId: string;
  cityName: string;
  region: string;
  country: string;
  revenue: number;
  bookings: number;
  customers: number;
  providers: number;
  avgOrderValue: number;
  growth: number;
  growthTrend: 'up' | 'down' | 'stable';
  topCategories: Array<{ name: string; revenue: number; percentage: number }>;
}

interface RevenueByCityStats {
  totalRevenue: number;
  totalBookings: number;
  totalCustomers: number;
  totalCities: number;
  avgOrderValue: number;
  avgRevenuePerCity: number;
  topCity: string;
  fastestGrowing: string;
  byCity: CityData[];
  byRegion: Array<{
    region: string;
    revenue: number;
    bookings: number;
    growth: number;
    percentage: number;
  }>;
  trend: Array<{ date: string; [cityId: string]: string | number }>;
  comparison: Array<{
    date: string;
    current: number;
    previous: number;
  }>;
}

interface RevenueByCityProps {
  embedded?: boolean;
  onClose?: () => void;
}

const REGION_COLORS: Record<string, string> = {
  'Dubai': '#10B981',
  'Abu Dhabi': '#3B82F6',
  'Northern Emirates': '#8B5CF6',
  'Other': '#F59E0B'
};

const CITY_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#F97316'];

export const RevenueByCity: React.FC<RevenueByCityProps> = ({
  embedded = false,
  onClose
}) => {
  const [stats, setStats] = useState<RevenueByCityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<string>('30d');
  const [sortBy, setSortBy] = useState<'revenue' | 'bookings' | 'growth' | 'customers'>('revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/revenue-by-city', {
        params: { dateRange }
      });

      if (response.data?.success) {
        setStats(response.data.data);
      } else {
        // Mock data
        setStats({
          totalRevenue: 2456780,
          totalBookings: 12567,
          totalCustomers: 8934,
          totalCities: 12,
          avgOrderValue: 195,
          avgRevenuePerCity: 204732,
          topCity: 'Dubai',
          fastestGrowing: 'Abu Dhabi',
          byCity: [
            {
              cityId: 'dubai',
              cityName: 'Dubai',
              region: 'Dubai',
              country: 'UAE',
              revenue: 1234560,
              bookings: 6234,
              customers: 4567,
              providers: 234,
              avgOrderValue: 198,
              growth: 18.5,
              growthTrend: 'up',
              topCategories: [
                { name: 'Home Cleaning', revenue: 345600, percentage: 28 },
                { name: 'AC Repair', revenue: 289000, percentage: 23 },
                { name: 'Plumbing', revenue: 198000, percentage: 16 },
                { name: 'Electrical', revenue: 156000, percentage: 13 },
                { name: 'Beauty', revenue: 245960, percentage: 20 }
              ]
            },
            {
              cityId: 'abu-dhabi',
              cityName: 'Abu Dhabi',
              region: 'Abu Dhabi',
              country: 'UAE',
              revenue: 567890,
              bookings: 2890,
              customers: 2100,
              providers: 123,
              avgOrderValue: 196,
              growth: 24.3,
              growthTrend: 'up',
              topCategories: [
                { name: 'Home Cleaning', revenue: 156000, percentage: 27 },
                { name: 'AC Repair', revenue: 134000, percentage: 24 },
                { name: 'Plumbing', revenue: 89000, percentage: 16 },
                { name: 'Electrical', revenue: 78000, percentage: 14 },
                { name: 'Gardening', revenue: 110890, percentage: 19 }
              ]
            },
            {
              cityId: 'sharjah',
              cityName: 'Sharjah',
              region: 'Northern Emirates',
              country: 'UAE',
              revenue: 234560,
              bookings: 1234,
              customers: 890,
              providers: 67,
              avgOrderValue: 190,
              growth: 12.8,
              growthTrend: 'up',
              topCategories: [
                { name: 'Home Cleaning', revenue: 78000, percentage: 33 },
                { name: 'Plumbing', revenue: 56000, percentage: 24 },
                { name: 'Electrical', revenue: 45000, percentage: 19 },
                { name: 'AC Repair', revenue: 34560, percentage: 15 },
                { name: 'Other', revenue: 21000, percentage: 9 }
              ]
            },
            {
              cityId: 'ajman',
              cityName: 'Ajman',
              region: 'Northern Emirates',
              country: 'UAE',
              revenue: 156780,
              bookings: 845,
              customers: 567,
              providers: 45,
              avgOrderValue: 185,
              growth: 8.5,
              growthTrend: 'up',
              topCategories: [
                { name: 'Home Cleaning', revenue: 56000, percentage: 36 },
                { name: 'Plumbing', revenue: 42000, percentage: 27 },
                { name: 'Electrical', revenue: 32000, percentage: 20 },
                { name: 'Other', revenue: 26780, percentage: 17 }
              ]
            },
            {
              cityId: 'ras-al-khaima',
              cityName: 'Ras Al Khaimah',
              region: 'Northern Emirates',
              country: 'UAE',
              revenue: 98000,
              bookings: 534,
              customers: 345,
              providers: 28,
              avgOrderValue: 183,
              growth: -2.3,
              growthTrend: 'down',
              topCategories: [
                { name: 'Home Cleaning', revenue: 35000, percentage: 36 },
                { name: 'Plumbing', revenue: 28000, percentage: 29 },
                { name: 'Electrical', revenue: 19000, percentage: 19 },
                { name: 'Other', revenue: 16000, percentage: 16 }
              ]
            },
            {
              cityId: 'fujairah',
              cityName: 'Fujairah',
              region: 'Northern Emirates',
              country: 'UAE',
              revenue: 45000,
              bookings: 245,
              customers: 178,
              providers: 15,
              avgOrderValue: 184,
              growth: 5.2,
              growthTrend: 'up',
              topCategories: [
                { name: 'Home Cleaning', revenue: 18000, percentage: 40 },
                { name: 'Plumbing', revenue: 12000, percentage: 27 },
                { name: 'Electrical', revenue: 8000, percentage: 18 },
                { name: 'Other', revenue: 7000, percentage: 15 }
              ]
            },
            {
              cityId: 'al-ain',
              cityName: 'Al Ain',
              region: 'Abu Dhabi',
              country: 'UAE',
              revenue: 89000,
              bookings: 456,
              customers: 234,
              providers: 23,
              avgOrderValue: 195,
              growth: 15.6,
              growthTrend: 'up',
              topCategories: [
                { name: 'Home Cleaning', revenue: 32000, percentage: 36 },
                { name: 'Plumbing', revenue: 24000, percentage: 27 },
                { name: 'Electrical', revenue: 18000, percentage: 20 },
                { name: 'Other', revenue: 15000, percentage: 17 }
              ]
            }
          ],
          byRegion: [
            { region: 'Dubai', revenue: 1234560, bookings: 6234, growth: 18.5, percentage: 50.2 },
            { region: 'Abu Dhabi', revenue: 656890, bookings: 3346, growth: 22.4, percentage: 26.7 },
            { region: 'Northern Emirates', revenue: 534340, bookings: 2858, growth: 8.9, percentage: 21.7 },
            { region: 'Other', revenue: 28290, bookings: 129, growth: 3.2, percentage: 1.2 }
          ],
          trend: [
            { date: 'Week 1', dubai: 280000, 'abu-dhabi': 120000, sharjah: 52000, ajman: 35000 },
            { date: 'Week 2', dubai: 295000, 'abu-dhabi': 135000, sharjah: 55000, ajman: 38000 },
            { date: 'Week 3', dubai: 310000, 'abu-dhabi': 148000, sharjah: 58000, ajman: 40000 },
            { date: 'Week 4', dubai: 349560, 'abu-dhabi': 164890, sharjah: 69560, ajman: 43780 }
          ],
          comparison: [
            { date: 'Jan', current: 1800000, previous: 1500000 },
            { date: 'Feb', current: 1950000, previous: 1650000 },
            { date: 'Mar', current: 2100000, previous: 1750000 },
            { date: 'Apr', current: 2456780, previous: 1980000 }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching revenue by city data:', err);
      setError('Failed to load revenue by city data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `AED ${(amount / 1000000).toFixed(1)}M`;
    }
    if (amount >= 1000) {
      return `AED ${(amount / 1000).toFixed(1)}K`;
    }
    return `AED ${amount}`;
  };

  const sortedCities = stats?.byCity.slice().sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    const modifier = sortOrder === 'asc' ? 1 : -1;
    return (aVal - bVal) * modifier;
  }) || [];

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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Revenue by City</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Revenue by City</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Geographic revenue breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
          </select>
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <Building className="w-5 h-5 text-nilin-warmGray" />
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
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{formatCurrency(stats?.totalRevenue || 0)}</p>
          <p className="text-xs text-nilin-warmGray">Total Revenue</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <BarChart3 className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalBookings || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Bookings</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCustomers || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Customers</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Building className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCities || 0}</p>
          <p className="text-xs text-nilin-warmGray">Active Cities</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg Order Value</span>
            <span className="text-lg font-serif text-nilin-charcoal">AED {stats?.avgOrderValue || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Top City</span>
            <span className="text-lg font-serif text-green-600">{stats?.topCity || 'N/A'}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Fastest Growing</span>
            <span className="text-lg font-serif text-green-600">{stats?.fastestGrowing || 'N/A'}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg per City</span>
            <span className="text-lg font-serif text-nilin-charcoal">{formatCurrency(stats?.avgRevenuePerCity || 0)}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue by Region */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue by Region</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byRegion || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="revenue"
                  nameKey="region"
                >
                  {stats?.byRegion?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={REGION_COLORS[entry.region] || CITY_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats?.byRegion.map((item, idx) => (
              <div key={item.region} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: REGION_COLORS[item.region] || CITY_COLORS[idx] }} />
                <span className="text-xs text-nilin-warmGray">{item.region}</span>
                <span className="text-xs font-medium text-nilin-charcoal ml-auto">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trend Chart */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue Trend by Top Cities</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `AED ${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Area type="monotone" dataKey="dubai" stackId="1" stroke="#3B82F6" fill="#3B82F620" strokeWidth={2} name="Dubai" />
                <Area type="monotone" dataKey="abu-dhabi" stackId="1" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Abu Dhabi" />
                <Area type="monotone" dataKey="sharjah" stackId="1" stroke="#F59E0B" fill="#F59E0B20" strokeWidth={2} name="Sharjah" />
                <Area type="monotone" dataKey="ajman" stackId="1" stroke="#8B5CF6" fill="#8B5CF620" strokeWidth={2} name="Ajman" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* City Comparison */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif text-nilin-charcoal">City Comparison</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSort('revenue')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                sortBy === 'revenue' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
              )}
            >
              Revenue
              {sortBy === 'revenue' && <ArrowUpDown className="w-3 h-3 inline ml-1" />}
            </button>
            <button
              onClick={() => handleSort('bookings')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                sortBy === 'bookings' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
              )}
            >
              Bookings
            </button>
            <button
              onClick={() => handleSort('growth')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                sortBy === 'growth' ? 'bg-nilin-coral text-white' : 'bg-nilin-blush/30 text-nilin-charcoal'
              )}
            >
              Growth
            </button>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sortedCities} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis type="number" stroke="#6B7280" fontSize={11} tickFormatter={(v) => formatCurrency(v)} />
              <YAxis dataKey="cityName" type="category" stroke="#6B7280" fontSize={11} width={100} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]}>
                {sortedCities.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CITY_COLORS[index % CITY_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* City Details Table */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">City Details</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-nilin-blush/30">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-nilin-warmGray">City</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Bookings</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Customers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Providers</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Avg Order</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-nilin-warmGray">Growth</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-nilin-warmGray">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nilin-border/30">
              {sortedCities.map((city, idx) => (
                <tr
                  key={city.cityId}
                  className={cn(
                    'hover:bg-nilin-blush/20 cursor-pointer transition-colors',
                    selectedCity?.cityId === city.cityId && 'bg-nilin-blush/30'
                  )}
                  onClick={() => setSelectedCity(selectedCity?.cityId === city.cityId ? null : city)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CITY_COLORS[idx] }} />
                      <div>
                        <p className="font-medium text-nilin-charcoal">{city.cityName}</p>
                        <p className="text-xs text-nilin-warmGray">{city.region}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-nilin-charcoal">{formatCurrency(city.revenue)}</td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">{city.bookings.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">{city.customers.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">{city.providers}</td>
                  <td className="px-4 py-3 text-right text-nilin-charcoal">AED {city.avgOrderValue}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      'flex items-center justify-end gap-1',
                      city.growthTrend === 'up' ? 'text-green-600' : 'text-red-600'
                    )}>
                      {city.growthTrend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {city.growth > 0 ? '+' : ''}{city.growth.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ChevronDown className={cn(
                      'w-4 h-4 mx-auto text-nilin-warmGray transition-transform',
                      selectedCity?.cityId === city.cityId && 'rotate-180'
                    )} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Expanded City Details */}
        {selectedCity && (
          <div className="mt-4 p-4 bg-nilin-blush/20 rounded-xl">
            <h4 className="font-medium text-nilin-charcoal mb-3">{selectedCity.cityName} - Top Categories</h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedCity.topCategories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis type="number" stroke="#6B7280" fontSize={11} tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis dataKey="name" type="category" stroke="#6B7280" fontSize={11} width={100} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Bar dataKey="revenue" name="Revenue" radius={[0, 4, 4, 0]} fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-4">
              {selectedCity.topCategories.map((cat, idx) => (
                <div key={cat.name} className="p-3 bg-white/50 rounded-lg">
                  <p className="text-sm text-nilin-warmGray">{cat.name}</p>
                  <p className="text-lg font-serif text-nilin-charcoal">{formatCurrency(cat.revenue)}</p>
                  <p className="text-xs text-nilin-warmGray">{cat.percentage}% of city revenue</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueByCity;
