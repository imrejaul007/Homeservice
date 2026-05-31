import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  User,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Ban,
  RotateCcw,
  Check,
  X,
  Globe,
  Fingerprint,
  CreditCard,
  Home,
  Building
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface BackgroundCheck {
  id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerPhone: string;
  type: 'identity' | 'criminal' | 'address' | 'employment' | 'education' | 'financial';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'needs_review';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  requestDate: string;
  completedDate?: string;
  expiryDate?: string;
  result?: {
    verified: boolean;
    score: number;
    details: string;
    documents?: Array<{
      type: string;
      url: string;
      verified: boolean;
    }>;
  };
  retryCount: number;
  lastRetryDate?: string;
  assignedTo?: string;
  notes: string;
}

interface BackgroundCheckStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  needsReview: number;
  avgCompletionTime: number;
  passRate: number;
  byType: Array<{ type: string; count: number; color: string }>;
  trend: Array<{ date: string; requested: number; completed: number; failed: number }>;
  urgentCount: number;
}

interface BackgroundCheckDashboardProps {
  embedded?: boolean;
  onClose?: () => void;
}

const TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  identity: { label: 'Identity', icon: Fingerprint, color: '#3B82F6', bgColor: 'bg-blue-100' },
  criminal: { label: 'Criminal', icon: Shield, color: '#EF4444', bgColor: 'bg-red-100' },
  address: { label: 'Address', icon: Home, color: '#8B5CF6', bgColor: 'bg-purple-100' },
  employment: { label: 'Employment', icon: Building, color: '#10B981', bgColor: 'bg-green-100' },
  education: { label: 'Education', icon: FileText, color: '#F59E0B', bgColor: 'bg-amber-100' },
  financial: { label: 'Financial', icon: CreditCard, color: '#EC4899', bgColor: 'bg-pink-100' }
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  needs_review: { label: 'Needs Review', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle }
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-200' }
};

