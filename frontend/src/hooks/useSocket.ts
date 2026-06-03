/**
 * useSocket - React hook for Socket.IO real-time events
 *
 * Provides proper React integration for socket events with automatic cleanup
 * on component unmount, preventing memory leaks and stale closures.
 *
 * @example
 * ```typescript
 * function BookingStatus({ bookingId }: { bookingId: string }) {
 *   const [status, setStatus] = useState<string | null>(null);
 *
 *   useSocket('booking:status_changed', (data) => {
 *     if (data.bookingId === bookingId) {
 *       setStatus(data.status);
 *     }
 *   });
 *
 *   return <div>Status: {status}</div>;
 * }
 * ```
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  socketService,
  ServerToClientEvents,
  BookingEvent,
  NotificationEvent,
  MessageEvent,
  TypingEvent,
} from '../services/socket';

// Type-safe event names for common events
type SocketEventName = keyof ServerToClientEvents;

/**
 * Hook to subscribe to socket events with automatic cleanup
 *
 * Automatically unsubscribes when component unmounts or when
 * event/callback dependencies change.
 */
export function useSocketEvent<K extends SocketEventName>(
  event: K,
  callback: ServerToClientEvents[K],
  options?: {
    /** If true, subscribes once and auto-unsubscribes after first event */
    once?: boolean;
    /** If provided, the callback will only fire if this condition is true */
    condition?: boolean;
  }
): void {
  const { once = false, condition = true } = options || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callbackRef = useRef<(...args: any[]) => void>(callback as (...args: any[]) => void);

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback as (...args: any[]) => void;
  }, [callback]);

  useEffect(() => {
    // Don't subscribe if condition is false
    if (!condition) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    // Create a stable wrapper callback to enable proper cleanup for once mode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrappedCallback = ((...args: unknown[]) => {
      callbackRef.current(...args);
    }) as ServerToClientEvents[K];

    if (once) {
      socketService.once(event, wrappedCallback);
      // FIX: Register cleanup for once mode to remove listener if unmount happens before event fires
      // This prevents memory leaks and stale closures when component unmounts prematurely
      unsubscribe = () => {
        socketService.off(event, wrappedCallback);
      };
    } else {
      unsubscribe = socketService.on(event, wrappedCallback);
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [event, once, condition]);
}

/**
 * Hook to subscribe to booking status changes
 */
export function useBookingStatus(
  callback: (data: BookingEvent) => void,
  options?: { condition?: boolean }
): void {
  useSocketEvent('booking:status_changed', callback, options);
}

/**
 * Hook to subscribe to new notifications
 */
export function useNotifications(
  callback: (data: NotificationEvent) => void,
  options?: { condition?: boolean }
): void {
  useSocketEvent('notification:new', callback, options);
}

/**
 * Hook to subscribe to new messages
 */
export function useMessages(
  callback: (data: MessageEvent) => void,
  options?: { condition?: boolean }
): void {
  useSocketEvent('message:new', callback, options);
}

/**
 * Hook to subscribe to typing indicators
 */
export function useTyping(
  callback: (data: TypingEvent) => void,
  options?: { condition?: boolean }
): void {
  useSocketEvent('typing:start', callback, options);
}

/**
 * Hook to get socket connection status
 */
export function useSocketStatus(): {
  isConnected: boolean;
  socketId: string | undefined;
  reconnectAttempts: number;
} {
  const [status, setStatus] = useState({
    isConnected: socketService.isConnected(),
    socketId: socketService.getSocketId(),
    reconnectAttempts: socketService.getReconnectAttempts(),
  });

  useEffect(() => {
    const handleConnect = () => {
      setStatus({
        isConnected: true,
        socketId: socketService.getSocketId(),
        reconnectAttempts: socketService.getReconnectAttempts(),
      });
    };

    const handleDisconnect = () => {
      setStatus((prev) => ({
        ...prev,
        isConnected: false,
      }));
    };

    const handleConnectError = () => {
      setStatus((prev) => ({
        ...prev,
        reconnectAttempts: socketService.getReconnectAttempts(),
      }));
    };

    const unsubscribeConnect = socketService.onConnect(handleConnect);
    const unsubscribeDisconnect = socketService.onDisconnect(handleDisconnect);
    const unsubscribeError = socketService.onConnectError(handleConnectError);

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeError();
    };
  }, []);

  return status;
}

