import React from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  DollarSign,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  MapPin,
  Activity,
  Shield,
  Zap,
  ChevronRight,
  FileText,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import {
  WidgetConfig,
  WidgetType,
} from '../../types/dashboard';

interface WidgetRendererProps {
  widget: WidgetConfig;
  /** Dashboard data - pass relevant stats based on widget type */
  stats?: {
    totalUsers?: number;
    activeProviders?: number;
    todayBookings?: number;
    revenue?: number;
    pendingVerifications?: number;
    activeIncidents?: number;
  };
  analytics?: {
    customers?: { total?: number; active?: number };
    providers?: { active?: number; newThisMonth?: number };
    bookings?: { total?: number; pending?: number; completed?: number };
    revenue?: { thisMonth?: number; lastMonth?: number; monthOverMonthGrowth?: number | null };
    funnelConversion?: number;
  };
  churnData?: {
    totalAtRisk?: number;
    churnRate?: number;
  };
  geographicData?: {
    topCity?: string;
    totalBookings?: number;
    byCity?: Array<{ city: string; bookings: number; revenue: number }>;
  };
  funnelData?: {
    conversionRates?: { overall?: number };
    stages?: Array<{ stage: string; count: number }>;
  };
  notifications?: Array<{
    id: string;
    type: 'provider' | 'service' | 'dispute' | 'withdrawal';
    message: string;
    timestamp: Date;
  }>;
  recentAuditLogs?: Array<{
    _id: string;
    action: string;
    resource: string;
    resourceId?: string;
    description?: string;
    userId?: { firstName?: string };
    createdAt: string;
    status?: string;
  }>;
  onClearNotifications?: () => void;
  /** If true, shows drag handle and remove button */
  isEditMode?: boolean;
  onRemove?: () => void;
  onDragStart?: () => void;
}

const CHART_COLORS = ['#E8B4A8', '#C9A87C', '#8B7355', '#6B5344', '#4A3728'];

