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

    if (once) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      socketService.once(event, ((...args: unknown[]) => {
        callbackRef.current(...args);
      }) as ServerToClientEvents[K]);
    } else {
      unsubscribe = socketService.on(event, ((...args: unknown[]) => {
        callbackRef.current(...args);
      }) as ServerToClientEvents[K]);
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

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    const unsubscribeConnect = socketService.onConnect(handleConnect);
    const unsubscribeDisconnect = socketService.onDisconnect(handleDisconnect);

    // Auto-connect if not connected
    if (!socketService.isConnected()) {
      socketService.connect().catch((error) => {
        console.error('[useSocketConnection] Auto-connect failed:', error);
      });
    }

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
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

export default useSocketEvent;