export const BackgroundCheckDashboard: React.FC<BackgroundCheckDashboardProps> = ({
  embedded = false,
  onClose
}) => {
  const [checks, setChecks] = useState<BackgroundCheck[]>([]);
  const [stats, setStats] = useState<BackgroundCheckStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedCheck, setSelectedCheck] = useState<BackgroundCheck | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/background-checks');

      if (response.data?.success) {
        setChecks(response.data.data.checks || []);
        setStats(response.data.data.stats);
      } else {
        // Mock data
        setChecks([
          {
            id: 'bc-001',
            providerId: 'prov-001',
            providerName: 'Ahmed Al-Rashid',
            providerEmail: 'ahmed.rashid@email.com',
            providerPhone: '+971501234567',
            type: 'identity',
            status: 'pending',
            priority: 'high',
            requestDate: new Date(Date.now() - 86400000 * 2).toISOString(),
            retryCount: 0,
            notes: 'Initial identity verification required',
            expiryDate: new Date(Date.now() + 86400000 * 30).toISOString()
          },
          {
            id: 'bc-002',
            providerId: 'prov-002',
            providerName: 'Fatima Hassan',
            providerEmail: 'fatima.h@email.com',
            providerPhone: '+971552345678',
            type: 'criminal',
            status: 'in_progress',
            priority: 'urgent',
            requestDate: new Date(Date.now() - 86400000 * 1).toISOString(),
            retryCount: 0,
            notes: 'Criminal background check initiated',
            assignedTo: 'verifier@nilin.com'
          },
          {
            id: 'bc-003',
            providerId: 'prov-003',
            providerName: 'Omar Malik',
            providerEmail: 'omar.malik@email.com',
            providerPhone: '+971504567890',
            type: 'address',
            status: 'completed',
            priority: 'medium',
            requestDate: new Date(Date.now() - 86400000 * 5).toISOString(),
            completedDate: new Date(Date.now() - 86400000 * 2).toISOString(),
            retryCount: 1,
            lastRetryDate: new Date(Date.now() - 86400000 * 3).toISOString(),
            result: {
              verified: true,
              score: 95,
              details: 'Address verified through utility bill and landlord confirmation',
              documents: [
                { type: 'utility_bill', url: '/docs/utility-bill-001.pdf', verified: true },
                { type: 'landlord_letter', url: '/docs/landlord-letter-001.pdf', verified: true }
              ]
            },
            notes: 'Address successfully verified'
          },
          {
            id: 'bc-004',
            providerId: 'prov-004',
            providerName: 'Sara Khan',
            providerEmail: 'sara.khan@email.com',
            providerPhone: '+971556789012',
            type: 'financial',
            status: 'failed',
            priority: 'high',
            requestDate: new Date(Date.now() - 86400000 * 3).toISOString(),
            completedDate: new Date(Date.now() - 86400000 * 1).toISOString(),
            retryCount: 0,
            result: {
              verified: false,
              score: 35,
              details: 'Bank statement verification failed - insufficient transaction history',
              documents: [
                { type: 'bank_statement', url: '/docs/bank-001.pdf', verified: false }
              ]
            },
            notes: 'Requires additional financial documentation'
          },
          {
            id: 'bc-005',
            providerId: 'prov-005',
            providerName: 'Youssef Ibrahim',
            providerEmail: 'y.ibrahim@email.com',
            providerPhone: '+971501234999',
            type: 'employment',
            status: 'needs_review',
            priority: 'medium',
            requestDate: new Date(Date.now() - 86400000 * 4).toISOString(),
            retryCount: 2,
            lastRetryDate: new Date(Date.now() - 86400000 * 1).toISOString(),
            result: {
              verified: false,
              score: 60,
              details: 'Employment history partially verified - previous employer not responding'
            },
            notes: 'Manual follow-up with employer required'
          },
          {
            id: 'bc-006',
            providerId: 'prov-006',
            providerName: 'Layla Al-Mansour',
            providerEmail: 'layla.m@email.com',
            providerPhone: '+971554321000',
            type: 'education',
            status: 'completed',
            priority: 'low',
            requestDate: new Date(Date.now() - 86400000 * 7).toISOString(),
            completedDate: new Date(Date.now() - 86400000 * 4).toISOString(),
            retryCount: 0,
            result: {
              verified: true,
              score: 100,
              details: 'University degree verified with registrar'
            },
            notes: 'Education credentials confirmed'
          }
        ]);
        setStats({
          total: 156,
          pending: 23,
          inProgress: 34,
          completed: 87,
          failed: 8,
          needsReview: 4,
          avgCompletionTime: 2.5,
          passRate: 91.5,
          byType: [
            { type: 'Identity', count: 45, color: '#3B82F6' },
            { type: 'Criminal', count: 38, color: '#EF4444' },
            { type: 'Address', count: 32, color: '#8B5CF6' },
            { type: 'Employment', count: 22, color: '#10B981' },
            { type: 'Education', count: 12, color: '#F59E0B' },
            { type: 'Financial', count: 7, color: '#EC4899' }
          ],
          trend: [
            { date: 'Mon', requested: 12, completed: 8, failed: 1 },
            { date: 'Tue', requested: 15, completed: 12, failed: 0 },
            { date: 'Wed', requested: 18, completed: 14, failed: 2 },
            { date: 'Thu', requested: 14, completed: 16, failed: 1 },
            { date: 'Fri', requested: 20, completed: 18, failed: 3 },
            { date: 'Sat', requested: 8, completed: 10, failed: 0 },
            { date: 'Sun', requested: 6, completed: 9, failed: 1 }
          ],
          urgentCount: 5
        });
      }
    } catch (err) {
      console.error('Error fetching background check data:', err);
      setError('Failed to load background check data');
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

  const handleRetryCheck = async (checkId: string) => {
    setActionLoading(checkId);
    try {
      await api.post(`/admin/background-checks/${checkId}/retry`);
      setChecks(prev => prev.map(check =>
        check.id === checkId
          ? { ...check, retryCount: check.retryCount + 1, lastRetryDate: new Date().toISOString(), status: 'pending' as const }
          : check
      ));
    } catch (err) {
      console.error('Error retrying check:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (checkId: string, newStatus: BackgroundCheck['status']) => {
    setActionLoading(checkId);
    try {
      await api.patch(`/admin/background-checks/${checkId}`, { status: newStatus });
      setChecks(prev => prev.map(check =>
        check.id === checkId ? { ...check, status: newStatus } : check
      ));
    } catch (err) {
      console.error('Error updating check status:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredChecks = checks.filter(check => {
    const matchesSearch =
      check.providerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      check.providerEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      check.providerId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || check.status === statusFilter;
    const matchesType = typeFilter === 'all' || check.type === typeFilter;
    const matchesPriority = priorityFilter === 'all' || check.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesType && matchesPriority;
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Background Checks</h3>
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
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Background Checks</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Provider verification & vetting</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button onClick={onClose} className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors">
              <X className="w-5 h-5 text-nilin-warmGray" />
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
          <p className="text-2xl font-serif text-nilin-charcoal">{stats?.total || 0}</p>
          <p className="text-xs text-nilin-warmGray">Total</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{stats?.pending || 0}</p>
          <p className="text-xs text-nilin-warmGray">Pending</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <RefreshCw className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{stats?.inProgress || 0}</p>
          <p className="text-xs text-nilin-warmGray">In Progress</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <CheckCircle className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{stats?.completed || 0}</p>
          <p className="text-xs text-nilin-warmGray">Completed</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600">{stats?.failed || 0}</p>
          <p className="text-xs text-nilin-warmGray">Failed</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Pass Rate</span>
            <span className="text-lg font-serif text-green-600">{stats?.passRate || 0}%</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Avg. Completion</span>
            <span className="text-lg font-serif text-nilin-charcoal">{stats?.avgCompletionTime || 0} days</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-orange-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Needs Review</span>
            <span className="text-lg font-serif text-orange-600">{stats?.needsReview || 0}</span>
          </div>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Urgent</span>
            <span className="text-lg font-serif text-red-600">{stats?.urgentCount || 0}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Request Trend</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Line type="monotone" dataKey="requested" stroke="#3B82F6" strokeWidth={2} name="Requested" />
                <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} name="Completed" />
                <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} name="Failed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Type</h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byType || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="type"
                >
                  {stats?.byType?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4">
            {stats?.byType?.map(item => (
              <div key={item.type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-nilin-warmGray">{item.type}</span>
              </div>
            ))}
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
            placeholder="Search by provider name or ID..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="needs_review">Needs Review</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          <option value="identity">Identity</option>
          <option value="criminal">Criminal</option>
          <option value="address">Address</option>
          <option value="employment">Employment</option>
          <option value="education">Education</option>
          <option value="financial">Financial</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Checks List */}
      <div className="space-y-3">
        {filteredChecks.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <Shield className="w-12 h-12 mx-auto mb-4 text-nilin-border" />
            <p className="font-medium">No background checks match your filters</p>
          </div>
        ) : (
          filteredChecks.map(check => {
            const typeConfig = TYPE_CONFIG[check.type];
            const statusConfig = STATUS_CONFIG[check.status];
            const priorityConfig = PRIORITY_CONFIG[check.priority];
            const StatusIcon = statusConfig.icon;
            const isSelected = selectedCheck?.id === check.id;

            return (
              <div
                key={check.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all',
                  check.priority === 'urgent' ? 'border-red-200 bg-red-50/30' :
                  check.priority === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  check.status === 'failed' ? 'border-red-100 bg-red-50/20' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', typeConfig.bgColor)}>
                    <typeConfig.icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-nilin-charcoal">{check.providerName}</span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', priorityConfig.color)}>
                        {priorityConfig.label}
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
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {check.providerEmail}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {check.providerPhone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(check.requestDate).toLocaleDateString()}
                      </span>
                      {check.retryCount > 0 && (
                        <span className="flex items-center gap-1 text-orange-600">
                          <RotateCcw className="w-3 h-3" />
                          {check.retryCount} retries
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.status === 'failed' && check.retryCount < 3 && (
                      <button
                        onClick={() => handleRetryCheck(check.id)}
                        disabled={actionLoading === check.id}
                        className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-600 hover:bg-orange-200 transition-colors text-sm font-medium"
                        title="Retry Check"
                      >
                        {actionLoading === check.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      </button>
                    )}
                    {check.status === 'pending' && (
                      <button
                        onClick={() => handleUpdateStatus(check.id, 'in_progress')}
                        disabled={actionLoading === check.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors text-sm font-medium"
                      >
                        Start
                      </button>
                    )}
                    {check.status === 'in_progress' && (
                      <button
                        onClick={() => handleUpdateStatus(check.id, 'completed')}
                        disabled={actionLoading === check.id}
                        className="px-3 py-1.5 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors text-sm font-medium"
                      >
                        Complete
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedCheck(isSelected ? null : check)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      {isSelected ? <ChevronUp className="w-4 h-4 text-nilin-warmGray" /> : <ChevronDown className="w-4 h-4 text-nilin-warmGray" />}
                    </button>
                  </div>
                </div>

                {isSelected && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    {check.result && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium text-nilin-charcoal">Verification Result</p>
                          <span className={cn(
                            'px-3 py-1 rounded-lg text-sm font-medium',
                            check.result.verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          )}>
                            {check.result.verified ? 'Verified' : 'Not Verified'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                          <div className="bg-white/50 rounded-lg p-3">
                            <p className="text-xs text-nilin-warmGray">Score</p>
                            <p className={cn(
                              'text-2xl font-serif',
                              check.result.score >= 70 ? 'text-green-600' : check.result.score >= 40 ? 'text-amber-600' : 'text-red-600'
                            )}>
                              {check.result.score}%
                            </p>
                          </div>
                          <div className="bg-white/50 rounded-lg p-3">
                            <p className="text-xs text-nilin-warmGray">Documents</p>
                            <p className="text-2xl font-serif text-nilin-charcoal">
                              {check.result.documents?.filter(d => d.verified).length || 0}/{check.result.documents?.length || 0}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-nilin-warmGray">{check.result.details}</p>

                        {check.result.documents && check.result.documents.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-nilin-charcoal mb-2">Submitted Documents</p>
                            <div className="grid grid-cols-2 gap-2">
                              {check.result.documents.map((doc, idx) => (
                                <div key={idx} className={cn(
                                  'flex items-center gap-2 p-2 rounded-lg',
                                  doc.verified ? 'bg-green-50' : 'bg-red-50'
                                )}>
                                  <FileText className={cn('w-4 h-4', doc.verified ? 'text-green-600' : 'text-red-600')} />
                                  <span className="text-xs text-nilin-charcoal capitalize">{doc.type.replace('_', ' ')}</span>
                                  {doc.verified ? (
                                    <CheckCircle className="w-3 h-3 text-green-600 ml-auto" />
                                  ) : (
                                    <XCircle className="w-3 h-3 text-red-600 ml-auto" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {check.notes && (
                      <div className="p-3 bg-nilin-blush/30 rounded-xl">
                        <p className="text-sm font-medium text-nilin-charcoal mb-1">Notes</p>
                        <p className="text-sm text-nilin-warmGray">{check.notes}</p>
                      </div>
                    )}

                    {check.expiryDate && (
                      <div className="mt-3 text-xs text-nilin-warmGray">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Expires: {new Date(check.expiryDate).toLocaleDateString()}
                      </div>
                    )}
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

export default BackgroundCheckDashboard;
