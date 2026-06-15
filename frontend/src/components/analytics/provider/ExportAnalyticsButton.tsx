import React from 'react';
import { Download } from 'lucide-react';
import type { ProviderInsightsAnalytics } from '../../../services/providerApi';
import type { ProviderDashboardRevenueMode } from '../../../services/analyticsApi';

interface ExportAnalyticsButtonProps {
  analytics: ProviderInsightsAnalytics;
  timeRange: '7d' | '30d' | '90d';
  revenueMode?: ProviderDashboardRevenueMode;
  confirmedRate?: number;
  grossRevenue?: { thisMonth: number; lastMonth: number };
  className?: string;
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(
  analytics: ProviderInsightsAnalytics,
  timeRange: string,
  options: {
    revenueMode?: ProviderDashboardRevenueMode;
    confirmedRate?: number;
    grossRevenue?: { thisMonth: number; lastMonth: number };
  } = {},
): string {
  const lines: string[] = [];
  const revenueMode = options.revenueMode ?? 'net';
  const primaryRevenue =
    revenueMode === 'gross' && options.grossRevenue
      ? options.grossRevenue.thisMonth
      : analytics.earnings.thisMonth;
  const previousRevenue =
    revenueMode === 'gross' && options.grossRevenue
      ? options.grossRevenue.lastMonth
      : analytics.earnings.lastMonth;

  lines.push('NILIN Provider Analytics Export');
  lines.push(`Period,${timeRange}`);
  lines.push(`Revenue mode,${revenueMode}`);
  lines.push(`Generated,${new Date().toISOString()}`);
  lines.push('');

  lines.push('KPI Snapshot');
  lines.push('Metric,Value');
  lines.push(`${revenueMode === 'gross' ? 'Gross' : 'Net'} Revenue,${escapeCsv(primaryRevenue)}`);
  lines.push(`Previous Period Revenue,${escapeCsv(previousRevenue)}`);
  lines.push(`Booking Requests,${escapeCsv(analytics.overview.bookingRequests)}`);
  lines.push(`Profile Views (unique),${escapeCsv(analytics.overview.profileViews)}`);
  lines.push(`Listing Impressions (unique),${escapeCsv(analytics.overview.totalViews)}`);
  lines.push(`Booking Rate (%),${escapeCsv(analytics.overview.conversionRate)}`);
  if (options.confirmedRate != null) {
    lines.push(`Confirmed Rate (%),${escapeCsv(options.confirmedRate)}`);
  }
  lines.push(`Completed Bookings,${escapeCsv(analytics.bookings.completed)}`);
  lines.push('');

  lines.push('Daily Revenue & Bookings');
  lines.push('Date,Revenue,Bookings');
  (analytics.timeSeries || []).forEach((row) => {
    lines.push(`${escapeCsv(row.date)},${escapeCsv(row.revenue)},${escapeCsv(row.bookings)}`);
  });
  lines.push('');

  lines.push('Top Services');
  lines.push('Rank,Service,Bookings,Revenue');
  analytics.topServices.forEach((service, index) => {
    lines.push(
      `${index + 1},${escapeCsv(service.name)},${escapeCsv(service.bookings)},${escapeCsv(service.revenue)}`,
    );
  });

  return lines.join('\n');
}

export const ExportAnalyticsButton: React.FC<ExportAnalyticsButtonProps> = ({
  analytics,
  timeRange,
  revenueMode = 'net',
  confirmedRate,
  grossRevenue,
  className,
}) => {
  const handleExport = () => {
    const csv = buildCsv(analytics, timeRange, { revenueMode, confirmedRate, grossRevenue });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nilin-analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-nilin text-sm font-medium border border-nilin-border bg-white text-nilin-charcoal hover:bg-nilin-muted transition-colors ${className ?? ''}`}
    >
      <Download className="h-4 w-4" />
      Export CSV
    </button>
  );
};
