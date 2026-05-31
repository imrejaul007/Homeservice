import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  AlertCircle,
  Search,
  Filter,
  Play,
  Pause,
  Eye,
  Calendar,
  TrendingUp,
  Zap,
  Mail,
  Bell,
  Gift,
  Users,
  Star,
  Cake,
  Award,
  MessageSquare,
  DollarSign,
  Shield,
  Settings,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  History,
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface AutomationJob {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'notification' | 'loyalty' | 'marketing' | 'operations' | 'analytics';
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused' | 'error' | 'disabled';
  successRate: number;
  avgExecutionTime: number;
  totalExecutions: number;
  recentFailures: number;
  icon: React.ElementType;
}

interface ExecutionLog {
  id: string;
  jobId: string;
  jobName: string;
  status: 'success' | 'failed' | 'partial';
  startTime: string;
  endTime?: string;
  duration?: number;
  recordsProcessed: number;
  recordsFailed: number;
  errorMessage?: string;
}

interface AutomationStats {
  totalJobs: number;
  activeJobs: number;
  pausedJobs: number;
  errorJobs: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  avgSuccessRate: number;
  executionsTrend: Array<{ date: string; success: number; failed: number }>;
  categoryDistribution: Array<{ category: string; count: number; color: string }>;
}

interface AutomationStatusProps {
  embedded?: boolean;
  onClose?: () => void;
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  email: { label: 'Email', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: Mail },
  notification: { label: 'Notifications', color: 'text-purple-600', bgColor: 'bg-purple-100', icon: Bell },
  loyalty: { label: 'Loyalty', color: 'text-amber-600', bgColor: 'bg-amber-100', icon: Star },
  marketing: { label: 'Marketing', color: 'text-pink-600', bgColor: 'bg-pink-100', icon: Gift },
  operations: { label: 'Operations', color: 'text-emerald-600', bgColor: 'bg-emerald-100', icon: Settings },
  analytics: { label: 'Analytics', color: 'text-cyan-600', bgColor: 'bg-cyan-100', icon: BarChart3 },
};

const JOBS_DATA: AutomationJob[] = [
  {
    id: 'job-001',
    name: 'Win-Back Campaign',
    description: 'Detect inactive users and run win-back campaigns',
    category: 'marketing',
    schedule: 'Every hour',
    lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 94.5,
    avgExecutionTime: 2340,
    totalExecutions: 1250,
    recentFailures: 12,
    icon: Users,
  },
  {
    id: 'job-002',
    name: 'Birthday Rewards',
    description: 'Send birthday rewards and special offers',
    category: 'marketing',
    schedule: 'Daily at 9 AM',
    lastRun: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 98.2,
    avgExecutionTime: 890,
    totalExecutions: 180,
    recentFailures: 0,
    icon: Cake,
  },
  {
    id: 'job-003',
    name: 'Tier Upgrades',
    description: 'Check and process tier upgrades',
    category: 'loyalty',
    schedule: 'Daily at 10 AM',
    lastRun: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 99.1,
    avgExecutionTime: 456,
    totalExecutions: 365,
    recentFailures: 1,
    icon: Award,
  },
  {
    id: 'job-004',
    name: 'Review Requests',
    description: 'Send review requests after bookings',
    category: 'marketing',
    schedule: 'Every 15 minutes',
    lastRun: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 91.3,
    avgExecutionTime: 1234,
    totalExecutions: 8640,
    recentFailures: 45,
    icon: Star,
  },
  {
    id: 'job-005',
    name: 'Provider Training',
    description: 'Check provider training progress and send reminders',
    category: 'operations',
    schedule: 'Every hour',
    lastRun: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 96.7,
    avgExecutionTime: 1890,
    totalExecutions: 2480,
    recentFailures: 8,
    icon: Shield,
  },
  {
    id: 'job-006',
    name: 'Onboarding Checklist',
    description: 'Process onboarding checklists for new users',
    category: 'operations',
    schedule: 'Every 6 hours',
    lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 97.8,
    avgExecutionTime: 2340,
    totalExecutions: 620,
    recentFailures: 3,
    icon: CheckCircle2,
  },
  {
    id: 'job-007',
    name: 'First Booking Discount',
    description: 'Check and apply first booking discounts',
    category: 'marketing',
    schedule: 'Daily at midnight',
    lastRun: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 16 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 98.9,
    avgExecutionTime: 678,
    totalExecutions: 365,
    recentFailures: 0,
    icon: Gift,
  },
  {
    id: 'job-008',
    name: 'Negative Review Recovery',
    description: 'Process and recover from negative reviews',
    category: 'operations',
    schedule: 'Every 30 minutes',
    lastRun: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 88.4,
    avgExecutionTime: 3456,
    totalExecutions: 4320,
    recentFailures: 28,
    icon: MessageSquare,
  },
  {
    id: 'job-009',
    name: 'Auto Refund Threshold',
    description: 'Process automatic refunds based on threshold rules',
    category: 'operations',
    schedule: 'Every hour',
    lastRun: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 99.5,
    avgExecutionTime: 890,
    totalExecutions: 2480,
    recentFailures: 2,
    icon: DollarSign,
  },
  {
    id: 'job-010',
    name: 'Mediation Auto-Assign',
    description: 'Auto-assign unassigned mediation cases',
    category: 'operations',
    schedule: 'Every 4 hours',
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'paused',
    successRate: 85.2,
    avgExecutionTime: 1567,
    totalExecutions: 310,
    recentFailures: 15,
    icon: Users,
  },
  {
    id: 'job-011',
    name: 'Welcome Email Sequence',
    description: 'Send welcome email sequences to new users',
    category: 'email',
    schedule: 'Every 15 minutes',
    lastRun: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
    status: 'active',
    successRate: 95.1,
    avgExecutionTime: 2134,
    totalExecutions: 5760,
    recentFailures: 34,
    icon: Mail,
  },
  {
    id: 'job-012',
    name: 'Referral Gamification',
    description: 'Track referrals and award badges',
    category: 'loyalty',
    schedule: 'Every hour',
    lastRun: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    nextRun: new Date(Date.now() + 40 * 60 * 1000).toISOString(),
    status: 'error',
    successRate: 72.3,
    avgExecutionTime: 4567,
    totalExecutions: 1240,
    recentFailures: 89,
    icon: Gift,
  },
];

