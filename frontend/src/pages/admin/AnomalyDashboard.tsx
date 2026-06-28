
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import {
  Shield,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Eye,
  Filter,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  AlertCircle,
  Ban,
  Check,
  ExternalLink,
  Download,
  Bell,
  User,
  Calendar,
  FilterX,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { anomalyApi } from '../../services/anomalyApi';
import type {
  Anomaly,
  AnomalyType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyFilters,
  AnomalyStats,
  EntityType,
} from '../../services/anomalyApi';
import { useAuthStore } from '../../stores/authStore';

// ============================================
// Entity admin link helper
// ============================================

const getEntityAdminHref = (entityType: EntityType, entityId: string): string => {
  switch (entityType) {
    case 'provider':
      return `/admin/providers?providerId=${entityId}`;
    case 'booking':
      return `/admin/bookings?bookingId=${entityId}`;
    case 'payment':
      return '/admin/refunds';
    case 'user':
    default:
      return `/admin/customers?customerId=${entityId}`;
  }
};

// ============================================
// Severity Badge Component
// ============================================

const SeverityBadge: React.FC<{ severity: AnomalySeverity }> = ({ severity }) => {
  const styles: Record<AnomalySeverity, { bg: string; text: string; icon: React.ReactNode }> = {
    critical: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-700 dark:text-red-400',
      icon: <AlertTriangle className="w-3 h-3" />,
    },
    high: {
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      text: 'text-orange-700 dark:text-orange-400',
      icon: <AlertCircle className="w-3 h-3" />,
    },
    medium: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-700 dark:text-yellow-400',
      icon: <Zap className="w-3 h-3" />,
    },
    low: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: <Activity className="w-3 h-3" />,
    },
  };

  const style = styles[severity];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.icon}
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
};

// ============================================
// Status Badge Component
// ============================================

const StatusBadge: React.FC<{ status: AnomalyStatus }> = ({ status }) => {
  const styles: Record<AnomalyStatus, { bg: string; text: string; icon: React.ReactNode }> = {
    pending: {
      bg: 'bg-gray-100 dark:bg-gray-800',
      text: 'text-gray-700 dark:text-gray-300',
      icon: <Clock className="w-3 h-3" />,
    },
    investigating: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      icon: <Eye className="w-3 h-3" />,
    },
    resolved: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-700 dark:text-green-400',
      icon: <CheckCircle className="w-3 h-3" />,
    },
    false_positive: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-700 dark:text-purple-400',
      icon: <Ban className="w-3 h-3" />,
    },
  };

  const style = styles[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.icon}
      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
};

// ============================================
// Type Badge Component
// ============================================

const TypeBadge: React.FC<{ type: AnomalyType }> = ({ type }) => {
  const styles: Record<AnomalyType, { bg: string; text: string; label: string }> = {
    fraud: {
      bg: 'bg-pink-100 dark:bg-pink-900/30',
      text: 'text-pink-700 dark:text-pink-400',
      label: 'Fraud',
    },
    booking: {
      bg: 'bg-indigo-100 dark:bg-indigo-900/30',
      text: 'text-indigo-700 dark:text-indigo-400',
      label: 'Booking',
    },
    payment: {
      bg: 'bg-emerald-100 dark:bg-emerald-900/30',
      text: 'text-emerald-700 dark:text-emerald-400',
      label: 'Payment',
    },
    behavior: {
      bg: 'bg-violet-100 dark:bg-violet-900/30',
      text: 'text-violet-700 dark:text-violet-400',
      label: 'Behavior',
    },
  };

  const style = styles[type];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
};

// ============================================
// Stats Card Component
// ============================================

const StatsCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, trend, color, subtitle }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
    <div className="flex items-center justify-between">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      {trend && (
        <div className={`flex items-center text-xs font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {trend.isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
          {Math.abs(trend.value)}%
        </div>
      )}
    </div>
    <div className="mt-3">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>}
    </div>
  </div>
);

// ============================================
// Anomaly Detail Modal Component
// ============================================

const AnomalyDetailModal: React.FC<{
  anomaly: Anomaly | null;
  onClose: () => void;
  onUpdateStatus: (id: string, status: AnomalyStatus, resolution?: string) => Promise<void>;
}> = ({ anomaly, onClose, onUpdateStatus }) => {
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [resolution, setResolution] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<AnomalyStatus | ''>('');

  if (!anomaly) return null;

  const handleUpdateStatus = async () => {
    if (!selectedStatus) return;
    setIsUpdating(true);
    try {
      await onUpdateStatus(anomaly.id, selectedStatus, resolution);
      onClose();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />

        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Anomaly Details
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Header Info */}
          <div className="flex flex-wrap gap-2 mb-4">
            <SeverityBadge severity={anomaly.severity} />
            <StatusBadge status={anomaly.status} />
            <TypeBadge type={anomaly.type} />
          </div>

          {/* Description */}
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Description</h4>
            <p className="text-gray-900 dark:text-white">{anomaly.description}</p>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Entity</h4>
              <p className="text-gray-900 dark:text-white capitalize">
                {anomaly.entityType}: {anomaly.entityId.slice(0, 8)}...
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Confidence</h4>
              <p className="text-gray-900 dark:text-white">{(anomaly.confidence * 100).toFixed(1)}%</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Detected At</h4>
              <p className="text-gray-900 dark:text-white">
                {new Date(anomaly.detectedAt).toLocaleString()}
              </p>
            </div>
            {anomaly.resolvedAt && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Resolved At</h4>
                <p className="text-gray-900 dark:text-white">
                  {new Date(anomaly.resolvedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Evidence */}
          {anomaly.evidence.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Evidence</h4>
              <div className="flex flex-wrap gap-2">
                {anomaly.evidence.slice(0, 5).map((item, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300"
                  >
                    {item}
                  </span>
                ))}
                {anomaly.evidence.length > 5 && (
                  <span className="px-2 py-1 text-xs text-gray-500">
                    +{anomaly.evidence.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Resolution */}
          {anomaly.resolution && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Resolution</h4>
              <p className="text-gray-900 dark:text-white">{anomaly.resolution}</p>
            </div>
          )}

          {/* Update Status Section */}
          {anomaly.status !== 'resolved' && anomaly.status !== 'false_positive' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Update Status</h4>
              <div className="space-y-3">
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as AnomalyStatus)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select new status</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="false_positive">False Positive</option>
                </select>

                {selectedStatus && (
                  <>
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      placeholder="Add resolution notes (optional)..."
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={2}
                    />
                    <button
                      onClick={handleUpdateStatus}
                      disabled={isUpdating || !selectedStatus}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                      Update Status
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => navigate(getEntityAdminHref(anomaly.entityType, anomaly.entityId))}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300"
            >
              <ExternalLink className="w-4 h-4" />
              View Entity
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// Main Dashboard Component
// ============================================

interface AnomalyDashboardProps {}

const AnomalyDashboard: React.FC<AnomalyDashboardProps> = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  // State
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  // Filters
  const [filters, setFilters] = useState<AnomalyFilters>({
    type: (searchParams.get('type') as AnomalyType) || undefined,
    severity: (searchParams.get('severity') as AnomalySeverity) || undefined,
    status: (searchParams.get('status') as AnomalyStatus) || undefined,
    page: parseInt(searchParams.get('page') || '1'),
    limit: 20,
  });

  // Fetch anomalies
  const fetchAnomalies = useCallback(async (refreshFilters?: AnomalyFilters) => {
    try {
      setError(null);
      const response = await anomalyApi.listAnomalies(refreshFilters || filters);
      setAnomalies(response.data);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message || 'Failed to load anomalies');
    }
  }, [filters]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsError(null);
      const response = await anomalyApi.getAnomalyStats();
      setStats(response);
    } catch (err) {
      const errorMessage = err.message || 'Failed to load statistics';
      setStatsError(errorMessage);
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    Promise.all([fetchAnomalies(), fetchStats()])
      .finally(() => setIsLoading(false));
  }, []);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchAnomalies(), fetchStats()]);
    setIsRefreshing(false);
  };

  // Apply filters
  const applyFilters = (newFilters: Partial<AnomalyFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 };
    setFilters(updatedFilters);

    // Update URL params
    const params = new URLSearchParams();
    Object.entries(updatedFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });
    setSearchParams(params);

    fetchAnomalies(updatedFilters);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({ page: 1, limit: 20 });
    setSearchParams(new URLSearchParams());
    fetchAnomalies({ page: 1, limit: 20 });
  };

  // Handle pagination
  const handlePageChange = (newPage: number) => {
    const updatedFilters = { ...filters, page: newPage };
    setFilters(updatedFilters);
    fetchAnomalies(updatedFilters);
  };

  // Update anomaly status
  const handleUpdateStatus = async (id: string, status: AnomalyStatus, resolution?: string) => {
    await anomalyApi.updateAnomalyStatus(id, status, resolution);
    handleRefresh();
  };

  // Export anomalies
  const handleExport = async () => {
    try {
      const blob = await anomalyApi.exportAnomalies(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `anomalies-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  // Count active filters
  const activeFilterCount = [
    filters.type,
    filters.severity,
    filters.status,
  ].filter(Boolean).length;

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-2">
      <button
        onClick={handleExport}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
      >
        <Download className="w-4 h-4" />
        Export
      </button>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 text-gray-700 dark:text-gray-300"
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
      <button
        onClick={() => setIsFullscreen(!isFullscreen)}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Anomaly Detection"
        subtitle="Monitor and manage detected anomalies across the platform"
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Anomaly Detection', current: true },
        ]}
        headerActions={headerActions}
        wideLayout
      >
        <div className={`${isFullscreen ? 'fixed inset-0 z-50 overflow-auto' : ''}`}>
          {/* Stats Cards */}
          {statsError ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Failed to load statistics
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-400">{statsError}</p>
                  </div>
                </div>
                <button
                  onClick={fetchStats}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                  title="Total Anomalies"
                  value={stats.total}
                  icon={<Shield className="w-5 h-5 text-blue-600" />}
                  color="bg-blue-100 dark:bg-blue-900/30"
                />
                <StatsCard
                  title="Critical"
                  value={stats.criticalCount}
                  icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
                  color="bg-red-100 dark:bg-red-900/30"
                  subtitle="Requires immediate attention"
                />
                <StatsCard
                  title="Pending Review"
                  value={stats.byStatus.pending}
                  icon={<Clock className="w-5 h-5 text-yellow-600" />}
                  color="bg-yellow-100 dark:bg-yellow-900/30"
                />
                <StatsCard
                  title="Resolved Today"
                  value={stats.resolvedToday}
                  icon={<CheckCircle className="w-5 h-5 text-green-600" />}
                  color="bg-green-100 dark:bg-green-900/30"
                  trend={{ value: 12, isPositive: true }}
                />
              </div>

              {/* Severity Breakdown */}
              <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                {(['critical', 'high', 'medium', 'low'] as AnomalySeverity[]).map((severity) => (
                  <div
                    key={severity}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => applyFilters({ severity })}
                  >
                    <div className="flex items-center justify-between">
                      <SeverityBadge severity={severity} />
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stats.bySeverity[severity]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}

          {/* Filters Bar */}
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${
                      showFilters
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {activeFilterCount > 0 && (
                    <button
                      onClick={clearFilters}
                      className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1"
                    >
                      <FilterX className="w-4 h-4" />
                      Clear all
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {pagination.total} total anomalies
                  </span>
                </div>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Type Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type
                    </label>
                    <select
                      value={filters.type || ''}
                      onChange={(e) => applyFilters({ type: e.target.value as AnomalyType || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">All Types</option>
                      <option value="fraud">Fraud</option>
                      <option value="booking">Booking</option>
                      <option value="payment">Payment</option>
                      <option value="behavior">Behavior</option>
                    </select>
                  </div>

                  {/* Severity Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Severity
                    </label>
                    <select
                      value={filters.severity || ''}
                      onChange={(e) => applyFilters({ severity: e.target.value as AnomalySeverity || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Status
                    </label>
                    <select
                      value={filters.status || ''}
                      onChange={(e) => applyFilters({ status: e.target.value as AnomalyStatus || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="false_positive">False Positive</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Anomaly List */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                  <p className="mt-2 text-gray-500 dark:text-gray-400">Loading anomalies...</p>
                </div>
              ) : error ? (
                <div className="p-8 text-center">
                  <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
                  <p className="mt-2 text-gray-500 dark:text-gray-400">{error}</p>
                  <button
                    onClick={handleRefresh}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : anomalies.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle className="w-8 h-8 mx-auto text-green-500" />
                  <p className="mt-2 text-gray-900 dark:text-white font-medium">No anomalies found</p>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    {activeFilterCount > 0
                      ? 'Try adjusting your filters'
                      : 'All clear! No anomalies detected.'}
                  </p>
                </div>
              ) : (
                anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedAnomaly(anomaly)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <SeverityBadge severity={anomaly.severity} />
                          <TypeBadge type={anomaly.type} />
                          <StatusBadge status={anomaly.status} />
                        </div>
                        <p className="mt-2 text-gray-900 dark:text-white font-medium line-clamp-1">
                          {anomaly.description}
                        </p>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {anomaly.entityType}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(anomaly.detectedAt).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            {(anomaly.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                      </div>
                      <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page <= 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                    const page = pagination.page - 2 + i;
                    if (page < 1 || page > pagination.pages) return null;
                    return (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 rounded-lg ${
                          page === pagination.page
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page >= pagination.pages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detail Modal */}
          <AnomalyDetailModal
            anomaly={selectedAnomaly}
            onClose={() => setSelectedAnomaly(null)}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

// ChevronRight icon fallback
const ChevronRight: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

export default AnomalyDashboard;
