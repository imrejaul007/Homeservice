# NILIN Marketplace Architecture

## Overview

NILIN is a home services marketplace platform connecting customers with service providers. The system is built with a modern microservices-inspired architecture using a monorepo structure for the frontend and backend.

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐   │
│  │   Web   │  │   PWA   │  │  Admin  │  │  Mobile (React) │   │
│  │   App   │  │   App   │  │   Panel │  │    (Android)    │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────────┬────────┘   │
└───────┼─────────────┼─────────────┼─────────────────┼───────────┘
        │             │             │                 │
        └─────────────┴──────┬──────┴─────────────────┘
                             │  HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (Express.js)                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Routes Layer                          │    │
│  │  auth │ booking │ provider │ service │ payment │ admin │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Middleware Layer                        │    │
│  │  auth │ validation │ security │ rate-limit │ cors       │    │
│  └─────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   MongoDB       │ │     Redis       │ │   Meilisearch   │
│   (Primary DB)  │ │    (Cache)     │ │   (Search)      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Backend Architecture

### Directory Structure

```
backend/src/
├── config/           # Configuration files (database, redis, sentry, etc.)
├── constants/        # Application constants (categories, etc.)
├── controllers/      # Route handlers (HTTP layer)
├── dto/              # Data Transfer Objects
├── domain/           # Domain entities and value objects
│   ├── entities/     # Business entities (User, Booking, Provider, Service)
│   └── value-objects/# Immutable value objects (Money, Address, etc.)
├── interfaces/       # TypeScript interfaces (contracts)
│   ├── service.interface.ts    # Service layer contracts
│   └── repository.interface.ts   # Data access contracts
├── jobs/             # Scheduled jobs (cron-like)
├── middleware/       # Express middleware
├── models/           # Mongoose schemas
├── queue/            # Background job queue
├── routes/           # Express routes
├── scripts/          # Standalone scripts (migrations, seeds)
├── seeders/          # Database seeders
├── services/         # Business logic layer
├── socket/           # WebSocket handlers
├── tests/            # Test files
├── utils/            # Utility functions
└── validation/       # Request validation schemas
```

### Architecture Layers

#### 1. Controllers (Presentation Layer)

Controllers handle HTTP requests and responses. They:
- Validate request parameters
- Call appropriate service methods
- Handle errors and return responses
- **Never contain business logic**

```typescript
// Example: booking.controller.ts
export const createBooking = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.user;
    const bookingData = req.body;
    const result = await bookingService.createCustomerBooking(customerId, bookingData);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
```

#### 2. Services (Business Logic Layer)

Services contain all business logic and:
- Implement use cases
- Coordinate between repositories
- Handle transactions
- Emit domain events

```typescript
// Example: booking.service.ts
export class BookingService {
  async createCustomerBooking(customerId: string, data: BookingInputDTO): Promise<BookingResult> {
    // Business logic here
    // Transaction handling
    // Event emission
  }
}
```

#### 3. Repositories (Data Access Layer)

Repositories abstract data access:
- CRUD operations on entities
- Query building
- Population handling
- Caching integration

```typescript
// Pattern used throughout the codebase
const booking = await Booking.findById(id).populate('serviceId');
```

#### 4. Models (Mongoose Schemas)

Models define data structures:
- Schema validation
- Indexes
- Middleware hooks
- Virtual properties

#### 5. Domain Layer (Entities & Value Objects)

Domain layer implements Domain-Driven Design principles:

**Entities** (have identity):
- `User` - User with roles (customer, provider, admin)
- `Booking` - Booking with full lifecycle management
- `Provider` - Service provider profile
- `Service` - Marketplace service/product

**Value Objects** (immutable, compared by value):
- `Money` - Currency with arithmetic operations
- `Address` - Physical address with geo calculations
- `BookingStatus` - Status with transition validation

### Domain Model

