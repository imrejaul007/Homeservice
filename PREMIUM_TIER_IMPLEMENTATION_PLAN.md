# PREMIUM TIER IMPLEMENTATION PLAN

## Overview

The codebase has a sophisticated tiered membership system:

| Tier | Components | Purpose |
|------|------------|---------|
| **AAA** | 12 components | Standard premium tier |
| **Premium** | 12 components | Enhanced tier with animations |
| **Elite** | 3 components | Top tier with exclusive features |
| **SuperApp** | 5 components | Gamification & habits |
| **Mobile** | 13 components | Native app integration |

---

## CURRENT STATE

### Tiers Defined But Not Connected
- Components exist with full UI/UX
- Hooks exist (`useHabits`, `useCapacitor`, `useHaptics`)
- Services exist (`HabitEngine`, `RewardsEngine`, `PredictiveEngine`)
- NO routes registered for tier pages
- NO backend subscription model
- NO user tier tracking

---

## IMPLEMENTATION PLAN

### Phase 1: Backend Foundation (Week 1)

#### 1.1 Create Subscription Model
```typescript
// backend/src/models/subscription.model.ts
// EXISTS - need to verify fields:
interface Subscription {
  userId: ObjectId;
  tier: 'free' | 'aaa' | 'premium' | 'elite';
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  features: {
    priorityBooking: boolean;
    exclusiveProviders: boolean;
    loyaltyMultiplier: number;
    freeCancellations: number;
  };
}
```

#### 1.2 Create Subscription Routes
```
Routes to create:
POST   /api/subscriptions/upgrade
POST   /api/subscriptions/cancel
GET    /api/subscriptions/current
GET    /api/subscriptions/features
POST   /api/subscriptions/webhook (Stripe)
```

#### 1.3 Add User Tier Field
```typescript
// Add to user.model.ts
subscriptionTier: {
  type: String,
  enum: ['free', 'aaa', 'premium', 'elite'],
  default: 'free'
}
```

---

### Phase 2: Frontend Infrastructure (Week 1)

#### 2.1 Create Subscription Hook
```typescript
// frontend/src/hooks/useSubscription.ts
// Should:
- Fetch user tier from auth store
- Check feature access
- Provide upgrade prompts
- Track tier-specific UI rendering
```

#### 2.2 Create Tier Provider
```typescript
// frontend/src/components/tier/TierProvider.tsx
// Wraps app with tier context
// Provides tier-aware rendering
```

#### 2.3 Create Upgrade Modal
```
Components to create:
- UpgradeModal.tsx
- TierComparison.tsx
- PaymentForm.tsx
```

---

### Phase 3: Connect Components (Week 2)

#### 3.1 AAA Tier Components → Import Into

| Component | Import Into | Priority |
|-----------|------------|----------|
| `AAAServiceCard.tsx` | SearchPage.tsx, CategoryPage | P1 |
| `AAAHero.tsx` | HomePage.tsx | P1 |
| `AAABookingCard.tsx` | CustomerBookingsPage.tsx | P1 |
| `AAANotificationBadge.tsx` | NavigationHeader.tsx | P2 |
| `AAAPremiumBadge.tsx` | ProviderCard.tsx, ServiceCard.tsx | P1 |

#### 3.2 Premium Tier Components → Import Into

| Component | Import Into | Priority |
|-----------|------------|----------|
| `PremiumServiceCard.tsx` | SearchPage.tsx | P1 |
| `PremiumBookingCard.tsx` | CustomerBookingsPage.tsx | P1 |
| `PremiumStatCard.tsx` | CustomerDashboard.tsx | P1 |
| `PremiumHero.tsx` | HomePage.tsx | P2 |
| `PremiumCard.tsx` | Various | P1 |
| `PremiumBadge.tsx` | ServiceCard.tsx | P1 |

#### 3.3 Elite Tier Components → Import Into

| Component | Import Into | Priority |
|-----------|------------|----------|
| `EliteServiceCard.tsx` | SearchPage.tsx (filtered) | P2 |
| `EliteHero.tsx` | HomePage.tsx (premium users) | P2 |
| `EliteSkeleton.tsx` | Loading states | P2 |

---

### Phase 4: SuperApp Features (Week 2-3)

#### 4.1 Gamification System

