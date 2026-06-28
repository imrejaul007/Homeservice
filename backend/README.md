# Home Service Marketplace - Backend API

A comprehensive Node.js/Express backend for a home services marketplace platform, built with TypeScript, MongoDB, and Redis.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Cache/Sessions**: Redis with ioredis
- **Queue**: BullMQ for background job processing
- **Authentication**: JWT with refresh tokens, API keys
- **Security**: Helmet, CORS, rate limiting, input sanitization
- **Real-time**: Socket.io with Redis adapter
- **Monitoring**: Prometheus metrics, Sentry error tracking
- **AI/ML**: Vector search (MeiliSearch), LLM integration (Resend)
- **File Storage**: Cloudinary for image uploads
- **Payments**: Stripe integration
- **Communications**: Twilio (SMS/WhatsApp), Resend (Email)

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB 6.0+
- Redis 7.0+
- npm or yarn

### Installation

```bash
# Clone the repository
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/homeservice
MONGODB_URI_PROD=your_production_mongodb_uri

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1...

# Resend (Email)
RESEND_API_KEY=re_...

# Sentry (Error Tracking)
SENTRY_DSN=https://...@sentry.io/...

# Admin Credentials (for setup)
ADMIN_EMAIL=admin@nilin.com
ADMIN_PASSWORD=your_admin_password
```

## API Endpoints

### Authentication & Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/me` | Update current user |
| POST | `/api/auth/verify-email` | Verify email |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password |

### Providers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List all providers |
| GET | `/api/providers/:id` | Get provider details |
| PUT | `/api/providers/:id` | Update provider |
| GET | `/api/providers/:id/services` | Get provider services |
| GET | `/api/providers/:id/reviews` | Get provider reviews |
| GET | `/api/providers/:id/availability` | Get availability |
| GET | `/api/providers/search` | Search providers |

### Services

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/services` | List services |
| GET | `/api/services/:id` | Get service details |
| POST | `/api/services` | Create service (provider) |
| PUT | `/api/services/:id` | Update service |
| DELETE | `/api/services/:id` | Delete service |
| GET | `/api/services/categories` | List categories |
| GET | `/api/services/search` | Search services |

### Bookings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bookings` | List bookings |
| GET | `/api/bookings/:id` | Get booking details |
| POST | `/api/bookings` | Create booking |
| PUT | `/api/bookings/:id` | Update booking |
| DELETE | `/api/bookings/:id` | Cancel booking |
| POST | `/api/bookings/:id/accept` | Accept booking (provider) |
| POST | `/api/bookings/:id/decline` | Decline booking (provider) |
| POST | `/api/bookings/:id/complete` | Complete booking |
| POST | `/api/bookings/:id/reschedule` | Request reschedule |

### Payments & Wallet

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/balance` | Get wallet balance |
| GET | `/api/wallet/transactions` | Get transactions |
| POST | `/api/wallet/topup` | Top up wallet |
| POST | `/api/wallet/withdraw` | Withdraw funds |
| GET | `/api/payments` | List payments |
| POST | `/api/payments/create-intent` | Create payment intent |
| POST | `/api/webhooks/stripe` | Stripe webhook |

### Reviews & Ratings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | List reviews |
| GET | `/api/reviews/:id` | Get review details |
| POST | `/api/reviews` | Create review |
| PUT | `/api/reviews/:id` | Update review |
| DELETE | `/api/reviews/:id` | Delete review |
| GET | `/api/reviews/provider/:id` | Get provider reviews |
| GET | `/api/reviews/service/:id` | Get service reviews |

### Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List all categories |
| GET | `/api/categories/:id` | Get category details |
| POST | `/api/categories` | Create category (admin) |
| PUT | `/api/categories/:id` | Update category (admin) |
| DELETE | `/api/categories/:id` | Delete category (admin) |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search` | Global search |
| GET | `/api/search/providers` | Search providers |
| GET | `/api/search/services` | Search services |
| GET | `/api/search/suggestions` | Get search suggestions |

### Chat & Messaging

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| GET | `/api/chat/conversations/:id` | Get conversation |
| GET | `/api/chat/messages/:conversationId` | Get messages |
| POST | `/api/chat/messages` | Send message |
| PUT | `/api/chat/messages/:id/read` | Mark as read |

### Offers & Coupons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/offers` | List offers |
| GET | `/api/offers/:id` | Get offer details |
| POST | `/api/offers` | Create offer (provider) |
| PUT | `/api/offers/:id` | Update offer |
| POST | `/api/offers/:id/claim` | Claim offer |
| GET | `/api/coupons/validate` | Validate coupon |

### Loyalty & Rewards

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/loyalty/status` | Get loyalty status |
| GET | `/api/loyalty/history` | Get points history |
| POST | `/api/loyalty/redeem` | Redeem points |
| GET | `/api/streak/status` | Get streak status |
| POST | `/api/streak/checkin` | Daily check-in |
| GET | `/api/habits` | Get habits/achievements |

### Analytics & Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/overview` | Dashboard overview |
| GET | `/api/analytics/revenue` | Revenue analytics |
| GET | `/api/analytics/bookings` | Booking analytics |
| GET | `/api/analytics/providers` | Provider analytics |
| GET | `/api/analytics/customers` | Customer analytics |
| GET | `/api/analytics/trends` | Trend analysis |

### Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/providers` | List providers |
| GET | `/api/admin/bookings` | List all bookings |
| GET | `/api/admin/reports` | Generate reports |
| GET | `/api/admin/metrics` | System metrics |
| GET | `/api/admin/health-scores` | Customer health scores |
| GET | `/api/admin/anomalies` | Anomaly detection |

### AI Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/recommendations` | Get recommendations |
| POST | `/api/ai/chat` | AI chat assistant |
| GET | `/api/ai/demand-forecast` | Demand forecasting |
| GET | `/api/ai/churn-prediction` | Churn prediction |

### Support & Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/support/tickets` | Create support ticket |
| GET | `/api/support/tickets` | List tickets |
| GET | `/api/support/tickets/:id` | Get ticket |
| POST | `/api/notifications/send` | Send notification |
| GET | `/api/notifications` | List notifications |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/stripe` | Stripe payments |
| POST | `/api/webhooks/twilio` | Twilio SMS/WhatsApp |
| POST | `/api/webhooks/notifications` | Push notifications |

### Additional Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/favorites` | User favorites |
| GET | `/api/wishlist` | User wishlist |
| POST | `/api/addresses` | Add address |
| GET | `/api/addresses` | List addresses |
| POST | `/api/referrals` | Create referral |
| GET | `/api/earnings` | Provider earnings |
| GET | `/api/availability/slots` | Available time slots |

## Features

### Core Features

- **Multi-role Authentication**: Customer, Provider, Admin roles with JWT
- **Service Marketplace**: Browse, search, filter services by category/location
- **Real-time Booking**: Instant booking with availability checking
- **Review System**: Rating and review for services and providers
- **Wallet System**: In-app wallet with top-up and withdrawal
- **Loyalty Program**: Points, streaks, achievements, tiered rewards
- **Push Notifications**: Real-time alerts via Firebase Cloud Messaging
- **File Upload**: Cloudinary integration for images

### Advanced Features

- **AI-powered Recommendations**: Personalized service suggestions
- **Churn Prediction**: ML-based customer retention analysis
- **Demand Forecasting**: Predictive scheduling and staffing
- **Anomaly Detection**: Fraud and unusual pattern detection
- **Vector Search**: Semantic search with MeiliSearch
- **Automated Workflows**: Scheduled promotions, training reminders
- **Corporate Accounts**: Business/corporate customer management
- **Managed Contracts**: Long-term service agreements

### Security Features

- **Rate Limiting**: Redis-backed rate limiter per endpoint/IP
- **API Key Authentication**: For service-to-service communication
- **Input Sanitization**: MongoDB injection prevention
- **CORS Configuration**: Cross-origin request control
- **Helmet Security Headers**: XSS, clickjacking protection
- **Request Timeout**: Prevent long-running requests
- **Audit Logging**: Track sensitive operations

### Performance Features

- **Redis Caching**: Response caching for hot data
- **Connection Pooling**: MongoDB and Redis connection pools
- **Request Batching**: Batch multiple API calls
- **Delta Sync**: Efficient data synchronization
- **Offline Queue**: Queue operations when offline

## Scripts

```bash
# Development
npm run dev              # Start dev server with nodemon
npm run build            # Build for production
npm start                # Start production server

# Database
npm run db:seed          # Seed database with initial data
npm run db:seed:services # Seed services only
npm run db:seed:reviews  # Seed reviews
npm run db:seed:beauty   # Seed beauty services
npm run db:create-admin  # Create admin user
npm run db:reset         # Reset database
npm run db:stats         # Show database statistics
npm run db:health        # Check database health
npm run db:validate      # Validate database schema

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:ci          # CI mode with coverage

# Code Quality
npm run lint             # Lint with ESLint
npm run format           # Format with Prettier

# Utilities
npm run redis:cleanup-locks  # Clean stale locks
npm run db:optimize          # Optimize database
npm run db:backup            # Backup database
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:ci

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## Project Structure

```
backend/
├── src/
│   ├── controllers/     # Request handlers
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── middleware/      # Express middleware
│   ├── services/        # Business logic
│   ├── services/ai/     # AI/ML services
│   ├── utils/           # Utilities
│   ├── config/          # Configuration
│   ├── automation/      # Scheduled tasks
│   ├── workflows/        # Business workflows
│   ├── queue/           # Job queue setup
│   ├── cqrs/            # CQRS patterns
│   ├── monitoring/      # Monitoring setup
│   ├── domain/          # Domain entities
│   ├── interfaces/      # TypeScript interfaces
│   ├── seeders/         # Database seeders
│   ├── scripts/         # Utility scripts
│   ├── tests/           # Unit/integration tests
│   └── server.ts        # Application entry
├── .env.example
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Environment

The backend runs on port 5000 by default. API base URL: `http://localhost:5000/api`

## License

MIT
