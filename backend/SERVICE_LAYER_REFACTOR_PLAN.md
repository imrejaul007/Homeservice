# Service Layer Refactor - Implementation Plan

## Overview

**Problem:** Controllers are oversized (auth: 50KB, booking: 41KB) with business logic mixed with HTTP handling.

**Goal:** Extract business logic into service layer, making controllers thin and focused on HTTP concerns.

---

## Target Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Routes      │ ──▶ │   Controllers   │ ──▶ │    Services     │
│  (HTTP Layer)   │     │  (Thin, HTTP)   │     │  (Business)     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────┐               │
                        │    Models       │ ◀──────────────┘
                        │  (Data Layer)  │
                        └─────────────────┘
```

---

## Current State Analysis

### Controller File Sizes
| Controller | Size | Lines | Responsibilities |
|------------|------|-------|------------------|
| `auth.controller.ts` | 50KB | 1,607 | Auth, registration, tokens, profiles |
| `booking.controller.ts` | 41KB | 1,292 | Booking CRUD, state transitions, notifications |
| `provider.controller.ts` | 18KB | ~600 | Provider profile, services management |
| `availability.controller.ts` | 18KB | ~600 | Provider availability management |
| `search.controller.ts` | 21KB | ~700 | Search, filters, recommendations |
| `admin.controller.ts` | 28KB | ~900 | Admin operations |

### Business Logic Found in Controllers
1. **Token Generation** - Should be in `AuthService`
2. **Customer Registration** - Should be in `AuthService.registerCustomer()`
3. **Provider Registration** - Should be in `AuthService.registerProvider()`
4. **Login Logic** - Should be in `AuthService.login()`
5. **Booking State Machine** - Should be in `BookingService`
6. **Pricing Calculations** - Should be in `BookingService.calculatePricing()`
7. **Notification Generation** - Should be in `NotificationService`
8. **Analytics Updates** - Should be in `AnalyticsService`

---

## Phase 1: Create Service Layer Structure

### Directory Structure
```
backend/src/
├── services/
│   ├── auth.service.ts      # Auth business logic
│   ├── booking.service.ts    # Booking business logic
│   ├── provider.service.ts   # Provider business logic
│   ├── notification.service.ts  # Notification logic
│   └── analytics.service.ts # Analytics calculations
├── controllers/
│   └── (refactored - thin)
├── dto/                    # Data Transfer Objects
│   ├── auth.dto.ts
│   ├── booking.dto.ts
│   └── provider.dto.ts
└── interfaces/
    └── service.interface.ts
```

---

## Phase 2: AuthService Implementation

### File: `backend/src/services/auth.service.ts`

```typescript
// Responsibilities:
// - User registration (customer/provider/admin)
// - Login/logout logic
// - Token generation and validation
// - Password reset flow
// - Profile management

export class AuthService {
  // Registration methods
  async registerCustomer(data: CustomerRegistrationDTO): Promise<AuthResult>
  async registerProvider(data: ProviderRegistrationDTO): Promise<AuthResult>
  async registerAdmin(data: AdminRegistrationDTO, creatorId: string): Promise<AuthResult>

  // Authentication methods
  async login(email: string, password: string, ip?: string): Promise<LoginResult>
  async logout(userId: string, refreshToken: string): Promise<void>
  async logoutAll(userId: string): Promise<void>
  async refreshToken(token: string): Promise<TokenResult>

  // Password management
  async forgotPassword(email: string): Promise<void>
  async resetPassword(token: string, password: string): Promise<AuthResult>
  async changePassword(userId: string, current: string, next: string): Promise<TokenResult>

  // Email verification
  async verifyEmail(token: string): Promise<VerificationResult>
  async resendVerificationEmail(email: string): Promise<void>

  // Profile
  async getProfile(userId: string): Promise<UserProfile>
  async updateProfile(userId: string, updates: ProfileUpdates): Promise<UserProfile>

