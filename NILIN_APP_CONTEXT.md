# Nilin App - Context File for AI Assistants

## Overview
Nilin is an **enterprise-scale home services marketplace platform** with three user roles:
- **Customer** - Book services, manage bookings, wallet, rewards
- **Provider** - Offer services, manage bookings, view analytics, earnings
- **Admin** - Platform management, analytics, moderation, settings

Tech Stack:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **State**: Zustand (stores) + React Context
- **Real-time**: WebSocket (Socket.IO)
- **Offline**: PWA support with offline sync

---

## All Routes / Pages

### Public Routes (No Auth)
| Route | Page |
|-------|------|
| `/` | HomePage |
| `/search`, `/services` | SearchPage |
| `/services/:id` | ServiceDetailPage |
| `/category/:slug` | CategoryPage |
| `/provider/:id` | ProviderDetailPage |
| `/book/:serviceId` | BookServicePage |
| `/track`, `/track/:bookingNumber` | TrackBookingPage |
| `/packages`, `/packages/:id`, `/packages/compare` | PackagesPage |
| `/experiences`, `/trending` | ExperiencesPage, TrendingPage |
| `/about`, `/contact`, `/help`, `/faq` | Info pages |
| `/privacy`, `/terms`, `/cookies` | Legal pages |

### Auth Routes
| Route | Page |
|-------|------|
| `/login` | LoginForm |
| `/register/customer`, `/register/provider` | Registration |
| `/forgot-password`, `/reset-password/:token` | Password recovery |
| `/verify-email/:token` | Email verification |

### Customer Routes (Protected)
| Route | Page |
|-------|------|
| `/customer` | → `/customer/dashboard` |
| `/customer/dashboard` | CustomerDashboardEnhanced |
| `/customer/bookings`, `/customer/bookings/:bookingId` | Bookings |
| `/customer/profile` | ProfilePage |
| `/customer/favorites`, `/customer/wishlist` | Favorites |
| `/customer/wallet`, `/customer/transactions` | Wallet |
| `/customer/addresses` | AddressesPage |
| `/customer/notifications` | NotificationsPage |
| `/customer/reviews` | ReviewsPage |
| `/customer/support`, `/customer/support/tickets/:ticketId` | Support |
| `/customer/messages` | MessagesPage |
| `/subscriptions`, `/subscriptions/manage` | Subscriptions |
| `/customer/rewards`, `/customer/my-claims` | Rewards/Loyalty |

### Provider Routes (Protected)
| Route | Page |
|-------|------|
| `/provider/dashboard` | ProviderDashboard |
| `/provider/services` | ServiceManagementPage |
| `/provider/bookings`, `/provider/bookings/:bookingId` | Bookings |
| `/provider/availability` | ProviderAvailabilityPage |
| `/provider/calendar` | ProviderCalendarPage |
| `/provider/profile` | ProviderProfilePage |
| `/provider/portfolio` | ProviderPortfolioPage |
| `/provider/analytics` | ProviderAnalyticsPage |
| `/provider/earnings`, `/provider/earnings-report` | Earnings |
| `/provider/verification` | ProviderVerificationPage |
| `/provider/reviews` | ProviderReviewsPage |
| `/provider/ads` | AdsPage |
| `/provider/settings` | ProviderSettingsPage |
| `/provider/bundles`, `/provider/bundles/:id/analytics` | Bundles |
| `/provider/operations` | OperationsDashboard |
| `/provider/payouts` | PayoutDashboard |

### Admin Routes (Protected)
| Route | Page |
|-------|------|
| `/admin` | → `/admin/dashboard` |
| `/admin/dashboard` | AdminDashboard |
| `/admin/categories` | CategoryManagement |
| `/admin/providers` | ProviderManagement |
| `/admin/offers` | AdminOffersManagement |
| `/admin/reviews` | ReviewModeration |
| `/admin/coupons` | CouponManagement |
| `/admin/api-keys` | ApiKeyManagement |
| `/admin/payouts` | PayoutManagement |
| `/admin/support` | AdminSupportPage |
| `/admin/settings` | AdminSettings |
| `/admin/reports` | AdminReports |
| `/admin/churn` | ChurnReport |
| `/admin/curated-trending` | CuratedTrendingManagement |
| `/admin/maintenance` | MaintenanceMode |
| `/admin/chatbot-builder` | ChatbotBuilderPage |

