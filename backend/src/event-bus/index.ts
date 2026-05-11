// Event Bus - Simple event system

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export const EVENT_TYPES = {
  BOOKING_CREATED: 'booking.created',
  BOOKING_CONFIRMED: 'booking.confirmed',
  PAYMENT_COMPLETED: 'payment.completed',
  USER_REGISTERED: 'user.registered',
};

export interface PlatformEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  data: unknown;
}

class EventBus extends EventEmitter {
  private history: PlatformEvent[] = [];

  async publish<T>(data: { eventType: string; data: T }): Promise<string> {
    const eventId = uuidv4();
    const event: PlatformEvent = {
      eventId,
      eventType: data.eventType,
      timestamp: new Date(),
      data: data.data,
    };

    this.history.push(event);
    if (this.history.length > 1000) this.history.shift();

    this.emit(data.eventType, event);
    this.emit('*', event);

    logger.info('Event published', { eventId, eventType: data.eventType });
    return eventId;
  }

  getHistory(): PlatformEvent[] {
    return this.history;
  }
}

export const eventBus = new EventBus();
export default eventBus;
