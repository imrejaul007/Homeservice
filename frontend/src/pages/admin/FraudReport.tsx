import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { fraudApi } from '../../services/analyticsApi';
import type { FraudReport, FraudStats, FraudOverview, SuspiciousActivity } from '../../services/analyticsApi';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import { useAuthStore } from '../../stores/authStore';
import Modal from '../../components/common/Modal';
import {
  Shield,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Flag,
  Clock,
  FileWarning,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// ============================================
// Severity Badge Component
// ============================================

interface SeverityBadgeProps {
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  const styles = {
    low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-nilin-blush text-nilin-rose dark:bg-nilin-coral/20 dark:text-nilin-coral',
  };

  const labelStyles = {
    low: 'text-green-600 dark:text-green-400',
    medium: 'text-yellow-600 dark:text-yellow-400',
    high: 'text-orange-600 dark:text-orange-400',
    critical: 'text-nilin-rose dark:text-nilin-coral',
  };

  const icons = {
    low: <ShieldCheck className="w-4 h-4" />,
    medium: <ShieldAlert className="w-4 h-4" />,
    high: <ShieldAlert className="w-4 h-4" />,
    critical: <ShieldX className="w-4 h-4" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[severity]}`}>
      {icons[severity]}
      <span className={labelStyles[severity]}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)}
      </span>
    </span>
  );
};

// ============================================
// Fraud Report Card Component
// ============================================

interface FraudReportCardProps {
  report: FraudReport;
  onFlag?: (providerId: string, flag: SuspiciousActivity) => void;
  onResolve?: (providerId: string, flagId: string, resolution: string) => void;
  onResolveClick?: (providerId: string, activityType: string) => void;
}

const FraudReportCard: React.FC<FraudReportCardProps> = ({ report, onFlag, onResolve, onResolveClick }) => {
  const [expanded, setExpanded] = useState(false);

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-nilin-rose dark:text-nilin-coral';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    if (score >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-nilin-blush/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-nilin-blush dark:bg-nilin-coral/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-nilin-rose dark:text-nilin-coral" />
            </div>
            <div>
              <p className="font-medium text-nilin-charcoal dark:text-white">
                Provider {report.providerId.slice(-6)}
              </p>
              <p className="text-sm text-nilin-warmGray">
                {report.suspiciousActivities.length} suspicious activities
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SeverityBadge severity={report.riskLevel} />
            <div className="text-right">
              <span className={`text-2xl font-bold ${getRiskColor(report.riskScore)}`}>
                {report.riskScore}
              </span>
              <p className="text-xs text-gray-500">/100</p>
            </div>
            {expanded ? (
              <ChevronDown className="w-5 h-5 text-nilin-warmGray" />
            ) : (
              <ChevronRight className="w-5 h-5 text-nilin-warmGray" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-nilin-border p-4 bg-nilin-blush/20 dark:bg-nilin-charcoal/10">
          {/* Summary */}
          <div className="mb-4 p-3 bg-white dark:bg-nilin-charcoal/5 rounded-lg">
            <p className="text-sm text-nilin-charcoal/70 dark:text-white/70">{report.summary}</p>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal dark:text-white mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-nilin-charcoal/70 dark:text-white/70 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-nilin-coral mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suspicious Activities */}
          <div>
            <h4 className="text-sm font-medium text-nilin-charcoal dark:text-white mb-2">Suspicious Activities</h4>
            <div className="space-y-2">
              {report.suspiciousActivities.map((activity, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-nilin-charcoal/5 rounded-lg border border-nilin-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-nilin-warmGray" />
                      <span className="font-medium text-nilin-charcoal dark:text-white">{activity.type}</span>
                    </div>
                    <SeverityBadge severity={activity.severity} />
                  </div>
                  <p className="text-sm text-nilin-charcoal/70 dark:text-white/70 mb-2">{activity.description}</p>
                  <div className="flex items-center gap-4 text-xs text-nilin-warmGray">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(activity.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {(onResolve || onResolveClick) && (
                    <div className="mt-3 pt-3 border-t border-nilin-border">
                      <button
                        onClick={() => onResolveClick?.(report.providerId, activity.type)}
                        className="text-xs px-3 py-1.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Fraud Report Component
// ============================================

const FraudReport: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'patterns'>('overview');

  // Data states
  const [stats, setStats] = useState<FraudStats | null>(null);
  const [overview, setOverview] = useState<FraudOverview | null>(null);
  const [fraudReports, setFraudReports] = useState<FraudReport[]>([]);

  // Filter states
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [providerId, setProviderId] = useState('');

  // Resolve modal state
  const [resolveModal, setResolveModal] = useState<{
    open: boolean;
    providerId: string;
    activityType: string;
    resolution: string;
  }>({
    open: false,
    providerId: '',
    activityType: '',
    resolution: '',
  });
  const [isResolving, setIsResolving] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsData, overviewData] = await Promise.all([
        fraudApi.getFraudStats(),
        fraudApi.getFraudOverview(),
      ]);

      setStats(statsData);
      setOverview(overviewData);
    } catch (error) {
      console.error('Failed to fetch fraud data:', error);
      toast.error('Failed to load fraud data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAnalyzeProvider = async () => {
    if (!providerId.trim()) {
      toast.error('Please enter a provider ID');
      return;
    }

    setLoading(true);
    try {
      const report = await fraudApi.analyzeProvider(providerId);
      setFraudReports((prev) => [report, ...prev.filter((r) => r.providerId !== report.providerId)]);
      setActiveTab('reports');
      toast.success('Provider analysis complete');
    } catch (error) {
      console.error('Failed to analyze provider:', error);
      toast.error('Failed to analyze provider. Please check the provider ID.');
    } finally {
      setLoading(false);
    }
  };

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  if (loading && !stats) {
    return (
      <AdminPageShell
        title="Fraud Detection"
        backHref="/admin/reports"
        wideLayout
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Reports', href: '/admin/reports' },
          { label: 'Fraud Detection', current: true },
        ]}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>
        <div id="main-content" className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-nilin-coral border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-nilin-warmGray">Loading fraud detection...</p>
          </div>
        </div>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      title="Fraud Detection"
      subtitle="Monitor and investigate suspicious provider activities"
      backHref="/admin/reports"
      wideLayout
      breadcrumbItems={[
        { label: 'Admin', href: '/admin/dashboard' },
        { label: 'Reports', href: '/admin/reports' },
        { label: 'Fraud Detection', current: true },
      ]}
      headerActions={
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-nilin-rose text-white rounded-lg hover:bg-nilin-rose/90 disabled:opacity-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      }
    >
      <div id="main-content" className="space-y-6">

        {/* Alert Banner */}
        {overview && overview.alertLevel !== 'low' && (
          <div className={`p-4 rounded-xl border ${overview.alertLevel === 'critical' ? 'bg-red-50 border-red-200' : overview.alertLevel === 'high' ? 'bg-orange-50 border-orange-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-3">
              <AlertCircle className={`w-6 h-6 ${overview.alertLevel === 'critical' ? 'text-red-600' : overview.alertLevel === 'high' ? 'text-orange-600' : 'text-yellow-600'}`} />
              <div>
                <p className={`font-medium ${overview.alertLevel === 'critical' ? 'text-red-800' : overview.alertLevel === 'high' ? 'text-orange-800' : 'text-yellow-800'}`}>
                  {overview.alertLevel === 'critical' ? 'Critical Alert' : overview.alertLevel === 'high' ? 'High Alert' : 'Moderate Alert'}
                </p>
                <p className={`text-sm ${overview.alertLevel === 'critical' ? 'text-red-700' : overview.alertLevel === 'high' ? 'text-orange-700' : 'text-yellow-700'}`}>
                  {overview.summary}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nilin-warmGray">Total Flagged</p>
                <p className="text-3xl font-bold text-nilin-charcoal dark:text-white mt-1">
                  {stats?.totalFlagged || overview?.totalFlagged || 0}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full ${getAlertLevelColor(overview?.alertLevel || 'low')} bg-opacity-20 flex items-center justify-center`}>
                <Flag className="w-6 h-6 text-nilin-rose dark:text-nilin-coral" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nilin-warmGray">Recent (7 days)</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {stats?.recentFlags || overview?.recentFlags || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nilin-warmGray">Resolved</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {stats?.resolvedFlags || overview?.resolvedFlags || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nilin-warmGray">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400 mt-1">
                  {overview?.pendingFlags || ((stats?.totalFlagged || 0) - (stats?.resolvedFlags || 0))}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-nilin-border">
          <nav className="flex gap-4" role="tablist" aria-label="Fraud detection views">
            {(['overview', 'reports', 'patterns'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                tabIndex={activeTab === tab ? 0 : -1}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                  activeTab === tab
                    ? 'border-nilin-coral text-nilin-coral'
                    : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'reports' ? 'Analysis Reports' : 'Fraud Patterns'}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6" role="tabpanel" aria-label="Overview">
            {/* Severity Breakdown */}
            <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-6">
              <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4">Flagged by Severity</h3>
              <div className="grid grid-cols-4 gap-4">
                {overview?.bySeverity && Object.entries(overview.bySeverity).map(([severity, count]) => (
                  <div key={severity} className={`text-center p-4 rounded-lg ${
                    severity === 'critical' ? 'bg-red-50 dark:bg-red-900/20' :
                    severity === 'high' ? 'bg-orange-50 dark:bg-orange-900/20' :
                    severity === 'medium' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    'bg-green-50 dark:bg-green-900/20'
                  }`}>
                    <p className={`text-3xl font-bold ${
                      severity === 'critical' ? 'text-red-600 dark:text-red-400' :
                      severity === 'high' ? 'text-orange-600 dark:text-orange-400' :
                      severity === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                      'text-green-600 dark:text-green-400'
                    }`}>
                      {count}
                    </p>
                    <p className="text-sm text-nilin-warmGray mt-1 capitalize">{severity}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {overview && (
              <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-6">
                <h3 className="text-lg font-semibold text-nilin-charcoal dark:text-white mb-4">Security Summary</h3>
                <p className="text-nilin-charcoal/70 dark:text-white/70">{overview.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4" role="tabpanel" aria-label="Analysis Reports">
            {/* Analyze Provider Form */}
            <div className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter provider ID to analyze..."
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeProvider()}
                    className="w-full px-4 py-2.5 pl-10 bg-nilin-blush/30 dark:bg-nilin-charcoal/20 border border-nilin-border rounded-lg text-nilin-charcoal dark:text-white placeholder:text-nilin-warmGray focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:border-nilin-coral"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray" />
                </div>
                <button
                  onClick={handleAnalyzeProvider}
                  disabled={loading}
                  className="px-6 py-2.5 bg-nilin-rose text-white rounded-lg hover:bg-nilin-rose/90 disabled:opacity-50 transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
                >
                  <Shield className="w-4 h-4" />
                  Analyze
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-4 py-2.5 bg-white dark:bg-nilin-charcoal/5 border border-nilin-border rounded-lg text-nilin-charcoal dark:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                aria-label="Filter by severity"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search by provider ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2.5 pl-10 bg-white dark:bg-nilin-charcoal/5 border border-nilin-border rounded-lg text-nilin-charcoal dark:text-white placeholder:text-nilin-warmGray focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral"
                  aria-label="Search by provider ID"
                />
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-nilin-warmGray" />
              </div>
            </div>

            {/* Fraud Reports */}
            <div className="space-y-3">
              {fraudReports.length > 0 ? (
                fraudReports
                  .filter((report) => {
                    if (severityFilter !== 'all' && report.riskLevel !== severityFilter) return false;
                    if (searchQuery && !report.providerId.toLowerCase().includes(searchQuery.toLowerCase())) return false;
                    return true;
                  })
                  .map((report) => (
                    <FraudReportCard
                      key={report.providerId}
                      report={report}
                      onResolveClick={(providerId, activityType) =>
                        setResolveModal({ open: true, providerId, activityType, resolution: '' })
                      }
                    />
                  ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border">
                  <Shield className="w-12 h-12 mx-auto text-nilin-warmGray mb-4" />
                  <p className="text-nilin-warmGray">
                    Enter a provider ID above to analyze for fraud
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="tabpanel" aria-label="Fraud Patterns">
            {[
              { id: 'duplicate_accounts', name: 'Duplicate Account Detection', severity: 'high', desc: 'Multiple accounts from the same IP or device' },
              { id: 'velocity_check', name: 'Velocity Check', severity: 'medium', desc: 'Unusually high booking or cancellation rate' },
              { id: 'suspicious_document', name: 'Suspicious Document', severity: 'critical', desc: 'Document appears tampered or invalid' },
              { id: 'address_mismatch', name: 'Address Mismatch', severity: 'medium', desc: 'Provider and document addresses do not match' },
              { id: 'high_risk_country', name: 'High Risk Country', severity: 'high', desc: 'Account from high-risk country or VPN detected' },
              { id: 'no_show_pattern', name: 'No-Show Pattern', severity: 'high', desc: 'Provider has high no-show rate' },
              { id: 'fake_reviews', name: 'Suspicious Review Pattern', severity: 'high', desc: 'Reviews from suspicious or fake accounts' },
              { id: 'payment_failure_spike', name: 'Payment Failure Spike', severity: 'medium', desc: 'High number of failed payment attempts' },
            ].map((pattern) => (
              <div
                key={pattern.id}
                className="bg-white dark:bg-nilin-charcoal/5 rounded-xl border border-nilin-border p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-nilin-charcoal dark:text-white">{pattern.name}</h3>
                  <SeverityBadge severity={pattern.severity as 'low' | 'medium' | 'high' | 'critical'} />
                </div>
                <p className="text-sm text-nilin-warmGray">{pattern.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      <Modal
        open={resolveModal.open}
        onOpenChange={(open) => !open && setResolveModal((prev) => ({ ...prev, open: false }))}
        title="Mark as Resolved"
        description="Enter resolution notes for this suspicious activity"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="resolution-notes" className="block text-sm font-medium text-nilin-charcoal dark:text-white mb-1.5">
              Resolution Notes
            </label>
            <textarea
              id="resolution-notes"
              value={resolveModal.resolution}
              onChange={(e) => setResolveModal((prev) => ({ ...prev, resolution: e.target.value }))}
              placeholder="Describe how this issue was resolved..."
              rows={4}
              className="w-full px-3 py-2.5 border border-nilin-border rounded-lg bg-white dark:bg-nilin-charcoal/10 text-nilin-charcoal dark:text-white placeholder:text-nilin-warmGray focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:border-nilin-coral"
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setResolveModal((prev) => ({ ...prev, open: false }))}
              className="px-4 py-2.5 text-sm font-medium text-nilin-warmGray hover:text-nilin-charcoal dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (!resolveModal.resolution.trim()) {
                  toast.error('Please enter resolution notes');
                  return;
                }
                setIsResolving(true);
                try {
                  // Call the onResolve callback if provided
                  // onResolve(resolveModal.providerId, resolveModal.activityType, resolveModal.resolution);
                  toast.success('Fraud flag resolved successfully');
                  setResolveModal({ open: false, providerId: '', activityType: '', resolution: '' });
                } catch (error) {
                  console.error('Failed to resolve fraud flag:', error);
                  toast.error(error instanceof Error ? error.message : 'Failed to resolve flag. Please try again.');
                } finally {
                  setIsResolving(false);
                }
              }}
              disabled={isResolving || !resolveModal.resolution.trim()}
              className="px-4 py-2.5 text-sm font-medium text-white bg-nilin-coral rounded-lg hover:bg-nilin-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              {isResolving && <Loader2 className="w-4 h-4 animate-spin" />}
              Mark Resolved
            </button>
          </div>
        </div>
      </Modal>
    </AdminPageShell>
  );
};

export default FraudReport;
