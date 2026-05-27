// AI Event Tracker - Frontend ML event tracking for feature pipelines
import axios from 'axios';
import { API_BASE_URL } from '../../config/api';
import { useAuthStore } from '../../stores/authStore';

const getAuthHeader = () => {
  const token = useAuthStore.getState().tokens?.accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Types
export type AIEventType =
  | 'booking.created'
  | 'booking.confirmed'
  | 'booking.completed'
  | 'booking.cancelled'
  | 'booking.rated'
  | 'user.registered'
  | 'user.login'
  | 'user.session_started'
  | 'user.session_ended'
  | 'service.viewed'
  | 'service.searched'
  | 'provider.viewed'
  | 'provider.booked'
  | 'wallet.debited'
  | 'wallet.refunded'
  | 'payment.failed'
  | 'notification.sent'
  | 'notification.opened'
  | 'notification.clicked'
  | 'search.query'
  | 'cart.added'
  | 'favorite.added'
  | 'favorite.removed';

export interface EventContext {
  deviceType: string;
  platform: 'ios' | 'android' | 'web';
  sessionId: string;
  page?: string;
  referrer?: string;
  location?: { lat: number; lng: number };
  userAgent?: string;
}

export interface TrackingEvent {
  type: AIEventType;
  timestamp?: string;
  userId?: string;
  providerId?: string;
  serviceId?: string;
  bookingId?: string;
  properties?: Record<string, any>;
  context?: EventContext;
}

// Session management
let currentSessionId: string | null = null;
let sessionStartTime: Date | null = null;

function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function getPlatform(): 'ios' | 'android' | 'web' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

function getDefaultContext(): EventContext {
  return {
    deviceType: getDeviceType(),
    platform: getPlatform(),
    sessionId: currentSessionId || generateSessionId(),
    page: window.location.pathname,
    userAgent: navigator.userAgent,
  };
}

// Event queue for batching
let eventQueue: TrackingEvent[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 5000; // 5 seconds
const MAX_BATCH_SIZE = 50;

// Start session
export function startSession(): string {
  currentSessionId = generateSessionId();
  sessionStartTime = new Date();

  track('user.session_started', {
    sessionId: currentSessionId,
    sessionStart: sessionStartTime.toISOString(),
  });

  return currentSessionId;
}

// End session
export function endSession(): void {
  if (currentSessionId && sessionStartTime) {
    const duration = Date.now() - sessionStartTime.getTime();

    track('user.session_ended', {
      sessionId: currentSessionId,
      duration,
    });
  }

  currentSessionId = null;
  sessionStartTime = null;
}

// Get current session ID
export function getSessionId(): string | null {
  return currentSessionId;
}

// Track event
export function track(type: AIEventType, properties?: Record<string, any>): void {
  const event: TrackingEvent = {
    type,
    timestamp: new Date().toISOString(),
    userId: useAuthStore.getState().user?._id,
    properties,
    context: getDefaultContext(),
  };

  eventQueue.push(event);

  // Flush if queue is full
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flush();
  } else if (!flushTimeout) {
    // Set timeout to flush
    flushTimeout = setTimeout(flush, FLUSH_INTERVAL);
  }
}

// Flush events to server
async function flush(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (eventQueue.length === 0) return;

  const events = [...eventQueue];
  eventQueue = [];

  try {
    await axios.post(`${API_BASE_URL}/ai/events`, { events }, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    // Re-add events to queue on failure
    eventQueue.unshift(...events);
    console.error('Failed to track events:', error);
  }
}

// Convenience tracking functions
export const trackEvent = {
  // Booking events
  bookingCreated: (bookingId: string, serviceId: string, providerId: string, properties: Record<string, any> = {}) => {
    track('booking.created', {
      bookingId,
      serviceId,
      providerId,
      ...properties,
    });
  },

  bookingCompleted: (bookingId: string, serviceId: string, providerId: string, properties: Record<string, any> = {}) => {
    track('booking.completed', {
      bookingId,
      serviceId,
      providerId,
      ...properties,
    });
  },

  bookingCancelled: (bookingId: string, reason?: string) => {
    track('booking.cancelled', { bookingId, reason });
  },

  bookingRated: (bookingId: string, rating: number, comment?: string) => {
    track('booking.rated', { bookingId, rating, comment });
  },

  // Service events
  serviceViewed: (serviceId: string, categoryId?: string, source?: string) => {
    track('service.viewed', { serviceId, categoryId, source });
  },

  serviceSearched: (query: string, filters?: Record<string, any>, resultsCount?: number) => {
    track('service.searched', { query, filters, resultsCount });
  },

  // Provider events
  providerViewed: (providerId: string, serviceId?: string) => {
    track('provider.viewed', { providerId, serviceId });
  },

  providerBooked: (providerId: string, serviceId: string, bookingId: string) => {
    track('provider.booked', { providerId, serviceId, bookingId });
  },

  // Engagement events
  notificationOpened: (notificationId: string, notificationType: string) => {
    track('notification.opened', { notificationId, notificationType });
  },

  notificationClicked: (notificationId: string, notificationType: string, action: string) => {
    track('notification.clicked', { notificationId, notificationType, action });
  },

  favoriteAdded: (serviceId: string, categoryId?: string) => {
    track('favorite.added', { serviceId, categoryId });
  },

  favoriteRemoved: (serviceId: string) => {
    track('favorite.removed', { serviceId });
  },

  // Payment events
  walletDebited: (amount: number, reason: string, bookingId?: string) => {
    track('wallet.debited', { amount, reason, bookingId });
  },

  walletRefunded: (amount: number, reason: string, bookingId?: string) => {
    track('wallet.refunded', { amount, reason, bookingId });
  },

  paymentFailed: (amount: number, method: string, errorCode?: string) => {
    track('payment.failed', { amount, method, errorCode });
  },
};

// Initialize session on module load
if (typeof window !== 'undefined') {
  // Start session when page loads
  startSession();

  // End session when page unloads
  window.addEventListener('beforeunload', () => {
    endSession();
    flush(); // Synchronous flush attempt
  });

  // Handle visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flush();
    } else if (document.visibilityState === 'visible' && !currentSessionId) {
      startSession();
    }
  });
}

export default {
  track,
  trackEvent,
  startSession,
  endSession,
  getSessionId,
};
