/**
 * Dashboard customization types
 */

export type WidgetType =
  | 'kpi-users'
  | 'kpi-providers'
  | 'kpi-bookings'
  | 'kpi-revenue'
  | 'kpi-churn'
  | 'kpi-funnel'
  | 'kpi-top-city'
  | 'chart-revenue'
  | 'chart-bookings'
  | 'chart-geographic'
  | 'chart-funnel'
  | 'activity-feed'
  | 'pending-actions'
  | 'audit-log'
  | 'service-approval'
  | 'quick-actions';

export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  size: WidgetSize;
  order: number;
  visible: boolean;
  /** Grid column span (1-12) */
  colSpan?: number;
  /** Grid row span */
  rowSpan?: number;
}

export interface DashboardLayout {
  id: string;
  name: string;
  widgets: WidgetConfig[];
  createdAt: string;
  updatedAt: string;
}

export interface WidgetDefinition {
  type: WidgetType;
  title: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  category: 'kpi' | 'chart' | 'activity' | 'actions';
  /** Default column span for each size */
  sizeToColSpan: Record<WidgetSize, number>;
}

export interface DragItem {
  widgetId: string;
  widgetType: WidgetType;
}

export interface DropZone {
  sectionId: string;
  index: number;
}

/** Widget definitions registry */
export const WIDGET_DEFINITIONS: Record<WidgetType, WidgetDefinition> = {
  'kpi-users': {
    type: 'kpi-users',
    title: 'Total Users',
    description: 'Display total and active customers',
    icon: 'Users',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'kpi-providers': {
    type: 'kpi-providers',
    title: 'Approved Providers',
    description: 'Display approved and pending providers',
    icon: 'CheckCircle',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'kpi-bookings': {
    type: 'kpi-bookings',
    title: "Today's Bookings",
    description: 'Display today and monthly bookings',
    icon: 'Calendar',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'kpi-revenue': {
    type: 'kpi-revenue',
    title: 'Revenue',
    description: 'Display monthly revenue and growth',
    icon: 'DollarSign',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'kpi-churn': {
    type: 'kpi-churn',
    title: 'At-Risk Customers',
    description: 'Display churn rate and risk breakdown',
    icon: 'TrendingDown',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'kpi-funnel': {
    type: 'kpi-funnel',
    title: 'Funnel Conversion',
    description: 'Display conversion rate percentage',
    icon: 'TrendingUp',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'kpi-top-city': {
    type: 'kpi-top-city',
    title: 'Top City',
    description: 'Display top performing city',
    icon: 'MapPin',
    defaultSize: 'sm',
    minSize: 'sm',
    maxSize: 'md',
    category: 'kpi',
    sizeToColSpan: { sm: 3, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'chart-revenue': {
    type: 'chart-revenue',
    title: 'Revenue Chart',
    description: 'Monthly revenue over time',
    icon: 'BarChart3',
    defaultSize: 'lg',
    minSize: 'md',
    maxSize: 'full',
    category: 'chart',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'chart-bookings': {
    type: 'chart-bookings',
    title: 'Bookings Chart',
    description: 'Booking trends over time',
    icon: 'BarChart3',
    defaultSize: 'lg',
    minSize: 'md',
    maxSize: 'full',
    category: 'chart',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'chart-geographic': {
    type: 'chart-geographic',
    title: 'Geographic Performance',
    description: 'Bookings by city',
    icon: 'MapPin',
    defaultSize: 'lg',
    minSize: 'md',
    maxSize: 'full',
    category: 'chart',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'chart-funnel': {
    type: 'chart-funnel',
    title: 'Booking Funnel',
    description: 'Marketing funnel visualization',
    icon: 'BarChart3',
    defaultSize: 'lg',
    minSize: 'md',
    maxSize: 'full',
    category: 'chart',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'activity-feed': {
    type: 'activity-feed',
    title: 'Live Activity',
    description: 'Real-time admin alerts',
    icon: 'Activity',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
    category: 'activity',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'pending-actions': {
    type: 'pending-actions',
    title: 'Pending Actions',
    description: 'Alerts requiring attention',
    icon: 'AlertTriangle',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
    category: 'activity',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'audit-log': {
    type: 'audit-log',
    title: 'Recent Admin Actions',
    description: 'Audit log entries',
    icon: 'FileText',
    defaultSize: 'md',
    minSize: 'sm',
    maxSize: 'lg',
    category: 'activity',
    sizeToColSpan: { sm: 12, md: 6, lg: 6, xl: 6, full: 12 },
  },
  'service-approval': {
    type: 'service-approval',
    title: 'Service Approvals',
    description: 'Pending service reviews',
    icon: 'Shield',
    defaultSize: 'lg',
    minSize: 'sm',
    maxSize: 'full',
    category: 'activity',
    sizeToColSpan: { sm: 12, md: 12, lg: 12, xl: 12, full: 12 },
  },
  'quick-actions': {
    type: 'quick-actions',
    title: 'Quick Actions',
    description: 'Shortcuts to admin workflows',
    icon: 'Zap',
    defaultSize: 'lg',
    minSize: 'md',
    maxSize: 'full',
    category: 'actions',
    sizeToColSpan: { sm: 12, md: 12, lg: 12, xl: 12, full: 12 },
  },
};

/** Default dashboard layout */
export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  id: 'default',
  name: 'Default Dashboard',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  widgets: [
    // Primary KPIs
    { id: 'w1', type: 'kpi-users', title: 'Total users', size: 'sm', order: 1, visible: true, colSpan: 3 },
    { id: 'w2', type: 'kpi-providers', title: 'Approved providers', size: 'sm', order: 2, visible: true, colSpan: 3 },
    { id: 'w3', type: 'kpi-bookings', title: "Today's bookings", size: 'sm', order: 3, visible: true, colSpan: 3 },
    { id: 'w4', type: 'kpi-revenue', title: 'Revenue this month', size: 'sm', order: 4, visible: true, colSpan: 3 },
    // Secondary KPIs
    { id: 'w5', type: 'kpi-churn', title: 'At-risk customers', size: 'sm', order: 5, visible: true, colSpan: 3 },
    { id: 'w6', type: 'chart-funnel', title: 'Booking funnel', size: 'lg', order: 6, visible: true, colSpan: 6 },
    { id: 'w7', type: 'chart-geographic', title: 'Geographic performance', size: 'lg', order: 7, visible: true, colSpan: 6 },
    // Activity sections
    { id: 'w8', type: 'activity-feed', title: 'Live activity', size: 'md', order: 8, visible: true, colSpan: 4 },
    { id: 'w9', type: 'audit-log', title: 'Recent admin actions', size: 'md', order: 9, visible: true, colSpan: 4 },
    { id: 'w10', type: 'pending-actions', title: 'Pending actions', size: 'md', order: 10, visible: true, colSpan: 4 },
    // Full-width widgets
    { id: 'w11', type: 'service-approval', title: 'Service Approvals', size: 'lg', order: 11, visible: true, colSpan: 12 },
    { id: 'w12', type: 'quick-actions', title: 'Quick actions', size: 'lg', order: 12, visible: true, colSpan: 12 },
  ],
};

/** Storage key for saved layout */
export const DASHBOARD_LAYOUT_STORAGE_KEY = 'admin-dashboard-layout';

/** Load saved layout from localStorage */
export function loadDashboardLayout(): DashboardLayout | null {
  try {
    const saved = localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as DashboardLayout;
    }
  } catch (error) {
    console.error('[Dashboard] Failed to load layout from localStorage:', error);
  }
  return null;
}

/** Save layout to localStorage */
export function saveDashboardLayout(layout: DashboardLayout): void {
  try {
    localStorage.setItem(
      DASHBOARD_LAYOUT_STORAGE_KEY,
      JSON.stringify({
        ...layout,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.error('[Dashboard] Failed to save layout to localStorage:', error);
  }
}

/** Reset layout to default */
export function resetDashboardLayout(): void {
  try {
    localStorage.removeItem(DASHBOARD_LAYOUT_STORAGE_KEY);
  } catch (error) {
    console.error('[Dashboard] Failed to reset layout:', error);
  }
}
