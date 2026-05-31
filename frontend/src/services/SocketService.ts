// SocketService.ts - Re-exports from unified socket.ts implementation
// This file is kept for backward compatibility with components that import from it
// The actual implementation is in socket.ts

export {
  socketService,
  useSocket,
  useSocketEvent,
  default,
} from './socket';

export type {
  BookingEvent,
  NotificationEvent,
  ServerToClientEvents,
  ClientToServerEvents,
} from './socket';

// Re-export additional types that RealTimeSync uses
export type { MessageEvent, TypingEvent } from './socket';
