# NILIN Test Suite

## Running Tests

### Install Dependencies
```bash
npm install -D @playwright/test supertest vitest
npx playwright install chromium
```

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# E2E Tests
npm run test:e2e

# API Tests
npm run test:api

# Smoke Tests
npm run test:smoke

# Chaos Tests
npm run test:chaos

# Visual Regression
npm run test:visual
```

### Update Visual Snapshots
```bash
npm run test:visual:update
```

## Test Structure
```
tests/
├── e2e/           # End-to-end Playwright tests
├── api/           # API contract tests
├── smoke/         # Smoke tests
├── chaos/         # Chaos engineering tests
└── visual/        # Visual regression tests
```

## Environment Variables
```env
BASE_URL=http://localhost:5173
API_URL=http://localhost:3001
CI=true  # Enable CI mode
```

## Test Coverage
- Auth: Registration, Login, Password Reset, 2FA
- Booking: Create, Cancel, Rate, List
- Payment: Wallet, Checkout, Refunds
- Provider: Dashboard, Bookings, Availability
- Health: Liveness, Readiness, Circuit Breakers
- Chaos: Timeouts, Rate Limits, Failures