/**
 * Hook to join/leave booking rooms for real-time updates
 */
export function useBookingRoom(bookingId: string | null | undefined): void {
  useEffect(() => {
    if (!bookingId) {
      return;
    }

    socketService.joinBookingRoom(bookingId);

    return () => {
      socketService.leaveBookingRoom(bookingId);
    };
  }, [bookingId]);
}

/**
 * Hook to manage typing indicators for a booking
 */
export function useTypingIndicator(bookingId: string | null | undefined) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback(() => {
    if (!bookingId) return;
    socketService.startTyping(bookingId);
  }, [bookingId]);

  const stopTyping = useCallback(() => {
    if (!bookingId) return;
    socketService.stopTyping(bookingId);
  }, [bookingId]);

  const emitTyping = useCallback(() => {
    if (!bookingId) return;

    startTyping();

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Auto-stop typing after 3 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [bookingId, startTyping, stopTyping]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (bookingId) {
        socketService.stopTyping(bookingId);
      }
    };
  }, [bookingId, stopTyping]);

  return { emitTyping, startTyping, stopTyping };
}

/**
 * Hook to manage socket connection lifecycle
 * Automatically connects on mount and disconnects on unmount
 */
export function useSocketConnection(): {
  connect: () => Promise<string>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  isConnected: boolean;
} {
  const [isConnected, setIsConnected] = useState(socketService.isConnected());
  // FIX: Track if auto-connect was performed so we only disconnect what we connected
  const autoConnectedRef = useRef(false);

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const unsubscribeConnect = socketService.onConnect(handleConnect);
    const unsubscribeDisconnect = socketService.onDisconnect(handleDisconnect);

    // Auto-connect if not connected
    if (!socketService.isConnected()) {
      autoConnectedRef.current = true;
      socketService.connect().catch((error) => {
        console.error('[useSocketConnection] Auto-connect failed:', error);
      });
    }

    // FIX: Cleanup function disconnects the socket on unmount
    // This prevents memory leaks and stale connections
    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      // Only disconnect if we auto-connected
      if (autoConnectedRef.current) {
        socketService.disconnect();
        autoConnectedRef.current = false;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    return socketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
  }, []);

  const reconnect = useCallback(async () => {
    await socketService.reconnect();
  }, []);

  return { connect, disconnect, reconnect, isConnected };
}

/**
 * Custom hook to subscribe to provider status events
 */
export function useProviderStatus() {
  const [approved, setApproved] = useState<{ providerId: string; verifiedAt: Date } | null>(null);
  const [rejected, setRejected] = useState<{ providerId: string; reason: string; canAppeal: boolean } | null>(null);
  const [suspended, setSuspended] = useState<{ providerId: string; reason: string; until?: Date } | null>(null);

  useEffect(() => {
    const unsubApproved = socketService.onProviderApproved((data) => {
      setApproved(data);
    });

    const unsubRejected = socketService.onProviderRejected((data) => {
      setRejected(data);
    });

    const unsubSuspended = socketService.onProviderSuspended((data) => {
      setSuspended(data);
    });

    return () => {
      unsubApproved();
      unsubRejected();
      unsubSuspended();
    };
  }, []);

  return { approved, rejected, suspended };
}

/**
 * Custom hook to subscribe to withdrawal events
 */
export function useWithdrawalStatus() {
  const [pending, setPending] = useState<{
    withdrawalId: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
  } | null>(null);

  const [approved, setApproved] = useState<{
    withdrawalId: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
    processedAt: string;
  } | null>(null);

  const [rejected, setRejected] = useState<{
    withdrawalId: string;
    providerId: string;
    amount: number;
    currency: string;
    status: string;
    reason: string;
    rejectedAt: string;
  } | null>(null);

  useEffect(() => {
    const unsubPending = socketService.onWithdrawalPending((data) => {
      setPending(data);
    });

    const unsubApproved = socketService.onWithdrawalApproved((data) => {
      setApproved(data);
    });

    const unsubRejected = socketService.onWithdrawalRejected((data) => {
      setRejected(data);
    });

    return () => {
      unsubPending();
      unsubApproved();
      unsubRejected();
    };
  }, []);

  return { pending, approved, rejected };
}