export const AutomationStatus: React.FC<AutomationStatusProps> = ({
  embedded = false,
  onClose,
}) => {
  const [jobs, setJobs] = useState<AutomationJob[]>(JOBS_DATA);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<AutomationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedJob, setSelectedJob] = useState<AutomationJob | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'jobs' | 'logs'>('overview');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/automation/status');

      if (response.data?.success) {
        setJobs(response.data.data.jobs || []);
        setLogs(response.data.data.logs || []);
        setStats(response.data.data.stats);
      } else {
        // Use local data
        setJobs(JOBS_DATA);

        // Generate mock logs
        const mockLogs: ExecutionLog[] = [];
        for (let i = 0; i < 20; i++) {
          const job = JOBS_DATA[Math.floor(Math.random() * JOBS_DATA.length)];
          mockLogs.push({
            id: `log-${i}`,
            jobId: job.id,
            jobName: job.name,
            status: Math.random() > 0.1 ? 'success' : Math.random() > 0.5 ? 'failed' : 'partial',
            startTime: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(),
            endTime: new Date(Date.now() - i * 30 * 60 * 1000 + Math.random() * 5000).toISOString(),
            duration: Math.floor(Math.random() * 5000),
            recordsProcessed: Math.floor(Math.random() * 100),
            recordsFailed: Math.floor(Math.random() * 10),
            errorMessage: Math.random() > 0.7 ? 'Connection timeout after 30s' : undefined,
          });
        }
        setLogs(mockLogs);

        setStats({
          totalJobs: JOBS_DATA.length,
          activeJobs: JOBS_DATA.filter(j => j.status === 'active').length,
          pausedJobs: JOBS_DATA.filter(j => j.status === 'paused').length,
          errorJobs: JOBS_DATA.filter(j => j.status === 'error').length,
          totalExecutions: 37850,
          successfulExecutions: 36245,
          failedExecutions: 1245,
          avgSuccessRate: 95.6,
          executionsTrend: [
            { date: 'Mon', success: 5200, failed: 180 },
            { date: 'Tue', success: 5400, failed: 150 },
            { date: 'Wed', success: 5100, failed: 220 },
            { date: 'Thu', success: 5600, failed: 190 },
            { date: 'Fri', success: 5800, failed: 170 },
            { date: 'Sat', success: 4900, failed: 200 },
            { date: 'Sun', success: 4245, failed: 135 },
          ],
          categoryDistribution: [
            { category: 'Email', count: 2, color: '#3B82F6' },
            { category: 'Notifications', count: 3, color: '#8B5CF6' },
            { category: 'Loyalty', count: 2, color: '#F59E0B' },
            { category: 'Marketing', count: 4, color: '#EC4899' },
            { category: 'Operations', count: 4, color: '#10B981' },
            { category: 'Analytics', count: 1, color: '#06B6D4' },
          ],
        });
      }
    } catch (err) {
      console.error('Error fetching automation data:', err);
      setError('Failed to load automation status');
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

  const handleToggleJob = async (jobId: string) => {
    try {
      await api.patch(`/admin/automation/jobs/${jobId}/toggle`);
      setJobs(prev =>
        prev.map(job =>
          job.id === jobId
            ? { ...job, status: job.status === 'active' ? 'paused' : 'active' }
            : job
        )
      );
    } catch (err) {
      console.error('Error toggling job:', err);
    }
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      job.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || job.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  };

  const formatTimeAgo = (date: string): string => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Automation Status</h3>
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
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
            <Activity className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Automation Status</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Monitor and manage scheduled automations</p>
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
        {(['overview', 'jobs', 'logs'] as const).map(tab => (
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
              <Activity className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-emerald-600">{stats?.activeJobs || 0}</p>
              <p className="text-xs text-nilin-warmGray">Active Jobs</p>
            </div>
            <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
              <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-green-600">{stats?.avgSuccessRate || 0}%</p>
              <p className="text-xs text-nilin-warmGray">Success Rate</p>
            </div>
            <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
              <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-blue-600">{stats?.totalExecutions?.toLocaleString() || 0}</p>
              <p className="text-xs text-nilin-warmGray">Total Runs</p>
            </div>
            <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
              <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-2xl font-serif text-red-600">{stats?.errorJobs || 0}</p>
              <p className="text-xs text-nilin-warmGray">Error Jobs</p>
            </div>
          </div>

          {/* Execution Trend */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Execution Trend (Last 7 Days)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.executionsTrend || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                  <YAxis stroke="#6B7280" fontSize={11} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                  <defs>
                    <linearGradient id="successGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="success" stroke="#10B981" fill="url(#successGradient)" strokeWidth={2} name="Success" />
                  <Area type="monotone" dataKey="failed" stroke="#EF4444" fill="url(#failedGradient)" strokeWidth={2} name="Failed" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl border border-nilin-border/50 p-6">
              <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Jobs by Category</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.categoryDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                      nameKey="category"
                    >
                      {stats?.categoryDistribution?.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value} jobs`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {stats?.categoryDistribution?.map(item => (
                  <div key={item.category} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-nilin-warmGray">{item.category}</span>
                    <span className="text-xs font-medium text-nilin-charcoal ml-auto">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass rounded-2xl border border-nilin-border/50 p-6">
              <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-nilin-blush/20 transition-colors">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      log.status === 'success' ? 'bg-green-100 text-green-600' :
                      log.status === 'failed' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
                    )}>
                      {log.status === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                       log.status === 'failed' ? <XCircle className="w-4 h-4" /> :
                       <AlertCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-nilin-charcoal truncate">{log.jobName}</p>
                      <p className="text-xs text-nilin-warmGray">{formatTimeAgo(log.startTime)}</p>
                    </div>
                    <span className="text-xs text-nilin-warmGray">{formatDuration(log.duration || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'jobs' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs..."
                className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="error">Error</option>
              <option value="disabled">Disabled</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="email">Email</option>
              <option value="notification">Notifications</option>
              <option value="loyalty">Loyalty</option>
              <option value="marketing">Marketing</option>
              <option value="operations">Operations</option>
              <option value="analytics">Analytics</option>
            </select>
          </div>

          {/* Jobs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredJobs.map(job => {
              const categoryConfig = CATEGORY_CONFIG[job.category] || CATEGORY_CONFIG.operations;
              const CategoryIcon = categoryConfig.icon;
              const isSelected = selectedJob?.id === job.id;

              return (
                <div
                  key={job.id}
                  className={cn(
                    'glass rounded-xl border p-4 transition-all cursor-pointer',
                    isSelected ? 'border-nilin-coral bg-nilin-blush/20' : 'border-nilin-border/50 hover:border-nilin-coral/50'
                  )}
                  onClick={() => setSelectedJob(isSelected ? null : job)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', categoryConfig.bgColor)}>
                      <CategoryIcon className={cn('w-5 h-5', categoryConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-nilin-charcoal">{job.name}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs font-medium',
                          job.status === 'active' ? 'bg-green-100 text-green-600' :
                          job.status === 'paused' ? 'bg-amber-100 text-amber-600' :
                          job.status === 'error' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-600'
                        )}>
                          {job.status}
                        </span>
                      </div>
                      <p className="text-xs text-nilin-warmGray line-clamp-1">{job.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {job.schedule}
                        </span>
                        <span className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {job.successRate}%
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {job.status !== 'error' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleJob(job.id);
                          }}
                          className={cn(
                            'p-2 rounded-lg transition-colors',
                            job.status === 'active'
                              ? 'bg-amber-100 text-amber-600 hover:bg-amber-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          )}
                          title={job.status === 'active' ? 'Pause job' : 'Resume job'}
                        >
                          {job.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                      ) : (
                        <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <div className="mt-4 pt-4 border-t border-nilin-border/50">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-nilin-warmGray">Last Run</p>
                          <p className="font-medium text-nilin-charcoal">
                            {job.lastRun ? formatTimeAgo(job.lastRun) : 'Never'}
                          </p>
                        </div>
                        <div>
                          <p className="text-nilin-warmGray">Next Run</p>
                          <p className="font-medium text-nilin-charcoal">
                            {job.nextRun ? formatTimeAgo(job.nextRun) : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-nilin-warmGray">Avg Duration</p>
                          <p className="font-medium text-nilin-charcoal">{formatDuration(job.avgExecutionTime)}</p>
                        </div>
                        <div>
                          <p className="text-nilin-warmGray">Total Executions</p>
                          <p className="font-medium text-nilin-charcoal">{job.totalExecutions.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-nilin-warmGray">Success Rate</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full"
                                style={{ width: `${job.successRate}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{job.successRate}%</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-nilin-warmGray">Recent Failures</p>
                          <p className={cn(
                            'font-medium',
                            job.recentFailures > 10 ? 'text-red-600' : 'text-nilin-charcoal'
                          )}>
                            {job.recentFailures}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <button className="flex-1 py-2 rounded-lg border border-nilin-border text-sm font-medium text-nilin-warmGray hover:bg-nilin-blush/30 transition-colors flex items-center justify-center gap-2">
                          <History className="w-4 h-4" />
                          View History
                        </button>
                        <button className="flex-1 py-2 rounded-lg border border-nilin-border text-sm font-medium text-nilin-warmGray hover:bg-nilin-blush/30 transition-colors flex items-center justify-center gap-2">
                          <Eye className="w-4 h-4" />
                          View Logs
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'logs' && (
        <>
          {/* Execution Logs */}
          <div className="space-y-3">
            {logs.map(log => (
              <div
                key={log.id}
                className={cn(
                  'glass rounded-xl border p-4',
                  log.status === 'success' ? 'border-green-200' :
                  log.status === 'failed' ? 'border-red-200' :
                  'border-amber-200'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center',
                    log.status === 'success' ? 'bg-green-100 text-green-600' :
                    log.status === 'failed' ? 'bg-red-100 text-red-600' :
                    'bg-amber-100 text-amber-600'
                  )}>
                    {log.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> :
                     log.status === 'failed' ? <XCircle className="w-5 h-5" /> :
                     <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-nilin-charcoal">{log.jobName}</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        log.status === 'success' ? 'bg-green-100 text-green-600' :
                        log.status === 'failed' ? 'bg-red-100 text-red-600' :
                        'bg-amber-100 text-amber-600'
                      )}>
                        {log.status}
                      </span>
                    </div>
                    <p className="text-xs text-nilin-warmGray">
                      {new Date(log.startTime).toLocaleString()}
                      {log.duration && ` - Duration: ${formatDuration(log.duration)}`}
                    </p>
                    {log.errorMessage && (
                      <p className="text-xs text-red-600 mt-1">{log.errorMessage}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-nilin-charcoal">
                      {log.recordsProcessed} processed
                    </p>
                    {log.recordsFailed > 0 && (
                      <p className="text-xs text-red-600">{log.recordsFailed} failed</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AutomationStatus;
