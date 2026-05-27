// Real-Time Provider Availability System
// Live availability tracking and instant WebSocket updates

import { create } from 'zustand';
import { socketService } from '../SocketService';
import { BookingEvent } from '../SocketService';
import logger from '../../lib/logger';

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

export interface LiveBookingUpdate {
  bookingId: string;
  status: 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
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

interface RealTimeState {
  // Provider availability
  providerAvailability: Record<string, ProviderAvailability>;
  liveBookings: Record<string, LiveBookingUpdate>;

  // Connection state
  isConnected: boolean;
  lastSync: number;

  // Actions
  updateProviderAvailability: (providerId: string, availability: ProviderAvailability) => void;
  updateLiveBooking: (bookingId: string, update: LiveBookingUpdate) => void;
  setConnected: (connected: boolean) => void;
  batchUpdateAvailability: (updates: Record<string, ProviderAvailability>) => void;
}

// Real-time store connected to WebSocket
export const useRealTimeStore = create<RealTimeState>((set) => ({
  providerAvailability: {},
  liveBookings: {},
  isConnected: false,
  lastSync: Date.now(),

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
        [bookingId]: { ...update, timestamp: update.timestamp || new Date().toISOString() },
      },
    })),

  setConnected: (connected) => set({ isConnected: connected, lastSync: Date.now() }),

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
}));

// Real-time provider availability hook
export function useProviderAvailability(providerId: string) {
  const availability = useRealTimeStore((state) => state.providerAvailability[providerId]);
  return availability || null;
}

// Live booking tracking hook
export function useLiveBooking(bookingId: string) {
  const booking = useRealTimeStore((state) => state.liveBookings[bookingId]);
  return booking || null;
}

// Check if provider is available now
export function useIsProviderAvailable(providerId: string): boolean {
  const availability = useProviderAvailability(providerId);
  return availability?.acceptingBookings && availability.isOnline && !availability.isBusy;
}

// Get next available slot
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

// Real-time service connected to WebSocket
class RealTimeService {
  private unsubscribers: (() => void)[] = [];
  private subscribedBookings: Set<string> = new Set();

  start() {
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Subscribe to connection events
    this.unsubscribers.push(
      socketService.onConnect(() => {
        logger.info('[RealTime] WebSocket connected');
        useRealTimeStore.getState().setConnected(true);
        // Re-subscribe to previously subscribed bookings
        this.subscribedBookings.forEach((bookingId) => {
          socketService.joinBookingRoom(bookingId);
        });
      })
    );

    // Handle disconnection
    this.unsubscribers.push(
      socketService.addListener('disconnect', () => {
        logger.info('[RealTime] WebSocket disconnected');
        useRealTimeStore.getState().setConnected(false);
      })
    );

    // Handle connection errors
    this.unsubscribers.push(
      socketService.onConnectError((data) => {
        logger.error('[RealTime] WebSocket connection error', { message: data.message });
        useRealTimeStore.getState().setConnected(false);
      })
    );

    // Handle unauthorized (token expired)
    this.unsubscribers.push(
      socketService.onUnauthorized(() => {
        logger.warn('[RealTime] WebSocket unauthorized - token may be expired');
        useRealTimeStore.getState().setConnected(false);
      })
    );

    // Subscribe to booking status changes
    this.unsubscribers.push(
      socketService.onBookingStatusChanged((data: BookingEvent) => {
        logger.info('[RealTime] Booking status changed via WebSocket', {
          bookingId: data.bookingId,
          status: data.status,
        });
        this.handleBookingUpdate(data);
      })
    );

    // Subscribe to booking confirmations
    this.unsubscribers.push(
      socketService.addListener('booking:confirmed', (data: BookingEvent) => {
        logger.info('[RealTime] Booking confirmed via WebSocket', { bookingId: data.bookingId });
        this.handleBookingUpdate(data);
      })
    );

    // Subscribe to booking cancellations
    this.unsubscribers.push(
      socketService.addListener('booking:cancelled', (data: BookingEvent) => {
        logger.info('[RealTime] Booking cancelled via WebSocket', { bookingId: data.bookingId });
        this.handleBookingUpdate({ ...data, status: 'cancelled' });
      })
    );

    // Initial connection state check
    if (socketService.isConnected()) {
      useRealTimeStore.getState().setConnected(true);
    }
  }

  /**
   * Handle incoming booking update from WebSocket
   */
  private handleBookingUpdate(data: BookingEvent) {
    const status = this.mapSocketStatus(data.status);

    useRealTimeStore.getState().updateLiveBooking(data.bookingId, {
      bookingId: data.bookingId,
      status,
      timestamp: data.timestamp instanceof Date ? data.timestamp.toISOString() : String(data.timestamp),
      message: this.getStatusMessage(status),
    });
  }

  /**
   * Map SocketService status string to LiveBookingUpdate status
   */
  private mapSocketStatus(
    socketStatus: string
  ): 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' {
    const statusMap: Record<string, LiveBookingUpdate['status']> = {
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
  private getStatusMessage(status: LiveBookingUpdate['status']): string {
    const messages: Record<LiveBookingUpdate['status'], string> = {
      confirmed: 'Your booking has been confirmed',
      assigned: 'A provider has been assigned to your booking',
      in_progress: 'Your service is in progress',
      completed: 'Your service has been completed',
      cancelled: 'Your booking has been cancelled',
    };
    return messages[status];
  }

  stop() {
    // Clean up all subscriptions
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];

    // Leave all booking rooms
    this.subscribedBookings.forEach((bookingId) => {
      socketService.leaveBookingRoom(bookingId);
    });
    this.subscribedBookings.clear();

    useRealTimeStore.getState().setConnected(false);
  }

  /**
   * Subscribe to real-time updates for a specific booking
   */
  subscribeToBooking(bookingId: string) {
    if (this.subscribedBookings.has(bookingId)) {
      logger.info('[RealTime] Already subscribed to booking', { bookingId });
      return;
    }

    logger.info('[RealTime] Subscribing to booking updates via WebSocket', { bookingId });
    this.subscribedBookings.add(bookingId);

    // Join the booking room for targeted updates
    if (socketService.isConnected()) {
      socketService.joinBookingRoom(bookingId);
    }
  }

  /**
   * Unsubscribe from a booking's updates
   */
  unsubscribeFromBooking(bookingId: string) {
    if (!this.subscribedBookings.has(bookingId)) {
      return;
    }

    logger.info('[RealTime] Unsubscribing from booking updates', { bookingId });
    this.subscribedBookings.delete(bookingId);

    // Leave the booking room
    if (socketService.isConnected()) {
      socketService.leaveBookingRoom(bookingId);
    }

    // Optionally clear from store (keep for offline access)
    // useRealTimeStore.getState().clearBooking(bookingId);
  }

  /**
   * Update provider availability manually
   * Note: Provider availability events should come from backend
   */
  updateProvider(providerId: string, availability: Partial<ProviderAvailability>) {
    const current = useRealTimeStore.getState().providerAvailability[providerId];
    if (current) {
      useRealTimeStore.getState().updateProviderAvailability(providerId, {
        ...current,
        ...availability,
      });
    }
  }
}

export const realTimeService = new RealTimeService();

// Hook for real-time connection status
export function useRealTimeConnection() {
  const { isConnected, lastSync } = useRealTimeStore();

  return {
    isConnected,
    lastSync,
    timeSinceSync: Date.now() - lastSync,
    isStale: Date.now() - lastSync > 60000, // 1 minute
  };
}

export default realTimeService;
