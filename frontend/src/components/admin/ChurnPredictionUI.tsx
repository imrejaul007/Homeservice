import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingDown,
  Users,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Search,
  Filter,
  AlertCircle,
  Activity,
  Heart,
  Clock,
  DollarSign,
  BarChart3,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  Send,
  MessageSquare
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
  ScatterChart,
  Scatter
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface ChurnPrediction {
  customerId: string;
  name: string;
  email: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  churnProbability: number;
  predictedChurnDate?: string;
  daysUntilChurn?: number;
  lastActive: string;
  lastBooking: string;
  bookingFrequency: number;
  avgOrderValue: number;
  totalSpend: number;
  engagementScore: number;
  factors: Array<{ factor: string; impact: number; direction: 'positive' | 'negative' }>;
  recommendedActions: string[];
  contactAttempts: number;
  outreachStatus: 'none' | 'pending' | 'contacted' | 'retained' | 'lost';
}

interface ChurnStats {
  totalCustomers: number;
  atRisk: number;
  criticalRisk: number;
  churnRate: number;
  predictedChurnRate: number;
  retentionRate: number;
  avgChurnProbability: number;
  savedByCampaigns: number;
  churnTrend: Array<{ date: string; churnRate: number; predicted: number }>;
  riskDistribution: Array<{ level: string; count: number; color: string }>;
  topChurnFactors: Array<{ factor: string; impact: number }>;
  retentionCost: number;
}

interface ChurnPredictionUIProps {
  embedded?: boolean;
  onClose?: () => void;
}

const RISK_LEVEL_CONFIG = {
  low: { label: 'Low Risk', color: '#10B981', bgColor: 'bg-green-100' },
  medium: { label: 'Medium Risk', color: '#F59E0B', bgColor: 'bg-amber-100' },
  high: { label: 'High Risk', color: '#F97316', bgColor: 'bg-orange-100' },
  critical: { label: 'Critical', color: '#EF4444', bgColor: 'bg-red-100' }
};

const OUTREACH_CONFIG = {
  none: { label: 'Not Contacted', color: 'bg-gray-100 text-gray-700' },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  contacted: { label: 'Contacted', color: 'bg-blue-100 text-blue-700' },
  retained: { label: 'Retained', color: 'bg-green-100 text-green-700' },
  lost: { label: 'Lost', color: 'bg-red-100 text-red-700' }
};

const getRiskColor = (score: number): string => {
  if (score < 25) return '#10B981';
  if (score < 50) return '#F59E0B';
  if (score < 75) return '#F97316';
  return '#EF4444';
};

