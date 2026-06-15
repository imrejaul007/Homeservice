import { AnalyticsEventModel, eventStreamService } from './eventStream.service';
import logger from '../utils/logger';

export interface IncomingAnalyticsEvent {
  id?: string;
  category?: string;
  name?: string;
  timestamp?: string;
  properties?: Record<string, unknown>;
  userId?: string;
  sessionId?: string;
  platform?: string;
  appVersion?: string;
}

const PROVIDER_FUNNEL_EVENT_NAMES = new Set([
  'booking_start',
  'provider_selected',
  'time_selected',
  'address_entered',
  'payment_started',
  'payment_completed',
  'booking_confirmed',
  'booking_cancelled',
  'service_booked',
  'service_viewed',
  'listing_impression',
  'search_result_click',
  'profile_viewed',
  'book_now_clicked',
  'payment_refunded',
  'ad_impression',
  'ad_click',
]);

export function buildIdempotencyKey(
  sessionId: string,
  eventType: string,
  entityId: string,
  dateBucket: string,
): string {
  const normalizedSession = sessionId || 'anonymous';
  const normalizedEntity = entityId || 'unknown';
  return `${normalizedSession}:${eventType}:${normalizedEntity}:${dateBucket}`;
}

function resolveEntityId(event: IncomingAnalyticsEvent): string {
  const props = event.properties || {};
  const serviceId = props.serviceId || props.service_id;
  if (typeof serviceId === 'string' && serviceId) {
    return serviceId;
  }

  const providerId = props.providerId || props.provider_id;
  if (typeof providerId === 'string' && providerId) {
    return providerId;
  }

  return 'unknown';
}

function resolveDateBucket(event: IncomingAnalyticsEvent): string {
  const timestamp = event.timestamp ? new Date(event.timestamp) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return timestamp.toISOString().slice(0, 10);
}

function isProviderRelevantEvent(event: IncomingAnalyticsEvent): boolean {
  const providerId = event.properties?.providerId || event.properties?.provider_id;
  if (!providerId || typeof providerId !== 'string') {
    return false;
  }

  if (event.category === 'booking' || event.category === 'service' || event.category === 'provider') {
    return true;
  }

  return PROVIDER_FUNNEL_EVENT_NAMES.has(event.name || '');
}

function buildEventType(event: IncomingAnalyticsEvent): string {
  if (event.category && event.name) {
    return `${event.category}.${event.name}`;
  }
  return event.name || 'analytics.custom';
}

async function isDuplicateEvent(idempotencyKey: string): Promise<boolean> {
  const existing = await AnalyticsEventModel.findOne({
    'properties.idempotencyKey': idempotencyKey,
  })
    .select('_id')
    .lean();

  return Boolean(existing);
}

export async function ingestAnalyticsEventBatch(
  events: IncomingAnalyticsEvent[],
  fallbackUserId?: string,
): Promise<{ accepted: number; stored: number; skipped: number }> {
  let stored = 0;
  let skipped = 0;

  for (const event of events.slice(0, 100)) {
    if (!event?.name && !event?.category) {
      skipped += 1;
      continue;
    }

    if (!isProviderRelevantEvent(event)) {
      skipped += 1;
      continue;
    }

    const eventType = buildEventType(event);
    const providerId = String(event.properties?.providerId || event.properties?.provider_id || '');
    const sessionId = event.sessionId || fallbackUserId || 'anonymous';
    const entityId = resolveEntityId(event);
    const dateBucket = resolveDateBucket(event);
    const idempotencyKey = buildIdempotencyKey(sessionId, eventType, entityId, dateBucket);

    try {
      if (await isDuplicateEvent(idempotencyKey)) {
        skipped += 1;
        continue;
      }

      await eventStreamService.recordEvent(
        eventType,
        {
          ...event.properties,
          providerId,
          eventCategory: event.category,
          eventName: event.name,
          platform: event.platform,
          appVersion: event.appVersion,
          idempotencyKey,
        },
        {
          userId: event.userId || fallbackUserId,
          sessionId: event.sessionId,
          conversionValue: typeof event.properties?.totalPrice === 'number'
            ? event.properties.totalPrice
            : undefined,
        },
      );
      stored += 1;
    } catch (error) {
      skipped += 1;
      logger.warn('Failed to ingest analytics event', {
        eventType,
        providerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    accepted: events.length,
    stored,
    skipped,
  };
}

export default ingestAnalyticsEventBatch;
