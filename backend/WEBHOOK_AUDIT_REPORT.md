# NILIN Webhook Reliability Audit Report

**Date:** 2026-05-22  
**Auditor:** Principal Backend Engineer  
**Status:** CRITICAL - Multiple Issues Found

---

## Executive Summary

The webhook infrastructure has **partial reliability** with significant gaps in atomicity, ordering guarantees, and edge case handling. While idempotency and retry mechanisms exist, the system lacks a proper outbox pattern for guaranteed delivery and has unhandled edge cases that could lead to data inconsistencies.

---

## Architecture Diagram

```
INCOMING WEBHOOKS
|
+-> Stripe Webhook Endpoint (/api/payments/webhook)
|   +-- Signature Verification (HMAC via Stripe SDK)
|   +-- Raw Body Buffer (express.raw middleware)
|   +-- Event Parsing
|
+-> Idempotency Check
|   +-- Redis Primary (webhook:processed:{eventId})
|   +-- MongoDB Fallback (ProcessedWebhook collection)
|       +-- TTL Index (24 hours)
|
+-> Event Handler (handleWebhookEvent)
|   +-- Switch on event.type
|   |   +-- payment_intent.succeeded
|   |   +-- payment_intent.payment_failed
|   |   +-- charge.refunded
|   +-- Publish to Event Bus
|
+-> Event Bus (in-memory, not persistent)
|   +-- Dead Letter Queue (max 100 entries)
|   +-- Subscriptions (analytics, notifications, email, socket)
|   +-- Background Processing
|
+-> Queue Workers (BullMQ/Redis)
|   +-- Email Worker (concurrency: 5)
|   +-- Notification Worker (concurrency: 10)
|   +-- Loyalty Worker (concurrency: 5)
|   +-- Webhook Retry Worker (concurrency: 5)
|
+-> Failed Jobs Collection (MongoDB)
    +-- Persistent storage for failed jobs

MISSING COMPONENTS
|
+-- Transactional Outbox Pattern NOT IMPLEMENTED
+-- Webhook Outbox Table NOT IMPLEMENTED
+-- Dead Letter Queue Persistence NOT IMPLEMENTED
+-- Secret Rotation Integration NOT IMPLEMENTED
+-- Out-of-Order Event Handling NOT IMPLEMENTED
```

---

## 1. OUTBOX PATTERN AUDIT

### Status: NOT IMPLEMENTED

**Critical Issues:**

1. **No Transactional Outbox**
   - Webhook events are published directly to Event Bus
   - If Event Bus publish fails, database changes may be lost
   - No atomicity between database operations and event publishing

2. **Missing Webhook Outbox Table**
   - No dedicated table for webhook dispatch tracking
   - Cannot guarantee "at-least-once" delivery

3. **Event Bus Not Persistent**
   - In-memory EventEmitter can lose events on crash
   - No event sourcing or replay capability

4. **Outbox Cleanup/Archival**
   - No archival strategy for processed outbox entries
   - No cleanup job for old entries

**Current Flow (BROKEN):**
```typescript
// Current implementation in payment.service.ts
await Booking.save();  // Database update
await eventBus.publish(EVENT_TYPES.PAYMENT_COMPLETED, {...});  // May fail!
```

**Fix Required:**
- Add webhook_outbox table with transactional guarantee
- Use database transaction to ensure atomicity
- Implement outbox relay pattern with polling

---

## 2. WEBHOOK SECURITY AUDIT

### Status: PARTIAL (2/3)

| Requirement | Status | Details |
|-------------|--------|---------|
| HMAC Signature Verification | PASS | Stripe SDK handles this |
| Timestamp Validation | FAIL | No replay attack prevention |
| Secret Rotation | FAIL | SecretRotationService exists but not integrated |

**Critical Issues:**

1. **No Timestamp Validation (Replay Attack Vulnerability)**
   - Stripe events have created timestamp
   - No check for events older than 5 minutes
   - Attackers could replay old, valid webhooks