  // Internal helpers
  private generateTokens(user: User): { accessToken: string; refreshToken: string }
  private validateRefreshToken(token: string, userId: string): Promise<boolean>
  private awardReferralBonus(referrerId: string, newUserId: string): Promise<void>
}
```

### DTOs for Auth

```typescript
// backend/src/dto/auth.dto.ts

export interface CustomerRegistrationDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: AddressDTO;
  communicationPreferences?: CommunicationPrefsDTO;
  referralCode?: string;
}

export interface ProviderRegistrationDTO {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  dateOfBirth?: string;
  businessInfo: BusinessInfoDTO;
  locationInfo: LocationInfoDTO;
  services: ServiceInputDTO[];
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResult {
  user: UserResponse;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
  requiresEmailVerification: boolean;
}

export interface LoginResult extends AuthResult {
  redirectUrl: string;
  roleSpecificData?: CustomerProfileData | ProviderProfileData;
}
```

---

## Phase 3: BookingService Implementation

### File: `backend/src/services/booking.service.ts`

```typescript
// Responsibilities:
// - Create bookings (customer & guest)
// - Booking state transitions (accept, reject, start, complete, cancel)
// - Pricing calculations
// - Availability validation
// - Refund calculations

export class BookingService {
  // Booking creation
  async createCustomerBooking(
    customerId: string,
    data: BookingInputDTO
  ): Promise<BookingResult>

  async createGuestBooking(data: GuestBookingInputDTO): Promise<GuestBookingResult>

  // Booking retrieval
  async getCustomerBookings(
    customerId: string,
    filters: BookingFilters
  ): Promise<PaginatedResult<Booking>>

  async getProviderBookings(
    providerId: string,
    filters: BookingFilters
  ): Promise<PaginatedResult<Booking>>

  async getBookingById(bookingId: string): Promise<Booking | null>

  async trackBooking(bookingNumber: string): Promise<PublicBookingInfo>

  // State transitions
  async acceptBooking(bookingId: string, providerId: string, notes?: string): Promise<Booking>
  async rejectBooking(bookingId: string, providerId: string, reason?: string): Promise<Booking>
  async startBooking(bookingId: string, providerId: string, notes?: string): Promise<Booking>
  async completeBooking(bookingId: string, providerId: string, notes?: string): Promise<Booking>
  async cancelBooking(bookingId: string, customerId: string, reason?: string): Promise<CancellationResult>

  // Communication
  async addMessage(bookingId: string, userId: string, message: string): Promise<void>

  // Internal helpers
  private calculatePricing(service: Service, addOns: AddOn[], duration?: number): PricingResult
  private validateAvailability(params: AvailabilityParams): Promise<AvailabilityResult>
  private calculateRefund(booking: Booking): RefundResult
  private generateBookingNumber(): string
}
```

### Booking State Machine

```
┌──────────┐
│ pending  │ ◀─── Create booking (customer/guest)
└────┬─────┘
     │
     ├──────────────────────┬─────────────────┐
     ▼                      ▼                 ▼
┌──────────┐          ┌──────────┐      ┌──────────┐
│accepted/ │          │ cancelled │      │ cancelled │
│confirmed │          │(customer) │      │(provider) │
└────┬─────┘          └───────────┘      └───────────┘
     │
     ▼
┌──────────┐
│in_progress│ ◀─── Provider starts service
└────┬─────┘
     │
     ▼
┌──────────┐
│ completed │ ◀─── Provider completes service
└───────────┘
```

---

## Phase 4: NotificationService Implementation

### File: `backend/src/services/notification.service.ts`

```typescript
export class NotificationService {
  async sendBookingCreated(booking: Booking): Promise<void>
  async sendBookingConfirmed(booking: Booking): Promise<void>
  async sendBookingCancelled(booking: Booking, cancelledBy: 'customer' | 'provider'): Promise<void>
  async sendBookingStarted(booking: Booking): Promise<void>
  async sendBookingCompleted(booking: Booking): Promise<void>
  async sendBookingMessage(booking: Booking, recipientId: string): Promise<void>

  // In-app notifications
  async createInAppNotification(data: NotificationData): Promise<void>

