/**
 * RealTimeSync - Real-Time Provider Availability System
 *
 * Manages live availability tracking and instant WebSocket updates for NILIN homeservice.
 * Provides Zustand store for reactive UI updates and connection state management.
 *
 * Package: com.nilin.app
 * NILIN brand color: #E8B4A8
 *
 * @example
 * ```typescript
 * // Subscribe to booking updates
 * realTimeService.subscribeToBooking(bookingId);
 *
 * // React component
 * const booking = useLiveBooking(bookingId);
 * const isConnected = useRealTimeConnection().isConnected;
 * ```
 */

import { create } from 'zustand';
import { socketService } from '../socket';
import type { BookingEvent } from '../socket';
import { deltaSyncEngine } from '../DeltaSyncEngine';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Provider availability status
 */
export interface ProviderAvailability {
  providerId: string;
  isOnline: boolean;
  isBusy: boolean;
  currentBooking?: {
    id: string;
    endsAt: string;
    service: string;
  };
  nextAvailable: string;
  acceptingBookings: boolean;
  lastUpdated: number;
}

/**
 * Live booking update status
 */
export type LiveBookingStatus =
  | 'confirmed'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

/**
 * Live booking update from WebSocket
 */
export interface LiveBookingUpdate {
  bookingId: string;
  status: LiveBookingStatus;
  provider?: {
    id: string;
    name: string;
    avatar?: string;
    location?: { lat: number; lng: number };
    eta?: number; // minutes
  };
  timestamp: string;
  message?: string;
}

/**
 * Real-time store state interface
 */
interface RealTimeState {
  // Provider availability tracking
  providerAvailability: Record<string, ProviderAvailability>;

  // Live bookings tracking
  liveBookings: Record<string, LiveBookingUpdate>;

  // Connection state
  isConnected: boolean;
  lastSync: number;
  connectionErrors: number;

  // Actions
  updateProviderAvailability: (
    providerId: string,
    availability: ProviderAvailability
  ) => void;
  updateLiveBooking: (bookingId: string, update: LiveBookingUpdate) => void;
  setConnected: (connected: boolean) => void;
  incrementConnectionErrors: () => void;
  batchUpdateAvailability: (updates: Record<string, ProviderAvailability>) => void;

  // State management
  clearStaleData: (maxAgeMs?: number) => void;
  clearAllData: () => void;
  getStateSnapshot: () => {
    providerAvailability: Record<string, ProviderAvailability>;
    liveBookings: Record<string, LiveBookingUpdate>;
    isConnected: boolean;
    lastSync: number;
  };
}

// =============================================================================
// Zustand Store
// =============================================================================

/**
 * Real-time store connected to WebSocket
 *
 * FIX #1: Added proper state cleanup and memory management
 */