### Admin Analytics Pages
| Route | Page |
|-------|------|
| `/admin/analytics` | AnalyticsDashboard |
| `/admin/executive` | ExecutiveDashboard |
| `/admin/launch` | LaunchDashboard |
| `/admin/anomaly` | AnomalyDashboard |
| `/admin/search-analytics` | SearchAnalyticsDashboard |
| `/admin/fraud` | FraudReport |
| `/admin/bookings` | BookingManagement |
| `/admin/customers` | CustomerManagement |
| `/admin/disputes` | DisputeCenter |
| `/admin/refunds` | RefundManagement |
| `/admin/bundles` | BundleManagement |
| `/admin/providers/metrics` | ProviderMetricsDashboard |

### Error/Special Pages
| Route | Page |
|-------|------|
| `/account-suspended` | AccountSuspended |
| `/provider/verification-pending` | VerificationPending |
| `/account-deactivated` | AccountDeactivated |
| `/unauthorized` | Unauthorized |
| `*` (404) | NotFound |

---

## Dashboard Components

### Admin Dashboards (`/components/admin/`, `/pages/admin/`)
- `AdminDashboard.tsx` - Main admin dashboard (61KB)
- `AnalyticsDashboard.tsx` - Analytics hub (48KB)
- `ExecutiveDashboard.tsx` - Executive metrics (32KB)
- `LaunchDashboard.tsx` - Launch monitoring
- `AnomalyDashboard.tsx` - Anomaly detection (34KB)
- `ChurnReport.tsx` - Churn analytics
- `FraudReport.tsx` - Fraud analytics

### Provider Dashboards (`/components/provider/`)
- `ProviderDashboard.tsx` - Main provider dashboard (81KB)
- OperationsDashboard.tsx - Operations view
- PayoutDashboard.tsx - Payout management

### Customer Dashboards (`/components/dashboard/`)
- `CustomerDashboardEnhanced.tsx` - Customer dashboard
- `OngoingBookings.tsx` - Active bookings
- `UpcomingBookings.tsx` - Upcoming bookings
- `NotificationsSection.tsx` - Notifications

---

## Component Organization

```
/frontend/src/components/
├── admin/           # Admin-specific components
│   ├── AdminNav.tsx           # Sidebar navigation
│   ├── AdminTable.tsx         # Generic data table
│   ├── settings/              # Admin settings sub-components
│   └── ...
├── auth/            # Authentication components
│   ├── LoginForm.tsx
│   ├── CustomerRegistration.tsx
│   ├── ProviderRegistration.tsx
│   └── ProtectedRoute.tsx    # Route guards
├── booking/         # Booking components
├── common/          # Shared components
│   ├── Toast/       # Toast notifications
│   ├── Modal.tsx
│   └── ...
├── customer/        # Customer-specific components
│   ├── BookingCard.tsx
│   ├── ServiceCard.tsx
│   └── ...
├── dashboard/       # Dashboard components
├── layout/         # Layout components
│   ├── NavigationHeader.tsx
│   ├── Footer.tsx
│   └── BottomNav.tsx
├── provider/       # Provider-specific components
│   ├── ServiceManagement.tsx
│   ├── CalendarView.tsx
│   ├── AddServiceModal.tsx
│   └── ...
├── ui/             # Design system primitives
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Modal.tsx
│   └── ...
└── analytics/      # Analytics components
    ├── admin/
    ├── customer/
    └── provider/
```

---

## Key Services / API Layer

### Frontend Services (`/services/`)
| Service | Purpose |
|---------|---------|
| `api.ts` | Base Axios client with retry, CSRF |
| `AuthService.ts` | Authentication |
| `BookingService.ts` | Booking operations |
| `PaymentService.ts` | Payment processing |
| `searchApi.ts` | Search functionality |
| `analyticsApi.ts` | Analytics data |
| `adminApiKeyApi.ts` | Admin API keys |
| `OfflineSync.ts` | Offline support |
| `socket.ts` | WebSocket connection |

### Backend Routes (`/routes/`)
| Route | Purpose |
|-------|---------|
| `auth.routes.ts` | Authentication |
| `booking.routes.ts` | Bookings |
| `payment.routes.ts` | Payments |
| `customer.routes.ts` | Customer ops |
| `provider.routes.ts` | Provider ops |
| `admin.routes.ts` | Admin ops |
| `marketplace.routes.ts` | Marketplace |
| `analytics.routes.ts` | Analytics |
| `churn.routes.ts` | Churn analytics |
| `dispute.routes.ts` | Disputes |
| `ai.routes.ts` | AI endpoints |

