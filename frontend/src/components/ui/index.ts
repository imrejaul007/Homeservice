// =============================================================================
// NILIN Design System - UI Components Index
// Centralized exports for all reusable UI components
// =============================================================================

// Layout Components
export { FadeSection } from './FadeSection';
export { ModernCard } from './ModernCard';
export { GradientButton } from './GradientButton';
export { SectionHeading } from './SectionHeading';
export { StatusBadge } from './StatusBadge';
export { MobileBottomNav } from './MobileBottomNav';
export { default as OptimizedImage } from './OptimizedImage';
export { ImageCard } from './ImageCard';
export { TrustBadge } from './TrustBadge';

// Dashboard Components
export { StatCard, StatCardGrid } from './StatCard';
export {
  DashboardSection,
  DashboardSectionHeader,
  DashboardCard,
  QuickActionsGrid,
  PromoCard,
} from './DashboardSection';
export {
  ServiceCard,
  CompactServiceCard,
  ProviderCard,
} from './Card';
export type { ServiceCardConfig } from './Card';

// Loading Skeletons
export {
  DashboardSkeleton,
  StatsRowSkeleton,
  QuickActionsSkeleton,
  ServiceListSkeleton,
  ServiceGridSkeleton,
  PromoCardsSkeleton,
  BookingListSkeleton,
  ProfileSkeleton,
  EmptyStateSkeleton,
} from './LoadingSkeleton';

// Note: For common components like Button, Badge, Skeleton, EmptyState,
// please import from '../common/' (already existing)