2. **Secret Rotation Not Integrated**
   - SecretRotationService exists with key versioning
   - Webhook verification hardcoded to single secret
   - No support for multiple active webhook secrets

**Fix Required:**
```typescript
// Add to payment.service.ts
const TOLERANCE_SECONDS = 300; // 5 minutes

const validateWebhookTimestamp = (event: Stripe.Event): void => {
  const ageSeconds = (Date.now() / 1000) - event.created;
  if (ageSeconds > TOLERANCE_SECONDS) {
    throw new ApiError(400, 'Webhook timestamp too old (possible replay attack)');
  }
};
```

---

## 3. DELIVERY GUARANTEES AUDIT

### Status: PARTIAL (3/5)

| Requirement | Status | Details |
|-------------|--------|---------|
| At-Least-Once Delivery | PARTIAL | Retry queue exists, but no outbox guarantee |
| Idempotency Keys | PASS | Redis + MongoDB with 24h TTL |
| Dead Letter Queue | PARTIAL | In-memory only, not persisted |
| Max Retry Attempts | PARTIAL | 5 attempts, but no max age limit |
| Retry Backoff Strategy | PASS | Exponential backoff implemented |

**Critical Issues:**

1. **At-Least-Once Not Guaranteed**
   - No transactional outbox = events can be lost
   - If DB save succeeds but queue fails, event is lost

2. **Dead Letter Queue Not Persistent**
   - In-memory queue in EventBus (max 100 entries)
   - Lost on application restart
   - Should persist to MongoDB

3. **No Maximum Retry Age**
   - Retries continue for 5 attempts
   - No time-based cutoff (e.g., max 24 hours)
   - Could retry old events indefinitely

4. **Retry Backoff Too Aggressive**
   - Current: 1s, 2s, 4s, 8s, 16s
   - Should be: 1m, 5m, 30m, 2h, 8h for critical webhooks

**Current Backoff Configuration:**
```typescript
// webhookQueue.ts - Line 45-49
backoff: {
  type: 'exponential',
  delay: 1000,  // 1 second - TOO FAST
},
```

**Fix Required:**
```typescript
// Should be:
backoff: {
  type: 'exponential',
  delay: 60000,  // 1 minute initial delay
  maxDelay: 3600000,  // 1 hour max delay
},
```

---

## 4. HANDLER RELIABILITY AUDIT

### Status: PARTIAL (2/4)

| Requirement | Status | Details |
|-------------|--------|---------|
| Idempotent Handlers | PASS | Skips already-processed events |
| Partial Failure Handling | PARTIAL | EventBus has DLQ, but limited |
| Rollback on Failure | FAIL | No compensation logic |
| Handler Timeout | FAIL | No timeout enforcement |

**Critical Issues:**

1. **No Rollback/Compensation**
   - If handler fails after partial processing, no rollback
   - Example: Payment marked as paid, then handler fails, but state is inconsistent

2. **No Handler Timeout**
   - Long-running handlers block webhook response
   - Stripe may timeout (10s) and retry
   - Need timeout wrapper with fast response

3. **Event Bus Not Transactional**
   - If subscription handler fails, event still marked as published
   - Inconsistent state across subscribers

**Current Handler Code (payment.service.ts:502-617):**
```typescript
export const handleWebhookEvent = async (event: Stripe.Event) => {
  // Idempotency check
  const alreadyProcessed = await checkWebhookProcessed(event.id);
  if (alreadyProcessed) {
    return { handled: true, message: 'Already processed' };
  }
  
  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        // NO TRANSACTION WRAPPER
        booking.payment.status = 'paid';
        booking.payment.paidAt = new Date();
        await booking.save();  // Save happens here
        
        // If eventBus.publish fails here, inconsistent state!
        await eventBus.publish(EVENT_TYPES.PAYMENT_COMPLETED, {...});
        
        await markWebhookProcessed(event.id, event.type);  // Mark after everything
        return { handled: true };
      }
    }
  } catch (error) {
    // Schedules retry, but DB state may already be changed!
    await scheduleWebhookRetry(event.id, event.type, event);
    throw error;
  }
};
```

