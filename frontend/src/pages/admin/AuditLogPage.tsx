import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  RefreshCw,
  Filter,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { AdminPagination } from '../../components/admin/AdminPagination';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import {
  auditService,
  type AuditLogEntry,
  type AuditLogFilters,
  type AuditStatsResponse,
} from '../../services/auditService';

const ACTION_OPTIONS = [
  'create',
  'update',
  'delete',
  'approve',
  'reject',
  'suspend',
  'login',
  'logout',
  'export',
  'bulk_action',
  'settings_change',
  'other',
];

const RESOURCE_OPTIONS = [
  'provider',
  'customer',
  'service',
  'booking',
  'category',
  'coupon',
  'offer',
  'review',
  'payout',
  'dispute',
  'refund',
  'user',
  'settings',
  'api_key',
  'system',
  'other',
];

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AE', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getActionColor(action: string, status: string): string {
  if (status === 'failure') return 'border-red-200 bg-red-50/50';
  if (['delete', 'reject', 'suspend'].includes(action)) return 'border-orange-200 bg-orange-50/50';
  if (['approve', 'create'].includes(action)) return 'border-emerald-200 bg-emerald-50/50';
  return 'border-nilin-border/50 bg-white/60';
}

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStatsResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 20 });
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: undefined,
    resource: undefined,
    status: undefined,
  });
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [logsRes, statsRes] = await Promise.all([
        auditService.getAuditLogs({ ...filters, page, limit: 20 }),
        auditService.getAuditStats(),
      ]);

      if (statsRes?.data) setStats(statsRes.data);

      if (logsRes?.data) {
        let entries = logsRes.data.logs;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          entries = entries.filter(
            (log) =>
              log.description?.toLowerCase().includes(q) ||
              log.action.toLowerCase().includes(q) ||
              log.resource.toLowerCase().includes(q) ||
              `${log.userId?.firstName} ${log.userId?.lastName}`.toLowerCase().includes(q)
          );
        }
        setLogs(entries);
        setPagination({
          total: logsRes.data.pagination.total,
          totalPages: logsRes.data.pagination.totalPages,
          limit: logsRes.data.pagination.limit,
        });
      } else {
        setLogs([]);
      }
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page, searchQuery]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExport = async () => {
    const csv = await auditService.exportLogs(filters);
    if (!csv) {
      toast.error('Export failed');
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Audit log exported');
  };

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => fetchLogs(true)}
        disabled={refreshing}
        className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-medium font-sans hover:bg-nilin-blush/40 transition-colors disabled:opacity-50"
        aria-label="Refresh audit log"
      >
        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">Refresh</span>
      </button>
      <button
        type="button"
        onClick={handleExport}
        className="inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-sm font-medium font-sans shadow-nilin-warm hover:opacity-95 transition-opacity"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">Export</span>
      </button>
    </div>
  );

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Audit Log"
        subtitle="Activity history · admin actions"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Audit Log', current: true },
        ]}
        headerActions={headerActions}
        wideLayout
      >
        <div className="space-y-6 overflow-x-hidden min-w-0">
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Today', value: stats.counts.today },
                { label: 'This week', value: stats.counts.week },
                { label: 'This month', value: stats.counts.month },
                { label: 'All time', value: stats.counts.total },
              ].map((item) => (
                <div
                  key={item.label}
                  className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4 min-w-0"
                >
                  <p className="text-xs text-nilin-warmGray font-sans uppercase tracking-wide">{item.label}</p>
                  <p className="text-2xl font-serif text-nilin-charcoal mt-1">{item.value.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium text-nilin-charcoal font-sans">
              <Filter className="w-4 h-4 text-nilin-coral" />
              Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-warmGray pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search logs..."
                  className="w-full min-h-11 pl-10 pr-3 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  aria-label="Search audit logs"
                />
              </div>
              <select
                value={filters.action || ''}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({ ...f, action: e.target.value || undefined }));
                }}
                className="min-h-11 px-3 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                aria-label="Filter by action"
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <select
                value={filters.resource || ''}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({ ...f, resource: e.target.value || undefined }));
                }}
                className="min-h-11 px-3 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                aria-label="Filter by resource"
              >
                <option value="">All resources</option>
                {RESOURCE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <select
                value={filters.status || ''}
                onChange={(e) => {
                  setPage(1);
                  setFilters((f) => ({
                    ...f,
                    status: (e.target.value as 'success' | 'failure') || undefined,
                  }));
                }}
                className="min-h-11 px-3 rounded-xl border border-nilin-border/50 bg-white/60 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                aria-label="Filter by status"
              >
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="failure">Failure</option>
              </select>
            </div>
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 overflow-hidden min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <FileText className="w-12 h-12 text-nilin-border mb-3" />
                <p className="text-sm text-nilin-warmGray font-sans">No audit entries found</p>
              </div>
            ) : (
              <ul className="divide-y divide-nilin-border/30">
                {logs.map((log) => (
                  <li
                    key={log._id}
                    className={`p-4 sm:p-5 border-l-4 ${getActionColor(log.action, log.status)}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-nilin-charcoal capitalize font-sans">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-nilin-blush/60 text-nilin-warmGray font-sans capitalize">
                            {log.resource}
                          </span>
                          {log.status === 'success' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500" aria-label="Success" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" aria-label="Failed" />
                          )}
                        </div>
                        {log.description && (
                          <p className="text-sm text-nilin-charcoal font-sans break-words">{log.description}</p>
                        )}
                        <p className="text-xs text-nilin-warmGray font-sans mt-1 truncate">
                          {log.userId
                            ? `${log.userId.firstName} ${log.userId.lastName} · ${log.userId.email}`
                            : 'System'}
                        </p>
                      </div>
                      <time
                        className="text-xs text-nilin-warmGray font-sans whitespace-nowrap flex-shrink-0"
                        dateTime={log.createdAt}
                        title={new Date(log.createdAt).toLocaleString()}
                      >
                        {formatRelativeTime(log.createdAt)}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!loading && pagination.totalPages > 1 && (
            <AdminPagination
              page={page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.limit}
              onPageChange={setPage}
              showPageNumbers
              showTotal
            />
          )}
        </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default AuditLogPage;