  // Email notifications
  async sendEmail(type: EmailType, data: EmailData): Promise<void>
}
```

---

## Phase 5: AnalyticsService Implementation

### File: `backend/src/services/analytics.service.ts`

```typescript
export class AnalyticsService {
  async updateProviderAnalytics(providerId: string): Promise<void>
  async updateCustomerAnalytics(customerId: string): Promise<void>
  async calculateProviderMetrics(providerId: string): Promise<ProviderMetrics>
  async calculateBookingStats(providerId: string): Promise<BookingStats>
}
```

---

## Phase 6: Controller Refactoring

### Before (Oversized Controller)
```typescript
// auth.controller.ts - 1607 lines
export const registerCustomer = asyncHandler(async (req, res) => {
  // Validation
  // User creation
  // Profile creation
  // Referral logic
  // Loyalty points
  // Token generation
  // Cookie setting
  // Response formatting
});
```

### After (Thin Controller)
```typescript
// auth.controller.ts - ~100 lines
export const registerCustomer = asyncHandler(async (req, res) => {
  const dto = registerCustomerSchema.parse(req.body);
  const result = await authService.registerCustomer(dto);

  if (result.tokens.refreshToken) {
    res.cookie('refreshToken', result.tokens.refreshToken, getCookieOptions(30 * days));
  }

  res.status(201).json({
    success: true,
    message: 'Customer registration successful!',
    data: result
  });
});
```

---

## Implementation Order

### Week 1: Foundation
| Day | Task | Files Created |
|-----|------|---------------|
| 1 | Create directory structure | - |
| 1 | Create DTOs | `dto/*.ts` |
| 2-3 | Implement AuthService | `services/auth.service.ts` |
| 4 | Refactor auth.controller.ts | `controllers/auth.controller.ts` |
| 5 | Test auth flow | - |

### Week 2: Booking
| Day | Task | Files Created |
|-----|------|---------------|
| 1-2 | Implement BookingService | `services/booking.service.ts` |
| 2 | Implement NotificationService | `services/notification.service.ts` |
| 3 | Implement AnalyticsService | `services/analytics.service.ts` |
| 4-5 | Refactor booking.controller.ts | `controllers/booking.controller.ts` |

### Week 3: Remaining Services
| Day | Task | Files Created |
|-----|------|---------------|
| 1-2 | Implement ProviderService | `services/provider.service.ts` |
| 2-3 | Refactor provider.controller.ts | `controllers/provider.controller.ts` |
| 4-5 | Refactor availability.controller.ts | `controllers/availability.controller.ts` |

### Week 4: Polish
| Day | Task |
|-----|------|
| 1-2 | Add unit tests for services |
| 3 | Update documentation |
| 4 | Performance testing |
| 5 | Code review & cleanup |

---

## Testing Strategy

### Unit Tests (for each service)
```typescript
// services/__tests__/auth.service.test.ts
describe('AuthService', () => {
  describe('registerCustomer', () => {
    it('should create user and profile', async () => { ... });
    it('should award referral bonus', async () => { ... });
    it('should reject duplicate email', async () => { ... });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => { ... });
    it('should increment login attempts on failure', async () => { ... });
    it('should lock account after 5 failed attempts', async () => { ... });
  });
});
```

### Integration Tests
- Full auth flow (register → login → refresh → logout)
- Full booking flow (create → accept → complete)

---

## Rollback Plan

If issues arise:
1. Keep original controllers as `*.controller.backup.ts`
2. Revert route imports to point to backup
3. Run existing tests to verify baseline

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Controller max size | 50KB | < 15KB |
| Service test coverage | 0% | > 80% |
| Business logic in services | 0% | > 90% |
| Controller complexity | High | Low |

---

## Next Steps After Refactor

1. **Add Redis caching** for frequently accessed data
2. **Implement repository pattern** for data access
3. **Add dependency injection** container (e.g., tsyringe)
4. **Add event-driven architecture** for async operations
5. **Implement CQRS** for read/write separation
