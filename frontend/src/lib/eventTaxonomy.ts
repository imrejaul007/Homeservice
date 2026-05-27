import { Capacitor } from '@capacitor/core';

// =============================================================================
// NILIN Event Taxonomy
// Centralized event definitions for analytics
// Package: com.nilin.app
// =============================================================================

// =============================================================================
// Event Categories
// =============================================================================

export enum EventCategory {
  AUTH = 'auth',
  BOOKING = 'booking',
  PAYMENT = 'payment',
  NAVIGATION = 'navigation',
  NOTIFICATION = 'notification',
  PERFORMANCE = 'performance',
  SEARCH = 'search',
  USER = 'user',
  ERROR = 'error',
}

// =============================================================================
// Auth Events
// =============================================================================

export enum AuthEvent {
  // Login flow
  LOGIN_START = 'login_start',
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',

  // Registration flow
  REGISTER_START = 'register_start',
  REGISTER_SUCCESS = 'register_success',
  REGISTER_FAILURE = 'register_failure',

  // Logout
  LOGOUT = 'logout',

  // Biometric
  BIOMETRIC_ENABLED = 'biometric_enabled',
  BIOMETRIC_DISABLED = 'biometric_disabled',
  BIOMETRIC_LOGIN_ATTEMPT = 'biometric_login_attempt',
  BIOMETRIC_LOGIN_SUCCESS = 'biometric_login_success',
  BIOMETRIC_LOGIN_FAILURE = 'biometric_login_failure',

  // Password
  PASSWORD_CHANGED = 'password_changed',
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',

  // Email verification
  EMAIL_VERIFICATION_SENT = 'email_verification_sent',
  EMAIL_VERIFIED = 'email_verified',
}

// =============================================================================
// Booking Events
// =============================================================================

export enum BookingEvent {
  // Booking funnel
  BOOKING_START = 'booking_start',
  PROVIDER_SELECTED = 'provider_selected',
  TIME_SELECTED = 'time_selected',
  ADDRESS_ENTERED = 'address_entered',
  DURATION_SELECTED = 'duration_selected',
  ADDON_ADDED = 'addon_added',
  ADDON_REMOVED = 'addon_removed',

  // Payment
  PAYMENT_STARTED = 'payment_started',
  PAYMENT_METHOD_SELECTED = 'payment_method_selected',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  PAYMENT_CANCELLED = 'payment_cancelled',

  // Booking lifecycle
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_RESCHEDULED = 'booking_rescheduled',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_NO_SHOW = 'booking_no_show',

  // Reviews
  REVIEW_PROMPTED = 'review_prompted',
  REVIEW_SUBMITTED = 'review_submitted',
  REVIEW_SKIPPED = 'review_skipped',

  // Re-booking
  REBOOK_STARTED = 'rebook_started',
  REBOOK_SUCCESS = 'rebook_success',
}

// =============================================================================
// Payment Events
// =============================================================================

export enum PaymentEvent {
  // Payment methods
  PAYMENT_METHOD_ADDED = 'payment_method_added',
  PAYMENT_METHOD_REMOVED = 'payment_method_removed',
  PAYMENT_METHOD_SELECTED = 'payment_method_selected',

  // Refunds
  REFUND_REQUESTED = 'refund_requested',
  REFUND_APPROVED = 'refund_approved',
  REFUND_REJECTED = 'refund_rejected',
  REFUND_COMPLETED = 'refund_completed',

  // Wallets
  WALLET_TOP_UP = 'wallet_top_up',
  WALLET_BALANCE_CHECK = 'wallet_balance_check',
}

// =============================================================================
// Navigation Events
// =============================================================================

export enum NavigationEvent {
  SCREEN_VIEWED = 'screen_viewed',
  SCREEN_LEFT = 'screen_left',
  TAB_CHANGED = 'tab_changed',
  DEEP_LINK_OPENED = 'deep_link_opened',
  BACK_BUTTON_PRESSED = 'back_button_pressed',
}

// =============================================================================
// Notification Events
// =============================================================================

export enum NotificationEvent {
  DISPLAYED = 'notification_displayed',
  OPENED = 'notification_opened',
  ACTION_TAKEN = 'notification_action_taken',
  RATE_LIMITED = 'notification_rate_limited',
  PERMISSION_GRANTED = 'notification_permission_granted',
  PERMISSION_DENIED = 'notification_permission_denied',
}

// =============================================================================
// Performance Events
// =============================================================================