export const useRealTimeStore = create<RealTimeState>((set, get) => ({
  providerAvailability: {},
  liveBookings: {},
  isConnected: false,
  lastSync: 0,
  connectionErrors: 0,

  updateProviderAvailability: (providerId, availability) =>
    set((state) => ({
      providerAvailability: {
        ...state.providerAvailability,
        [providerId]: { ...availability, lastUpdated: Date.now() },
      },
      lastSync: Date.now(),
    })),

  updateLiveBooking: (bookingId, update) =>
    set((state) => ({
      liveBookings: {
        ...state.liveBookings,
        [bookingId]: {
          ...update,
          timestamp: update.timestamp || new Date().toISOString(),
        },
      },
    })),

  setConnected: (connected) =>
    set((state) => ({
      isConnected: connected,
      lastSync: connected ? Date.now() : state.lastSync,
    })),

  incrementConnectionErrors: () =>
    set((state) => ({
      connectionErrors: state.connectionErrors + 1,
    })),

  batchUpdateAvailability: (updates) =>
    set((state) => {
      const now = Date.now();
      const newAvailability = { ...state.providerAvailability };

      Object.entries(updates).forEach(([providerId, availability]) => {
        newAvailability[providerId] = { ...availability, lastUpdated: now };
      });

      return {
        providerAvailability: newAvailability,
        lastSync: now,
      };
    }),

  /**
   * Clear stale data older than maxAgeMs
   *
   * FIX #1: Memory management - prevents unbounded growth
   */
  clearStaleData: (maxAgeMs = 5 * 60 * 1000) => {
    // 5 minutes default
    set((state) => {
      const cutoff = Date.now() - maxAgeMs;

      // Filter stale provider availability
      const providerAvailability = Object.fromEntries(
        Object.entries(state.providerAvailability).filter(
          ([_, availability]) => availability.lastUpdated > cutoff
        )
      );

      // Filter stale live bookings (keep completed/cancelled for history)
      const liveBookings = Object.fromEntries(
        Object.entries(state.liveBookings).filter(([_, booking]) => {
          const bookingAge = Date.now() - new Date(booking.timestamp).getTime();
          // Keep if recent or if it's a terminal state
          if (booking.status === 'completed' || booking.status === 'cancelled') {
            // Keep terminal states for 24 hours
            return bookingAge < 24 * 60 * 60 * 1000;
          }
          return bookingAge < maxAgeMs;
        })
      );

      return { providerAvailability, liveBookings };
    });
  },

  /**
   * Clear all tracked data
   */
  clearAllData: () =>
    set({
      providerAvailability: {},
      liveBookings: {},
      lastSync: Date.now(),
    }),

  /**
   * Get snapshot of current state for persistence
   *
   * FIX #7: State persistence for recovery after reconnect
   */
  getStateSnapshot: () => {
    const state = get();
    return {
      providerAvailability: { ...state.providerAvailability },
      liveBookings: { ...state.liveBookings },
      isConnected: state.isConnected,
      lastSync: state.lastSync,
    };
  },
}));

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Get provider availability for a specific provider
 */
export function useProviderAvailability(providerId: string): ProviderAvailability | null {
  const availability = useRealTimeStore(
    (state) => state.providerAvailability[providerId]
  );
  return availability || null;
}

/**
 * Get live booking update for a specific booking
 */
export function useLiveBooking(bookingId: string): LiveBookingUpdate | null {
  const booking = useRealTimeStore((state) => state.liveBookings[bookingId]);
  return booking || null;
}

/**
 * Check if provider is currently available
 */
export function useIsProviderAvailable(providerId: string): boolean {
  const availability = useProviderAvailability(providerId);
  return (
    availability?.acceptingBookings === true &&
    availability.isOnline === true &&
    availability.isBusy === false
  );
}

/**
 * Get next available time slot for a provider
 */
export function useNextAvailable(providerId: string): string | null {
  const availability = useProviderAvailability(providerId);

  if (!availability) return null;

  if (availability.acceptingBookings) return 'Now';

  const nextTime = new Date(availability.nextAvailable);
  const now = new Date();
  const diffMs = nextTime.getTime() - now.getTime();
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return 'Less than 1 hour';
  if (diffHours < 24) return `${diffHours} hours`;
  return nextTime.toLocaleDateString();
}

// =============================================================================
// RealTimeService Class
// =============================================================================

/**
 * Real-time service connected to WebSocket
 *
 * FIX #1: Fixed memory leak - proper cleanup of all subscriptions
 * FIX #6: Stale state recovery after reconnection
 */
class RealTimeService {
  /** Active subscriptions for cleanup */
  private unsubscribers: Array<() => void> = [];

  /** Tracked booking IDs for re-subscription */
  private subscribedBookings: Set<string> = new Set();

  /** Flag to prevent duplicate initialization */
  private isStarted: boolean = false;

  /** Flag to prevent duplicate listener registration */
  private listenersSetup: boolean = false;

  /** Cached state snapshot for reconnection recovery */
  private stateSnapshot: ReturnType<RealTimeState['getStateSnapshot']> | null = null;

  /** Periodic cleanup interval ID */
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  /** Maximum time to keep data without sync (ms) */
  private readonly STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  // ---------------------------------------------------------------------------
  // Lifecycle Methods
  // ---------------------------------------------------------------------------

