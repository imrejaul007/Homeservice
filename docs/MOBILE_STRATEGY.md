# NILIN Mobile Strategy

## Current State: Capacitor

**Pros:**
- Single codebase for web + mobile
- Fast iteration cycle
- Web team can maintain

**Cons:**
- WebView performance limitations
- No native performance for animations
- Limited native API access
- App Store restrictions on WebView-heavy apps
- Battery consumption

## Recommended Approach: Hybrid Strategy

### Phase 1: Critical Native Modules (3 months)
Convert performance-critical screens to native:

1. **Booking Flow** → Native
   - Service selection
   - Provider selection
   - Time slot picker
   - Checkout

2. **Provider Live Tracking** → Native
   - Real-time GPS tracking
   - Map integration
   - Notifications

3. **Payment** → Native
   - Apple Pay / Google Pay
   - Biometric auth
   - Secure token handling

### Phase 2: Core Native Screens (6 months)
1. Home & Discovery
2. User Profile
3. Provider Dashboard
4. Chat/Messaging

### Phase 3: Full Native (12 months)
Migration complete with shared business logic layer.

## Migration Architecture

```
┌─────────────────────────────────────────┐
│              React Native                  │
│  ┌─────────────┐  ┌──────────────────┐     │
│  │   Screens  │  │   Components     │     │
│  │  (Native)  │  │   (Shared)      │     │
│  └─────────────┘  └──────────────────┘     │
│         │                │                 │
│  ┌─────┴────────────────────────┐          │
│  │     Business Logic Layer    │          │
│  │   (TypeScript / Zustand)  │          │
│  └───────────────────────────┘          │
│                   │                    │
│  ┌────────────────┴────────────────┐   │
│  │         Native Modules           │   │
│  │  (Payments, Maps, Push)        │   │
│  └───────────────────────────────┘      │
└─────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native 0.75+ |
| Language | TypeScript 5+ |
| State | Zustand + React Query |
| Navigation | React Navigation 6 |
| Native Modules | Turbo Modules |
| Payments | react-native-stripe |
| Maps | react-native-maps |
| Analytics | react-native-sentry |
| CI/CD | GitHub Actions |

## Critical Files to Convert First

1. `BookingFormWizard.tsx` → Native module
2. `NavigationHeader.tsx` → Native navigation
3. `BookingTracker.tsx` → Native GPS + Maps
4. Payment screens → Native Stripe

## Effort Estimate

| Screen | Complexity | Weeks |
|--------|------------|-------|
| Booking Flow | High | 8 |
| Live Tracking | High | 6 |
| Payments | Medium | 4 |
| Chat | High | 10 |
| Home | Medium | 4 |
| Profile | Low | 2 |
| **Total** | | **34 weeks** |

## Rollback Plan

1. Keep Capacitor build as fallback
2. Feature flags for native/web toggle
3. A/B test performance metrics
4. Gradual rollout by user segment