| Component | Backend Connection |
|-----------|-----------------|
| `AchievementBadges.tsx` | Connect to `HabitEngine` service |
| `SmartQuickActions.tsx` | Connect to `PredictiveEngine` |
| `SpendingInsights.tsx` | Connect to `analytics.customer` |
| `SuperAppHome.tsx` | Create route `/customer/superapp` |

#### 4.2 Habits & Streaks

Backend routes needed:
```
GET  /api/habits/current
POST /api/habits/check-in
GET  /api/habits/streak
GET  /api/achievements
POST /api/achievements/unlock
```

#### 4.3 Points & Rewards

Backend routes needed:
```
GET  /api/loyalty/points
GET  /api/loyalty/tier
POST /api/loyalty/redeem
GET  /api/loyalty/history
```

---

### Phase 5: Mobile Integration (Week 3)

#### 5.1 Capacitor Integration
```typescript
// Use existing hooks:
// - useCapacitor.ts - Device detection
// - useHaptics.ts - Vibration feedback
// - usePerformance.ts - Performance monitoring
```

#### 5.2 Native Features
| Component | Feature |
|-----------|---------|
| `AppShell.tsx` | Mobile wrapper |
| `BottomSheet.tsx` | Native-like modals |
| `AnimatedBottomSheet.tsx` | Advanced bottom sheets |
| `LoadingSkeleton.tsx` | Optimized loading |

---

## FILE MANIFEST

### Components to Import

```
frontend/src/components/
├── mobile/
│   ├── AppShell.tsx           → Wrap mobile views
│   ├── BottomSheet.tsx         → Replace modal dialogs
│   ├── AnimatedBottomSheet.tsx  → Advanced modals
│   ├── LoadingSkeleton.tsx      → Replace spinners
│   ├── PremiumCard.tsx         → Replace cards
│   ├── PremiumServiceCard.tsx   → Replace service cards
│   ├── PremiumBookingCard.tsx   → Replace booking cards
│   ├── PremiumStatCard.tsx      → Replace stat cards
│   ├── PremiumHero.tsx         → Hero sections
│   ├── PremiumBadge.tsx         → Badges
│   ├── PremiumEmptyState.tsx    → Empty states
│   └── PageTransition.tsx       → Navigation transitions
├── aaa/
│   ├── AAAServiceCard.tsx      → Service display
│   ├── AAAHero.tsx             → Hero sections
│   ├── AAABookingCard.tsx      → Booking display
│   ├── AAANotificationBadge.tsx → Notification badge
│   └── index.ts               → Export barrel
├── elite/
│   ├── EliteServiceCard.tsx    → Exclusive services
│   ├── EliteHero.tsx           → Elite hero
│   ├── EliteSkeleton.tsx       → Loading state
│   └── index.ts               → Export barrel
├── superapp/
│   ├── SuperAppHome.tsx       → Main hub (needs route)
│   ├── AchievementBadges.tsx   → Gamification
│   ├── SmartQuickActions.tsx   → Quick actions
│   ├── SpendingInsights.tsx     → Insights
│   └── index.ts               → Export barrel
```

---

## BACKEND ROUTES NEEDED

### New Routes to Create

| Route | Method | Purpose | Priority |
|-------|--------|---------|----------|
| `/api/subscriptions/upgrade` | POST | Upgrade tier | P1 |
| `/api/subscriptions/cancel` | POST | Cancel subscription | P1 |
| `/api/subscriptions/current` | GET | Get subscription | P1 |
| `/api/habits/check-in` | POST | Daily check-in | P2 |
| `/api/habits/streak` | GET | Get streak | P2 |
| `/api/achievements` | GET | Get achievements | P2 |
| `/api/achievements/unlock` | POST | Unlock achievement | P2 |

---

## TASK BREAKDOWN

### Task 1: Backend Subscription Model
**Estimate:** 4 hours
**Files:**
- `backend/src/models/subscription.model.ts` (verify)
- `backend/src/routes/subscription.routes.ts` (create)
- `backend/src/controllers/subscription.controller.ts` (create)
- `backend/src/services/subscription.service.ts` (create)

### Task 2: Frontend Tier Infrastructure
**Estimate:** 6 hours
**Files:**
- `frontend/src/hooks/useSubscription.ts` (create)
- `frontend/src/components/tier/TierProvider.tsx` (create)
- `frontend/src/components/tier/TierBadge.tsx` (create)
- `frontend/src/pages/customer/SubscriptionPage.tsx` (create)