```
┌─────────────────┐     ┌─────────────────┐
│      User       │     │     Provider    │
├─────────────────┤     ├─────────────────┤
│ _id             │────<│ userId          │
│ email           │     │ businessName    │
│ role            │     │ location        │
│ preferences     │     │ isVerified      │
└─────────────────┘     │ averageRating   │
        │               └────────┬────────┘
        │                        │
        │                        │
        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│     Booking     │     │     Service     │
├─────────────────┤     ├─────────────────┤
│ _id             │     │ _id             │
│ bookingNumber   │     │ name            │
│ customerId ─────┼─────┼─ providerId    │
│ providerId      │     │ categoryId      │
│ serviceId ──────┼─────┼─ basePrice     │
│ status          │     │ duration        │
│ pricing         │     │ isActive        │
│ location        │     └─────────────────┘
│ statusHistory   │
└─────────────────┘
        │
        │
        ▼
┌─────────────────┐
│   Category      │
├─────────────────┤
│ _id             │
│ name            │
│ slug            │
│ subcategories[] │
│ parentId        │
└─────────────────┘
```

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── components/        # Reusable React components
│   ├── auth/          # Authentication components
│   ├── booking/       # Booking flow components
│   ├── common/        # Common UI components
│   ├── dashboard/     # Dashboard views
│   ├── home/          # Home page components
│   ├── layout/        # Layout components
│   └── ...
├── config/            # Frontend configuration
├── constants/         # Application constants
├── hooks/             # Custom React hooks
├── i18n/              # Internationalization
├── lib/               # Core libraries
├── pages/             # Page components
│   ├── admin/         # Admin pages
│   ├── booking/       # Booking pages
│   ├── customer/      # Customer pages
│   └── provider/      # Provider pages
├── services/          # API services (axios-based)
├── store/             # State management (Zustand stores)
├── styles/            # Global styles
├── theme/             # Theme configuration
├── types/             # TypeScript type definitions
└── utils/             # Utility functions
    ├── formatting.ts   # Formatting helpers
    └── validation.ts   # Validation helpers
```

### State Management

Uses Zustand for lightweight state management:

```typescript
// Example: authStore.ts
export const useAuthStore = create((set) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  login: async (credentials) => { /* ... */ },
  logout: () => set({ user: null, tokens: null, isAuthenticated: false }),
}));
```

### API Layer

Axios-based API services with:
- Automatic token refresh
- Request/response interceptors
- Error handling
- Retry logic

---

## Design Patterns

### 1. Dependency Injection

Services are instantiated with dependencies passed in:

```typescript
// Instead of importing directly
const bookingService = new BookingService({
  bookingModel: Booking,
  userModel: User,
  eventBus: eventBus,
});
```

### 2. Repository Pattern

Data access is abstracted through repository interfaces:

```typescript
// IBookingRepository
export interface IBookingRepository {
  findById(id: string): Promise<Booking | null>;
  findByCustomerId(customerId: string): Promise<Booking[]>;
  create(data: Partial<Booking>): Promise<Booking>;
  // ...
}
```

### 3. Service Interface Contracts

Services implement defined interfaces for consistency:

```typescript
// IServiceBase
export interface IServiceBase {
  initialize?(): Promise<void>;
  cleanup?(): Promise<void>;
}
```

### 4. Value Objects

Immutable objects for domain concepts:

```typescript
// Money value object
const price = Money.fromDecimal(99.99, 'USD');
const total = price.add(tax).format();
```

### 5. Event-Driven Architecture

Domain events trigger side effects:

```typescript
// Event emission
eventBus.emit(EVENT_TYPES.BOOKING_CONFIRMED, { bookingId, customerId });