**Fix Required:**
```typescript
// Use MongoDB transaction with outbox pattern
const session = await mongoose.startSession();
session.startTransaction();

try {
  // 1. Update booking in transaction
  booking.payment.status = 'paid';
  booking.payment.paidAt = new Date();
  await booking.save({ session });
  
  // 2. Write to outbox in same transaction
  await WebhookOutbox.create([{
    eventId: event.id,
    eventType: event.type,
    payload: event,
    status: 'pending',
    createdAt: new Date()
  }], { session });
  
  // 3. Commit transaction - both succeed or both fail
  await session.commitTransaction();
  
  // 4. Mark as processed
  await markWebhookProcessed(event.id, event.type);
  
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  session.endSession();
}
```

---

## 5. EDGE CASES AUDIT

### Status: PARTIAL (2/5)

| Edge Case | Status | Handling |
|-----------|--------|----------|
| Maintenance Window | FAIL | Not handled |
| Duplicate Delivery | PASS | Idempotency check |
| Out-of-Order Delivery | FAIL | Not handled |
| Malformed Payloads | PARTIAL | Stripe SDK validation only |
| High Load Spikes | PARTIAL | Queue throttling exists |

**Critical Issues:**

1. **Maintenance Window Not Handled**
   - No check for maintenance mode
   - Could process events when database is in read-only mode
   - No queuing for later processing

2. **Out-of-Order Event Delivery**
   - Events can arrive out of order (e.g., charge.refunded before payment_intent.succeeded)
   - No sequence number or timestamp validation
   - Could mark payment as refunded when it was never paid

3. **Malformed Payload - Limited Validation**
   - Stripe SDK validates structure
   - No custom validation of event data
   - Could have unexpected null/undefined values

**Missing Out-of-Order Handling:**
```typescript
// Example: Charge.refunded arrived before payment_intent.succeeded
// Current code would:
// 1. Find booking (status might be 'pending')
// 2. Try to calculate refund amount
// 3. Set totalRefunded to undefined + refund amount = NaN
// 4. Update booking status to 'refunded'
// This is WRONG - booking was never paid!

// Fix:
const validateEventSequence = async (event: Stripe.Event, booking: Booking) => {
  if (event.type === 'charge.refunded') {
    if (booking.payment.status !== 'paid') {
      logger.error('Refund received for unpaid booking', {
        bookingId: booking._id,
        eventType: event.type,
        paymentStatus: booking.payment.status
      });
      // Queue for investigation, don't process
      await queueEventForInvestigation(event);
      return false;
    }
  }
  return true;
};
```

---

## Critical Issues Summary

### Priority 1 (Critical - Fix Immediately)

1. **Missing Transactional Outbox**
   - Impact: Events can be lost, causing inconsistent state
   - Fix: Add WebhookOutbox table with transaction guarantee

2. **No Rollback on Handler Failure**
   - Impact: Partial state changes on retry
   - Fix: Wrap handlers in transactions with compensation

3. **Out-of-Order Event Vulnerability**
   - Impact: Refunds processed before payment confirmed
   - Fix: Add sequence/timestamp validation

### Priority 2 (High - Fix Within Week)

4. **No Replay Attack Prevention**
   - Impact: Old webhooks can be replayed
   - Fix: Add timestamp validation (5 minute window)

5. **Dead Letter Queue Not Persistent**
   - Impact: Lost on restart
   - Fix: Persist to MongoDB FailedWebhookDLQ collection

6. **No Handler Timeout**
   - Impact: Slow handlers cause Stripe timeout + retry
   - Fix: Add 5-second timeout wrapper

### Priority 3 (Medium - Fix Within Month)

7. **Secret Rotation Not Integrated**
   - Impact: Webhook secret can't be rotated without downtime
   - Fix: Support multiple active secrets in rotation

