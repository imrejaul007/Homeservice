# Home Service Marketplace - Frontend

A comprehensive React + TypeScript frontend for a home services marketplace platform, built with Vite, TailwindCSS, and React Query.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Routing**: React Router v6
- **Styling**: TailwindCSS with custom design system
- **State Management**: Zustand for global state
- **Server State**: TanStack Query (React Query)
- **Forms**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives
- **Charts**: Recharts
- **Animations**: Framer Motion, GSAP, Three.js
- **Maps**: React Leaflet
- **Mobile**: Capacitor for iOS/Android
- **Analytics**: Custom analytics services
- **Error Tracking**: Sentry
- **i18n**: i18next
- **Testing**: Vitest, Playwright

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Mobile Development

```bash
# Install Capacitor
npm run cap:sync

# Open in Android Studio
npm run cap:open

# Build Android APK
npm run cap:build

# Build release APK
npm run cap:build:release
```

## Features

### Core Features

#### 1. Authentication & Onboarding
- Email/password registration and login
- Social authentication (Google, Apple)
- Biometric authentication (mobile)
- Multi-step onboarding flow
- Profile completion wizard

#### 2. Service Marketplace
- Browse services by category
- Advanced search with filters
- Location-based service discovery
- Service comparison
- Service bundles/packages
- Real-time availability checking

#### 3. Booking System
- Instant booking
- Date/time slot selection
- Recurring bookings
- Booking management (view, cancel, reschedule)
- Booking history
- Booking reminders and notifications

#### 4. Provider Features
- Provider profile pages
- Service portfolio
- Availability calendar
- Booking management
- Earnings dashboard
- Performance analytics
- Service management (CRUD)

#### 5. Payment & Wallet
- Multiple payment methods
- In-app wallet
- Auto-topup
- Corporate billing
- Transaction history
- Payment security (3D Secure)

#### 6. Reviews & Ratings
- Leave reviews after service
- Photo reviews
- Provider response to reviews
- Review filtering and sorting

#### 7. SuperApp Features

##### Loyalty & Rewards
- Points system
- Tiered loyalty (Bronze, Silver, Gold, Platinum)
- Cashback rewards
- Vouchers and credits
- Achievement badges

##### Habit & Engagement
- Daily check-in streaks
- Weekly challenges
- Achievement system
- Milestone celebrations
- Re-engagement nudges

##### SuperApp Dashboard
- Personalized recommendations
- Spending insights
- Customer health score
- Engagement metrics

#### 8. Communication
- In-app chat
- Real-time messaging
- Push notifications
- Email notifications
- SMS notifications (WhatsApp)

#### 9. Additional Features
- Favorites and wishlist
- Saved addresses
- Service history
- Offline support
- PWA capabilities
- Dark mode

### Admin Features

- Dashboard with analytics
- User management
- Provider management
- Service moderation
- Booking oversight
- Review moderation
- Customer health scores
- Anomaly detection
- Report generation
- System health monitoring

## Pages & Routes

### Public Pages
- `/` - Home page
- `/search` - Search results
- `/services/:id` - Service details
- `/providers/:id` - Provider profile
- `/category/:slug` - Category listing
- `/login` - User login
- `/register` - User registration
- `/forgot-password` - Password recovery

### Customer Pages
- `/dashboard` - Customer dashboard
- `/bookings` - My bookings
- `/bookings/:id` - Booking details
- `/wallet` - Wallet management
- `/rewards` - Rewards and loyalty
- `/favorites` - Saved favorites
- `/addresses` - Manage addresses
- `/reviews` - My reviews
- `/settings` - Account settings
- `/notifications` - Notification preferences

### Provider Pages
- `/provider/dashboard` - Provider dashboard
- `/provider/services` - Manage services
- `/provider/services/new` - Create service
- `/provider/services/:id/edit` - Edit service
- `/provider/bookings` - Manage bookings
- `/provider/earnings` - Earnings overview
- `/provider/analytics` - Performance analytics
- `/provider/chat` - Messages
- `/provider/reviews` - View reviews
- `/provider/settings` - Provider settings

