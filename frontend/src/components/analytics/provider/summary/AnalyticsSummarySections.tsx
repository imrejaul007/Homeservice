import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  MapPin,
  TrendingUp,
  TrendingDown,
  Users,
  ChevronDown,
  ChevronUp,
  Target,
  Megaphone,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ProviderCancellationStats } from '../../../../services/providerInsightsApi';
import type {
  ProviderResponseTimeMetrics,
  ProviderCustomerLtv,
  ProviderGeographicDemand,
  ProviderRevenueForecast,
  ProviderBookingSourceAttribution,
  ProviderAnomalyAlert,
  ServiceAnalyticsMetrics,
} from '../../../../services/analyticsApi';
import { EmptyState } from '../../../common/EmptyState';
import { formatPrice } from '../../../../utils/currency';
import { cn } from '../../../../lib/utils';

const SOURCE_COLORS: Record<string, string> = {
  organic: '#60A5FA',
  search: '#34D399',
  profile: '#F59E0B',
  ad: '#A78BFA',
  direct: '#94A3B8',
  repeat: '#2563EB',
};

const SEVERITY_STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  critical: 'bg-red-50 border-red-200 text-red-900',
};

export interface AnalyticsSummaryData {
  responseTime: ProviderResponseTimeMetrics | null;
  customerLtv: ProviderCustomerLtv | null;
  geographic: ProviderGeographicDemand | null;
  forecast: ProviderRevenueForecast | null;
  bookingSources: ProviderBookingSourceAttribution | null;
  anomalyAlerts: ProviderAnomalyAlert[];
  serviceFunnel: ServiceAnalyticsMetrics[];
}

interface AnalyticsSummarySectionsProps {
  timeRange: '7d' | '30d' | '90d';
  periodLabel: string;
  cancellationStats: ProviderCancellationStats | null;
  summaryData: AnalyticsSummaryData;
  isLoading?: boolean;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function TrendIndicator({ trend }: { trend?: 'improving' | 'stable' | 'declining' | 'increasing' | 'decreasing' | 'up' | 'down' }) {
  if (!trend || trend === 'stable') return null;

  const isPositive = trend === 'improving' || trend === 'up' || trend === 'increasing';
  const isNegative = trend === 'declining' || trend === 'down';

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs font-medium ml-2',
      isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-nilin-warmGray'
    )}>
      {isPositive && <TrendingUp className="h-3 w-3" />}
      {isNegative && <TrendingDown className="h-3 w-3" />}
      {trend}
    </span>
  );
}

