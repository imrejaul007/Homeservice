# SOCKET & NOTIFICATION AUDIT REPORT

## Socket Integrity Score: 58/100

---

## CRITICAL ISSUES

### 1. Chat Messages Never Delivered
**File:** `backend/src/socket/chat.handler.ts:505` and `frontend/src/services/socket.ts`

| Problem | Details |
|---------|---------|
| Backend emits | `message:new` |
| Frontend listens | `chat:new_message` |
| Impact | **Chat completely broken - users cannot receive messages** |

### 2. Chat Message Payload Mismatch
**Files:** `backend/src/socket/chat.handler.ts` and `frontend/src/services/socket.ts`

| Backend Sends | Frontend Expects |
|--------------|------------------|
| `{messageId, chatRoomId, senderId, receiverId, content, type, status, createdAt}` | `{bookingId, message, senderId, timestamp}` |

**Impact:** Even with event name fix, data fields are wrong.

---

## MISSING HANDLERS

| Event | Backend Emits | Frontend Missing | Impact |
|-------|--------------|------------------|--------|
| `chat:message:new` | Yes | No listener | Chat broken |
| `chat:message:delivered` | Yes | No listener | Delivery receipts not shown |
| `chat:message:deleted` | Yes | No listener | Deleted messages remain |
| `provider:document_verified` | Yes | Not in setupDefaultListeners | Only works with explicit subscription |
| `provider:verification_complete` | Yes | Not in setupDefaultListeners | Only works with explicit subscription |

---

## DEAD CODE

| Event | Status | Impact |
|-------|--------|--------|
| `booking:reminder` | Backend never emits | Reminder notifications never fire |

---

## BACKEND EVENTS (Working)

| Event | Status |
|-------|--------|
| `booking:status_changed` | ✓ |
| `booking:new_request` | ✓ |
| `booking:confirmed` | ✓ |
| `booking:cancelled` | ✓ |
| `notification:new` | ✓ |
| `provider:approved` | ✓ |
| `provider:rejected` | ✓ |
| `service:approved` | ✓ |
| `dispute:new` | ✓ |
| `withdrawal:approved` | ✓ |

---

## RECOMMENDATIONS

### Priority 1 (Fix Immediately)
1. Fix `message:new` / `chat:new_message` naming mismatch in backend chat.handler.ts
2. Fix message payload structure to include `bookingId`
3. Add missing event registrations to `setupDefaultListeners`

### Priority 2 (Fix Soon)
1. Implement `booking:reminder` backend emission or remove from frontend
2. Add listeners for `chat:message:delivered`, `chat:message:deleted`