// Event handling
eventBus.on(EVENT_TYPES.BOOKING_CONFIRMED, async (data) => {
  await notificationService.send(data.customerId, notification);
});
```

---

## Data Flow

### Booking Flow

```
Customer                    API                      Services
   │                         │                          │
   │── POST /bookings ─────>│                          │
   │                         │── validate ─────────────>│
   │                         │                          │
   │                         │── check availability ───>│
   │                         │                          │
   │                         │── calculate pricing ─────>│
   │                         │                          │
   │                         │── create booking ─────────>│
   │                         │                          │
   │                         │── emit event ────────────>│ (BookingCreated)
   │                         │                          │
   │<── 201 Created ─────────│                          │
   │                         │                          │
   │                         │<── Notifications ────────│ (async)
   │                         │<── Analytics ────────────│ (async)
```

---

## Security

### Authentication Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │     │   API   │     │  Redis  │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     │── login ─────>│               │
     │               │── validate ───>│
     │               │               │
     │               │<─ tokens ─────│
     │<── tokens ────│               │
     │               │               │
     │── /resource ─>│               │
     │               │── validate ───>│ (refresh token)
     │               │               │
     │               │<── session ───│
     │<── response ──│               │
```

### Security Measures

| Layer | Protection |
|-------|-----------|
| Transport | HTTPS/TLS 1.3 |
| API | Rate limiting, CORS, Helmet.js |
| Auth | JWT with refresh tokens, 2FA |
| Input | Validation, Sanitization |
| Data | Encryption at rest, Field-level encryption for PII |
| Audit | Full audit logging |

---

## Caching Strategy

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Client  │     │   API   │     │  Redis  │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     │── GET /───>   │               │
     │               │── cache? ────>│
     │               │               │
     │               │<── miss ──────│
     │               │── fetch ─────────> MongoDB
     │               │               │
     │               │── set ───────>│ (TTL: 5min)
     │<── response ──│               │
```

---

## Error Handling

### Error Response Format

```typescript
{
  success: false,
  error: {
    code: 'BOOKING_NOT_FOUND',
    message: 'The requested booking does not exist',
    details: {}
  },
  statusCode: 404
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |

---

## Deployment

### Environment Variables

```env
# Database
MONGODB_URI=mongodb://host:27017/nilin

# Redis
REDIS_URL=redis://host:6379

# Auth
JWT_SECRET=your-secret
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# External Services
SENDGRID_API_KEY=your-key
STRIPE_SECRET_KEY=your-key
SENTRY_DSN=your-dsn

# Search
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=your-key
```

---

## Monitoring & Observability

### Logging

Structured JSON logging with:
- Correlation IDs
- Request tracing
- Log levels (error, warn, info, debug)

### Metrics

Key metrics tracked:
- Request latency (p50, p95, p99)
- Error rate
- Active bookings
- User activity
- Revenue

### Alerting

| Metric | Threshold | Action |
|--------|-----------|--------|
| Error rate | > 5% | Page on-call |
| Latency p99 | > 2s | Page on-call |
| Queue depth | > 1000 | Email alert |
| Disk usage | > 80% | Email alert |

---

## Appendix: Key Files

### Backend Entry Points

| File | Purpose |
|------|---------|
| `src/server.ts` | Server initialization |
| `src/app.ts` | Express app configuration |
| `src/config/` | Configuration loaders |

### Core Services

| Service | Responsibility |
|---------|----------------|
| `booking.service.ts` | Booking lifecycle |
| `payment.service.ts` | Payment processing |
| `auth.service.ts` | Authentication |
| `notification.service.ts` | Notifications |
| `search.service.ts` | Full-text search |
| `provider.service.ts` | Provider management |

### Frontend Services

| Service | Responsibility |
|---------|----------------|
| `api.ts` | Core HTTP client |
| `auth.api.ts` | Auth endpoints |
| `booking.service.ts` | Booking API |
| `SocketService.ts` | Real-time updates |

---

## Future Considerations

1. **GraphQL API** - For more flexible querying
2. **Event Sourcing** - For audit trails
3. **CQRS** - Separate read/write models
4. **Service Decomposition** - Split into microservices
5. **GraphQL Subscriptions** - Real-time updates

---

*Last updated: 2026-05-15*
