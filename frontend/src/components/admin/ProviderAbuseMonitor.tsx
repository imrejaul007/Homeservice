import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  Ban,
  CheckCircle,
  XCircle,
  Shield,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Bell,
  MessageSquare,
  MapPin,
  Star,
  DollarSign,
  AlertCircle,
  FileText,
  Eye
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

interface AbuseCase {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerPhone: string;
  type: 'service_violation' | 'pricing_abuse' | 'no_show' | 'quality_issues' | 'policy_breach' | 'harassment';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'actioned' | 'resolved' | 'escalated';
  reportedAt: string;
  incidents: number;
  reports: number;
  affectedCustomers: number;
  totalPenalty: number;
  evidence: {
    descriptions: string[];
    customerIds: string[];
    dates: string[];
    serviceIds: string[];
  };
  actions: Array<{
    type: 'warning' | 'suspension' | 'penalty' | 'termination' | 'restriction';
    description: string;
    by: string;
    at: string;
  }>;
  notes: Array<{
    text: string;
    author: string;
    createdAt: string;
  }>;
  history: Array<{
    action: string;
    by: string;
    at: string;
  }>;
}

interface AbuseStats {
  totalCases: number;
  open: number;
  investigating: number;
  actioned: number;
  resolved: number;
  escalated: number;
  avgResolutionTime: number;
  repeatOffenders: number;
  totalPenaltyCollected: number;
  byType: Array<{ type: string; count: number; revenue: number; color: string }>;
  bySeverity: { low: number; medium: number; high: number; critical: number };
  trend: Array<{ date: string; cases: number; resolved: number }>;
  topOffenders: Array<{ providerId: string; providerName: string; incidents: number; penalty: number }>;
}

interface ProviderAbuseMonitorProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  service_violation: { label: 'Service Violation', icon: AlertTriangle, color: '#EF4444', bgColor: 'bg-red-100' },
  pricing_abuse: { label: 'Pricing Abuse', icon: DollarSign, color: '#F59E0B', bgColor: 'bg-amber-100' },
  no_show: { label: 'No Show', icon: Users, color: '#8B5CF6', bgColor: 'bg-purple-100' },
  quality_issues: { label: 'Quality Issues', icon: Star, color: '#EC4899', bgColor: 'bg-pink-100' },
  policy_breach: { label: 'Policy Breach', icon: Shield, color: '#3B82F6', bgColor: 'bg-blue-100' },
  harassment: { label: 'Harassment', icon: AlertCircle, color: '#DC2626', bgColor: 'bg-red-200' }
};

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200' }
};

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  investigating: { label: 'Investigating', color: 'bg-blue-100 text-blue-700', icon: Eye },
  actioned: { label: 'Actioned', color: 'bg-orange-100 text-orange-700', icon: Bell },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  escalated: { label: 'Escalated', color: 'bg-purple-100 text-purple-700', icon: TrendingUp }
};