### Admin Pages
- `/admin/dashboard` - Admin overview
- `/admin/users` - User management
- `/admin/providers` - Provider management
- `/admin/services` - Service moderation
- `/admin/bookings` - All bookings
- `/admin/health-scores` - Customer health
- `/admin/analytics` - Platform analytics
- `/admin/settings` - Platform settings

### Other Pages
- `/chat` - Chat interface
- `/chat/:conversationId` - Specific conversation
- `/support` - Help center
- `/support/ticket/:id` - Support ticket
- `/privacy` - Privacy policy
- `/terms` - Terms of service

## Components

### Common Components
- `Button` - Button with variants
- `Input` - Form input
- `Select` - Dropdown select
- `Modal` - Modal dialog
- `Badge` - Status badges
- `Card` - Content card
- `Avatar` - User avatar
- `Skeleton` - Loading skeleton
- `Toast` - Notification toast
- `Tabs` - Tab navigation
- `Dropdown` - Dropdown menu
- `Calendar` - Date picker
- `Rating` - Star rating

### Booking Components
- `BookingCard` - Booking display
- `BookingStatus` - Status badge
- `ServiceSelector` - Service selection
- `DatePicker` - Booking date
- `TimeSlots` - Available times
- `PriceBreakdown` - Cost summary

### Provider Components
- `ServiceCard` - Service display
- `ProviderCard` - Provider preview
- `AvailabilityCalendar` - Calendar view
- `ServiceForm` - Create/edit service
- `AnalyticsChart` - Performance charts

### Market Components
- `SearchBar` - Search input
- `Filters` - Search filters
- `CategoryGrid` - Category display
- `ServiceGrid` - Services list
- `ReviewList` - Reviews display
- `ImageGallery` - Photo gallery

### SuperApp Components
- `RewardsCard` - Rewards summary
- `StreakDisplay` - Streak counter
- `AchievementBadge` - Achievement icon
- `ChallengeCard` - Weekly challenge
- `HealthScore` - Customer health
- `SpendingInsights` - Spending analytics

### Mobile Components
- `BottomNav` - Mobile navigation
- `MobileHeader` - Mobile header
- `SlideMenu` - Side menu
- `PullToRefresh` - Pull gesture
- `HapticFeedback` - Touch feedback

## Services (API)

### Core API Services
- `api.ts` - Main API client with interceptors
- `authService.ts` - Authentication
- `bookingApi.ts` - Booking operations
- `serviceApi.ts` - Service CRUD
- `providerApi.ts` - Provider data
- `reviewApi.ts` - Reviews
- `walletApi.ts` - Wallet operations
- `paymentService.ts` - Payment processing

### Additional Services
- `searchApi.ts` - Search functionality
- `chatApi.ts` - Messaging
- `notificationService.ts` - Push notifications
- `loyaltyApi.ts` - Loyalty program
- `superappApi.ts` - SuperApp features
- `analyticsService.ts` - Analytics tracking
- `recommendationClient.ts` - AI recommendations
- `fraudClient.ts` - Fraud detection

### Infrastructure Services
- `offlineSync.ts` - Offline data sync
- `offlineStorage.ts` - Local storage
- `conflictResolver.ts` - Data conflict handling
- `syncPrioritizer.ts` - Sync priority
- `cacheManager.ts` - Response caching
- `securityService.ts` - Security utilities

## Stores (Zustand)

- `authStore` - Authentication state
- `bookingStore` - Booking state
- `walletStore` - Wallet state
- `notificationStore` - Notifications
- `savedSearchStore` - Saved searches
- `preferencesStore` - User preferences
- `offlineStore` - Offline state

## Hooks

