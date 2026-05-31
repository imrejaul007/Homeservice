/**
 * NILIN Customer Dashboard Components
 *
 * A collection of production-ready React components for the customer dashboard.
 * These components follow the NILIN design system with Tailwind CSS and Radix UI.
 */

// =============================================================================
// Feed & Recommendations
// =============================================================================

export { PersonalizedFeed, default as PersonalizedFeedDefault } from './PersonalizedFeed';
export type { PersonalizedFeedProps, PersonalizedFeedProps as PersonalizedFeedPropsType } from './PersonalizedFeed';

export { TrendingServices, default as TrendingServicesDefault } from './TrendingServices';
export type { TrendingServicesProps, TrendingServicesProps as TrendingServicesPropsType } from './TrendingServices';

export { NearbyServices, default as NearbyServicesDefault } from './NearbyServices';
export type { NearbyServicesProps, NearbyServicesProps as NearbyServicesPropsType } from './NearbyServices';

export { RecentlyViewed, default as RecentlyViewedDefault } from './RecentlyViewed';
export type { RecentlyViewedProps, RecentlyViewedItem, RecentlyViewedProps as RecentlyViewedPropsType } from './RecentlyViewed';

// =============================================================================
// Booking Filters
// =============================================================================

export { BookingFilters, default as BookingFiltersDefault } from './BookingFilters';
export type {
  BookingFiltersProps,
  BookingFiltersState,
  BookingFiltersProps as BookingFiltersPropsType
} from './BookingFilters';

// =============================================================================
// Review Drafts
// =============================================================================

export { ReviewDraft, ReviewDraftList, default as ReviewDraftDefault } from './ReviewDraft';
export type {
  ReviewDraftProps,
  ReviewDraftListProps,
  ReviewDraftData,
  ReviewDraftProps as ReviewDraftPropsType
} from './ReviewDraft';

// =============================================================================
// Saved & Quick Actions
// =============================================================================

export { SavedProvidersQuickBook, default as SavedProvidersQuickBookDefault } from './SavedProvidersQuickBook';
export type {
  SavedProvidersQuickBookProps,
  SavedProvider,
  SavedProvidersQuickBookProps as SavedProvidersQuickBookPropsType
} from './SavedProvidersQuickBook';

// =============================================================================
// Loyalty & Engagement
// =============================================================================

export { LoyaltyStatusBadge, TierBadge, default as LoyaltyStatusBadgeDefault } from './LoyaltyStatusBadge';
export type {
  LoyaltyStatusBadgeProps,
  LoyaltyTier,
  LoyaltyBenefits,
  LoyaltyStatusBadgeProps as LoyaltyStatusBadgePropsType
} from './LoyaltyStatusBadge';

export { CustomerHealthScore, default as CustomerHealthScoreDefault } from './CustomerHealthScore';
export type { CustomerHealthScoreProps, CustomerHealthScoreProps as CustomerHealthScorePropsType } from './CustomerHealthScore';

// =============================================================================
// Booking Tracking
// =============================================================================

export { LiveBookingTracker, default as LiveBookingTrackerDefault } from './LiveBookingTracker';
export type {
  LiveBookingTrackerProps,
  BookingStatus,
  LiveBookingTrackerProps as LiveBookingTrackerPropsType
} from './LiveBookingTracker';

export { BookingTimeline, getDefaultBookingTimeline, default as BookingTimelineDefault } from './BookingTimeline';
export type {
  BookingTimelineProps,
  BookingTimelineEvent,
  BookingTimelineProps as BookingTimelinePropsType
} from './BookingTimeline';

// =============================================================================
// Documents & Downloads
// =============================================================================

export { InvoiceDownload, default as InvoiceDownloadDefault } from './InvoiceDownload';
export type {
  InvoiceDownloadProps,
  InvoiceData,
  InvoiceDownloadProps as InvoiceDownloadPropsType
} from './InvoiceDownload';

export { ReceiptDownload, default as ReceiptDownloadDefault } from './ReceiptDownload';
export type {
  ReceiptDownloadProps,
  ReceiptData,
  ReceiptDownloadProps as ReceiptDownloadPropsType
} from './ReceiptDownload';

// =============================================================================
// Booking Management
// =============================================================================

export { RecurringBookingSetup, default as RecurringBookingSetupDefault } from './RecurringBookingSetup';
export type {
  RecurringBookingSetupProps,
  RecurringSubscription,
  RecurringFrequency,
  RecurringBookingSetupProps as RecurringBookingSetupPropsType
} from './RecurringBookingSetup';

export { BookingReschedule, default as BookingRescheduleDefault } from './BookingReschedule';
export type {
  BookingRescheduleProps,
  BookingRescheduleProps as BookingReschedulePropsType
} from './BookingReschedule';

// =============================================================================
// Support & Emergency
// =============================================================================

export { NoShowReport, default as NoShowReportDefault } from './NoShowReport';
export type {
  NoShowReportProps,
  NoShowReportData,
  NoShowReportProps as NoShowReportPropsType
} from './NoShowReport';

export { EmergencyBooking, default as EmergencyBookingDefault } from './EmergencyBooking';
export type {
  EmergencyBookingProps,
  EmergencyBookingData,
  EmergencyBookingProps as EmergencyBookingPropsType
} from './EmergencyBooking';

// =============================================================================
// Re-exports from existing components
// =============================================================================

// =============================================================================
// Reviews & Media
// =============================================================================

export { PhotoReview, PhotoGallery, default as PhotoReviewDefault } from './PhotoReview';
export type {
  PhotoReviewProps,
  PhotoReviewItem,
  ReviewPhoto,
  PhotoReviewProps as PhotoReviewPropsType
} from './PhotoReview';

// =============================================================================
// Payment
// =============================================================================

export { SplitPayment, SplitPaymentSelector, default as SplitPaymentDefault } from './SplitPayment';
export type {
  SplitPaymentProps,
  SplitPaymentDetails,
  WalletBalance,
  SplitPaymentProps as SplitPaymentPropsType
} from './SplitPayment';

// =============================================================================
// Service Bundles
// =============================================================================

export { ServiceBundles, default as ServiceBundlesDefault } from './ServiceBundles';
export type {
  ServiceBundlesProps,
  Bundle,
  BundleService,
  ServiceBundlesProps as ServiceBundlesPropsType
} from './ServiceBundles';

// =============================================================================
// Re-exports from existing components
// =============================================================================

export { default as PromoCard } from './PromoCard';
export { default as Timeline } from './Timeline';
export { default as CategoryGrid } from './CategoryGrid';
export { default as ServiceCard } from './ServiceCard';
export { default as BookingCard } from './BookingCard';