export const AnalyticsSummarySections: React.FC<AnalyticsSummarySectionsProps> = ({
  timeRange,
  periodLabel,
  cancellationStats,
  summaryData,
  isLoading = false,
}) => {
  const navigate = useNavigate();
  const [serviceFunnelOpen, setServiceFunnelOpen] = useState(false);
  const { responseTime, customerLtv, geographic, forecast, bookingSources, anomalyAlerts, serviceFunnel } =
    summaryData;

  const actionableAlerts = anomalyAlerts.filter((alert) => alert.severity !== 'info');

  return (
    <div className="space-y-8">
      {actionableAlerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-serif text-nilin-charcoal flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Anomaly alerts
          </h2>
          <div className="flex flex-col gap-2">
            {actionableAlerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'rounded-nilin border px-4 py-3 text-sm',
                  SEVERITY_STYLES[alert.severity],
                )}
              >
                <p className="font-medium">{alert.title}</p>
                <p className="mt-1 opacity-90">{alert.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {cancellationStats && (
        <section className="glass-nilin rounded-nilin-lg p-6 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-serif text-nilin-charcoal">Cancellation snapshot</h2>
              <p className="text-xs text-nilin-warmGray mt-1">{periodLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/provider/analytics?tab=cancellations')}
              className="text-sm font-medium text-nilin-coral hover:underline"
            >
              View details →
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-nilin-muted rounded-nilin p-4 text-center">
              <p className="text-2xl font-bold text-nilin-charcoal">
                {formatPercent(cancellationStats.cancellationRate)}
              </p>
              <p className="text-sm text-nilin-warmGray">Cancellation rate</p>
            </div>
            <div className="bg-red-50 rounded-nilin p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{cancellationStats.cancelledBookings}</p>
              <p className="text-sm text-red-600">Cancelled</p>
            </div>
            <div className="bg-nilin-muted rounded-nilin p-4 text-center">
              <p className="text-2xl font-bold text-nilin-charcoal">{cancellationStats.totalBookings}</p>
              <p className="text-sm text-nilin-warmGray">Total bookings</p>
            </div>
            <div className="bg-nilin-muted rounded-nilin p-4 text-center">
              <p className="text-2xl font-bold capitalize">
                <span className={cn(
                  cancellationStats.trend === 'improving' ? 'text-green-600' :
                  cancellationStats.trend === 'worsening' ? 'text-red-600' : 'text-nilin-charcoal'
                )}>
                  {cancellationStats.trend}
                </span>
              </p>
              <p className="text-sm text-nilin-warmGray">Trend</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-serif text-nilin-charcoal">Response time</h2>
          </div>
          {isLoading ? (
            <p className="text-sm text-nilin-warmGray">Loading…</p>
          ) : !responseTime || responseTime.sampleSize === 0 ? (
            <EmptyState
              title="No response data yet"
              description="Response metrics appear after you accept booking requests."
              compact
            />
          ) : (
            <>
              <p className="text-3xl font-bold text-nilin-charcoal">
                {Math.round(responseTime.avgResponseTimeMinutes)}m
              </p>
              <p className="text-sm text-nilin-warmGray mt-1">
                Target: {responseTime.targetMinutes}m ·{' '}
                <span
                  className={cn(
                    'font-medium',
                    responseTime.compliant ? 'text-green-600' : 'text-amber-600',
                  )}
                >
                  {responseTime.compliant ? 'On target' : 'Above target'}
                </span>
                <TrendIndicator trend={responseTime.trend} />
              </p>
              {responseTime.sampleSize > 0 && (
                <p className="text-xs text-nilin-warmGray mt-2">
                  Based on {responseTime.sampleSize} booking{responseTime.sampleSize !== 1 ? 's' : ''}
                </p>
              )}
            </>
          )}
        </div>

        <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-serif text-nilin-charcoal">Customer LTV</h2>
          </div>
          {isLoading ? (
            <p className="text-sm text-nilin-warmGray">Loading…</p>
          ) : !customerLtv || customerLtv.totalCustomers === 0 ? (
            <EmptyState
              title="No LTV data yet"
              description="Complete bookings to see average customer lifetime value."
              compact
            />
          ) : (
            <>
              <p className="text-3xl font-bold text-nilin-charcoal">
                {formatPrice(customerLtv.avgRevenuePerCustomer)}
              </p>
              <p className="text-sm text-nilin-warmGray mt-1">
                Avg revenue per customer · {customerLtv.totalCustomers} customers
              </p>
              <p className="text-xs text-nilin-warmGray mt-2">
                {customerLtv.avgBookingsPerCustomer.toFixed(1)} bookings per customer on average
              </p>
            </>
          )}
        </div>
      </section>

      <section className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-green-600" />
          <h2 className="text-lg font-serif text-nilin-charcoal">Geographic demand</h2>
        </div>
        {isLoading ? (
          <p className="text-sm text-nilin-warmGray">Loading…</p>
        ) : !geographic || geographic.locations.length === 0 ? (
          <EmptyState
            title="No location data yet"
            description="Top cities appear once you complete bookings with location details."
            compact
          />
        ) : (
          <div className="space-y-3">
            {geographic.locations.slice(0, 5).map((location) => (
              <div
                key={`${location.city}-${location.emirate}`}
                className="flex items-center justify-between gap-4 py-2 border-b border-nilin-border last:border-0"
              >
                <div>
                  <p className="font-medium text-nilin-charcoal">{location.city}</p>
                  <p className="text-xs text-nilin-warmGray">{location.emirate}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-nilin-charcoal">{location.bookings} bookings</p>
                  <p className="text-nilin-warmGray">
                    {formatPrice(location.revenue)} · {location.share.toFixed(0)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-nilin-coral" />
            <h2 className="text-lg font-serif text-nilin-charcoal">Revenue forecast</h2>
          </div>
          {isLoading ? (
            <p className="text-sm text-nilin-warmGray">Loading…</p>
          ) : !forecast ? (
            <EmptyState title="Forecast unavailable" description="More booking history is needed." compact />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-nilin-muted rounded-nilin p-4">
                  <p className="text-xs text-nilin-warmGray">Next 7 days</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {formatPrice(forecast.projectedRevenue7d)}
                  </p>
                </div>
                <div className="bg-nilin-muted rounded-nilin p-4">
                  <p className="text-xs text-nilin-warmGray">Next 30 days</p>
                  <p className="text-xl font-bold text-nilin-charcoal">
                    {formatPrice(forecast.projectedRevenue30d)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-nilin-warmGray capitalize">
                  Based on {timeRange} history
                </span>
                <TrendIndicator trend={forecast.trend} />
              </div>
            </div>
          )}
        </div>

        <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-serif text-nilin-charcoal">Booking sources</h2>
          </div>
          {isLoading ? (
            <p className="text-sm text-nilin-warmGray">Loading…</p>
          ) : !bookingSources || bookingSources.bySource.length === 0 ? (
            <EmptyState
              title="No attribution data"
              description="Source breakdown appears as bookings are attributed."
              compact
            />
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bookingSources.bySource} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="source" width={72} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? formatPrice(value) : value,
                      name === 'revenue' ? 'Revenue' : 'Bookings',
                    ]}
                  />
                  <Bar dataKey="bookings" radius={[0, 4, 4, 0]}>
                    {bookingSources.bySource.map((entry) => (
                      <Cell key={entry.source} fill={SOURCE_COLORS[entry.source] || '#94A3B8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      <section className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <button
          type="button"
          onClick={() => setServiceFunnelOpen((open) => !open)}
          className="w-full flex items-center justify-between gap-4 text-left"
        >
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-nilin-coral" />
            <div>
              <h2 className="text-lg font-serif text-nilin-charcoal">Service-level funnel</h2>
              <p className="text-xs text-nilin-warmGray">Views → bookings by service</p>
            </div>
          </div>
          {serviceFunnelOpen ? (
            <ChevronUp className="h-5 w-5 text-nilin-warmGray" />
          ) : (
            <ChevronDown className="h-5 w-5 text-nilin-warmGray" />
          )}
        </button>

        {serviceFunnelOpen && (
          <div className="mt-4 space-y-3">
            {isLoading ? (
              <p className="text-sm text-nilin-warmGray">Loading…</p>
            ) : serviceFunnel.length === 0 ? (
              <EmptyState
                title="No service funnel data"
                description="Add services and complete bookings to see per-service conversion."
                compact
              />
            ) : (
              serviceFunnel.map((service) => (
                <div
                  key={service.serviceId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-nilin-border last:border-0"
                >
                  <div>
                    <p className="font-medium text-nilin-charcoal">{service.serviceName}</p>
                    <p className="text-xs text-nilin-warmGray">
                      {service.views} views · {service.totalBookings} bookings
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-nilin-warmGray">
                      Conv. <span className="font-medium text-nilin-charcoal">{service.conversionRate.toFixed(1)}%</span>
                    </span>
                    <span className="text-nilin-warmGray">
                      {formatPrice(service.totalRevenue)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={() => navigate('/provider/services')}
              className="text-sm font-medium text-nilin-coral hover:underline"
            >
              Manage services →
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default AnalyticsSummarySections;