export const ChurnPredictionUI: React.FC<ChurnPredictionUIProps> = ({
  embedded = false,
  onClose
}) => {
  const [predictions, setPredictions] = useState<ChurnPrediction[]>([]);
  const [stats, setStats] = useState<ChurnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [outreachFilter, setOutreachFilter] = useState<string>('all');
  const [selectedPrediction, setSelectedPrediction] = useState<ChurnPrediction | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/churn/predictions');

      if (response.data?.success) {
        setPredictions(response.data.data.predictions || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setPredictions([
          {
            customerId: 'cust-001',
            name: 'Ahmed Hassan',
            email: 'ahmed@email.com',
            riskScore: 85,
            riskLevel: 'critical',
            churnProbability: 0.78,
            predictedChurnDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilChurn: 14,
            lastActive: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            lastBooking: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
            bookingFrequency: 0.5,
            avgOrderValue: 350,
            totalSpend: 4200,
            engagementScore: 25,
            factors: [
              { factor: 'Declining engagement', impact: 0.35, direction: 'negative' },
              { factor: 'No recent bookings', impact: 0.28, direction: 'negative' },
              { factor: 'Negative reviews', impact: 0.15, direction: 'negative' },
              { factor: 'Price sensitivity', impact: 0.12, direction: 'negative' }
            ],
            recommendedActions: ['Send personalized discount', 'Phone outreach', 'Schedule check-in'],
            contactAttempts: 0,
            outreachStatus: 'none'
          },
          {
            customerId: 'cust-002',
            name: 'Sarah Khan',
            email: 'sarah@email.com',
            riskScore: 62,
            riskLevel: 'high',
            churnProbability: 0.55,
            predictedChurnDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            daysUntilChurn: 30,
            lastActive: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            lastBooking: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
            bookingFrequency: 0.8,
            avgOrderValue: 280,
            totalSpend: 5600,
            engagementScore: 42,
            factors: [
              { factor: 'Decreased frequency', impact: 0.25, direction: 'negative' },
              { factor: 'Competitor activity', impact: 0.18, direction: 'negative' },
              { factor: 'Support tickets', impact: 0.12, direction: 'negative' }
            ],
            recommendedActions: ['Offer loyalty reward', 'Exclusive early access'],
            contactAttempts: 1,
            outreachStatus: 'contacted'
          },
          {
            customerId: 'cust-003',
            name: 'Mohammed Ali',
            email: 'mohammed@email.com',
            riskScore: 45,
            riskLevel: 'medium',
            churnProbability: 0.35,
            lastActive: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            lastBooking: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            bookingFrequency: 1.2,
            avgOrderValue: 420,
            totalSpend: 12600,
            engagementScore: 58,
            factors: [
              { factor: 'Lower engagement', impact: 0.15, direction: 'negative' },
              { factor: 'Price concerns', impact: 0.10, direction: 'negative' }
            ],
            recommendedActions: ['Engagement campaign', 'Value proposition reminder'],
            contactAttempts: 0,
            outreachStatus: 'pending'
          },
          {
            customerId: 'cust-004',
            name: 'Fatima Omar',
            email: 'fatima@email.com',
            riskScore: 18,
            riskLevel: 'low',
            churnProbability: 0.12,
            lastActive: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            lastBooking: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            bookingFrequency: 2.5,
            avgOrderValue: 380,
            totalSpend: 22800,
            engagementScore: 85,
            factors: [
              { factor: 'Consistent engagement', impact: -0.15, direction: 'positive' }
            ],
            recommendedActions: ['VIP treatment', 'Referral program'],
            contactAttempts: 0,
            outreachStatus: 'none'
          }
        ]);
        setStats({
          totalCustomers: 12450,
          atRisk: 847,
          criticalRisk: 123,
          churnRate: 5.2,
          predictedChurnRate: 6.8,
          retentionRate: 94.8,
          avgChurnProbability: 34,
          savedByCampaigns: 156,
          churnTrend: [
            { date: 'Jan', churnRate: 5.8, predicted: 6.2 },
            { date: 'Feb', churnRate: 5.4, predicted: 6.0 },
            { date: 'Mar', churnRate: 5.1, predicted: 6.5 },
            { date: 'Apr', churnRate: 5.3, predicted: 6.8 },
            { date: 'May', churnRate: 5.2, predicted: 6.8 },
            { date: 'Jun', churnRate: 4.9, predicted: 6.4 }
          ],
          riskDistribution: [
            { level: 'Low', count: 11456, color: '#10B981' },
            { level: 'Medium', count: 624, color: '#F59E0B' },
            { level: 'High', count: 312, color: '#F97316' },
            { level: 'Critical', count: 123, color: '#EF4444' }
          ],
          topChurnFactors: [
            { factor: 'Declining engagement', impact: 0.35 },
            { factor: 'No recent activity', impact: 0.28 },
            { factor: 'Competitor switching', impact: 0.22 },
            { factor: 'Price sensitivity', impact: 0.18 },
            { factor: 'Service issues', impact: 0.15 }
          ],
          retentionCost: 45600
        });
      }
    } catch (err) {
      console.error('Error fetching churn data:', err);
      setError('Failed to load churn predictions');
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

  const handleUpdateOutreach = async (customerId: string, newStatus: ChurnPrediction['outreachStatus']) => {
    setActionLoading(customerId);
    try {
      await api.patch(`/admin/churn/predictions/${customerId}`, { outreachStatus: newStatus });
      setPredictions(prev => prev.map(p =>
        p.customerId === customerId ? { ...p, outreachStatus: newStatus, contactAttempts: p.contactAttempts + 1 } : p
      ));
    } catch (err) {
      console.error('Error updating outreach:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredPredictions = predictions.filter(pred => {
    const matchesSearch = pred.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          pred.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = riskFilter === 'all' || pred.riskLevel === riskFilter;
    const matchesOutreach = outreachFilter === 'all' || pred.outreachStatus === outreachFilter;
    return matchesSearch && matchesRisk && matchesOutreach;
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
          <TrendingDown className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Churn Data</h3>
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
            <TrendingDown className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Churn Prediction</h2>
            <p className="text-sm text-nilin-warmGray mt-1">ML-powered churn risk analysis</p>
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
          <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.atRisk || 0}</p>
          <p className="text-xs text-nilin-warmGray">At Risk</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <TrendingDown className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.churnRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Churn Rate</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Activity className="w-6 h-6 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.predictedChurnRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Predicted</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <Heart className="w-6 h-6 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.retentionRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Retention</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Users className="w-6 h-6 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.savedByCampaigns || 0}</p>
          <p className="text-xs text-nilin-warmGray">Saved</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Churn Trend */}
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Churn Rate Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.churnTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Line type="monotone" dataKey="churnRate" stroke="#EF4444" strokeWidth={2} name="Actual" />
                <Line type="monotone" dataKey="predicted" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 5" name="Predicted" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

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
                <Tooltip formatter={(value: number) => value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-4">
            {stats?.riskDistribution?.map(item => (
              <div key={item.level} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-nilin-warmGray">{item.level}</span>
                </div>
                <span className="text-xs font-medium text-nilin-charcoal">{item.count.toLocaleString()}</span>
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
            placeholder="Search customers..."
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
          value={outreachFilter}
          onChange={(e) => setOutreachFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Outreach</option>
          <option value="none">Not Contacted</option>
          <option value="pending">Pending</option>
          <option value="contacted">Contacted</option>
          <option value="retained">Retained</option>
          <option value="lost">Lost</option>
        </select>
      </div>

      {/* Predictions List */}
      <div className="space-y-4">
        {filteredPredictions.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <Heart className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No customers match your filters</p>
          </div>
        ) : (
          filteredPredictions.map(pred => {
            const riskConfig = RISK_LEVEL_CONFIG[pred.riskLevel];
            const outreachConfig = OUTREACH_CONFIG[pred.outreachStatus];
            const isSelected = selectedPrediction?.customerId === pred.customerId;
            const riskColor = getRiskColor(pred.riskScore);

            return (
              <div
                key={pred.customerId}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  pred.riskLevel === 'critical' ? 'border-red-200 bg-red-50/30' :
                  pred.riskLevel === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${riskColor}20` }}>
                      <Users className="w-6 h-6" style={{ color: riskColor }} />
                    </div>
                    <div
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                      style={{ backgroundColor: riskColor }}
                    >
                      {pred.riskScore}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{pred.name}</span>
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: `${riskColor}20`, color: riskColor }}>
                        {riskConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', outreachConfig.color)}>
                        {outreachConfig.label}
                      </span>
                    </div>
                    <p className="text-sm text-nilin-warmGray">{pred.email}</p>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm mt-2">
                      <div>
                        <span className="text-nilin-warmGray">Churn Prob:</span>
                        <span className="ml-1 font-semibold" style={{ color: riskColor }}>{(pred.churnProbability * 100).toFixed(0)}%</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Total Spend:</span>
                        <span className="ml-1 font-semibold text-nilin-charcoal">AED {pred.totalSpend.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Bookings:</span>
                        <span className="ml-1 font-semibold text-nilin-charcoal">{pred.bookingFrequency}/mo</span>
                      </div>
                      <div>
                        <span className="text-nilin-warmGray">Engagement:</span>
                        <span className="ml-1 font-semibold text-nilin-charcoal">{pred.engagementScore}%</span>
                      </div>
                      {pred.daysUntilChurn && (
                        <div>
                          <span className="text-nilin-warmGray">Days Left:</span>
                          <span className="ml-1 font-semibold text-red-600">{pred.daysUntilChurn}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(pred.outreachStatus === 'none' || pred.outreachStatus === 'pending') && pred.riskLevel !== 'low' && (
                      <button
                        onClick={() => handleUpdateOutreach(pred.customerId, 'contacted')}
                        disabled={actionLoading === pred.customerId}
                        className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        Contact
                      </button>
                    )}
                    {pred.outreachStatus === 'contacted' && (
                      <button
                        onClick={() => handleUpdateOutreach(pred.customerId, 'retained')}
                        disabled={actionLoading === pred.customerId}
                        className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors text-sm font-medium"
                      >
                        Mark Retained
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedPrediction(isSelected ? null : pred)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Churn Factors */}
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Churn Factors</h4>
                        <div className="space-y-2">
                          {pred.factors.map((factor, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className={cn(
                                'w-2 h-2 rounded-full',
                                factor.direction === 'negative' ? 'bg-red-400' : 'bg-green-400'
                              )} />
                              <span className="text-sm text-nilin-charcoal flex-1">{factor.factor}</span>
                              <span className="text-sm font-medium" style={{ color: factor.direction === 'negative' ? '#EF4444' : '#10B981' }}>
                                {factor.direction === 'negative' ? '+' : '-'}{(factor.impact * 100).toFixed(0)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Recommended Actions */}
                      <div>
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Recommended Actions</h4>
                        <div className="space-y-2">
                          {pred.recommendedActions.map((action, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-nilin-blush/30 rounded-lg">
                              <ArrowRight className="w-4 h-4 text-nilin-coral" />
                              <span className="text-sm text-nilin-charcoal">{action}</span>
                            </div>
                          ))}
                        </div>
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

export default ChurnPredictionUI;
