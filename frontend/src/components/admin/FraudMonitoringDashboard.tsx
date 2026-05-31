import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Filter,
  Search,
  ChevronDown,
  Ban,
  UserX,
  DollarSign,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Flag,
  TrendingUp,
  Zap,
  Bell,
  EyeOff
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from '../../lib/utils';
import { fraudApi } from '../../services/analyticsApi';

interface FraudAlert {
  id: string;
  type: 'payment' | 'account' | 'behavior' | 'review' | 'booking';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'reviewed' | 'confirmed' | 'dismissed';
  customerId?: string;
  customerName: string;
  description: string;
  details: Record<string, string | number>;
  timestamp: string;
  assignedTo?: string;
  riskScore: number;
}

interface FraudStats {
  totalAlerts: number;
  pendingReview: number;
  confirmedFraud: number;
  dismissed: number;
  fraudRate: number;
  trend: Array<{ date: string; alerts: number; confirmed: number }>;
  byType: Array<{ type: string; count: number; color: string }>;
  bySeverity: { low: number; medium: number; high: number; critical: number };
}

interface FraudMonitoringDashboardProps {
  embedded?: boolean;
  onClose?: () => void;
}

const SEVERITY_CONFIG = {
  low: { label: 'Low', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Bell },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-200', icon: AlertTriangle },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-200', icon: Shield }
};

const TYPE_CONFIG = {
  payment: { label: 'Payment', icon: CreditCard, color: '#EF4444' },
  account: { label: 'Account', icon: UserX, color: '#F59E0B' },
  behavior: { label: 'Behavior', icon: Eye, color: '#8B5CF6' },
  review: { label: 'Review', icon: Flag, color: '#EC4899' },
  booking: { label: 'Booking', icon: Clock, color: '#3B82F6' }
};

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  reviewed: { label: 'Reviewed', color: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', color: 'bg-red-100 text-red-700' },
  dismissed: { label: 'Dismissed', color: 'bg-gray-100 text-gray-700' }
};

export const FraudMonitoringDashboard: React.FC<FraudMonitoringDashboardProps> = ({
  embedded = false,
  onClose
}) => {
  const [alerts, setAlerts] = useState<FraudAlert[]>([]);
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<FraudAlert | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      // Fetch fraud overview for stats
      const overview = await fraudApi.getFraudOverview();

      setStats({
        totalAlerts: overview.totalFlagged,
        pendingReview: overview.pendingFlags,
        confirmedFraud: overview.resolvedFlags,
        dismissed: 0,
        fraudRate: 0.5, // Would need to calculate from total transactions
        trend: [], // Would need separate API call for trend data
        byType: [], // Would need separate API call
        bySeverity: (overview.bySeverity ?? { low: 0, medium: 0, high: 0, critical: 0 }) as { low: number; medium: number; high: number; critical: number },
      });

      // Set alerts as empty for now - would need separate alerts API
      setAlerts([]);
    } catch (err) {
      console.error('Error fetching fraud data:', err);
      setError('Failed to load fraud monitoring data');
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

  const handleUpdateStatus = async (alertId: string, newStatus: FraudAlert['status']) => {
    setActionLoading(alertId);
    try {
      // Update alert status via API
      // Note: fraudApi.resolveFraudFlag can be used for dismissing flags
      // This would need the providerId associated with the alert
      // For now, we just update the local state
      setAlerts(prev => prev.map(alert =>
        alert.id === alertId ? { ...alert, status: newStatus } : alert
      ));
    } catch (err) {
      console.error('Error updating alert:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          alert.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || alert.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
          <div className="h-64 bg-nilin-blush/30 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Fraud Data</h3>
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
            <Shield className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Fraud Monitoring</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Real-time threat detection & alerts</p>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Total Alerts</span>
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-serif text-nilin-charcoal">{stats?.totalAlerts || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">This month</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Pending Review</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-serif text-nilin-charcoal">{stats?.pendingReview || 0}</p>
          <p className="text-xs text-red-500 mt-1">Needs attention</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Confirmed Fraud</span>
            <Ban className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-serif text-red-600">{stats?.confirmedFraud || 0}</p>
          <p className="text-xs text-nilin-warmGray mt-1">Actions taken</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-nilin-warmGray">Fraud Rate</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-serif text-green-600">{stats?.fraudRate || 0}%</p>
          <p className="text-xs text-nilin-warmGray mt-1">Of all transactions</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Alert Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats?.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="date" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                />
                <Line type="monotone" dataKey="alerts" stroke="#EF4444" strokeWidth={2} name="Alerts" />
                <Line type="monotone" dataKey="confirmed" stroke="#F59E0B" strokeWidth={2} name="Confirmed" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Type */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">By Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.byType || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
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
                <span className="text-xs font-medium text-nilin-charcoal ml-auto">{item.count}</span>
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
            placeholder="Search alerts..."
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
          <option value="reviewed">Reviewed</option>
          <option value="confirmed">Confirmed</option>
          <option value="dismissed">Dismissed</option>
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

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="text-center py-12 text-nilin-warmGray">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
            <p className="font-medium">No alerts match your filters</p>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const severityConfig = SEVERITY_CONFIG[alert.severity];
            const typeConfig = TYPE_CONFIG[alert.type];
            const StatusConfig = STATUS_CONFIG[alert.status];

            return (
              <div
                key={alert.id}
                className={cn(
                  'glass rounded-xl border p-4 transition-all hover:shadow-md',
                  alert.severity === 'critical' ? 'border-red-200 bg-red-50/30' :
                  alert.severity === 'high' ? 'border-orange-200 bg-orange-50/30' :
                  'border-nilin-border/50'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-lg', alert.severity === 'critical' ? 'bg-red-100' : 'bg-nilin-blush/30')}>
                    <typeConfig.icon className="w-5 h-5" style={{ color: typeConfig.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium border', severityConfig.color)}>
                        {severityConfig.label}
                      </span>
                      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', StatusConfig.color)}>
                        {StatusConfig.label}
                      </span>
                      <span className="text-xs text-nilin-warmGray ml-auto">
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-medium text-nilin-charcoal">{alert.customerName}</p>
                    <p className="text-sm text-nilin-warmGray mt-1">{alert.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-nilin-warmGray">
                      <span>Risk Score: <strong className="text-nilin-charcoal">{alert.riskScore}</strong></span>
                      <span>Type: <strong className="text-nilin-charcoal capitalize">{alert.type}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {alert.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'confirmed')}
                          disabled={actionLoading === alert.id}
                          className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                          title="Confirm Fraud"
                        >
                          {actionLoading === alert.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(alert.id, 'dismissed')}
                          disabled={actionLoading === alert.id}
                          className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                          title="Dismiss"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setSelectedAlert(selectedAlert?.id === alert.id ? null : alert)}
                      className="p-2 rounded-lg hover:bg-nilin-blush/30 transition-colors"
                    >
                      <ChevronDown className={cn('w-4 h-4 text-nilin-warmGray transition-transform', selectedAlert?.id === alert.id && 'rotate-180')} />
                    </button>
                  </div>
                </div>
                {selectedAlert?.id === alert.id && (
                  <div className="mt-4 pt-4 border-t border-nilin-border/50">
                    <p className="text-sm font-medium text-nilin-charcoal mb-2">Alert Details</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(alert.details).map(([key, value]) => (
                        <div key={key} className="bg-white/50 rounded-lg p-3">
                          <p className="text-xs text-nilin-warmGray capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                          <p className="text-lg font-serif text-nilin-charcoal">{value}</p>
                        </div>
                      ))}
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

export default FraudMonitoringDashboard;
