import { io, Socket } from 'socket.io-client';
import { secureStorage } from '@/lib/security';

// Types
export interface BookingEvent {
  bookingId: string;
  bookingNumber: string;
  status: string;
  userId: string;
  timestamp: Date;
}

export interface NotificationEvent {
  id: string;
  type: 'booking' | 'message' | 'system' | 'promotion';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  userId: string;
  timestamp: Date;
  read?: boolean;
}

export interface ServerToClientEvents {
  'booking:status_changed': (data: BookingEvent) => void;
  'booking:new_request': (data: { booking: BookingEvent; providerId: string }) => void;
  'booking:confirmed': (data: BookingEvent) => void;
  'booking:cancelled': (data: BookingEvent) => void;
  'booking:reminder': (data: { bookingId: string; minutesUntil: number }) => void;
  'notification:new': (data: NotificationEvent) => void;
  'notification:read': (data: { notificationId: string }) => void;
  'message:new': (data: { bookingId: string; message: string; senderId: string; timestamp: Date }) => void;
  'connected': (data: { socketId: string }) => void;
  'error': (data: { message: string }) => void;
  'unauthorized': () => void;
  'typing:start': (data: { bookingId: string; userId: string }) => void;
  'typing:stop': (data: { bookingId: string; userId: string }) => void;
}

export interface ClientToServerEvents {
  'join:user_room': (userId: string) => void;
  'leave:user_room': (userId: string) => void;
  'join:booking_room': (bookingId: string) => void;
  'leave:booking_room': (bookingId: string) => void;
  'typing:start': (data: { bookingId: string }) => void;
  'typing:stop': (data: { bookingId: string }) => void;
}

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class SocketService {
  private socket: TypedSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<Function>> = new Map();
  private isConnecting = false;

  // Get API URL
  private getSocketUrl(): string {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    // Remove /api suffix if present
    return apiUrl.replace(/\/api$/, '');
  }

  // Get auth token
  private getToken(): string | null {
    return secureStorage.getItem('accessToken');
  }

  // Connect to socket server
  connect(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve(this.socket.id || '');
        return;
      }

      if (this.isConnecting) {
        resolve('');
        return;
      }

      this.isConnecting = true;
      const token = this.getToken();

      if (!token) {
        this.isConnecting = false;
        reject(new Error('No authentication token available'));
        return;
      }

      const url = this.getSocketUrl();

      this.socket = io(url, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });

      this.socket.on('connect', () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        console.log('Socket connected:', this.socket?.id);
        this.emit('join:user_room', this.getUserIdFromToken(token));
        resolve(this.socket?.id || '');
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        this.notifyListeners('disconnect', { reason });
      });

      this.socket.on('connect_error', (error) => {
        this.isConnecting = false;
        this.reconnectAttempts++;
        console.error('Socket connection error:', error.message);
        this.notifyListeners('connect_error', { error: error.message });
        reject(error);
      });

      this.socket.on('unauthorized', () => {
        console.error('Socket unauthorized');
        this.disconnect();
        this.notifyListeners('unauthorized', {});
      });

      this.socket.on('error', (data) => {
        console.error('Socket error:', data.message);
        this.notifyListeners('error', data);
      });

      // Setup default event forwarding
      this.setupDefaultListeners();
    });
  }

  // Get user ID from token
  private getUserIdFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id || '';
    } catch {
      return '';
    }
  }

  // Setup default event listeners
  private setupDefaultListeners(): void {
    if (!this.socket) return;

    // Forward booking events
    this.socket.on('booking:status_changed', (data) => {
      this.notifyListeners('booking:status_changed', data);
    });

    this.socket.on('booking:new_request', (data) => {
      this.notifyListeners('booking:new_request', data);
    });

    this.socket.on('booking:confirmed', (data) => {
      this.notifyListeners('booking:confirmed', data);
    });

    this.socket.on('booking:cancelled', (data) => {
      this.notifyListeners('booking:cancelled', data);
    });

    this.socket.on('booking:reminder', (data) => {
      this.notifyListeners('booking:reminder', data);
    });

    // Forward notification events
    this.socket.on('notification:new', (data) => {
      this.notifyListeners('notification:new', data);
    });

    this.socket.on('notification:read', (data) => {
      this.notifyListeners('notification:read', data);
    });

    // Forward message events
    this.socket.on('message:new', (data) => {
      this.notifyListeners('message:new', data);
    });

    // Forward typing events
    this.socket.on('typing:start', (data) => {
      this.notifyListeners('typing:start', data);
    });

    this.socket.on('typing:stop', (data) => {
      this.notifyListeners('typing:stop', data);
    });
  }

  // Disconnect from socket server
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Emit event to server
  emit<K extends keyof ClientToServerEvents>(
    event: K,
    data: Parameters<ClientToServerEvents[K]>[0]
  ): void {
    if (this.socket?.connected) {
      (this.socket as any).emit(event, data);
    }
  }

  // Join booking room
  joinBookingRoom(bookingId: string): void {
    this.emit('join:booking_room', bookingId);
  }

  // Leave booking room
  leaveBookingRoom(bookingId: string): void {
    this.emit('leave:booking_room', bookingId);
  }

  // Start typing
  startTyping(bookingId: string): void {
    this.emit('typing:start', { bookingId });
  }

  // Stop typing
  stopTyping(bookingId: string): void {
    this.emit('typing:stop', { bookingId });
  }

  // Subscribe to events
  on<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback as Function);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as Function);
    };
  }

  // Subscribe to events once
  once<K extends keyof ServerToClientEvents>(
    event: K,
    callback: ServerToClientEvents[K]
  ): void {
    if (this.socket) {
      this.socket.once(event, callback as any);
    }
  }

  // Notify all listeners of an event
  private notifyListeners(event: string, data: any): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        (callback as Function)(data);
      } catch (error) {
        console.error('Socket listener error:', error);
      }
    });
  }

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get socket ID
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  // Reconnect
  async reconnect(): Promise<void> {
    this.disconnect();
    await this.connect();
  }
}

// Export singleton instance
export const socketService = new SocketService();

// Hook for using socket in React components
export const useSocket = () => {
  return socketService;
};

// React hook for socket events
export const useSocketEvent = <K extends keyof ServerToClientEvents>(
  event: K,
  callback: ServerToClientEvents[K]
) => {
  // Using a simple effect would be implemented in React components
  // This is a placeholder for the pattern
  return () => {
    // Cleanup function
  };
};

export default socketService;
