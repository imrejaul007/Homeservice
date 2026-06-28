
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  TrendingUp,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Target,
  Zap,
  BarChart3,
  PieChart,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Eye,
  Play,
  Settings,
} from 'lucide-react';
import { demoApi, type LaunchReadiness, type ReadinessItem, type UserOnboardingFunnel, type ConversionData } from '../../services/demoApi';
import { useAuthStore } from '../../stores/authStore';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';

// ============================================
// Types
// ============================================

interface LaunchKPIs {
  totalUsers: number;
  activeProviders: number;
  totalBookings: number;
  monthlyRevenue: number;
  conversionRate: number;
  avgBookingValue: number;
  providerGrowthRate: number;
  customerGrowthRate: number;
}

// ============================================
// Score Circle Component
// ============================================

const ScoreCircle: React.FC<{ score: number; size?: 'sm' | 'md' | 'lg' }> = ({ score, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-16 h-16 text-lg',
    md: 'w-24 h-24 text-2xl',
    lg: 'w-32 h-32 text-4xl',
  };

  const strokeWidth = size === 'lg' ? 8 : 6;
  const radius = size === 'lg' ? 54 : size === 'md' ? 42 : 28;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return { stroke: '#10b981', text: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 60) return { stroke: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-100' };
    return { stroke: '#ef4444', text: 'text-red-600', bg: 'bg-red-100' };
  };

  const colors = getScoreColor(score);

  return (
    <div className={`relative ${sizeClasses[size]}`}>
      <svg className="transform -rotate-90" width={size === 'lg' ? 128 : size === 'md' ? 96 : 64} height={size === 'lg' ? 128 : size === 'md' ? 96 : 64}>
        <circle
          cx={size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          cy={size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          cy={size === 'lg' ? 64 : size === 'md' ? 48 : 32}
          r={radius}
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center ${colors.text} font-bold ${size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-lg'}`}>
        {score}
      </div>
    </div>
  );
};

// ============================================
// Status Badge Component
// ============================================

const StatusBadge: React.FC<{ status: ReadinessItem['status'] }> = ({ status }) => {
  const styles: Record<ReadinessItem['status'], { bg: string; text: string; label: string }> = {
    complete: { bg: 'bg-green-100', text: 'text-green-700', label: 'Complete' },
    in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress' },
    pending: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Pending' },
    blocked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Blocked' },
  };

  const style = styles[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      {status === 'complete' && <CheckCircle className="w-3 h-3 mr-1" />}
      {status === 'in_progress' && <Activity className="w-3 h-3 mr-1" />}
      {status === 'blocked' && <AlertTriangle className="w-3 h-3 mr-1" />}
      {style.label}
    </span>
  );
};

// ============================================
// Metric Card Component
// ============================================

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, change, icon, color, subtitle }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${color}`}>{icon}</div>
      {change !== undefined && (
        <div className={`flex items-center text-sm font-medium ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(change).toFixed(1)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
    {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

// ============================================
// Funnel Chart Component
// ============================================

const FunnelChart: React.FC<{ data: UserOnboardingFunnel[] }> = ({ data }) => {
  const maxValue = Math.max(...data.map(d => d.visitors), 1);

  return (
    <div className="space-y-3">
      {data.slice(-7).map((item, idx) => (
        <div key={idx} className="relative">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-600 dark:text-gray-400">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            <span className="text-gray-900 dark:text-white font-medium">{item.visitors.toLocaleString()} visitors</span>
          </div>
          <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex">
            <div
              className="h-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{ width: `${(item.signups / maxValue) * 100}%` }}
              title={`Signups: ${item.signups}`}
            >
              {item.signups > 0 && `${item.signups} signups`}
            </div>
            <div
              className="h-full bg-green-500 flex items-center justify-center text-white text-xs font-medium transition-all duration-500"
              style={{ width: `${(item.bookings / maxValue) * 100}%` }}
              title={`Bookings: ${item.bookings}`}
            >
              {item.bookings > 0 && `${item.bookings} bookings`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================
// Readiness Category Component
// ============================================

const ReadinessCategory: React.FC<{
  title: string;
  icon: React.ReactNode;
  data: LaunchReadiness['categories']['technical'];
  color: string;
}> = ({ title, icon, data, color }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-5">
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">Score: {data.score}%</p>
      </div>
    </div>
    <div className="space-y-2">
      {data.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</p>
            {item.description && <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>}
          </div>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  </div>
);

// ============================================
// Main Launch Dashboard Component
// ============================================

const LaunchDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Auth check
  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/unauthorized');
    }
  }, [user, navigate]);

  const [readiness, setReadiness] = useState<LaunchReadiness | null>(null);
  const [funnelData, setFunnelData] = useState<UserOnboardingFunnel[]>([]);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [kpis, setKpis] = useState<LaunchKPIs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'readiness' | 'funnel' | 'conversions'>('overview');

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [readinessRes, funnelRes, conversionRes] = await Promise.all([
        demoApi.getLaunchReadiness(),
        demoApi.getOnboardingFunnel(
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          new Date().toISOString().split('T')[0]
        ),
        demoApi.getConversionData(),
      ]);

      setReadiness(readinessRes);
      setFunnelData(funnelRes);
      setConversionData(conversionRes);

      const funnelTotal = funnelRes?.steps?.reduce((sum, step) => sum + (step.count || 0), 0) ?? 0;
      const lastStep = funnelRes?.steps?.[funnelRes.steps.length - 1];
      const conversionRate =
        funnelTotal > 0 && lastStep ? Number(((lastStep.count / funnelTotal) * 100).toFixed(1)) : 0;

      setKpis({
        totalUsers: readinessRes?.metrics?.totalUsers ?? 0,
        activeProviders: readinessRes?.metrics?.activeProviders ?? 0,
        totalBookings: readinessRes?.metrics?.totalBookings ?? funnelTotal,
        monthlyRevenue: readinessRes?.metrics?.monthlyRevenue ?? 0,
        conversionRate: conversionRes?.overallConversion ?? conversionRate,
        avgBookingValue: readinessRes?.metrics?.avgBookingValue ?? 0,
        providerGrowthRate: readinessRes?.metrics?.providerGrowthRate ?? 0,
        customerGrowthRate: readinessRes?.metrics?.customerGrowthRate ?? 0,
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch launch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  // Export report
  const handleExport = async () => {
    try {
      const report = {
        generatedAt: new Date().toISOString(),
        readiness,
        funnelData,
        conversionData,
        kpis,
      };

      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `launch-dashboard-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Launch Dashboard"
        subtitle={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Track launch readiness and platform metrics'}
        showSidebar={false}
        wideLayout
        headerActions={
          <>
            <button
              onClick={handleExport}
              className="px-4 py-2 border border-nilin-border rounded-xl hover:bg-nilin-blush/50 flex items-center gap-2 text-nilin-charcoal focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 bg-nilin-coral text-white rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </>
        }
      >
        {/* Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-nilin-coral focus:text-white focus:rounded-lg"
        >
          Skip to main content
        </a>

        <main id="main-content">
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>Demo data:</strong> Launch readiness metrics come from demo endpoints and do not reflect production readiness. Use Operations and Analytics dashboards for live platform data.
          </div>
          {/* Tab Navigation */}
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'readiness', label: 'Readiness', icon: Target },
                { id: 'funnel', label: 'Onboarding Funnel', icon: PieChart },
                { id: 'conversions', label: 'Conversions', icon: TrendingUp },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-3 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
                    activeTab === tab.id
                      ? 'border-nilin-coral text-nilin-coral'
                      : 'border-transparent text-nilin-warmGray hover:text-nilin-charcoal'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nilin-coral"></div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Launch Score */}
                  {readiness && (
                    <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-medium opacity-90">Launch Readiness Score</h2>
                          <p className="text-sm opacity-75 mt-1">
                            {readiness.score >= 80
                              ? 'Excellent! Platform is ready for launch'
                              : readiness.score >= 60
                              ? 'Good progress. Some items need attention'
                              : 'Additional work required before launch'}
                          </p>
                          {readiness.estimatedLaunchDate && (
                            <p className="text-sm opacity-75 mt-2">
                              Estimated Launch: {new Date(readiness.estimatedLaunchDate).toLocaleDateString('en-US', { dateStyle: 'long' })}
                            </p>
                          )}
                        </div>
                        <ScoreCircle score={readiness.score} size="lg" />
                      </div>

                      {/* Blockers */}
                      {readiness.blockers.length > 0 && (
                        <div className="mt-6 bg-white/10 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="w-5 h-5" />
                            <h3 className="font-semibold">Blockers ({readiness.blockers.length})</h3>
                          </div>
                          <ul className="space-y-1">
                            {readiness.blockers.map((blocker, idx) => (
                              <li key={idx} className="text-sm flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 bg-white rounded-full flex-shrink-0" />
                                {blocker}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* KPI Cards */}
                  {kpis && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard
                        title="Total Users"
                        value={kpis.totalUsers.toLocaleString()}
                        change={kpis.customerGrowthRate}
                        icon={<Users className="w-5 h-5 text-blue-600" />}
                        color="bg-blue-100"
                        subtitle="customers"
                      />
                      <MetricCard
                        title="Active Providers"
                        value={kpis.activeProviders}
                        change={kpis.providerGrowthRate}
                        icon={<Zap className="w-5 h-5 text-amber-600" />}
                        color="bg-amber-100"
                        subtitle="verified"
                      />
                      <MetricCard
                        title="Total Bookings"
                        value={kpis.totalBookings.toLocaleString()}
                        change={8.2}
                        icon={<Calendar className="w-5 h-5 text-green-600" />}
                        color="bg-green-100"
                      />
                      <MetricCard
                        title="Monthly Revenue"
                        value={formatCurrency(kpis.monthlyRevenue)}
                        change={12.5}
                        icon={<DollarSign className="w-5 h-5 text-purple-600" />}
                        color="bg-purple-100"
                      />
                    </div>
                  )}

                  {/* Additional KPIs */}
                  {kpis && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <MetricCard
                        title="Conversion Rate"
                        value={`${kpis.conversionRate}%`}
                        change={0.3}
                        icon={<Target className="w-5 h-5 text-indigo-600" />}
                        color="bg-indigo-100"
                        subtitle="visitors to customers"
                      />
                      <MetricCard
                        title="Avg. Booking Value"
                        value={formatCurrency(kpis.avgBookingValue)}
                        change={-2.1}
                        icon={<BarChart3 className="w-5 h-5 text-rose-600" />}
                        color="bg-rose-100"
                      />
                      <MetricCard
                        title="Provider Growth"
                        value={`+${kpis.providerGrowthRate}%`}
                        icon={<TrendingUp className="w-5 h-5 text-teal-600" />}
                        color="bg-teal-100"
                        subtitle="month over month"
                      />
                      <MetricCard
                        title="Customer Growth"
                        value={`+${kpis.customerGrowthRate}%`}
                        icon={<Users className="w-5 h-5 text-cyan-600" />}
                        color="bg-cyan-100"
                        subtitle="month over month"
                      />
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                          <Eye className="w-5 h-5 text-indigo-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">View Demo</span>
                      </button>
                      <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                          <Play className="w-5 h-5 text-green-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Start Scenario</span>
                      </button>
                      <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                          <Settings className="w-5 h-5 text-amber-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Configure</span>
                      </button>
                      <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                          <Download className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Export Report</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Readiness Tab */}
              {activeTab === 'readiness' && readiness && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ReadinessCategory
                      title="Technical"
                      icon={<Zap className="w-5 h-5 text-indigo-600" />}
                      data={readiness.categories.technical}
                      color="bg-indigo-100 dark:bg-indigo-900/30"
                    />
                    <ReadinessCategory
                      title="Business"
                      icon={<DollarSign className="w-5 h-5 text-green-600" />}
                      data={readiness.categories.business}
                      color="bg-green-100 dark:bg-green-900/30"
                    />
                    <ReadinessCategory
                      title="Marketing"
                      icon={<TrendingUp className="w-5 h-5 text-pink-600" />}
                      data={readiness.categories.marketing}
                      color="bg-pink-100 dark:bg-pink-900/30"
                    />
                    <ReadinessCategory
                      title="Operations"
                      icon={<Settings className="w-5 h-5 text-amber-600" />}
                      data={readiness.categories.operations}
                      color="bg-amber-100 dark:bg-amber-900/30"
                    />
                  </div>

                  {/* Recommendations */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recommendations</h3>
                    <div className="space-y-3">
                      {readiness.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-gray-700 dark:text-gray-300">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Funnel Tab */}
              {activeTab === 'funnel' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">User Onboarding Funnel (Last 30 Days)</h3>
                    {funnelData.length > 0 ? (
                      <FunnelChart data={funnelData} />
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No funnel data available yet</p>
                      </div>
                    )}
                  </div>

                  {/* Funnel Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-5">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Visitors</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {funnelData.reduce((sum, d) => sum + d.visitors, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-5">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Signups</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {funnelData.reduce((sum, d) => sum + d.signups, 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-5">
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Bookings</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {funnelData.reduce((sum, d) => sum + d.bookings, 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Conversions Tab */}
              {activeTab === 'conversions' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border border-nilin-border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Conversion Metrics</h3>
                    {conversionData.length > 0 ? (
                      <div className="space-y-4">
                        {conversionData.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{item.metric}</p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {item.trend === 'up' ? 'Increased' : item.trend === 'down' ? 'Decreased' : 'Stable'} by {Math.abs(item.change).toFixed(1)}%
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.value.toFixed(2)}%</p>
                              <div className={`flex items-center justify-end text-sm ${item.trend === 'up' ? 'text-green-600' : item.trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
                                {item.trend === 'up' ? <ArrowUpRight className="w-4 h-4" /> : item.trend === 'down' ? <ArrowDownRight className="w-4 h-4" /> : null}
                                {item.trend}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                        <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No conversion data available yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default LaunchDashboard;