8. **Maintenance Window Not Handled**
   - Impact: Events processed when DB is unavailable
   - Fix: Check maintenance mode before processing

9. **Retry Backoff Too Fast**
   - Impact: Too many retries in short time
   - Fix: Increase initial delay to 60 seconds

---

## Recommendations

### Immediate Actions

1. **Create WebhookOutbox Table**
```typescript
// backend/src/models/webhookOutbox.model.ts
const webhookOutboxSchema = new Schema({
  eventId: { type: String, required: true, unique: true },
  eventType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed', 'dead_letter'],
    default: 'pending' 
  },
  attempts: { type: Number, default: 0 },
  lastAttempt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  nextRetryAt: { type: Date },
  maxRetries: { type: Number, default: 10 },
  expiresAt: { type: Date, required: true, index: true }
});

webhookOutboxSchema.index({ status: 1, nextRetryAt: 1 });
webhookOutboxSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WebhookOutbox = mongoose.model('WebhookOutbox', webhookOutboxSchema);
```

2. **Add Timestamp Validation**
```typescript
const validateWebhookTimestamp = (event: Stripe.Event): void => {
  const TOLERANCE_SECONDS = 300; // 5 minutes
  const ageSeconds = (Date.now() / 1000) - event.created;
  if (ageSeconds > TOLERANCE_SECONDS) {
    logger.error('Webhook timestamp too old', {
      eventId: event.id,
      ageSeconds,
      action: 'REPLAY_ATTACK_DETECTED'
    });
    throw new ApiError(400, 'Webhook timestamp too old');
  }
};
```

3. **Implement Outbox Relay Pattern**
```typescript
// backend/src/queue/outboxRelay.ts
export const processWebhookOutbox = async () => {
  const pendingEvents = await WebhookOutbox.find({
    status: 'pending',
    nextRetryAt: { $lte: new Date() },
    expiresAt: { $gt: new Date() }
  }).limit(100);
  
  for (const outboxEvent of pendingEvents) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      outboxEvent.status = 'processing';
      outboxEvent.attempts++;
      outboxEvent.lastAttempt = new Date();
      await outboxEvent.save({ session });
      
      await eventBus.publish(outboxEvent.eventType, outboxEvent.payload);
      
      outboxEvent.status = 'completed';
      outboxEvent.nextRetryAt = undefined;
      await outboxEvent.save({ session });
      
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      
      outboxEvent.attempts++;
      if (outboxEvent.attempts >= outboxEvent.maxRetries) {
        outboxEvent.status = 'dead_letter';
        await outboxEvent.save();
      } else {
        outboxEvent.status = 'pending';
        outboxEvent.nextRetryAt = calculateNextRetry(outboxEvent.attempts);
        await outboxEvent.save();
      }
    } finally {
      session.endSession();
    }
  }
};

// Cron job to process outbox every 5 seconds
cron.schedule('*/5 * * * * *', processWebhookOutbox);
```

4. **Add Out-of-Order Validation**
```typescript
const validateEventSequence = async (event: Stripe.Event, booking: Booking) => {
  switch (event.type) {
    case 'charge.refunded': {
      if (booking.payment.status !== 'paid') {
        logger.error('Refund received for non-paid booking', {
          bookingId: booking._id,
          paymentStatus: booking.payment.status,
          eventId: event.id
        });
        return false;
      }
      break;
    }
    case 'payment_intent.payment_failed': {
      if (booking.payment.status === 'refunded') {
        logger.error('Payment failure after refund', {
          bookingId: booking._id,
          eventId: event.id
        });
        return false;
      }
      break;
    }
  }
  return true;
};
```

5. **Add Handler Timeout Wrapper**
```typescript
export const withWebhookTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number = 5000
): Promise<T> => {
  return withTimeout(fn, timeoutMs, 'Webhook handler timeout');
};

export const handleWebhookEvent = async (event: Stripe.Event) => {
  return withWebhookTimeout(async () => {
    // ... existing handler logic
  });
};
```