export enum PerformanceEvent {
  SCREEN_RENDER = 'screen_render',
  API_LATENCY = 'api_latency',
  API_ERROR = 'api_error',
  ANR_DETECTED = 'anr_detected',
  MEMORY_WARNING = 'memory_warning',
  CRASH_DETECTED = 'crash_detected',
  SLOW_QUERY = 'slow_query',
  OFFLINE_MODE_ENTERED = 'offline_mode_entered',
  OFFLINE_MODE_EXITED = 'offline_mode_exited',
}

// =============================================================================
// Search Events
// =============================================================================

export enum SearchEvent {
  SEARCH_PERFORMED = 'search_performed',
  SEARCH_CLEARED = 'search_cleared',
  FILTER_APPLIED = 'filter_applied',
  FILTER_REMOVED = 'filter_removed',
  SORT_CHANGED = 'sort_changed',
  RESULT_CLICKED = 'result_clicked',
  NO_RESULTS = 'no_results',
}

// =============================================================================
// Error Events
// =============================================================================

export enum ErrorEvent {
  // Authentication errors
  AUTH_ERROR = 'auth_error',
  TOKEN_EXPIRED = 'token_expired',

  // Booking errors
  BOOKING_ERROR = 'booking_error',
  BOOKING_SLOT_UNAVAILABLE = 'booking_slot_unavailable',

  // Payment errors
  PAYMENT_ERROR = 'payment_error',
  PAYMENT_DECLINED = 'payment_declined',

  // Network errors
  NETWORK_ERROR = 'network_error',
  OFFLINE_ERROR = 'offline_error',

  // Validation errors
  VALIDATION_ERROR = 'validation_error',

  // Generic errors
  UNEXPECTED_ERROR = 'unexpected_error',
}

// =============================================================================
// Type Definitions
// =============================================================================

export interface BaseEvent {
  /** Event category */
  category: EventCategory;
  /** Event name */
  name: string;
  /** Event timestamp */
  timestamp: string;
  /** Platform information */
  platform: string;
  /** App version */
  appVersion?: string;
  /** User ID if authenticated */
  userId?: string;
  /** Session ID */
  sessionId?: string;
}

export interface AuthEventData extends BaseEvent {
  category: EventCategory.AUTH;
  name: AuthEvent;
  properties?: {
    method?: 'email' | 'biometric' | 'social';
    provider?: string;
    errorType?: string;
    errorMessage?: string;
    duration?: number;
  };
}

export interface BookingEventData extends BaseEvent {
  category: EventCategory.BOOKING;
  name: BookingEvent;
  properties?: {
    providerId?: string;
    serviceId?: string;
    bookingId?: string;
    price?: number;
    currency?: string;
    addressId?: string;
    scheduledTime?: string;
    duration?: number;
    addons?: string[];
    paymentMethod?: string;
    rating?: number;
    errorType?: string;
    errorMessage?: string;
  };
}

export interface PaymentEventData extends BaseEvent {
  category: EventCategory.PAYMENT;
  name: PaymentEvent;
  properties?: {
    paymentMethod?: 'card' | 'wallet' | 'cash' | 'paypal';
    amount?: number;
    currency?: string;
    transactionId?: string;
    errorType?: string;
    errorMessage?: string;
  };
}

export interface NavigationEventData extends BaseEvent {
  category: EventCategory.NAVIGATION;
  name: NavigationEvent;
  properties?: {
    screenName?: string;
    previousScreen?: string;
    referrer?: string;
    deepLinkUrl?: string;
    tabName?: string;
  };
}

export interface NotificationEventData extends BaseEvent {
  category: EventCategory.NOTIFICATION;
  name: NotificationEvent;
  properties?: {
    notificationId?: string;
    notificationType?: string;
    actionType?: string;
    timeInApp?: number;
  };
}

export interface PerformanceEventData extends BaseEvent {
  category: EventCategory.PERFORMANCE;
  name: PerformanceEvent;
  properties?: {
    screenName?: string;
    renderTime?: number;
    apiEndpoint?: string;
    latency?: number;
    errorType?: string;
    memoryUsage?: number;
    stackTrace?: string;
  };
}

export interface SearchEventData extends BaseEvent {
  category: EventCategory.SEARCH;
  name: SearchEvent;
  properties?: {
    query?: string;
    filters?: Record<string, unknown>;
    resultCount?: number;
    serviceId?: string;
    providerId?: string;
  };
}

export interface ErrorEventData extends BaseEvent {
  category: EventCategory.ERROR;
  name: ErrorEvent;
  properties?: {
    errorType?: string;
    errorMessage?: string;
    stackTrace?: string;
    context?: string;
  };
}

export type AnalyticsEventData =
  | AuthEventData
  | BookingEventData
  | PaymentEventData
  | NavigationEventData
  | NotificationEventData
  | PerformanceEventData
  | SearchEventData
  | ErrorEventData;

