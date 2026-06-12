/**
 * Timeline Utilities for NILIN Marketplace
 *
 * Shared timeline building functions for consistent booking timeline
 * display across the platform.
 *
 * @module utils/timeline
 */

import type { Booking } from '../types/booking.types';

/**
 * Timeline event structure
 */
export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: Date;
  status: 'completed' | 'current' | 'pending' | 'cancelled';
  actor?: {
    name: string;
    type: 'customer' | 'provider' | 'system';
  };
  icon?: string;
}

/**
 * Status title mapping
 */
const STATUS_TITLES: Record<string, string> = {
  created: 'Booking Created',
  pending: 'Pending Confirmation',
  confirmed: 'Booking Confirmed',
  in_progress: 'Service Started',
  completed: 'Service Completed',
  cancelled: 'Booking Cancelled',
  disputed: 'Disputed',
};

/**
 * Status icon mapping
 */
const STATUS_ICONS: Record<string, string> = {
  created: '📋',
  pending: '⏳',
  confirmed: '✅',
  in_progress: '🔧',
  completed: '🎉',
  cancelled: '❌',
  disputed: '⚠️',
};

/**
 * Determine actor type from status history entry
 */
function determineActorType(historyEntry: {
  updatedBy?: string;
  updatedByType?: 'customer' | 'provider' | 'admin' | 'system';
}): 'customer' | 'provider' | 'system' {
  if (historyEntry.updatedByType === 'customer') return 'customer';
  if (historyEntry.updatedByType === 'provider') return 'provider';
  if (historyEntry.updatedByType === 'admin' || historyEntry.updatedByType === 'system') return 'system';
  return 'system';
}

/**
 * Build timeline events from booking data
 *
 * Uses statusHistory as primary source when available, falls back to
 * individual timestamp fields for backward compatibility.
 *
 * @param booking - The booking object
 * @returns Array of timeline events sorted by timestamp
 *
 * @example
 * const events = buildBookingTimeline(booking);
 * // Returns: [{ id: 'created', title: 'Booking Created', ... }, ...]
 */
export function buildBookingTimeline(booking: Booking): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // 1. Booking Created (always first)
  events.push({
    id: 'created',
    title: STATUS_TITLES['created'] || 'Booking Created',
    description: `Booking #${booking.bookingNumber}`,
    timestamp: new Date(booking.createdAt),
    status: 'completed',
    actor: { name: 'Customer', type: 'customer' },
    icon: STATUS_ICONS['created'],
  });

  // 2. Use statusHistory if available (preferred)
  if (booking.statusHistory && booking.statusHistory.length > 0) {
    for (const history of booking.statusHistory) {
      // Skip 'created' status as we already added it
      if (history.status === 'created') continue;

      // Determine status for display
      let displayStatus: TimelineEvent['status'] = 'completed';
      if (history.status === booking.status) {
        displayStatus = 'current';
      } else if (history.status === 'cancelled') {
        displayStatus = 'cancelled';
      } else if (new Date(history.timestamp) > new Date()) {
        displayStatus = 'pending';
      }

      events.push({
        id: history.status,
        title: STATUS_TITLES[history.status] || history.status,
        description: history.notes,
        timestamp: new Date(history.timestamp),
        status: displayStatus,
        actor: history.updatedBy
          ? {
              name: history.updatedBy,
              type: determineActorType(history as any),
            }
          : undefined,
        icon: STATUS_ICONS[history.status],
      });
    }
  } else {
    // Fallback: Use individual timestamp fields (backward compatibility)

    // Confirmed status
    if (booking.confirmedAt) {
      const isCompleted = booking.status !== 'confirmed' && booking.status !== 'in_progress';
      events.push({
        id: 'confirmed',
        title: STATUS_TITLES['confirmed'] || 'Booking Confirmed',
        description: 'Provider has confirmed your booking',
        timestamp: new Date(booking.confirmedAt),
        status: isCompleted ? 'completed' : 'current',
        icon: STATUS_ICONS['confirmed'],
      });
    }

    // In Progress status
    if (booking.startedAt) {
      const isCompleted = booking.status === 'completed';
      events.push({
        id: 'in_progress',
        title: STATUS_TITLES['in_progress'] || 'Service Started',
        description: 'Provider has started the service',
        timestamp: new Date(booking.startedAt),
        status: isCompleted ? 'completed' : 'current',
        icon: STATUS_ICONS['in_progress'],
      });
    }

    // Completed status
    if (booking.completedAt) {
      events.push({
        id: 'completed',
        title: STATUS_TITLES['completed'] || 'Service Completed',
        description: 'Service has been completed successfully',
        timestamp: new Date(booking.completedAt),
        status: 'completed',
        icon: STATUS_ICONS['completed'],
      });
    }

    // Cancelled status
    if (booking.cancelledAt) {
      events.push({
        id: 'cancelled',
        title: STATUS_TITLES['cancelled'] || 'Booking Cancelled',
        description: booking.cancellationReason || 'Booking was cancelled',
        timestamp: new Date(booking.cancelledAt),
        status: 'cancelled',
        icon: STATUS_ICONS['cancelled'],
      });
    }
  }

  // Sort by timestamp ascending
  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

/**
 * Format status for display
 *
 * @param status - Raw status string
 * @returns Human-readable status title
 */
export function formatStatusTitle(status: string): string {
  return STATUS_TITLES[status] || status;
}

/**
 * Get icon for status
 *
 * @param status - Raw status string
 * @returns Emoji icon for the status
 */
export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] || '📋';
}

// =============================================================================
// Exports
// =============================================================================

export const timeline = {
  build: buildBookingTimeline,
  formatStatusTitle,
  getStatusIcon,
};

export default timeline;