6. **Persist Dead Letter Queue**
```typescript
// backend/src/models/webhookDLQ.model.ts
const webhookDLQSchema = new Schema({
  eventId: { type: String, required: true, index: true },
  eventType: { type: String, required: true },
  payload: { type: Schema.Types.Mixed, required: true },
  error: { type: String, required: true },
  attempts: { type: Number, required: true },
  lastAttempt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  resolvedBy: { type: String }
});

webhookDLQSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // 7 days

export const WebhookDLQ = mongoose.model('WebhookDLQ', webhookDLQSchema);
```

---

## Testing Requirements

### Unit Tests Required

1. **Idempotency Tests**
   - Process same event twice - second time returns cached result
   - Process 100 duplicate events - only one DB write

2. **Transaction Tests**
   - DB save succeeds, queue fails - transaction rollback
   - DB save fails, queue succeeds - transaction rollback
   - Both succeed - commit

3. **Out-of-Order Tests**
   - Refund arrives before payment - rejected
   - Payment failed arrives after refund - rejected
   - Payment succeeded arrives 10x - idempotent

4. **Timeout Tests**
   - Handler takes 10s - timeout, Stripe retries
   - Handler takes 4s - completes successfully

5. **Replay Attack Tests**
   - Event from 10 minutes ago - rejected
   - Event from 1 minute ago - accepted
   - Event from 4 minutes ago - accepted

---

## Monitoring Recommendations

### Metrics to Track

```typescript
// Add to metrics dashboard
{
  "webhook_events_total": "Counter of all webhook events",
  "webhook_events_processed": "Counter of successfully processed events",
  "webhook_events_failed": "Counter of failed events",
  "webhook_events_retried": "Counter of retried events",
  "webhook_outbox_size": "Gauge of pending outbox events",
  "webhook_dlq_size": "Gauge of dead letter queue size",
  "webhook_processing_time_seconds": "Histogram of processing time",
  "webhook_replay_attacks_detected": "Counter of rejected old events",
  "webhook_out_of_order_detected": "Counter of out-of-order events"
}
```

### Alerting Rules

```yaml
# Prometheus alerting rules
- alert: WebhookDLQHigh
  expr: webhook_dlq_size > 100
  for: 5m
  severity: critical

- alert: WebhookOutboxBacklog
  expr: webhook_outbox_size > 1000
  for: 10m
  severity: warning

- alert: WebhookProcessingSlow
  expr: histogram_quantile(0.95, webhook_processing_time_seconds) > 10
  for: 5m
  severity: warning

- alert: WebhookReplayAttack
  expr: rate(webhook_replay_attacks_detected[5m]) > 0
  for: 1m
  severity: critical
```

---

## Implementation Timeline

### Week 1: Critical Fixes
- [ ] Implement transactional outbox pattern
- [ ] Add timestamp validation
- [ ] Fix retry backoff to 60s initial

### Week 2: High Priority
- [ ] Add out-of-order event validation
- [ ] Persist dead letter queue
- [ ] Add handler timeout wrapper

### Week 3: Medium Priority
- [ ] Integrate secret rotation service
- [ ] Add maintenance window handling
- [ ] Comprehensive test suite

### Week 4: Verification
- [ ] Load test webhook infrastructure
- [ ] Chaos engineering tests
- [ ] Documentation and runbooks

---

## Conclusion

The webhook infrastructure has **significant reliability gaps** that must be addressed before production deployment. The most critical issues are:

1. **Missing transactional outbox** - Events can be lost
2. **No rollback mechanism** - Partial state changes possible
3. **Out-of-order vulnerability** - Refunds can process before payment

**Estimated Fix Time:** 3-4 weeks  
**Risk Without Fix:** HIGH - Data inconsistencies, replay attacks, lost events

**Recommendation:** Do not go to production until Priority 1 and 2 issues are resolved.

---

**Report Generated:** 2026-05-22  
**Next Audit:** After fixes implemented  
**Status:** OPEN - Requires immediate action
