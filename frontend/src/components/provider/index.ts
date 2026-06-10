/**
 * Provider Dashboard Components Index
 * Export all provider dashboard components
 */

// Analytics & Insights
export { RevenueTrendChart } from './RevenueTrendChart';
export { AcceptanceRateWidget } from './AcceptanceRateWidget';
export { ProfileViewsWidget } from './ProfileViewsWidget';
export { ConversionFunnel } from './ConversionFunnel';
export { EarningsForecast } from './EarningsForecast';
export { SentimentAnalysis } from './SentimentAnalysis';

// Service Analytics
export { ServiceAnalytics, default as ServiceAnalyticsDefault } from './ServiceAnalytics';
export type { ServiceAnalyticsProps, ServicePerformance } from './ServiceAnalytics';

// Quick Actions & Alerts
export { QuickActions } from './QuickActions';
export { AITipsAlerts } from './AITipsAlerts';

// Batch Booking Actions
export { BatchBookingActions, default as BatchBookingActionsDefault } from './BatchBookingActions';
export type { BatchBookingActionsProps, BookingSummary as BookingItem, BatchAction } from './BatchBookingActions';

// Service Management
export { ServiceDrafts } from './ServiceDrafts';
export { ServiceClone } from './ServiceClone';
export { ServicePauseList as ServicePause } from './ServicePause';
export { ServicePackages } from './ServicePackages';
export { BulkServiceUpload } from './BulkServiceUpload';
export type { BulkServiceUploadProps, UploadResult, ValidationError } from './BulkServiceUpload';

// Profile Completeness
export { ProviderProfileCompleteness } from './ProviderProfileCompleteness';
export type { ProviderProfileCompletenessProps, ProfileCompletenessData } from './ProviderProfileCompleteness';

// Calendar & Scheduling
export { CalendarView } from './CalendarView';
export { PayoutCalendar } from './PayoutCalendar';

// Financial Management
export { TaxDocuments } from './TaxDocuments';
export { ExpenseTracker } from './ExpenseTracker';
export { TipTracking } from './TipTracking';

// Customer CRM
export { CustomerNotes } from './CustomerNotes';
export { CustomerHistory } from './CustomerHistory';
export { FollowUpReminders } from './FollowUpReminders';

// Reviews & Marketing
export { ReviewTemplates } from './ReviewTemplates';
export { CouponCreation } from './CouponCreation';
