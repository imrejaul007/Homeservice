import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Globe,
  Users,
  Calendar,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Flag,
  Bell,
  Settings,
  Clock,
  Lock,
  Unlock,
  Ban,
  AlertCircle
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
  Area
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface ContentFilter {
  id: string;
  name: string;
  description: string;
  category: string;
  enabled: boolean;
  strictness: 'low' | 'medium' | 'high';
  blockedCount: number;
  lastTriggered?: string;
}

interface AgeRestriction {
  id: string;
  category: string;
  minAge: number;
  enabled: boolean;
  verificationRequired: boolean;
}

interface CategoryBlock {
  id: string;
  category: string;
  serviceTypes: string[];
  blocked: boolean;
  reason?: string;
  since?: string;
  blockedBy?: string;
}

interface Report {
  id: string;
  reportedItem: {
    type: 'service' | 'provider' | 'review' | 'message';
    id: string;
    name: string;
  };
  reporter: {
    id: string;
    name: string;
  };
  reason: string;
  status: 'pending' | 'reviewed' | 'actioned' | 'dismissed';
  createdAt: string;
  reviewedAt?: string;
  action?: string;
}

interface SafeSearchStats {
  totalFilters: number;
  activeFilters: number;
  blockedContent: number;
  reportsReceived: number;
  avgResponseTime: number;
  filterEffectiveness: number;
  byCategory: Array<{ category: string; blocked: number; total: number }>;
  trend: Array<{ date: string; blocked: number; reports: number }>;
  recentBlocks: Array<{ type: string; count: number; time: string }>;
}

interface SafeSearchControlsProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Adult Content': '#DC2626',
  'Violence': '#EF4444',
  'Hate Speech': '#F59E0B',
  'Illegal Services': '#7C3AED',
  'Fraud': '#DC2626',
  'Safety': '#3B82F6'
};