// =============================================================================
// Track Functions
// =============================================================================

/**
 * Get current session ID from sessionStorage
 */
function getSessionId(): string {
  if (typeof sessionStorage === 'undefined') return '';
  let sessionId = sessionStorage.getItem('nilin_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('nilin_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Get app version from package.json or build config
 */
function getAppVersion(): string {
  // In production, this would come from the build environment
  return import.meta.env?.VITE_APP_VERSION || '1.0.0';
}

/**
 * Core track function - logs events to console and sends to analytics backend
 */
export function track<T extends AnalyticsEventData>(
  category: EventCategory,
  name: string,
  properties?: T['properties']
): void {
  const event: AnalyticsEventData = {
    category,
    name,
    timestamp: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    appVersion: getAppVersion(),
    sessionId: getSessionId(),
    properties: properties as any,
  } as T;

  // Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[Analytics] ${category}/${name}`, properties);
  }

  // In production, send to analytics backend
  // Example: Firebase Analytics, Mixpanel, Amplitude, etc.
  // sendToAnalytics(event);

  // Also dispatch to window for Sentry/custom handlers
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('analytics-event', {
        detail: event,
      })
    );
  }
}

// =============================================================================
// Convenience Track Functions
// =============================================================================

/**
 * Track authentication events
 */
export function trackAuth(
  event: AuthEvent,
  properties?: AuthEventData['properties']
): void {
  track<AuthEventData>(EventCategory.AUTH, event, properties);
}

/**
 * Track booking events
 */
export function trackBooking(
  event: BookingEvent,
  properties?: BookingEventData['properties']
): void {
  track<BookingEventData>(EventCategory.BOOKING, event, properties);
}

/**
 * Track payment events
 */
export function trackPayment(
  event: PaymentEvent,
  properties?: PaymentEventData['properties']
): void {
  track<PaymentEventData>(EventCategory.PAYMENT, event, properties);
}

/**
 * Track navigation events
 */
export function trackNavigation(
  event: NavigationEvent,
  properties?: NavigationEventData['properties']
): void {
  track<NavigationEventData>(EventCategory.NAVIGATION, event, properties);
}

/**
 * Track notification events
 */
export function trackNotification(
  event: NotificationEvent,
  properties?: NotificationEventData['properties']
): void {
  track<NotificationEventData>(EventCategory.NOTIFICATION, event, properties);
}

/**
 * Track performance events
 */
export function trackPerformance(
  event: PerformanceEvent,
  properties?: PerformanceEventData['properties']
): void {
  track<PerformanceEventData>(EventCategory.PERFORMANCE, event, properties);
}

/**
 * Track search events
 */
export function trackSearch(
  event: SearchEvent,
  properties?: SearchEventData['properties']
): void {
  track<SearchEventData>(EventCategory.SEARCH, event, properties);
}

/**
 * Track error events
 */
export function trackError(
  event: ErrorEvent,
  properties?: ErrorEventData['properties']
): void {
  track<ErrorEventData>(EventCategory.ERROR, event, properties);
}

// =============================================================================
// User Property Setters (for Firebase, Amplitude, etc.)
// =============================================================================

export interface UserProperties {
  userId?: string;
  email?: string;
  name?: string;
  role?: 'customer' | 'provider' | 'admin';
  accountStatus?: string;
  createdAt?: string;
  lastLoginAt?: string;
  preferences?: Record<string, unknown>;
}

/**
 * Set user properties for analytics platforms
 * Call this when user logs in or updates their profile
 */
export function setUserProperties(properties: UserProperties): void {
  if (import.meta.env.DEV) {
    console.log('[Analytics] User properties set:', properties);
  }

  // In production, send to analytics backend
  // Example: Amplitude.setUserProperties(properties);
  // Example: mixpanel.people.set(properties);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('analytics-user-properties', {
        detail: properties,
      })
    );
  }
}

/**
 * Clear user properties (on logout)
 */
export function clearUserProperties(): void {
  if (import.meta.env.DEV) {
    console.log('[Analytics] User properties cleared');
  }

  // In production
  // Example: Amplitude.clearUserProperties();
  // Example: mixpanel.reset();

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('analytics-user-logout', {})
    );
  }
}

// =============================================================================
// Exports
// =============================================================================

export default {
  track,
  trackAuth,
  trackBooking,
  trackPayment,
  trackNavigation,
  trackNotification,
  trackPerformance,
  trackSearch,
  trackError,
  setUserProperties,
  clearUserProperties,
  EventCategory,
  AuthEvent,
  BookingEvent,
  PaymentEvent,
  NavigationEvent,
  NotificationEvent,
  PerformanceEvent,
  SearchEvent,
  ErrorEvent,
};
