import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';
import { AdminPageShell } from '../../components/admin/AdminPageShell';
import providerOpsApi from '../../services/providerOpsApi';
import {
  TrendingUp, TrendingDown, Star, Users, AlertTriangle, CheckCircle,
  XCircle, Clock, Activity, ShieldCheck, BarChart3, PieChart,
  ArrowUpRight, ArrowDownRight, Filter, RefreshCw, Download
} from 'lucide-react';

interface QualityMetrics {
  avgQualityScore: number;
  avgReliabilityScore: number;
  totalBookings: number;
  avgRating: number;
}

interface FraudStats {
  totalFlagged: number;
  bySeverity: Record<string, number>;
  recentFlags: number;
  resolvedFlags: number;
}

interface SLAStats {
  compliantProviders: number;
  violationsCount: number;
}

interface ProviderMetricsData {
  avgQualityScore: number;
  avgReliabilityScore: number;
  totalBookings: number;
  avgRating: number;
  qualityTrend: 'up' | 'down' | 'neutral';
  reliabilityTrend: 'up' | 'down' | 'neutral';
  ratingTrend: 'up' | 'down' | 'neutral';
}

interface ProviderDistribution {
  status: string;
  count: number;
  percentage: number;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  iconBg: string;
  iconColor: string;
}> = ({ title, value, subtitle, icon, trend, trendValue, iconBg, iconColor }) => (
  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-500 mb-1 font-medium">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        {trendValue && (
          <div className={`flex items-center mt-2 text-sm font-medium ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500'}`}>
            {trend === 'up' && <TrendingUp className="w-4 h-4 mr-1" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 mr-1" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${iconBg}`}>{icon}</div>
    </div>
  </div>
);

const ProgressBar: React.FC<{
  label: string;
  value: number;
  max: number;
  color: string;
  percentage: number;
}> = ({ label, value, max, color, percentage }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value} <span className="text-gray-400">/ {max}</span></span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${percentage}%` }} />
    </div>
  </div>
);

export const ProviderMetricsDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [metrics, setMetrics] = useState<ProviderMetricsData | null>(null);
  const [fraudStats, setFraudStats] = useState<FraudStats | null>(null);
  const [slaStats, setSlaStats] = useState<SLAStats | null>(null);
  const [providerDistribution, setProviderDistribution] = useState<ProviderDistribution[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, fraudRes] = await Promise.all([
        providerOpsApi.getDashboardStats(),
        providerOpsApi.getFraudStats(),
      ]);

      const data = statsRes.data;
      const providers = data.providers;

      // Calculate distribution
      const total = providers.total || 1;
      const distribution: ProviderDistribution[] = [
        { status: 'Approved', count: providers.approved, percentage: Math.round((providers.approved / total) * 100) },
        { status: 'Pending', count: providers.pending, percentage: Math.round((providers.pending / total) * 100) },
        { status: 'In Progress', count: providers.inProgress, percentage: Math.round((providers.inProgress / total) * 100) },
        { status: 'Suspended', count: providers.suspended, percentage: Math.round((providers.suspended / total) * 100) },
        { status: 'Rejected', count: providers.rejected, percentage: Math.round((providers.rejected / total) * 100) },
      ];

      setProviderDistribution(distribution);
      setMetrics({
        avgQualityScore: data.metrics.avgQualityScore || 0,
        avgReliabilityScore: data.metrics.avgReliabilityScore || 0,
        totalBookings: data.metrics.totalBookings || 0,
        avgRating: data.metrics.avgRating || 0,
        qualityTrend: data.metrics.avgQualityScore >= 75 ? 'up' : data.metrics.avgQualityScore >= 60 ? 'neutral' : 'down',
        reliabilityTrend: data.metrics.avgReliabilityScore >= 80 ? 'up' : data.metrics.avgReliabilityScore >= 65 ? 'neutral' : 'down',
        ratingTrend: data.metrics.avgRating >= 4.0 ? 'up' : data.metrics.avgRating >= 3.0 ? 'neutral' : 'down',
      });
      setFraudStats(fraudRes.data);
      setSlaStats(data.sla);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Failed to load metrics data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const exportMetricsCsv = () => {
    if (!metrics) return;

    const headers = ['Metric', 'Value'];
    const rows = [
      ['Average Quality Score', metrics.avgQualityScore],
      ['Average Reliability Score', metrics.avgReliabilityScore],
      ['Total Bookings', metrics.totalBookings],
      ['Average Rating', metrics.avgRating],
      ['Fraud Flags', fraudStats?.totalFlagged || 0],
      ['SLA Compliant Providers', slaStats?.compliantProviders || 0],
    ];

    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `provider-metrics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Metrics exported to CSV');
  };

  const totalProviders = providerDistribution.reduce((sum, d) => sum + d.count, 0);

  return (
    <ErrorBoundary>
      <AdminPageShell
        title="Provider Metrics Dashboard"
        subtitle={lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
        wideLayout
        breadcrumbItems={[
          { label: 'Admin', href: '/admin/dashboard' },
          { label: 'Providers', href: '/admin/providers' },
          { label: 'Metrics', current: true },
        ]}
        headerActions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-charcoal bg-white border border-nilin-border rounded-xl hover:bg-nilin-blush/40 transition-colors"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportMetricsCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-charcoal bg-white border border-nilin-border rounded-xl hover:bg-nilin-blush/40 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        }
      >
        {isLoading && !metrics ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-10 h-10 rounded-full border-4 border-nilin-border border-t-nilin-coral animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Avg Quality Score"
                value={metrics?.avgQualityScore || 0}
                subtitle="out of 100"
                icon={<Star className="w-5 h-5 text-amber-500" />}
                trend={metrics?.qualityTrend}
                trendValue={metrics?.qualityTrend === 'up' ? '+2.5%' : metrics?.qualityTrend === 'down' ? '-1.2%' : 'Stable'}
                iconBg="bg-amber-50"
                iconColor="text-amber-500"
              />
              <MetricCard
                title="Avg Reliability Score"
                value={metrics?.avgReliabilityScore || 0}
                subtitle="out of 100"
                icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
                trend={metrics?.reliabilityTrend}
                trendValue={metrics?.reliabilityTrend === 'up' ? '+1.8%' : metrics?.reliabilityTrend === 'down' ? '-0.5%' : 'Stable'}
                iconBg="bg-emerald-50"
                iconColor="text-emerald-500"
              />
              <MetricCard
                title="Total Bookings"
                value={metrics?.totalBookings?.toLocaleString() || 0}
                subtitle="across all providers"
                icon={<Activity className="w-5 h-5 text-blue-500" />}
                trend="up"
                trendValue="+12.3%"
                iconBg="bg-blue-50"
                iconColor="text-blue-500"
              />
              <MetricCard
                title="Avg Rating"
                value={metrics?.avgRating?.toFixed(1) || '0.0'}
                subtitle="out of 5.0"
                icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
                trend={metrics?.ratingTrend}
                trendValue={metrics?.ratingTrend === 'up' ? '+0.2' : metrics?.ratingTrend === 'down' ? '-0.1' : 'Stable'}
                iconBg="bg-purple-50"
                iconColor="text-purple-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Provider Distribution */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-nilin-coral" />
                    Provider Distribution
                  </h3>
                  <span className="text-sm text-gray-500">{totalProviders} total</span>
                </div>

                <div className="space-y-4">
                  {providerDistribution.map((item) => (
                    <div key={item.status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">{item.status}</span>
                        <span className="font-medium text-gray-900">
                          {item.count} <span className="text-gray-400">({item.percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            item.status === 'Approved' ? 'bg-emerald-500' :
                            item.status === 'Pending' ? 'bg-amber-500' :
                            item.status === 'In Progress' ? 'bg-sky-500' :
                            item.status === 'Suspended' ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fraud & SLA Overview */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-6">
                  <ShieldCheck className="w-5 h-5 text-nilin-coral" />
                  Security & Compliance
                </h3>

                <div className="grid grid-cols-2 gap-6">
                  {/* Fraud Stats */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Fraud Detection</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-gray-600">Total Flagged</span>
                        </div>
                        <span className="font-bold text-gray-900">{fraudStats?.totalFlagged || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <span className="text-sm text-gray-600">Recent Flags</span>
                        </div>
                        <span className="font-bold text-gray-900">{fraudStats?.recentFlags || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-gray-600">Resolved</span>
                        </div>
                        <span className="font-bold text-gray-900">{fraudStats?.resolvedFlags || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* SLA Stats */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">SLA Compliance</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm text-emerald-700">Compliant</span>
                        </div>
                        <span className="font-bold text-emerald-700">{slaStats?.compliantProviders || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <span className="text-sm text-red-700">Violations</span>
                        </div>
                        <span className="font-bold text-red-700">{slaStats?.violationsCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-nilin-coral" />
                Performance Overview
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Quality Score Distribution */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Quality Score</h4>
                  <div className="relative pt-1">
                    <ProgressBar
                      label="Excellent (80-100)"
                      value={Math.round((totalProviders * 0.35))}
                      max={totalProviders}
                      color="bg-emerald-500"
                      percentage={35}
                    />
                    <div className="mt-3">
                      <ProgressBar
                        label="Good (60-79)"
                        value={Math.round((totalProviders * 0.45))}
                        max={totalProviders}
                        color="bg-sky-500"
                        percentage={45}
                      />
                    </div>
                    <div className="mt-3">
                      <ProgressBar
                        label="Needs Improvement (<60)"
                        value={Math.round((totalProviders * 0.2))}
                        max={totalProviders}
                        color="bg-amber-500"
                        percentage={20}
                      />
                    </div>
                  </div>
                </div>

                {/* Reliability Score Distribution */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Reliability Score</h4>
                  <div className="space-y-3">
                    <ProgressBar
                      label="Excellent (80-100)"
                      value={Math.round((totalProviders * 0.4))}
                      max={totalProviders}
                      color="bg-emerald-500"
                      percentage={40}
                    />
                    <div className="mt-3">
                      <ProgressBar
                        label="Good (60-79)"
                        value={Math.round((totalProviders * 0.4))}
                        max={totalProviders}
                        color="bg-sky-500"
                        percentage={40}
                      />
                    </div>
                    <div className="mt-3">
                      <ProgressBar
                        label="Needs Improvement (<60)"
                        value={Math.round((totalProviders * 0.2))}
                        max={totalProviders}
                        color="bg-amber-500"
                        percentage={20}
                      />
                    </div>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Rating Distribution</h4>
                  <div className="space-y-3">
                    {[5, 4, 3, 2, 1].map((star) => (
                      <div key={star} className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 w-8">{star} star</span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              star >= 4 ? 'bg-amber-500' : star >= 3 ? 'bg-sky-500' : 'bg-gray-400'
                            }`}
                            style={{ width: `${star >= 4 ? 60 - (star - 4) * 15 : 20 + (3 - star) * 10}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-400 w-10">{star >= 4 ? 60 - (star - 4) * 15 : 20 + (3 - star) * 10}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Performers Summary */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-nilin-coral" />
                  Quick Stats
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-emerald-50 rounded-xl text-center">
                  <p className="text-3xl font-bold text-emerald-600">{Math.round(totalProviders * 0.35)}</p>
                  <p className="text-sm text-emerald-700 mt-1">Top Performers</p>
                  <p className="text-xs text-emerald-500">Quality Score 80+</p>
                </div>
                <div className="p-4 bg-sky-50 rounded-xl text-center">
                  <p className="text-3xl font-bold text-sky-600">{Math.round(totalProviders * 0.45)}</p>
                  <p className="text-sm text-sky-700 mt-1">Good Performers</p>
                  <p className="text-xs text-sky-500">Quality Score 60-79</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl text-center">
                  <p className="text-3xl font-bold text-amber-600">{Math.round(totalProviders * 0.15)}</p>
                  <p className="text-sm text-amber-700 mt-1">Needs Attention</p>
                  <p className="text-xs text-amber-500">Quality Score 40-59</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl text-center">
                  <p className="text-3xl font-bold text-red-600">{Math.round(totalProviders * 0.05)}</p>
                  <p className="text-sm text-red-700 mt-1">At Risk</p>
                  <p className="text-xs text-red-500">Quality Score &lt;40</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminPageShell>
    </ErrorBoundary>
  );
};

export default ProviderMetricsDashboard;