export const SafeSearchControls: React.FC<SafeSearchControlsProps> = ({
  embedded = false,
  onClose
}) => {
  const [filters, setFilters] = useState<ContentFilter[]>([]);
  const [ageRestrictions, setAgeRestrictions] = useState<AgeRestriction[]>([]);
  const [categoryBlocks, setCategoryBlocks] = useState<CategoryBlock[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<SafeSearchStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'filters' | 'restrictions' | 'blocks' | 'reports'>('filters');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/safe-search');

      if (response.data?.success) {
        setFilters(response.data.data.filters || []);
        setAgeRestrictions(response.data.data.ageRestrictions || []);
        setCategoryBlocks(response.data.data.categoryBlocks || []);
        setReports(response.data.data.reports || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setFilters([
          {
            id: 'filter-001',
            name: 'Adult Content Filter',
            description: 'Blocks adult content and explicit material',
            category: 'Adult Content',
            enabled: true,
            strictness: 'high',
            blockedCount: 156,
            lastTriggered: new Date(Date.now() - 3600000).toISOString()
          },
          {
            id: 'filter-002',
            name: 'Violence Filter',
            description: 'Blocks violent content and imagery',
            category: 'Violence',
            enabled: true,
            strictness: 'medium',
            blockedCount: 89,
            lastTriggered: new Date(Date.now() - 7200000).toISOString()
          },
          {
            id: 'filter-003',
            name: 'Hate Speech Filter',
            description: 'Detects and blocks hate speech and discrimination',
            category: 'Hate Speech',
            enabled: true,
            strictness: 'high',
            blockedCount: 34,
            lastTriggered: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'filter-004',
            name: 'Illegal Services Filter',
            description: 'Blocks listings for illegal services',
            category: 'Illegal Services',
            enabled: true,
            strictness: 'high',
            blockedCount: 12,
            lastTriggered: new Date(Date.now() - 172800000).toISOString()
          },
          {
            id: 'filter-005',
            name: 'Fraud Detection',
            description: 'AI-powered fraud detection for suspicious listings',
            category: 'Fraud',
            enabled: true,
            strictness: 'medium',
            blockedCount: 67,
            lastTriggered: new Date(Date.now() - 3600000 * 4).toISOString()
          },
          {
            id: 'filter-006',
            name: 'Safety Warnings',
            description: 'Shows safety warnings for potentially risky services',
            category: 'Safety',
            enabled: true,
            strictness: 'low',
            blockedCount: 0,
            lastTriggered: new Date(Date.now() - 3600000 * 2).toISOString()
          }
        ]);
        setAgeRestrictions([
          {
            id: 'age-001',
            category: 'Adult Services',
            minAge: 18,
            enabled: true,
            verificationRequired: true
          },
          {
            id: 'age-002',
            category: 'Home Repair',
            minAge: 0,
            enabled: false,
            verificationRequired: false
          },
          {
            id: 'age-003',
            category: 'Cleaning Services',
            minAge: 0,
            enabled: false,
            verificationRequired: false
          },
          {
            id: 'age-004',
            category: 'Beauty Services',
            minAge: 16,
            enabled: true,
            verificationRequired: false
          }
        ]);
        setCategoryBlocks([
          {
            id: 'block-001',
            category: 'Firearms Services',
            serviceTypes: ['Gun repair', 'Ammunition sales'],
            blocked: true,
            reason: 'Prohibited under local law',
            since: new Date(Date.now() - 86400000 * 30).toISOString(),
            blockedBy: 'admin@nilin.com'
          },
          {
            id: 'block-002',
            category: 'Bail Services',
            serviceTypes: ['Bail bonds'],
            blocked: true,
            reason: 'Prohibited service category',
            since: new Date(Date.now() - 86400000 * 60).toISOString(),
            blockedBy: 'admin@nilin.com'
          },
          {
            id: 'block-003',
            category: 'Content Removal',
            serviceTypes: ['Reputation management', 'Content deletion'],
            blocked: false
          },
          {
            id: 'block-004',
            category: 'Dating Services',
            serviceTypes: ['Escort services'],
            blocked: true,
            reason: 'Prohibited under platform policy',
            since: new Date(Date.now() - 86400000 * 90).toISOString(),
            blockedBy: 'admin@nilin.com'
          }
        ]);
        setReports([
          {
            id: 'report-001',
            reportedItem: { type: 'service', id: 'svc-001', name: 'Home Cleaning Service' },
            reporter: { id: 'cust-001', name: 'Ahmed Hassan' },
            reason: 'Inappropriate images in service gallery',
            status: 'pending',
            createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
          },
          {
            id: 'report-002',
            reportedItem: { type: 'review', id: 'rev-001', name: 'Review by Sarah K.' },
            reporter: { id: 'prov-001', name: 'Clean Pro Services' },
            reason: 'Fake review with defamatory content',
            status: 'reviewed',
            createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            reviewedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
            action: 'Review removed, reporter warned'
          },
          {
            id: 'report-003',
            reportedItem: { type: 'provider', id: 'prov-002', name: 'Quick Handyman' },
            reporter: { id: 'cust-002', name: 'Omar Ali' },
            reason: 'Provider asking for payment outside platform',
            status: 'actioned',
            createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
            reviewedAt: new Date(Date.now() - 3600000 * 36).toISOString(),
            action: 'Provider suspended pending investigation'
          }
        ]);
        setStats({
          totalFilters: 6,
          activeFilters: 6,
          blockedContent: 358,
          reportsReceived: 45,
          avgResponseTime: 2.4,
          filterEffectiveness: 94.5,
          byCategory: [
            { category: 'Adult Content', blocked: 156, total: 200 },
            { category: 'Violence', blocked: 89, total: 150 },
            { category: 'Hate Speech', blocked: 34, total: 50 },
            { category: 'Illegal Services', blocked: 12, total: 20 },
            { category: 'Fraud', blocked: 67, total: 100 }
          ],
          trend: [
            { date: 'Mon', blocked: 45, reports: 5 },
            { date: 'Tue', blocked: 52, reports: 8 },
            { date: 'Wed', blocked: 38, reports: 6 },
            { date: 'Thu', blocked: 61, reports: 7 },
            { date: 'Fri', blocked: 48, reports: 9 },
            { date: 'Sat', blocked: 55, reports: 4 },
            { date: 'Sun', blocked: 59, reports: 6 }
          ],
          recentBlocks: [
            { type: 'Content', count: 12, time: 'Last hour' },
            { type: 'Listings', count: 5, time: 'Last hour' },
            { type: 'Reviews', count: 3, time: 'Last hour' }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching safe search data:', err);
      setError('Failed to load safe search controls');
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

  const handleToggleFilter = async (filterId: string, enabled: boolean) => {
    setActionLoading(filterId);
    try {
      await api.patch(`/admin/safe-search/filters/${filterId}`, { enabled });
      setFilters(prev => prev.map(f =>
        f.id === filterId ? { ...f, enabled } : f
      ));
    } catch (err) {
      console.error('Error toggling filter:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStrictness = async (filterId: string, strictness: 'low' | 'medium' | 'high') => {
    setActionLoading(filterId);
    try {
      await api.patch(`/admin/safe-search/filters/${filterId}`, { strictness });
      setFilters(prev => prev.map(f =>
        f.id === filterId ? { ...f, strictness } : f
      ));
    } catch (err) {
      console.error('Error updating strictness:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBlock = async (blockId: string, blocked: boolean, reason?: string) => {
    setActionLoading(blockId);
    try {
      await api.patch(`/admin/safe-search/blocks/${blockId}`, { blocked, reason });
      setCategoryBlocks(prev => prev.map(b =>
        b.id === blockId
          ? { ...b, blocked, reason: reason || b.reason, since: blocked ? new Date().toISOString() : undefined }
          : b
      ));
    } catch (err) {
      console.error('Error toggling block:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateReport = async (reportId: string, status: Report['status'], action?: string) => {
    setActionLoading(reportId);
    try {
      await api.patch(`/admin/safe-search/reports/${reportId}`, { status, action });
      setReports(prev => prev.map(r =>
        r.id === reportId
          ? { ...r, status, action, reviewedAt: new Date().toISOString() }
          : r
      ));
    } catch (err) {
      console.error('Error updating report:', err);
    } finally {
      setActionLoading(null);
    }
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
          <Shield className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Safe Search Controls</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Safe Search Controls</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Content moderation & safety settings</p>
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
          <Shield className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.activeFilters || 0}</p>
          <p className="text-xs text-nilin-warmGray">Active Filters</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <EyeOff className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.blockedContent || 0}</p>
          <p className="text-xs text-nilin-warmGray">Blocked</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Flag className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.reportsReceived || 0}</p>
          <p className="text-xs text-nilin-warmGray">Reports</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <BarChart3 className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.filterEffectiveness || 0}%</p>
          <p className="text-xs text-nilin-warmGray">Effectiveness</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Clock className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.avgResponseTime || 0}h</p>
          <p className="text-xs text-nilin-warmGray">Avg Response</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-nilin-border mb-6">
        <button
          onClick={() => setActiveTab('filters')}
          className={cn(
            'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'filters'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Content Filters
        </button>
        <button
          onClick={() => setActiveTab('restrictions')}
          className={cn(
            'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'restrictions'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          <Users className="w-4 h-4 inline mr-2" />
          Age Restrictions
        </button>
        <button
          onClick={() => setActiveTab('blocks')}
          className={cn(
            'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'blocks'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          <Ban className="w-4 h-4 inline mr-2" />
          Category Blocks
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'reports'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
          )}
        >
          <Flag className="w-4 h-4 inline mr-2" />
          Reports ({reports.filter(r => r.status === 'pending').length})
        </button>
      </div>

      {/* Content Filters Tab */}
      {activeTab === 'filters' && (
        <div className="space-y-4">
          <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Blocking Trend</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.trend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <Area type="monotone" dataKey="blocked" stroke="#EF4444" fill="#EF444420" strokeWidth={2} name="Blocked Content" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {filters.map(filter => (
            <div key={filter.id} className="glass rounded-xl border border-nilin-border/50 p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${CATEGORY_COLORS[filter.category] || '#6B7280'}20` }}>
                  <EyeOff className="w-6 h-6" style={{ color: CATEGORY_COLORS[filter.category] || '#6B7280' }} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-nilin-charcoal">{filter.name}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      filter.strictness === 'high' ? 'bg-red-100 text-red-700' :
                      filter.strictness === 'medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    )}>
                      {filter.strictness}
                    </span>
                  </div>
                  <p className="text-sm text-nilin-warmGray mb-2">{filter.description}</p>
                  <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
                    <span>{filter.blockedCount} blocked</span>
                    {filter.lastTriggered && (
                      <span>Last triggered: {new Date(filter.lastTriggered).toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={filter.strictness}
                    onChange={(e) => handleUpdateStrictness(filter.id, e.target.value as 'low' | 'medium' | 'high')}
                    disabled={actionLoading === filter.id}
                    className="px-3 py-1.5 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <button
                    onClick={() => handleToggleFilter(filter.id, !filter.enabled)}
                    disabled={actionLoading === filter.id}
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      filter.enabled
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    )}
                  >
                    {filter.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Age Restrictions Tab */}
      {activeTab === 'restrictions' && (
        <div className="space-y-4">
          <div className="glass rounded-xl border border-nilin-border/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-medium text-nilin-charcoal">Global Age Verification</h3>
                <p className="text-sm text-nilin-warmGray">Require age verification for all users</p>
              </div>
              <button className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors">
                <ToggleRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          {ageRestrictions.map(restriction => (
            <div key={restriction.id} className="glass rounded-xl border border-nilin-border/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-nilin-blush/30 flex items-center justify-center">
                    <Users className="w-6 h-6 text-nilin-coral" />
                  </div>
                  <div>
                    <h3 className="font-medium text-nilin-charcoal">{restriction.category}</h3>
                    <p className="text-sm text-nilin-warmGray">
                      Minimum age: <strong>{restriction.minAge > 0 ? `${restriction.minAge}+` : 'No restriction'}</strong>
                      {restriction.verificationRequired && ' - Verification required'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    className="px-3 py-1.5 border border-nilin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                    defaultValue={restriction.minAge}
                  >
                    <option value={0}>No restriction</option>
                    <option value={16}>16+</option>
                    <option value={18}>18+</option>
                    <option value={21}>21+</option>
                  </select>
                  <button
                    className={cn(
                      'p-2 rounded-lg transition-colors',
                      restriction.enabled
                        ? 'bg-green-100 text-green-600 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    )}
                  >
                    {restriction.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Blocks Tab */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          {categoryBlocks.map(block => (
            <div key={block.id} className={cn(
              'glass rounded-xl border p-4',
              block.blocked ? 'border-red-200 bg-red-50/30' : 'border-nilin-border/50'
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center',
                    block.blocked ? 'bg-red-100' : 'bg-nilin-blush/30'
                  )}>
                    {block.blocked ? <Lock className="w-6 h-6 text-red-600" /> : <Unlock className="w-6 h-6 text-nilin-warmGray" />}
                  </div>
                  <div>
                    <h3 className="font-medium text-nilin-charcoal">{block.category}</h3>
                    <p className="text-sm text-nilin-warmGray">
                      {block.serviceTypes.join(', ')}
                    </p>
                    {block.blocked && block.reason && (
                      <p className="text-xs text-red-600 mt-1">Reason: {block.reason}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {block.blocked ? (
                    <button
                      onClick={() => handleToggleBlock(block.id, false)}
                      disabled={actionLoading === block.id}
                      className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm font-medium"
                    >
                      Unblock
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleBlock(block.id, true, 'Prohibited under platform policy')}
                      disabled={actionLoading === block.id}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                    >
                      Block
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="text-center py-12 text-nilin-warmGray">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
              <p className="font-medium">No reports to review</p>
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className={cn(
                'glass rounded-xl border p-4',
                report.status === 'pending' ? 'border-amber-200 bg-amber-50/30' :
                report.status === 'actioned' ? 'border-red-200' :
                'border-nilin-border/50'
              )}>
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-lg flex items-center justify-center',
                    report.status === 'pending' ? 'bg-amber-100' :
                    report.status === 'actioned' ? 'bg-red-100' : 'bg-green-100'
                  )}>
                    <Flag className="w-6 h-6" style={{
                      color: report.status === 'pending' ? '#F59E0B' :
                             report.status === 'actioned' ? '#DC2626' : '#10B981'
                    }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-nilin-charcoal">{report.reportedItem.name}</h3>
                      <span className="px-2 py-0.5 bg-nilin-blush text-nilin-charcoal rounded text-xs font-medium capitalize">
                        {report.reportedItem.type}
                      </span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        report.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        report.status === 'actioned' ? 'bg-red-100 text-red-700' :
                        'bg-green-100 text-green-700'
                      )}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-sm text-nilin-warmGray mb-2">{report.reason}</p>
                    <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
                      <span>Reported by: {report.reporter.name}</span>
                      <span>{new Date(report.createdAt).toLocaleString()}</span>
                      {report.reviewedAt && (
                        <span>Reviewed: {new Date(report.reviewedAt).toLocaleString()}</span>
                      )}
                    </div>
                    {report.action && (
                      <p className="text-sm text-nilin-charcoal mt-2 p-2 bg-white/50 rounded">
                        Action: {report.action}
                      </p>
                    )}
                  </div>
                  {report.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateReport(report.id, 'dismissed')}
                        disabled={actionLoading === report.id}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleUpdateReport(report.id, 'actioned', 'Content removed, user warned')}
                        disabled={actionLoading === report.id}
                        className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                      >
                        Take Action
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SafeSearchControls;
