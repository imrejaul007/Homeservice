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
import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import { ErrorEmptyState } from './EmptyState';

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

export const AutomationStatus: React.FC<AutomationStatusProps> = ({
  embedded = false,
  onClose,
}) => {
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
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
        const apiJobs = (response.data.data.jobs || []).map((job: AutomationJob) => ({
          ...job,
          icon: CATEGORY_CONFIG[job.category]?.icon || Zap,
        }));
        setJobs(apiJobs);
        setLogs(response.data.data.logs || []);
        setStats(response.data.data.stats || null);
      } else {
        setJobs([]);
        setLogs([]);
        setStats(null);
        setError('No automation data available');
      }
    } catch (err) {
      console.error('Error fetching automation data:', err);
      setJobs([]);
      setLogs([]);
      setStats(null);
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
