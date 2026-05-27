import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fraudApi } from '../../services/analyticsApi';
import type { FraudReport, FraudStats, FraudOverview, SuspiciousActivity } from '../../services/analyticsApi';
import PageLayout from '../../components/layout/PageLayout';
import { useAuthStore } from '../../stores/authStore';
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
  Eye,
  CheckCircle,
  XCircle,
  Flag,
  User,
  Clock,
  FileWarning,
  AlertCircle,
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
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
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
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
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
}

const FraudReportCard: React.FC<FraudReportCardProps> = ({ report, onFlag, onResolve }) => {
  const [expanded, setExpanded] = useState(false);

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 dark:text-red-400';
    if (score >= 50) return 'text-orange-600 dark:text-orange-400';
    if (score >= 25) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                Provider {report.providerId.slice(-6)}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
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
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/50">
          {/* Summary */}
          <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">{report.summary}</p>
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suspicious Activities */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Suspicious Activities</h4>
            <div className="space-y-2">
              {report.suspiciousActivities.map((activity, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-gray-500" />
                      <span className="font-medium text-gray-900 dark:text-white">{activity.type}</span>
                    </div>
                    <SeverityBadge severity={activity.severity} />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{activity.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(activity.detectedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {onResolve && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          const resolution = prompt('Enter resolution notes:');
                          if (resolution) {
                            // Note: In real implementation, you'd pass the flag ID
                            // onResolve(report.providerId, activity.type, resolution);
                          }
                        }}
                        className="text-xs px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
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
      alert('Please enter a provider ID');
      return;
    }

    setLoading(true);
    try {
      const report = await fraudApi.analyzeProvider(providerId);
      setFraudReports((prev) => [report, ...prev.filter((r) => r.providerId !== report.providerId)]);
      setActiveTab('reports');
    } catch (error) {
      console.error('Failed to analyze provider:', error);
      alert('Failed to analyze provider. Please check the provider ID.');
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
      <PageLayout title="Fraud Detection">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">Loading fraud detection...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Fraud Detection" subtitle="Provider fraud detection and risk analysis">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fraud Detection</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Monitor and investigate suspicious provider activities
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

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
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Flagged</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                  {stats?.totalFlagged || overview?.totalFlagged || 0}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-full ${getAlertLevelColor(overview?.alertLevel || 'low')} bg-opacity-20 flex items-center justify-center`}>
                <Flag className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Recent (7 days)</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {stats?.recentFlags || overview?.recentFlags || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Resolved</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {stats?.resolvedFlags || overview?.resolvedFlags || 0}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
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
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-4">
            {(['overview', 'reports', 'patterns'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-red-600 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tab === 'overview' ? 'Overview' : tab === 'reports' ? 'Analysis Reports' : 'Fraud Patterns'}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Severity Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Flagged by Severity</h3>
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
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 capitalize">{severity}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            {overview && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Summary</h3>
                <p className="text-gray-600 dark:text-gray-400">{overview.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-4">
            {/* Analyze Provider Form */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter provider ID to analyze..."
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeProvider()}
                    className="w-full px-4 py-2 pl-10 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  />
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <button
                  onClick={handleAnalyzeProvider}
                  disabled={loading}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
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
                className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500"
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
                  className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500"
                />
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
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
                    <FraudReportCard key={report.providerId} report={report} />
                  ))
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                  <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Enter a provider ID above to analyze for fraud
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{pattern.name}</h3>
                  <SeverityBadge severity={pattern.severity as 'low' | 'medium' | 'high' | 'critical'} />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{pattern.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default FraudReport;