---

## State Management

### Zustand Stores (`/stores/`)
| Store | Purpose |
|-------|---------|
| `authStore.ts` | Authentication state |
| `bookingStore.ts` | Booking state |
| `paymentStore.ts` | Payment state |
| `searchStore.ts` | Search state |
| `favoritesStore.ts` | Favorites |
| `subscriptionStore.ts` | Subscriptions |

### Context Providers (`/context/`)
- `PlatformConfigProvider` - Platform config
- `ToastProvider` - Toast notifications
- `SearchModalProvider` - Search modal state
- `AnalyticsProvider` - Analytics tracking

---

## Navigation Structure

### Header (Desktop)
- Logo + Search bar (triggers SearchModal)
- Category quick links
- Notification bell
- User menu (role-based)

### Sidebar (Admin)
- `AdminNav.tsx` with icon-based navigation
- Sections: Overview, Management, Analytics, Settings

### Mobile
- `BottomNav.tsx` / `MobileBottomNav.tsx`
- Tabs: Home, Search, Bookings, Profile, Menu

### Route Guards
- `ProtectedRoute` - Requires auth
- `CustomerRoute` - Customer role only
- `ProviderRoute` - Provider role only
- `AdminRoute` - Admin role only

---

## UI Components Library (`/components/ui/`)

### Primitives
- `Button.tsx` - Button variants
- `Card.tsx` - Card containers
- `Input.tsx` - Form inputs
- `Modal.tsx` - Dialogs
- `Badge.tsx` - Status badges
- `LoadingSpinner.tsx` - Spinners

### Advanced
- `3d-card.tsx` - 3D card effects
- `Sparkles.tsx` - Particle effects
- `Spotlight.tsx` - Spotlight effects
- `CanvasRevealEffect.tsx` - Canvas animations

---

## Custom Hooks (`/hooks/`)
| Hook | Purpose |
|------|---------|
| `useAuthGuard.ts` | Auth protection |
| `useAnalytics.ts` | Analytics tracking |
| `useSocket.ts` | WebSocket |
| `useGlobalSearch.tsx` | Search |
| `usePermissions.ts` | RBAC |
| `useOfflineSync.ts` | Offline support |
| `useRecommendations.ts` | AI recommendations |

---

## Key Files for Reference

### Frontend Entry Points
- `frontend/src/App.tsx` - Main app with routing
- `frontend/src/main.tsx` - React entry
- `frontend/src/index.css` - Global styles

### Backend Entry Points
- `backend/src/index.ts` - Express app
- `backend/src/app.ts` - App configuration

### Environment Files
- `.env` - Environment variables
- `frontend/.env` - Frontend config
- `backend/.env` - Backend config

---

## Design System

### Colors (Tailwind custom colors)
- `nilin-primary` / `nilin-coral` - Primary brand
- `nilin-rose` - Error/warning
- `nilin-warmGray` - Muted text
- `nilin-border` - Borders
- `nilin-lightBg` - Background

### Typography
- Tailwind default font stack
- Custom font configuration in `tailwind.config.js`

---

## Feature Highlights

### Real-time Features
- Live booking tracking
- WebSocket notifications
- Real-time chat

### Offline Support
- PWA with service worker
- Offline booking queue
- Delta sync engine

### AI/ML Features
- Churn prediction
- Fraud detection
- Demand forecasting
- Smart pricing
- Recommendations

### Analytics
- Admin dashboards
- Provider earnings
- Customer behavior
- Marketplace metrics

---

## Development Notes

### File Naming Conventions
- Components: PascalCase (`ServiceCard.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Stores: camelCase with `Store` suffix (`authStore.ts`)
- Utils: camelCase (`formatCurrency.ts`)
- Types: PascalCase (`Service.types.ts`)

### Common Imports
```typescript
// Component imports
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

// Service imports
import { authService } from '@/services/AuthService';
import { bookingService } from '@/services/BookingService';

// Store imports
import { useAuthStore } from '@/stores/authStore';
import { useBookingStore } from '@/stores/bookingStore';
```

### API Base URL
- Development: `http://localhost:5000/api`
- Production: Configured via environment

---

## Stats
- **Frontend Pages**: ~80+
- **Admin Pages**: 30+
- **API Routes**: 100+
- **Components**: 200+
- **Hooks**: 40+
- **Zustand Stores**: 12