function formatAED(amount: number) {
  return `AED ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatAuditTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });
}

function KpiWidget({
  icon: Icon,
  label,
  value,
  subValue,
  accent = 'coral',
  to,
  isEditMode,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  accent?: 'coral' | 'gold' | 'sage' | 'rose';
  to?: string;
  isEditMode?: boolean;
}) {
  const accents = {
    coral: 'from-nilin-rose/20 to-nilin-coral/10 text-nilin-coral',
    gold: 'from-amber-100/80 to-nilin-gold/20 text-amber-800',
    sage: 'from-emerald-100/80 to-nilin-sage/20 text-emerald-800',
    rose: 'from-nilin-blush to-nilin-rose/20 text-nilin-charcoal',
  };

  const content = (
    <>
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accents[accent]} flex items-center justify-center mb-4`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-serif font-semibold text-nilin-charcoal">{value}</p>
      <p className="text-sm font-semibold text-nilin-charcoal/80 font-sans mt-1">{label}</p>
      {subValue && <p className="text-xs font-medium text-nilin-warmGray mt-1.5 font-sans">{subValue}</p>}
      {to && (
        <p className="text-xs font-medium text-nilin-coral mt-2 font-sans flex items-center gap-0.5">
          View details <ChevronRight className="w-3 h-3" />
        </p>
      )}
    </>
  );

  const className =
    'glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d p-5 block transition-all hover:border-nilin-coral/50 hover:shadow-nilin-warm relative';

  if (isEditMode) {
    return (
      <div className={className}>
        <div className="absolute top-2 right-2 w-6 h-6 rounded bg-nilin-coral/20 text-nilin-coral text-xs flex items-center justify-center">
          <GripVertical className="w-3 h-3" />
        </div>
        {content}
      </div>
    );
  }

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function GripVertical() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function ActivityFeedWidget({
  notifications,
  onClear,
  isEditMode,
}: {
  notifications?: WidgetRendererProps['notifications'];
  onClear?: () => void;
  isEditMode?: boolean;
}) {
  return (
    <section className="glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d overflow-hidden relative">
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 w-8 h-8 rounded bg-nilin-coral/20 text-nilin-coral flex items-center justify-center">
          <GripVertical />
        </div>
      )}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-nilin-border/40">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">Live activity</h2>
          <p className="text-sm text-nilin-warmGray font-sans mt-0.5">Real-time admin alerts</p>
        </div>
        {notifications && notifications.length > 0 && !isEditMode && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-nilin-coral hover:text-nilin-rose font-sans"
          >
            Clear all
          </button>
        )}
      </div>
      <div className="p-5">
        {!notifications || notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="w-10 h-10 text-nilin-border mb-3" />
            <p className="text-sm text-nilin-warmGray font-sans">No new alerts</p>
            <p className="text-xs text-nilin-warmGray/80 mt-1 font-sans">
              Updates appear when providers, disputes, or payouts change
            </p>
          </div>
        ) : (
          <ul role="log" aria-live="polite" aria-label="Live notifications" className="space-y-3 max-h-64 overflow-y-auto">
            {notifications.slice(0, 8).map((n) => (
              <li key={n.id} className="flex gap-3 text-sm font-sans">
                <span
                  className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                    n.type === 'provider'
                      ? 'bg-nilin-coral'
                      : n.type === 'service'
                        ? 'bg-emerald-500'
                        : n.type === 'dispute'
                          ? 'bg-red-500'
                          : 'bg-violet-500'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-nilin-charcoal leading-snug">{n.message}</p>
                  <p className="text-xs text-nilin-warmGray mt-0.5">{n.timestamp.toLocaleTimeString('en-AE')}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function PendingActionsWidget({
  stats,
  isEditMode,
}: {
  stats?: WidgetRendererProps['stats'];
  isEditMode?: boolean;
}) {
  const pendingItems = [
    stats?.pendingVerifications && stats.pendingVerifications > 0
      ? { label: 'Provider verifications', count: stats.pendingVerifications, urgent: true }
      : null,
    stats?.activeIncidents && stats.activeIncidents > 0
      ? { label: 'Active incidents', count: stats.activeIncidents, urgent: true }
      : null,
  ].filter(Boolean) as Array<{ label: string; count: number; urgent: boolean }>;

  return (
    <section className="glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d overflow-hidden relative">
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 w-8 h-8 rounded bg-nilin-coral/20 text-nilin-coral flex items-center justify-center">
          <GripVertical />
        </div>
      )}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-nilin-border/40">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">Pending actions</h2>
          <p className="text-sm text-nilin-warmGray font-sans mt-0.5">Requires attention</p>
        </div>
      </div>
      <div className="p-5">
        {pendingItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-400 mb-3" />
            <p className="text-sm text-nilin-charcoal font-sans">All caught up</p>
            <p className="text-xs text-nilin-warmGray/80 mt-1 font-sans">No pending actions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <Link
                key={item.label}
                to={item.label.includes('Provider') ? '/admin/providers?tab=pending' : '/admin/disputes'}
                className="flex items-center justify-between p-3 rounded-xl border border-amber-200/80 bg-amber-50/50 hover:bg-amber-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-nilin-charcoal">{item.label}</span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-200 text-amber-800 text-sm font-semibold">
                  {item.count}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function AuditLogWidget({
  logs,
  isEditMode,
}: {
  logs?: WidgetRendererProps['recentAuditLogs'];
  isEditMode?: boolean;
}) {
  const getAuditActionIcon = (action: string) => {
    switch (action) {
      case 'approve':
      case 'activate':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
      case 'reject':
      case 'deactivate':
      case 'suspend':
        return <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
      case 'create':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      case 'delete':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-nilin-warmGray" />;
    }
  };

  const getAuditActionColor = (action: string, status: string) => {
    if (status === 'failure') return 'border-red-200 bg-red-50/50';
    switch (action) {
      case 'approve':
      case 'activate':
        return 'border-emerald-200 bg-emerald-50/30';
      case 'reject':
      case 'deactivate':
      case 'suspend':
        return 'border-red-200 bg-red-50/30';
      case 'create':
        return 'border-blue-200 bg-blue-50/30';
      case 'update':
        return 'border-amber-200 bg-amber-50/30';
      case 'delete':
        return 'border-red-200 bg-red-50/30';
      default:
        return 'border-nilin-border/40 bg-white/30';
    }
  };

  return (
    <section className="glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d overflow-hidden relative">
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 w-8 h-8 rounded bg-nilin-coral/20 text-nilin-coral flex items-center justify-center">
          <GripVertical />
        </div>
      )}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-nilin-border/40">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">Recent admin actions</h2>
          <p className="text-sm text-nilin-warmGray font-sans mt-0.5">Audit log entries</p>
        </div>
        <Link to="/admin/audit" className="text-xs text-nilin-coral hover:text-nilin-rose font-sans">
          View all
        </Link>
      </div>
      <div className="p-5">
        {!logs || logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-10 h-10 text-nilin-border mb-3" />
            <p className="text-sm text-nilin-warmGray font-sans">No audit entries yet</p>
            <p className="text-xs text-nilin-warmGray/80 mt-1 font-sans">Admin actions will appear here</p>
          </div>
        ) : (
          <ul className="space-y-2.5 max-h-64 overflow-y-auto">
            {logs.slice(0, 6).map((log) => (
              <li
                key={log._id}
                className={`flex items-start gap-3 p-2.5 rounded-xl border ${getAuditActionColor(log.action, log.status || '')} transition-colors`}
              >
                <div className="w-8 h-8 rounded-lg bg-white/60 flex items-center justify-center flex-shrink-0">
                  {getAuditActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-nilin-charcoal capitalize">{log.action}</span>
                    <span className="text-xs text-nilin-warmGray">{log.resource}</span>
                    {log.resourceId && (
                      <span className="text-xs text-nilin-warmGray/70 font-mono">#{log.resourceId.slice(-6)}</span>
                    )}
                  </div>
                  {log.description && (
                    <p className="text-xs text-nilin-charcoal/80 mt-0.5 line-clamp-1">{log.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    {log.userId && (
                      <span className="text-xs text-nilin-warmGray flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.userId.firstName || 'Admin'}
                      </span>
                    )}
                    <span className="text-xs text-nilin-warmGray/70">{formatAuditTime(log.createdAt)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ChartWidget({
  title,
  subtitle,
  chartData,
  isEditMode,
  type,
}: {
  title: string;
  subtitle?: string;
  chartData: Array<{ stage: string; count: number }>;
  isEditMode?: boolean;
  type: 'funnel' | 'geographic';
}) {
  return (
    <section className="glass glass-blur rounded-2xl border border-nilin-border/50 gradient-3d neu-light card-3d overflow-hidden relative">
      {isEditMode && (
        <div className="absolute top-2 right-2 z-10 w-8 h-8 rounded bg-nilin-coral/20 text-nilin-coral flex items-center justify-center">
          <GripVertical />
        </div>
      )}
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-nilin-border/40">
        <div>
          <h2 className="text-lg font-serif text-nilin-charcoal">{title}</h2>
          {subtitle && <p className="text-sm text-nilin-warmGray font-sans mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-5">
        {chartData.length > 0 && chartData.some((d) => d.count > 0) ? (
          <>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6B5344' }} />
                  <YAxis type="category" dataKey="stage" width={88} tick={{ fontSize: 11, fill: '#4A3728' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #E8E0D8',
                      fontFamily: 'system-ui',
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm text-nilin-warmGray font-sans py-8 text-center">
            Chart data will appear as users browse and book services.
          </p>
        )}
      </div>
    </section>
  );
}

export function WidgetRenderer(props: WidgetRendererProps) {
  const { widget, isEditMode, onRemove } = props;
  const colSpanClass = {
    3: 'col-span-3',
    4: 'col-span-4',
    6: 'col-span-6',
    12: 'col-span-12',
  };

  const baseClasses = 'relative';
  const wrapperClasses = `${baseClasses} ${colSpanClass[widget.colSpan || 6] || 'col-span-6'}`;

  const renderWidget = () => {
    switch (widget.type) {
      case 'kpi-users':
        return (
          <KpiWidget
            icon={Users}
            label="Total users"
            value={(props.stats?.totalUsers || props.analytics?.customers?.total || 0).toLocaleString()}
            subValue={props.analytics ? `${props.analytics.customers?.active || 0} active customers` : undefined}
            accent="rose"
            to="/admin/reports"
            isEditMode={isEditMode}
          />
        );

      case 'kpi-providers':
        return (
          <KpiWidget
            icon={CheckCircle}
            label="Approved providers"
            value={props.stats?.activeProviders || props.analytics?.providers?.active || 0}
            subValue={
              props.stats?.pendingVerifications && props.stats.pendingVerifications > 0
                ? `${props.stats.pendingVerifications} awaiting verification`
                : props.analytics
                  ? `${props.analytics.providers?.newThisMonth || 0} new this month`
                  : undefined
            }
            accent="sage"
            to={props.stats?.pendingVerifications ? '/admin/providers?tab=pending' : '/admin/providers'}
            isEditMode={isEditMode}
          />
        );

      case 'kpi-bookings':
        return (
          <KpiWidget
            icon={Calendar}
            label="Today's bookings"
            value={(props.stats?.todayBookings || 0).toLocaleString()}
            subValue={
              props.analytics?.bookings?.total
                ? `${props.analytics.bookings.total} created this month`
                : 'No bookings yet'
            }
            accent="coral"
            to="/admin/reports?tab=bookings"
            isEditMode={isEditMode}
          />
        );

      case 'kpi-revenue':
        return (
          <KpiWidget
            icon={DollarSign}
            label="Revenue this month"
            value={formatAED(props.stats?.revenue || props.analytics?.revenue?.thisMonth || 0)}
            subValue={
              props.analytics?.revenue?.monthOverMonthGrowth !== undefined
                ? `${props.analytics.revenue.monthOverMonthGrowth >= 0 ? '+' : ''}${props.analytics.revenue.monthOverMonthGrowth.toFixed(1)}% vs last month`
                : 'No revenue this month'
            }
            accent="gold"
            to="/admin/reports?tab=revenue"
            isEditMode={isEditMode}
          />
        );

      case 'kpi-churn':
        return (
          <KpiWidget
            icon={TrendingDown}
            label="At-risk customers"
            value={props.churnData?.totalAtRisk || 0}
            subValue={`Churn rate ${(props.churnData?.churnRate || 0).toFixed(1)}%`}
            accent="rose"
            to="/admin/churn"
            isEditMode={isEditMode}
          />
        );

      case 'kpi-funnel':
        return (
          <KpiWidget
            icon={TrendingUp}
            label="Funnel conversion"
            value={`${(props.funnelData?.conversionRates?.overall || 0).toFixed(1)}%`}
            subValue="View to completed booking"
            accent="gold"
            to="/admin/reports"
            isEditMode={isEditMode}
          />
        );

      case 'kpi-top-city':
        return (
          <KpiWidget
            icon={MapPin}
            label="Top city"
            value={props.geographicData?.topCity || '—'}
            subValue={`${props.geographicData?.totalBookings?.toLocaleString() || 0} bookings`}
            accent="sage"
            to="/admin/reports?tab=bookings&period=year"
            isEditMode={isEditMode}
          />
        );

      case 'activity-feed':
        return (
          <ActivityFeedWidget
            notifications={props.notifications}
            onClear={props.onClearNotifications}
            isEditMode={isEditMode}
          />
        );

      case 'pending-actions':
        return <PendingActionsWidget stats={props.stats} isEditMode={isEditMode} />;

      case 'audit-log':
        return <AuditLogWidget logs={props.recentAuditLogs} isEditMode={isEditMode} />;

      case 'chart-funnel':
        return (
          <ChartWidget
            title="Booking funnel"
            subtitle="Marketing funnel (last 12 months)"
            chartData={props.funnelData?.stages || []}
            isEditMode={isEditMode}
            type="funnel"
          />
        );

      case 'chart-geographic':
        return (
          <ChartWidget
            title="Geographic performance"
            subtitle="Completed bookings by city"
            chartData={
              props.geographicData?.byCity?.map((c) => ({
                stage: c.city,
                count: c.bookings,
              })) || []
            }
            isEditMode={isEditMode}
            type="geographic"
          />
        );

      case 'service-approval':
        // This widget is rendered separately in the dashboard
        return null;

      case 'quick-actions':
        // This widget is rendered separately in the dashboard
        return null;

      default:
        return (
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-5 text-center">
            <p className="text-sm text-nilin-warmGray">Unknown widget type: {widget.type}</p>
          </div>
        );
    }
  };

  return (
    <div className={wrapperClasses} data-widget-id={widget.id} data-widget-type={widget.type}>
      {renderWidget()}
      {isEditMode && onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600 transition-colors z-20 flex items-center justify-center"
          title="Remove widget"
          aria-label={`Remove ${widget.title}`}
        >
          <span className="text-lg leading-none">×</span>
        </button>
      )}
    </div>
  );
}

export default WidgetRenderer;