### Custom Hooks
- `useAuth` - Authentication
- `useBooking` - Booking operations
- `useService` - Service data
- `useProvider` - Provider data
- `usePayment` - Payment processing
- `useNotifications` - Push notifications
- `useOfflineSync` - Offline sync
- `useDeepLinks` - Deep linking
- `useOnlineStatus` - Network status
- `useBiometricAuth` - Biometric login
- `useTheme` - Theme toggle
- `usePWA` - PWA features
- `useHaptics` - Haptic feedback
- `useTranslation` - i18n

### Third-party Hooks
- `@tanstack/react-query` - Server state
- `react-hook-form` - Form handling
- `useDebounce` - Debounce values
- `useThrottle` - Throttle functions

## Styling

### Design System

The project uses a custom design system with the following tokens:

**Colors**
- Primary: Coral (`#E8604C`)
- Charcoal: Dark text (`#1F2937`)
- Warm Gray: Muted text (`#6B7280`)
- Blush: Background accent (`#F5EBE7`)
- Border: Borders (`#E5E7EB`)

**Typography**
- Font Family: System fonts
- Headings: Serif for display, Sans for body
- Line heights: 1.5 for body, 1.2 for headings

**Spacing**
- Base unit: 4px
- Scale: 1, 2, 3, 4, 6, 8, 12, 16, 24

**Shadows**
- sm: Subtle shadow
- md: Card shadow
- lg: Modal shadow
- xl: Dropdown shadow

### Utility Classes

- `cn()` - Class merging utility
- `twMerge` - Tailwind class merging
- Color classes: `text-nilin-*`, `bg-nilin-*`, `border-nilin-*`
- Animation classes: `animate-fade-in`, `animate-slide-up`

## Testing

```bash
# Run unit tests
npm test

# Run with UI
npm run test:ui

# Run once with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# E2E with UI
npm run test:e2e:ui

# Install E2E browsers
npm run test:e2e:install
```

## Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build           # Build for production
npm run preview         # Preview production build
npm run lint            # Lint with ESLint

# Type Checking
npm run type-check      # TypeScript check

# Testing
npm test                # Run tests
npm run test:ui         # Test UI
npm run test:coverage   # Coverage report

# Mobile (Capacitor)
npm run cap:sync        # Sync web to mobile
npm run cap:open        # Open in native IDE
npm run cap:build       # Build mobile app
npm run cap:run         # Run on device
```

## Project Structure

```
frontend/
├── public/              # Static assets
├── src/
│   ├── components/      # React components
│   │   ├── common/      # Shared components
│   │   ├── booking/     # Booking components
│   │   ├── provider/    # Provider components
│   │   ├── customer/    # Customer components
│   │   ├── admin/       # Admin components
│   │   ├── marketplace/ # Marketplace components
│   │   ├── wallet/      # Wallet components
│   │   ├── chat/        # Chat components
│   │   ├── security/    # Security components
│   │   ├── analytics/   # Analytics components
│   │   ├── ui/          # UI primitives
│   │   ├── layout/      # Layout components
│   │   ├── mobile/      # Mobile-specific
│   │   └── superapp/    # SuperApp features
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── stores/          # Zustand stores
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Utilities
│   ├── types/           # TypeScript types
│   ├── utils/           # Helper functions
│   ├── config/          # Configuration
│   ├── theme/           # Theme tokens
│   ├── styles/          # Global styles
│   ├── i18n/            # Translations
│   ├── monitoring/      # Error tracking
│   └── main.tsx         # Entry point
├── capacitor.config.ts  # Capacitor config
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Environment Variables

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000/api
VITE_WS_URL=ws://localhost:5000
VITE_STRIPE_PUBLIC_KEY=pk_test_...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

## Capacitor Mobile App

The project supports native mobile apps via Capacitor:

```bash
# Initial setup
npm run cap:sync

# Android
npm run cap:open android

# iOS (requires macOS)
npm run cap:open ios
```

### Mobile Features
- Biometric authentication
- Camera integration
- File system access
- Geolocation
- Push notifications
- Haptic feedback
- Splash screen

## PWA Features

- Offline support
- Background sync
- Installable
- Push notifications

## Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

## License

MIT
