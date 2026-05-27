import mongoose, { Schema, Document } from 'mongoose';
import { DomainEvent } from './eventBus';

interface IEventStore extends Document {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  payload: any;
  metadata: {
    timestamp: Date;
    correlationId?: string;
    userId?: string;
    version: number;
  };
  version: number;
  createdAt: Date;
}

const eventStoreSchema = new Schema<IEventStore>({
  aggregateId: { type: String, required: true, index: true },
  aggregateType: { type: String, required: true, index: true },
  eventType: { type: String, required: true, index: true },
  payload: { type: Schema.Types.Mixed, required: true },
  metadata: {
    timestamp: { type: Date, required: true },
    correlationId: String,
    userId: String,
    version: { type: Number, required: true },
  },
  version: { type: Number, required: true },
}, { timestamps: true });

eventStoreSchema.index({ aggregateId: 1, version: 1 });

const EventStore = mongoose.model<IEventStore>('EventStore', eventStoreSchema);

class EventStoreService {
  async append(
    aggregateId: string,
    aggregateType: string,
    event: DomainEvent
  ): Promise<IEventStore> {
    // Get current version
    const lastEvent = await EventStore.findOne({ aggregateId })
      .sort({ version: -1 });

    const version = (lastEvent?.version || 0) + 1;

    // Create event record
    const eventRecord = await EventStore.create({
      aggregateId,
      aggregateType,
      eventType: event.type,
      payload: event.payload,
      metadata: {
        ...event.metadata,
        version,
      },
      version,
    });

    return eventRecord;
  }

  async getEvents(aggregateId: string): Promise<IEventStore[]> {
    return EventStore.find({ aggregateId })
      .sort({ version: 1 });
  }

  async getEventsByType(eventType: string): Promise<IEventStore[]> {
    return EventStore.find({ eventType })
      .sort({ 'metadata.timestamp': -1 });
  }

  async getEventsInRange(
    startDate: Date,
    endDate: Date
  ): Promise<IEventStore[]> {
    return EventStore.find({
      'metadata.timestamp': {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ 'metadata.timestamp': -1 });
  }
}

export const eventStoreService = new EventStoreService();
