/**
 * Event Taxonomy for Analytics
 * Centralized event categories and names for tracking
 */

export const EventCategory = {
  BOOKING: 'booking',
  PAYMENT: 'payment',
  SEARCH: 'search',
  USER: 'user',
  PROVIDER: 'provider',
  SERVICE: 'service',
  AUTH: 'auth',
  NAVIGATION: 'navigation',
  PERFORMANCE: 'performance',
  ERROR: 'error',
  CONTACT: 'contact',
} as const;

export type EventCategory = typeof EventCategory[keyof typeof EventCategory];

export const PaymentEvent = {
  WALLET_TOP_UP: 'wallet_top_up',
  WALLET_WITHDRAWAL: 'wallet_withdrawal',
  WALLET_BALANCE_CHECK: 'wallet_balance_check',
  BOOKING_PAYMENT: 'booking_payment',
  REFUND: 'refund',
  COUPON_APPLIED: 'coupon_applied',
} as const;

export type PaymentEvent = typeof PaymentEvent[keyof typeof PaymentEvent];

export const BookingEvent = {
  SERVICE_BOOKED: 'service_booked',
  BOOKING_CONFIRMED: 'booking_confirmed',
  BOOKING_CANCELLED: 'booking_cancelled',
  BOOKING_COMPLETED: 'booking_completed',
  BOOKING_START: 'booking_start',
  BOOKING_STARTED: 'booking_started',
  BOOKING_REJECTED: 'booking_rejected',
  PROVIDER_SELECTED: 'provider_selected',
  TIME_SELECTED: 'time_selected',
  ADDRESS_ENTERED: 'address_entered',
  PAYMENT_STARTED: 'payment_started',
  PAYMENT_COMPLETED: 'payment_completed',
} as const;

export type BookingEvent = typeof BookingEvent[keyof typeof BookingEvent];

export const AuthEvent = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  REGISTER: 'register',
  PASSWORD_RESET: 'password_reset',
  PASSWORD_CHANGED: 'password_changed',
  EMAIL_VERIFIED: 'email_verified',
} as const;

export type AuthEvent = typeof AuthEvent[keyof typeof AuthEvent];

export const NavigationEvent = {
  PAGE_VIEW: 'page_view',
  PAGE_LEFT: 'page_left',
  SCREEN_VIEWED: 'screen_viewed',
  SCREEN_LEFT: 'screen_left',
  BACK_CLICK: 'back_click',
  TAB_SWITCH: 'tab_switch',
  SCREEN_RENDER: 'screen_render',
} as const;

export type NavigationEvent = typeof NavigationEvent[keyof typeof NavigationEvent];

export const PerformanceEvent = {
  API_LATENCY: 'api_latency',
  PAGE_LOAD: 'page_load',
  INTERACTION: 'interaction',
  SCREEN_RENDER: 'screen_render',
  SLOW_QUERY: 'slow_query',
} as const;

export type PerformanceEvent = typeof PerformanceEvent[keyof typeof PerformanceEvent];

export const SearchEvent = {
  SEARCH_QUERY: 'search_query',
  SEARCH_RESULT_CLICK: 'search_result_click',
  FILTER_APPLIED: 'filter_applied',
  SORT_CHANGED: 'sort_changed',
} as const;

export type SearchEvent = typeof SearchEvent[keyof typeof SearchEvent];

export const ErrorEvent = {
  ERROR: 'error',
  EXCEPTION: 'exception',
} as const;

export type ErrorEvent = typeof ErrorEvent[keyof typeof ErrorEvent];

export const ContactEvent = {
  PAGE_VIEWED: 'contact_page_viewed',
  FORM_STARTED: 'form_started',
  EMAIL_CLICKED: 'email_clicked',
  PHONE_CLICKED: 'phone_clicked',
  CHAT_OPENED: 'chat_opened',
  SOCIAL_CLICKED: 'social_clicked',
  MAPS_CLICKED: 'maps_clicked',
  INQUIRY_SUBMITTED: 'inquiry_submitted',
  SUPPORT_REQUEST: 'support_request',
  FEEDBACK_SUBMITTED: 'feedback_submitted',
  COMPLAINT_RAISED: 'complaint_raised',
  FORM_SUBMITTED: 'form_submitted',
  FORM_ERROR: 'form_error',
  CHAT_STARTED: 'chat_started',
  CHAT_ENDED: 'chat_ended',
  SUPPORT_TAB_CHANGED: 'support_tab_changed',
} as const;

export type ContactEvent = typeof ContactEvent[keyof typeof ContactEvent];

// User properties storage
export interface UserProperties {
  userId?: string;
  userType?: string;
  [key: string]: unknown;
}

let userProperties: UserProperties = {};

/**
 * Track an analytics event
 */
export function track(
  category: string,
  event: string,
  metadata?: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Analytics] ${category}:${event}`, metadata);
  }
}

/**
 * Track auth event
 */
export function trackAuth(event: string, metadata?: Record<string, unknown>): void {
  track(EventCategory.AUTH, event, metadata);
}

/**
 * Track booking event
 */
export function trackBooking(event: string, metadata?: Record<string, unknown>): void {
  track(EventCategory.BOOKING, event, metadata);
}

/**
 * Track payment event
 */
export function trackPayment(event: string, metadata?: Record<string, unknown>): void {
  track(EventCategory.PAYMENT, event, metadata);
}

/**
 * Track navigation event
 */
export function trackNavigation(event: string, metadata?: Record<string, unknown>): void {
  track(EventCategory.NAVIGATION, event, metadata);
}

/**
 * Track performance event
 */
export function trackPerformance(event: string, metadata?: Record<string, unknown>): void {
  track(EventCategory.PERFORMANCE, event, metadata);
}

/**
 * Track search event
 */
export function trackSearch(event: string, metadata?: Record<string, unknown>): void {
  track(EventCategory.SEARCH, event, metadata);
}

/**
 * Track error event
 */
export function trackError(error: Error, metadata?: Record<string, unknown>): void {
  track(EventCategory.ERROR, ErrorEvent.EXCEPTION, {
    error_message: error.message,
    error_name: error.name,
    ...metadata,
  });
}

/**
 * Set user properties for analytics
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  userProperties = { ...userProperties, ...properties };
}

/**
 * Clear user properties
 */
export function clearUserProperties(): void {
  userProperties = {};
}

/**
 * Get current user properties
 */
export function getUserProperties(): Record<string, unknown> {
  return { ...userProperties };
}

export default {
  EventCategory,
  PaymentEvent,
  BookingEvent,
  AuthEvent,
  NavigationEvent,
  PerformanceEvent,
  SearchEvent,
  ErrorEvent,
  ContactEvent,
  track,
  trackAuth,
  trackBooking,
  trackPayment,
  trackNavigation,
  trackPerformance,
  trackSearch,
  trackError,
  setUserProperties,
  clearUserProperties,
  getUserProperties,
};