/**
 * Custom hook to subscribe to dispute events
 */
export function useDisputeEvents() {
  const [newDispute, setNewDispute] = useState<{
    disputeId: string;
    bookingId: string;
    disputeNumber: string;
    category: string;
    priority: string;
  } | null>(null);

  const [resolvedDispute, setResolvedDispute] = useState<{
    disputeId: string;
    resolution: string;
    resolutionType: string;
  } | null>(null);

  useEffect(() => {
    const unsubNew = socketService.onNewDispute((data) => {
      setNewDispute(data);
    });

    const unsubResolved = socketService.onDisputeResolved((data) => {
      setResolvedDispute(data);
    });

    return () => {
      unsubNew();
      unsubResolved();
    };
  }, []);

  return { newDispute, resolvedDispute };
}

/**
 * Custom hook to subscribe to user account status events (for customers and providers)
 */
export function useUserStatus() {
  const [statusChanged, setStatusChanged] = useState<{
    userId: string;
    status: 'active' | 'suspended' | 'banned';
    reason?: string;
    timestamp: Date;
  } | null>(null);

  const [accountLocked, setAccountLocked] = useState<{
    userId: string;
    reason: string;
    until?: Date;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    const unsubStatusChanged = socketService.onUserStatusChanged((data) => {
      setStatusChanged(data);
    });

    const unsubAccountLocked = socketService.onUserAccountLocked((data) => {
      setAccountLocked(data);
    });

    return () => {
      unsubStatusChanged();
      unsubAccountLocked();
    };
  }, []);

  return { statusChanged, accountLocked };
}

/**
 * Issue #7 fix: Custom hook to subscribe to booking admin update events (for customers)
 *
 * Integration guide for customer booking pages:
 * ```tsx
 * import { useBookingAdminUpdates } from '@/hooks/useSocket';
 *
 * function CustomerBookingPage() {
 *   const { bookingUpdated } = useBookingAdminUpdates();
 *
 *   useEffect(() => {
 *     if (bookingUpdated && bookingUpdated.bookingId === currentBookingId) {
 *       // Refresh booking data or show notification
 *       refetchBooking();
 *       toast.success(`Booking updated by admin: ${bookingUpdated.status}`);
 *     }
 *   }, [bookingUpdated]);
 *
 *   // ...
 * }
 * ```
 *
 * This hook enables real-time admin update notifications in customer-facing booking components.
 * Use this in:
 * - CustomerBookingsPage.tsx
 * - CustomerBookingDetailPage.tsx
 * - BookingStatusPage.tsx
 */
export function useBookingAdminUpdates() {
  const [bookingUpdated, setBookingUpdated] = useState<{
    bookingId: string;
    bookingNumber: string;
    status: string;
    updatedBy: 'admin';
    reason?: string;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    const unsubBookingUpdated = socketService.onBookingAdminUpdated((data) => {
      setBookingUpdated(data);
    });

    return () => {
      unsubBookingUpdated();
    };
  }, []);

  return { bookingUpdated };
}

/**
 * Custom hook to subscribe to batch service operation events (for providers)
 */
export function useServiceBatchUpdates() {
  const [batchCompleted, setBatchCompleted] = useState<{
    providerIds: string[];
    affectedCount: number;
    action: 'approved' | 'rejected';
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    const unsubBatchCompleted = socketService.onServicesBatchCompleted((data) => {
      setBatchCompleted(data);
    });

    return () => {
      unsubBatchCompleted();
    };
  }, []);

  return { batchCompleted };
}

/**
 * Custom hook to subscribe to review visibility events (for customers and providers)
 */
export function useReviewVisibility() {
  const [reviewVisible, setReviewVisible] = useState<{
    reviewId: string;
    customerId: string;
    providerId?: string;
    rating: number;
    visible: boolean;
    timestamp: Date;
  } | null>(null);

  useEffect(() => {
    const unsubReviewVisible = socketService.onReviewVisible((data) => {
      setReviewVisible(data);
    });

    return () => {
      unsubReviewVisible();
    };
  }, []);

  return { reviewVisible };
}

export default useSocketEvent;