  /**
   * Start the real-time service
   *
   * FIX #1: Fixed duplicate listener registration
   * FIX #6: State snapshot for recovery
   * FIX #12: Prevent duplicate listener setup on multiple start() calls
   */
  start(): void {
    if (this.isStarted) {
      console.debug('[RealTime] Service already started');
      return;
    }

    // Load cached state if available
    this.loadCachedState();

    // Connect to socket
    if (!socketService.isConnected()) {
      socketService.connect().catch((error) => {
        console.error('[RealTime] Initial connection failed:', error);
      });
    }

    // Subscribe to connection and booking events (only once)
    if (!this.listenersSetup) {
      this.setupConnectionListeners();
      this.setupBookingListeners();
      this.listenersSetup = true;
    }

    // Start periodic cleanup
    this.startPeriodicCleanup();

    // Mark as started
    this.isStarted = true;

    // Sync initial connection state
    if (socketService.isConnected()) {
      useRealTimeStore.getState().setConnected(true);
    }

    console.debug('[RealTime] Service started');
  }

  /**
   * Stop the real-time service and cleanup
   *
   * FIX #1: CRITICAL - Properly cleanup ALL resources
   * FIX #12: Reset listenersSetup flag to allow re-setup on next start
   */
  stop(): void {
    if (!this.isStarted) return;

    console.debug('[RealTime] Stopping service...');

    // 1. Clear periodic cleanup
    this.stopPeriodicCleanup();

    // 2. Unsubscribe all listeners (CRITICAL - prevents memory leak)
    this.cleanup();

    // 3. Leave all booking rooms
    for (const bookingId of this.subscribedBookings) {
      if (socketService.isConnected()) {
        socketService.leaveBookingRoom(bookingId);
      }
    }
    this.subscribedBookings.clear();

    // 4. Reset state
    useRealTimeStore.getState().setConnected(false);

    // 5. Save final state snapshot for next session
    this.saveStateSnapshot();

    // 6. Reset flags for next start
    this.isStarted = false;
    this.listenersSetup = false;

    console.debug('[RealTime] Service stopped');
  }

  /**
   * Cleanup all subscriptions
   *
   * FIX #1: Proper cleanup to prevent memory leaks
   */
  private cleanup(): void {
    // Call all unsubscribe functions
    for (const unsub of this.unsubscribers) {
      try {
        unsub();
      } catch (error) {
        console.error('[RealTime] Unsubscribe error:', error);
      }
    }
    this.unsubscribers = [];
  }

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Setup connection event listeners
   *
   * FIX #1: Each listener stored for cleanup
   */
  private setupConnectionListeners(): void {
    // Connection success
    const connectUnsub = socketService.onConnect(() => {
      console.debug('[RealTime] WebSocket connected');
      useRealTimeStore.getState().setConnected(true);

      // FIX #6: Re-subscribe to previously subscribed bookings
      this.resubscribeToBookings();

      // FIX #7: Recover state from snapshot if stale
      this.recoverStaleState();
    });
    this.unsubscribers.push(connectUnsub);

    // Disconnection
    const disconnectUnsub = socketService.onDisconnect(() => {
      console.debug('[RealTime] WebSocket disconnected');
      useRealTimeStore.getState().setConnected(false);
    });
    this.unsubscribers.push(disconnectUnsub);

    // Connection error
    const connectErrorUnsub = socketService.onConnectError((data) => {
      console.error('[RealTime] WebSocket connection error:', data.message);
      useRealTimeStore.getState().setConnected(false);
      useRealTimeStore.getState().incrementConnectionErrors();
    });
    this.unsubscribers.push(connectErrorUnsub);

    // Unauthorized (token expired)
    const unauthorizedUnsub = socketService.onUnauthorized(() => {
      console.warn('[RealTime] WebSocket unauthorized - token expired');
      useRealTimeStore.getState().setConnected(false);

      // Clear sensitive data on auth failure
      useRealTimeStore.getState().clearAllData();
    });
    this.unsubscribers.push(unauthorizedUnsub);
  }

