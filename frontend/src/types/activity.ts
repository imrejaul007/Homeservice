// Activity types for entity detail views

export type ActivityType =
  // Authentication
  | 'login'
  | 'logout'
  // Bookings
  | 'booking_created'
  | 'booking_cancelled'
  | 'booking_completed'
  // Reviews
  | 'review_given'
  | 'review_moderated'
  // Refunds
  | 'refund_requested'
  | 'refund_approved'
  | 'refund_rejected'
  // Disputes
  | 'dispute_opened'
  | 'dispute_resolved'
  // Profile
  | 'profile_updated'
  // Payments
  | 'payment_made'
  | 'payment_failed'
  // Messages
  | 'message_sent';

export interface ActivityActor {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

export interface ActivityEntity {
  id: string;
  type: string;
  name: string;
  link?: string;
}

export interface Activity {
  _id: string;
  type: ActivityType;
  description: string;
  actor: ActivityActor;
  entity?: ActivityEntity;
  metadata?: Record<string, unknown>;
  timestamp: string | Date;
  createdAt?: string | Date;
}

export interface ActivityFilter {
  types?: ActivityType[];
  startDate?: string | Date;
  endDate?: string | Date;
  actorId?: string;
}

export interface ActivityGroup {
  date: string;
  label: string;
  activities: Activity[];
}

export interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
  maxItems?: number;
  filterTypes?: ActivityType[];
  onLoadMore?: () => void;
  hasMore?: boolean;
  onFilterChange?: (filter: ActivityFilter) => void;
  currentFilter?: ActivityFilter;
  emptyMessage?: string;
  className?: string;
}

// Activity type configuration for UI display
export const ACTIVITY_CONFIG: Record<ActivityType, {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}> = {
  login: {
    icon: 'LogIn',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Login',
  },
  logout: {
    icon: 'LogOut',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Logout',
  },
  booking_created: {
    icon: 'CalendarPlus',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Booking Created',
  },
  booking_cancelled: {
    icon: 'CalendarX',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Booking Cancelled',
  },
  booking_completed: {
    icon: 'CalendarCheck',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Booking Completed',
  },
  review_given: {
    icon: 'Star',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Review Given',
  },
  review_moderated: {
    icon: 'CheckCircle',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Review Moderated',
  },
  refund_requested: {
    icon: 'RotateCcw',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Refund Requested',
  },
  refund_approved: {
    icon: 'Check',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Refund Approved',
  },
  refund_rejected: {
    icon: 'X',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Refund Rejected',
  },
  dispute_opened: {
    icon: 'AlertTriangle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Dispute Opened',
  },
  dispute_resolved: {
    icon: 'Shield',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Dispute Resolved',
  },
  profile_updated: {
    icon: 'User',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Profile Updated',
  },
  payment_made: {
    icon: 'CreditCard',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Payment Made',
  },
  payment_failed: {
    icon: 'AlertCircle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Payment Failed',
  },
  message_sent: {
    icon: 'MessageSquare',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Message Sent',
  },
};

// All activity types grouped by category
export const ACTIVITY_GROUPS = {
  authentication: ['login', 'logout'] as ActivityType[],
  bookings: ['booking_created', 'booking_cancelled', 'booking_completed'] as ActivityType[],
  reviews: ['review_given', 'review_moderated'] as ActivityType[],
  refunds: ['refund_requested', 'refund_approved', 'refund_rejected'] as ActivityType[],
  disputes: ['dispute_opened', 'dispute_resolved'] as ActivityType[],
  payments: ['payment_made', 'payment_failed'] as ActivityType[],
  messages: ['message_sent'] as ActivityType[],
  profile: ['profile_updated'] as ActivityType[],
};