### Task 3: Connect AAA Components
**Estimate:** 8 hours
**Files:**
- SearchPage.tsx
- CategoryPage.tsx
- CustomerDashboard.tsx
- NavigationHeader.tsx
- HomePage.tsx

### Task 4: Connect Premium Components
**Estimate:** 8 hours
**Files:**
- SearchPage.tsx
- CustomerBookingsPage.tsx
- ServiceCard.tsx
- ProviderCard.tsx

### Task 5: Connect Elite Components
**Estimate:** 4 hours
**Files:**
- HomePage.tsx (conditional rendering)
- SearchPage.tsx (elite-only services)

### Task 6: SuperApp Integration
**Estimate:** 12 hours
**Files:**
- `frontend/src/pages/customer/SuperAppPage.tsx` (update route)
- `frontend/src/services/superapp/HabitEngine.ts` (connect)
- `frontend/src/services/superapp/RewardsEngine.ts` (connect)
- Backend routes for habits/achievements

### Task 7: Mobile Wrapper
**Estimate:** 4 hours
**Files:**
- App.tsx (wrap with AppShell when mobile)
- Create mobile detection logic

---

## DEPENDENCY GRAPH

```
Task 1 (Backend)
    ↓
Task 2 (Frontend Infrastructure)
    ↓
├── Task 3 (AAA) ──────────┐
├── Task 4 (Premium) ──────┼── Can be parallel
├── Task 5 (Elite) ───────┤
├── Task 6 (SuperApp) ─────┘
└── Task 7 (Mobile)
```

---

## SUCCESS CRITERIA

### Must Have (MVP)
- [ ] Backend subscription model works
- [ ] User tier stored in database
- [ ] Frontend can read tier
- [ ] AAA components render for AAA users
- [ ] Premium components render for Premium users
- [ ] Elite components render for Elite users
- [ ] Upgrade flow works

### Should Have
- [ ] SuperApp home renders
- [ ] Achievement badges display
- [ ] Habit tracking works
- [ ] Mobile wrapper active

### Nice to Have
- [ ] Haptic feedback on mobile
- [ ] Animated transitions
- [ ] Push notifications
- [ ] Deep linking

---

## ESTIMATED TIMELINE

| Phase | Tasks | Estimate |
|-------|-------|----------|
| Week 1 | Backend + Frontend Infrastructure | 10 hours |
| Week 2 | Component Connections | 24 hours |
| Week 3 | SuperApp + Mobile | 16 hours |
| **Total** | | **50 hours** |

---

## RISKS

| Risk | Mitigation |
|------|------------|
| Subscription payment integration complex | Start with manual upgrades |
| Performance impact of tier checks | Cache tier in auth store |
| Multiple component variants | Use conditional rendering |

---

## NEXT STEPS

1. **Start with Task 1** - Backend subscription model
2. **Create route** `/customer/subscription`
3. **Add tier to user model**
4. **Create TierProvider**
5. **Import one component** (e.g., PremiumBadge)
6. **Test tier switching**

---

## CURRENT PRIORITY ORDER

1. `PremiumBadge.tsx` → Add to ServiceCard
2. `PremiumCard.tsx` → Add to SearchPage
3. `AAAServiceCard.tsx` → Add to CategoryPage
4. `TierProvider.tsx` → Create
5. Backend subscription routes → Create

---

## QUICK START (This Week)

### Day 1-2: Backend Foundation
```bash
# Verify subscription model
cat backend/src/models/subscription.model.ts

# Create routes
cat > backend/src/routes/subscription.routes.ts << 'EOF'
// Create subscription upgrade/cancel routes
EOF
```

### Day 3-4: Frontend Tier System
```bash
# Create TierProvider
cat > frontend/src/components/tier/TierProvider.tsx << 'EOF'
// Tier-aware wrapper component
EOF

# Create useSubscription hook
cat > frontend/src/hooks/useSubscription.ts << 'EOF'
// Hook to read/update user tier
EOF
```

### Day 5: First Component
```tsx
// Import PremiumBadge into ServiceCard
import { PremiumBadge } from '../mobile/PremiumBadge';

// Use conditionally
{user.tier !== 'free' && <PremiumBadge tier={user.tier} />}
```

---

## CONCLUSION

The premium tier system is **ready to be connected**. Most infrastructure exists - just needs:

1. Backend routes for subscription management
2. Frontend tier provider
3. Import components into existing pages
4. Route for SuperApp

**Estimated effort: 50 hours across 3 weeks**
