# ADR-005: Mobile Approach

**Date:** 2024-02-01
**Status:** Accepted
**Deciders:** Engineering Team

## Context

We need a mobile app but don't have resources for separate iOS/Android development.

## Decision

We will use **Capacitor** to wrap the web app for mobile platforms.

## Rationale

### Benefits
1. **Single Codebase**: Web + Mobile from one codebase
2. **Native Features**: Camera, push notifications, etc.
3. **Fast Development**: Web technologies
4. **App Store**: Access to mobile stores

### Limitations
1. **Performance**: Not as fast as native
2. **Native Features**: Limited to Capacitor plugins
3. **App Size**: Larger than native

## Alternatives Considered

### React Native
- Pros: Native performance
- Cons: Different codebase, more complex

### Flutter
- Pros: Native performance, good DX
- Cons: Different codebase, Dart required

### Native Apps
- Pros: Best performance
- Cons: 2x development effort

## Implementation

### Capacitor Plugins Used
- @capacitor/camera
- @capacitor/push-notifications
- @capacitor/geolocation
- @capacitor/local-notifications
- @capacitor/haptics

### Build Process
```bash
npm run build
npx cap sync
npx cap open android
npx cap open ios
```

## Consequences

### Positive
- Fast to develop
- Single team can maintain
- Easy updates

### Negative
- Performance trade-offs
- Platform-specific issues
- Larger app size
