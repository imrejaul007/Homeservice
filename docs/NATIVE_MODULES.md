# Native Module Strategy

## Critical Native Modules

### 1. Payment Module

**Why Native:**
- PCI compliance
- Biometric auth
- Apple Pay / Google Pay
- Secure enclave

**Implementation:**
```typescript
// NativeBridge.ts
import { NativeModules } from 'react-native';

interface PaymentModule {
  processPayment(params: PaymentParams): Promise<PaymentResult>;
  requestApplePay(cart: Cart): Promise<ApplePayResult>;
  requestGooglePay(config: GooglePayConfig): Promise<GooglePayResult>;
  authenticateWithBiometrics(): Promise<BiometricResult>;
}

export const PaymentBridge: PaymentModule = NativeModules.PaymentModule;
```

### 2. Location Module

**Why Native:**
- Background location
- Battery optimization
- Geofencing

**Implementation:**
```typescript
interface LocationModule {
  startTracking(options: TrackingOptions): void;
  stopTracking(): void;
  getCurrentPosition(): Promise<Position>;
  watchPosition(callback: PositionCallback): Subscription;
}
```

### 3. Push Notification Module

**Why Native:**
- Background delivery
- Action buttons
- Rich notifications

### 4. Camera Module

**Why Native:**
- Performance
- Filters
- QR scanning