export const ProviderAbuseMonitor: React.FC<ProviderAbuseMonitorProps> = ({
  embedded = false,
  onClose
}) => {
  const [cases, setCases] = useState<AbuseCase[]>([]);
  const [stats, setStats] = useState<AbuseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<AbuseCase | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newNote, setNewNote] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/provider-abuse');

      if (response.data?.success) {
        setCases(response.data.data.cases || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setCases([
          {
            id: 'abuse-001',
            providerId: 'prov-abuse-001',
            providerName: 'Ahmed Electric',
            providerEmail: 'ahmed.elec@email.com',
            providerPhone: '+971501234567',
            type: 'pricing_abuse',
            severity: 'high',
            status: 'investigating',
            reportedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            incidents: 3,
            reports: 5,
            affectedCustomers: 5,
            totalPenalty: 0,
            evidence: {
              descriptions: [
                'Charged 500 AED for a job quoted at 200 AED',
                'Added unauthorized charges after completion',
                'Refused to provide itemized invoice'
              ],
              customerIds: ['cust-001', 'cust-002', 'cust-003'],
              dates: [new Date(Date.now() - 3600000 * 72).toISOString(), new Date(Date.now() - 3600000 * 48).toISOString()],
              serviceIds: ['svc-001', 'svc-002']
            },
            actions: [],
            notes: [
              { text: 'Initial review started - collecting more evidence', author: 'investigator@nilin.com', createdAt: new Date(Date.now() - 3600000 * 12).toISOString() }
            ],
            history: [
              { action: 'Case opened', by: 'System', at: new Date(Date.now() - 3600000 * 24).toISOString() },
              { action: 'Assigned for investigation', by: 'investigator@nilin.com', at: new Date(Date.now() - 3600000 * 12).toISOString() }
            ]
          },
          {
            id: 'abuse-002',
            providerId: 'prov-abuse-002',
            providerName: 'Quick Clean Services',
            providerEmail: 'quick.clean@email.com',
            providerPhone: '+971552345678',
            type: 'no_show',
            severity: 'medium',
            status: 'actioned',
            reportedAt: new Date(Date.now() - 3600000 * 48).toISOString(),
            incidents: 5,
            reports: 8,
            affectedCustomers: 8,
            totalPenalty: 450,
            evidence: {
              descriptions: [
                'Did not show up for scheduled appointment',
                'Did not show up for scheduled appointment',
                'Did not show up for scheduled appointment'
              ],
              customerIds: ['cust-010', 'cust-011', 'cust-012', 'cust-013', 'cust-014'],
              dates: [new Date(Date.now() - 3600000 * 72).toISOString(), new Date(Date.now() - 3600000 * 96).toISOString()],
              serviceIds: ['svc-clean-001', 'svc-clean-002']
            },
            actions: [
              { type: 'warning', description: 'First warning issued for no-show pattern', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 36).toISOString() },
              { type: 'penalty', description: 'AED 150 penalty applied for no-show incidents', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 36).toISOString() }
            ],
            notes: [],
            history: [
              { action: 'Case opened', by: 'System', at: new Date(Date.now() - 3600000 * 48).toISOString() },
              { action: 'Warning issued', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 36).toISOString() },
              { action: 'Penalty applied', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 36).toISOString() }
            ]
          },
          {
            id: 'abuse-003',
            providerId: 'prov-abuse-003',
            providerName: 'Professional Plumbing',
            providerEmail: 'prof.plumb@email.com',
            providerPhone: '+971504567890',
            type: 'service_violation',
            severity: 'critical',
            status: 'escalated',
            reportedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
            incidents: 2,
            reports: 4,
            affectedCustomers: 4,
            totalPenalty: 0,
            evidence: {
              descriptions: [
                'Used substandard parts without disclosure',
                'Damaged customer property during service',
                'Left work incomplete'
              ],
              customerIds: ['cust-020', 'cust-021', 'cust-022'],
              dates: [new Date(Date.now() - 3600000 * 24).toISOString()],
              serviceIds: ['svc-plumb-001']
            },
            actions: [],
            notes: [
              { text: 'Critical case - property damage involved - escalating to senior management', author: 'admin@nilin.com', createdAt: new Date(Date.now() - 3600000 * 6).toISOString() }
            ],
            history: [
              { action: 'Case opened', by: 'System', at: new Date(Date.now() - 3600000 * 12).toISOString() },
              { action: 'Escalated to senior management', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 6).toISOString() }
            ]
          },
          {
            id: 'abuse-004',
            providerId: 'prov-abuse-004',
            providerName: 'Home Repairs Co',
            providerEmail: 'homerepairs@email.com',
            providerPhone: '+971556789012',
            type: 'quality_issues',
            severity: 'low',
            status: 'resolved',
            reportedAt: new Date(Date.now() - 3600000 * 96).toISOString(),
            incidents: 1,
            reports: 2,
            affectedCustomers: 2,
            totalPenalty: 100,
            evidence: {
              descriptions: [
                'Service quality below standards',
                'Customer requested rework'
              ],
              customerIds: ['cust-030', 'cust-031'],
              dates: [new Date(Date.now() - 3600000 * 120).toISOString()],
              serviceIds: ['svc-repair-001']
            },
            actions: [
              { type: 'warning', description: 'Quality standards reminder sent', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 72).toISOString() }
            ],
            notes: [],
            history: [
              { action: 'Case opened', by: 'System', at: new Date(Date.now() - 3600000 * 96).toISOString() },
              { action: 'Warning issued', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 72).toISOString() },
              { action: 'Resolved - provider completed retraining', by: 'admin@nilin.com', at: new Date(Date.now() - 3600000 * 48).toISOString() }
            ]
          }
        ]);
        setStats({
          totalCases: 89,
          open: 12,
          investigating: 23,
          actioned: 18,
          resolved: 32,
          escalated: 4,
          avgResolutionTime: 48,
          repeatOffenders: 8,
          totalPenaltyCollected: 4520,
          byType: [
            { type: 'Service Violation', count: 28, revenue: 0, color: '#EF4444' },
            { type: 'Pricing Abuse', count: 22, revenue: 12400, color: '#F59E0B' },
            { type: 'No Show', count: 18, revenue: 0, color: '#8B5CF6' },
            { type: 'Quality Issues', count: 12, revenue: 0, color: '#EC4899' },
            { type: 'Policy Breach', count: 6, revenue: 0, color: '#3B82F6' },
            { type: 'Harassment', count: 3, revenue: 0, color: '#DC2626' }
          ],
          bySeverity: { low: 25, medium: 34, high: 22, critical: 8 },
          trend: [
            { date: 'Mon', cases: 12, resolved: 8 },
            { date: 'Tue', cases: 15, resolved: 10 },
            { date: 'Wed', cases: 10, resolved: 12 },
            { date: 'Thu', cases: 18, resolved: 9 },
            { date: 'Fri', cases: 14, resolved: 11 },
            { date: 'Sat', cases: 8, resolved: 6 },
            { date: 'Sun', cases: 12, resolved: 7 }
          ],
          topOffenders: [
            { providerId: 'prov-abuse-001', providerName: 'Ahmed Electric', incidents: 12, penalty: 600 },
            { providerId: 'prov-abuse-002', providerName: 'Quick Clean Services', incidents: 10, penalty: 450 },
            { providerId: 'prov-abuse-005', providerName: 'Budget Handyman', incidents: 8, penalty: 350 }
          ]
        });
      }
    } catch (err) {
      console.error('Error fetching provider abuse data:', err);
      setError('Failed to load provider abuse data');
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

  const handleUpdateStatus = async (caseId: string, newStatus: AbuseCase['status']) => {
    setActionLoading(caseId);
    try {
      await api.patch(`/admin/provider-abuse/${caseId}`, { status: newStatus });
      setCases(prev => prev.map(c =>
        c.id === caseId
          ? { ...c, status: newStatus, history: [...c.history, { action: `Status changed to ${newStatus}`, by: 'admin@nilin.com', at: new Date().toISOString() }] }
          : c
      ));
    } catch (err) {
      console.error('Error updating case:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTakeAction = async (caseId: string, actionType: string, description: string) => {
    setActionLoading(caseId);
    try {
      await api.post(`/admin/provider-abuse/${caseId}/actions`, { type: actionType, description });
      setCases(prev => prev.map(c =>
        c.id === caseId
          ? {
              ...c,
              actions: [...c.actions, { type: actionType as any, description, by: 'admin@nilin.com', at: new Date().toISOString() }],
              history: [...c.history, { action: `${actionType}: ${description}`, by: 'admin@nilin.com', at: new Date().toISOString() }]
            }
          : c
      ));
    } catch (err) {
      console.error('Error taking action:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddNote = async (caseId: string) => {
    if (!newNote.trim()) return;

    setActionLoading(caseId);
    try {
      await api.post(`/admin/provider-abuse/${caseId}/notes`, { text: newNote });
      setCases(prev => prev.map(c =>
        c.id === caseId
          ? { ...c, notes: [...c.notes, { text: newNote, author: 'admin@nilin.com', createdAt: new Date().toISOString() }] }
          : c
      ));
      setNewNote('');
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredCases = cases.filter(c => {
    const matchesSearch =
      c.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.providerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.providerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesType = typeFilter === 'all' || c.type === typeFilter;
    const matchesSeverity = severityFilter === 'all' || c.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesType && matchesSeverity;
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Provider Abuse Monitor</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 flex items-center justify-center">
            <Shield className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Provider Abuse Monitor</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Track & action provider violations</p>
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
          <AlertTriangle className="w-5 h-5 text-gray-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.totalCases || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total Cases</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.open || 0}</p>
          <p className="text-xs text-nilin-warmGray">Open</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <Eye className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.investigating || 0}</p>
          <p className="text-xs text-nilin-warmGray">Investigating</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">{stats?.escalated || 0}</p>
          <p className="text-xs text-nilin-warmGray">Escalated</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <DollarSign className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">AED {stats?.totalPenaltyCollected || 0}</p>
          <p className="text-xs text-nilin-warmGray">Penalties</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg Resolution Time</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.avgResolutionTime || 0}h</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Repeat Offenders</span>
            <span className="text-lg font-serif text-red-600">{stats?.repeatOffenders || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Actioned</span>
            <span className="text-lg font-serif text-orange-600">{stats?.actioned || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Resolved</span>
            <span className="text-lg font-serif text-green-600">{stats?.resolved || 0}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Trend */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Case Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Area type="monotone" dataKey="cases" stroke="#EF4444" fill="#EF444420" strokeWidth={2} name="Cases" />
                <Area type="monotone" dataKey="resolved" stroke="#10B981" fill="#10B98120" strokeWidth={2} name="Resolved" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Abuse Type</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byType || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="type" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="count" fill="#8B5CF6" name="Cases" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by provider name..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="actioned">Actioned</option>
          <option value="resolved">Resolved</option>
          <option value="escalated">Escalated</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="service_violation">Service Violation</option>
          <option value="pricing_abuse">Pricing Abuse</option>
          <option value="no_show">No Show</option>
          <option value="quality_issues">Quality Issues</option>
          <option value="policy_breach">Policy Breach</option>
          <option value="harassment">Harassment</option>
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {filteredCases.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No abuse cases match your filters</p>
          </div>
        ) : (
          filteredCases.map(c => {
            const typeConfig = TYPE_CONFIG[c.type];
            const severityConfig = SEVERITY_CONFIG[c.severity];
            const statusConfig = STATUS_CONFIG[c.status];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedCase?.id === c.id;

            return (
              <div
                key={c.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  c.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                  c.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  c.status === 'resolved' ? 'border-green-100/50' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', typeConfig.bgColor)}>
                    <typeConfig.icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{c.providerName}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', severityConfig.color)}>
                        {severityConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', statusConfig.color)}>
                        <StatusIcon className="w-3 h-3 inline mr-1" />
                        {statusConfig.label}
                      </span>
                      <span className="px-2 py-0.5 bg-nilin-blush text-nilin-charcoal rounded text-xs font-medium">
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span>{c.incidents} incidents</span>
                      <span>{c.reports} reports</span>
                      <span>{c.affectedCustomers} affected</span>
                      {c.totalPenalty > 0 && (
                        <span className="text-red-600 font-medium">AED {c.totalPenalty} penalty</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.status !== 'resolved' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(c.id, 'actioned')}
                          disabled={actionLoading === c.id}
                          className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors text-sm font-medium"
                        >
                          Take Action
                        </button>
                        {c.status === 'open' && (
                          <button
                            onClick={() => handleUpdateStatus(c.id, 'investigating')}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                          >
                            Investigate
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => setSelectedCase(isSelected ? null : c)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    {/* Evidence */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Evidence & Descriptions</h4>
                      <div className="space-y-2">
                        {c.evidence.descriptions.map((desc, idx) => (
                          <div key={idx} className="p-3 bg-red-50/50 rounded-lg border border-red-100">
                            <p className="text-sm text-nilin-charcoal">{desc}</p>
                            <p className="text-xs text-nilin-warmGray mt-1">
                              Reported: {new Date(c.evidence.dates[idx]).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions Taken */}
                    {c.actions.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Actions Taken</h4>
                        <div className="space-y-2">
                          {c.actions.map((action, idx) => (
                            <div key={idx} className="p-3 bg-orange-50/50 rounded-lg border border-orange-100">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-orange-200 text-orange-800 rounded text-xs font-medium capitalize">
                                  {action.type}
                                </span>
                                <span className="text-xs text-nilin-warmGray">by {action.by}</span>
                                <span className="text-xs text-nilin-warmGray ml-auto">{new Date(action.at).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-nilin-charcoal">{action.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    {c.status !== 'resolved' && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Quick Actions</h4>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleTakeAction(c.id, 'warning', 'Formal warning issued for policy violation')}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm"
                          >
                            Issue Warning
                          </button>
                          <button
                            onClick={() => handleTakeAction(c.id, 'penalty', 'Monetary penalty applied')}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm"
                          >
                            Apply Penalty
                          </button>
                          <button
                            onClick={() => handleTakeAction(c.id, 'suspension', 'Account suspended pending review')}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors text-sm"
                          >
                            Suspend
                          </button>
                          <button
                            onClick={() => handleTakeAction(c.id, 'restriction', 'Service restrictions applied')}
                            disabled={actionLoading === c.id}
                            className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm"
                          >
                            Restrict
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-2">Notes</h4>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newNote}
                          onChange={(e) => setNewNote(e.target.value)}
                          placeholder="Add a note..."
                          className="flex-1 px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddNote(c.id)}
                        />
                        <button
                          onClick={() => handleAddNote(c.id)}
                          disabled={!newNote.trim() || actionLoading === c.id}
                          className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:bg-nilin-coral/90 transition-colors text-sm disabled:opacity-50"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                      {c.notes.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {c.notes.map((note, idx) => (
                            <div key={idx} className="p-2 bg-blue-50/50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-blue-700">{note.author}</span>
                                <span className="text-xs text-nilin-warmGray">{new Date(note.createdAt).toLocaleString()}</span>
                              </div>
                              <p className="text-sm text-nilin-charcoal">{note.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* History */}
                    <div>
                      <h4 className="text-sm font-medium text-nilin-charcoal mb-2">History</h4>
                      <div className="space-y-1">
                        {c.history.map((h, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-nilin-warmGray">
                            <span className="w-2 h-2 rounded-full bg-nilin-coral" />
                            <span>{h.action}</span>
                            <span className="text-nilin-charcoal">by {h.by}</span>
                            <span className="ml-auto">{new Date(h.at).toLocaleString()}</span>
                          </div>
                        ))}
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

export default ProviderAbuseMonitor;