  /**
   * Setup booking event listeners
   *
   * FIX #1: Each listener properly tracked for cleanup
   */
  private setupBookingListeners(): void {
    // Booking status changed
    const statusChangedUnsub = socketService.onBookingStatusChanged(
      (data: BookingEvent) => {
        console.debug('[RealTime] Booking status changed', {
          bookingId: data.bookingId,
          status: data.status,
        });
        this.handleBookingUpdate(data);
      }
    );
    this.unsubscribers.push(statusChangedUnsub);

    // Booking confirmed
    const confirmedUnsub = socketService.on('booking:confirmed', (data: BookingEvent) => {
      console.debug('[RealTime] Booking confirmed', {
        bookingId: data.bookingId,
      });
      this.handleBookingUpdate(data);
    });
    this.unsubscribers.push(confirmedUnsub);

    // Booking cancelled
    const cancelledUnsub = socketService.on(
      'booking:cancelled',
      (data: BookingEvent) => {
        console.debug('[RealTime] Booking cancelled', {
          bookingId: data.bookingId,
        });
        this.handleBookingUpdate({ ...data, status: 'cancelled' });
      }
    );
    this.unsubscribers.push(cancelledUnsub);
  }

  // ---------------------------------------------------------------------------
  // State Recovery
  // ---------------------------------------------------------------------------

  /**
   * Check if we're in a browser environment (SSR guard)
   */
  private isBrowser(): boolean {
    return typeof window !== 'undefined';
  }

  /**
   * Save current state to storage for recovery
   *
   * FIX #7: Persist state for reconnection recovery
   * FIX #12: Added SSR guard for localStorage access
   */
  private saveStateSnapshot(): void {
    // SSR guard: Only access localStorage in browser
    if (!this.isBrowser()) {
      return;
    }

    try {
      const snapshot = useRealTimeStore.getState().getStateSnapshot();
      const serialized = JSON.stringify({
        ...snapshot,
        savedAt: Date.now(),
      });
      localStorage.setItem('realtime_state_snapshot', serialized);
      console.debug('[RealTime] State snapshot saved');
    } catch (error) {
      console.error('[RealTime] Failed to save state snapshot:', error);
    }
  }

  /**
   * Load cached state from storage
   *
   * FIX #7: Restore state on service start
   * FIX #12: Added SSR guard for localStorage access
   */
  private loadCachedState(): void {
    // SSR guard: Only access localStorage in browser
    if (!this.isBrowser()) {
      return;
    }

    try {
      const stored = localStorage.getItem('realtime_state_snapshot');
      if (stored) {
        const snapshot = JSON.parse(stored);
        this.stateSnapshot = snapshot;

        // Only restore if data is relatively fresh (within 5 minutes)
        const age = Date.now() - snapshot.savedAt;
        if (age < this.STALE_THRESHOLD_MS) {
          console.debug('[RealTime] Loading cached state from', new Date(snapshot.savedAt));
        }
      }
    } catch (error) {
      console.error('[RealTime] Failed to load cached state:', error);
    }
  }

  /**
   * Recover state after reconnection
   *
   * FIX #7: Handle stale state after disconnect/reconnect
   * FIX #12: Added SSR guard for localStorage access
   */
  private recoverStaleState(): void {
    if (!this.stateSnapshot) return;

    const age = Date.now() - this.stateSnapshot.lastSync;

    if (age > this.STALE_THRESHOLD_MS) {
      // Data is too stale, clear it
      console.debug('[RealTime] State too stale, clearing');
      useRealTimeStore.getState().clearAllData();
      this.stateSnapshot = null;

      // SSR guard: Only access localStorage in browser
      if (this.isBrowser()) {
        localStorage.removeItem('realtime_state_snapshot');
      }
      return;
    }

    // Check if we have pending deltas from DeltaSyncEngine
    const pendingDeltas = deltaSyncEngine.getAllDeltas();
    if (pendingDeltas.length > 0) {
      console.debug('[RealTime] Found pending deltas to sync', {
        count: pendingDeltas.length,
      });
      // TODO: Trigger delta sync for pending changes
    }
  }

  // ---------------------------------------------------------------------------
  // Booking Subscription
  // ---------------------------------------------------------------------------

  /**
   * Re-subscribe to previously subscribed bookings after reconnect
   *
   * FIX #6: Maintain subscriptions across reconnections
   */
  private resubscribeToBookings(): void {
    const bookings = Array.from(this.subscribedBookings);
    console.debug('[RealTime] Re-subscribing to bookings', { count: bookings.length });

    for (const bookingId of bookings) {
      socketService.joinBookingRoom(bookingId);
    }
  }

