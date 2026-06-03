// =============================================================================
// NILIN Beauty Marketplace — Booking Constants
// Centralized constants for booking-related values
// =============================================================================

/**
 * Cancellation reasons used when a booking is cancelled.
 * These values must match the backend enum in refund.service.ts
 */
export const CANCELLATION_REASONS = {
  CUSTOMER_REQUEST: 'customer_request',
  PROVIDER_CANCELLATION: 'provider_cancellation',
  NO_SHOW: 'no_show',
  RESCHEDULE: 'reschedule',
  SERVICE_NOT_AVAILABLE: 'service_not_available',
  OTHER: 'other',
} as const;

export type CancellationReason = typeof CANCELLATION_REASONS[keyof typeof CANCELLATION_REASONS];

/**
 * Human-readable labels for cancellation reasons (for display purposes)
 */
export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  [CANCELLATION_REASONS.CUSTOMER_REQUEST]: 'Customer Request',
  [CANCELLATION_REASONS.PROVIDER_CANCELLATION]: 'Provider Cancellation',
  [CANCELLATION_REASONS.NO_SHOW]: 'No Show',
  [CANCELLATION_REASONS.RESCHEDULE]: 'Reschedule',
  [CANCELLATION_REASONS.SERVICE_NOT_AVAILABLE]: 'Service Not Available',
  [CANCELLATION_REASONS.OTHER]: 'Other',
};
