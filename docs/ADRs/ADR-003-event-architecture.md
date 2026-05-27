# ADR-003: Event-Driven Architecture

**Date:** 2024-01-20
**Status:** Accepted
**Deciders:** Engineering Team

## Context

We need to handle asynchronous operations like notifications, analytics, and integrations without blocking the main request flow.

## Decision

We will use an **internal event bus** with BullMQ for job queuing.

## Architecture

### Event Bus
- In-process event emitter for sync events
- Supports event history for debugging
- Memory-efficient circular buffer

### Job Queue
- BullMQ for async job processing
- Separate queues by job type
- Retry with exponential backoff
- Dead letter queue for failed jobs

## Event Types

### Booking Events
- `booking.created`
- `booking.confirmed`
- `booking.completed`
- `booking.cancelled`
- `booking.no_show`

### Payment Events
- `payment.pending`
- `payment.completed`
- `payment.failed`
- `payment.refunded`

### Notification Events
- `notification.email`
- `notification.push`
- `notification.sms`

## Implementation

```typescript
// Event publishing
eventBus.publish(EVENT_TYPES.BOOKING_CREATED, {
  bookingId: booking._id,
  customerId: booking.customerId,
  providerId: booking.providerId,
});

// Event subscription
eventBus.subscribe(EVENT_TYPES.BOOKING_CREATED, async (event) => {
  await sendBookingConfirmation(event.data);
  await updateAnalytics(event.data);
});
```

## Consequences

### Positive
- Decoupled modules
- Better scalability
- Improved observability

### Negative
- Eventual consistency
- More complex debugging
- Event ordering not guaranteed