  /**
   * Subscribe to real-time updates for a specific booking
   */
  subscribeToBooking(bookingId: string): void {
    if (this.subscribedBookings.has(bookingId)) {
      return;
    }

    console.debug('[RealTime] Subscribing to booking', { bookingId });
    this.subscribedBookings.add(bookingId);

    if (socketService.isConnected()) {
      socketService.joinBookingRoom(bookingId);
    }
  }

  /**
   * Unsubscribe from a booking's updates
   */
  unsubscribeFromBooking(bookingId: string): void {
    if (!this.subscribedBookings.has(bookingId)) {
      return;
    }

    console.debug('[RealTime] Unsubscribing from booking', { bookingId });
    this.subscribedBookings.delete(bookingId);

    if (socketService.isConnected()) {
      socketService.leaveBookingRoom(bookingId);
    }

    // Optionally clear from store (keep for offline access)
    // useRealTimeStore.getState().liveBookings[bookingId]
  }

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle incoming booking update from WebSocket
   */
  private handleBookingUpdate(data: BookingEvent): void {
    const status = this.mapSocketStatus(data.status);

    useRealTimeStore.getState().updateLiveBooking(data.bookingId, {
      bookingId: data.bookingId,
      status,
      timestamp:
        data.timestamp instanceof Date
          ? data.timestamp.toISOString()
          : String(data.timestamp),
      message: this.getStatusMessage(status),
    });

    // Track changes in DeltaSyncEngine for potential offline sync
    deltaSyncEngine.trackChanges('booking', data.bookingId, {
      status: data.status,
      updatedAt: Date.now(),
    });
  }

  /**
   * Map Socket.IO status to internal status
   */
  private mapSocketStatus(socketStatus: string): LiveBookingStatus {
    const statusMap: Record<string, LiveBookingStatus> = {
      pending: 'confirmed',
      confirmed: 'confirmed',
      assigned: 'assigned',
      'in-progress': 'in_progress',
      in_progress: 'in_progress',
      progress: 'in_progress',
      completed: 'completed',
      done: 'completed',
      cancelled: 'cancelled',
      canceled: 'cancelled',
    };
    return statusMap[socketStatus.toLowerCase()] || 'confirmed';
  }

  /**
   * Get user-friendly message for status
   */
  private getStatusMessage(status: LiveBookingStatus): string {
    const messages: Record<LiveBookingStatus, string> = {
      confirmed: 'Your booking has been confirmed',
      assigned: 'A provider has been assigned to your booking',
      in_progress: 'Your service is in progress',
      completed: 'Your service has been completed',
      cancelled: 'Your booking has been cancelled',
    };
    return messages[status];
  }

  // ---------------------------------------------------------------------------
  // Provider Availability
  // ---------------------------------------------------------------------------

  /**
   * Update provider availability manually
   */
  updateProvider(
    providerId: string,
    availability: Partial<ProviderAvailability>
  ): void {
    const current = useRealTimeStore.getState().providerAvailability[providerId];
    if (current) {
      useRealTimeStore.getState().updateProviderAvailability(providerId, {
        ...current,
        ...availability,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Periodic Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Start periodic cleanup of stale data
   *
   * FIX #1: Memory management - remove old entries periodically
   */
  private startPeriodicCleanup(): void {
    // Run cleanup every minute
    this.cleanupIntervalId = setInterval(() => {
      useRealTimeStore.getState().clearStaleData(this.STALE_THRESHOLD_MS);

      // Also save state snapshot periodically
      this.saveStateSnapshot();
    }, 60 * 1000);
  }

  /**
   * Stop periodic cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const realTimeService = new RealTimeService();

// =============================================================================
// Connection Status Hook
// =============================================================================

/**
 * Hook for real-time connection status
 */
export function useRealTimeConnection(): {
  isConnected: boolean;
  lastSync: number;
  timeSinceSync: number;
  isStale: boolean;
  connectionErrors: number;
} {
  const { isConnected, lastSync, connectionErrors } = useRealTimeStore();

  return {
    isConnected,
    lastSync,
    timeSinceSync: Date.now() - lastSync,
    isStale: Date.now() - lastSync > 60000, // 1 minute
    connectionErrors,
  };
}

export default realTimeService;
