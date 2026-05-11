# 🧪 Home Service Platform - Testing Guide

## 📋 Overview

This guide covers all testing approaches implemented for the authentication system including unit tests, integration tests, and end-to-end tests.

## 🏗️ Testing Architecture

### Backend Testing Stack
- **Jest** - Testing framework
- **Supertest** - HTTP assertion library
- **MongoDB Memory Server** - In-memory database for testing
- **TypeScript** - Type safety in tests

### Frontend Testing Stack  
- **Vitest** - Fast testing framework (Vite-native)
- **React Testing Library** - Component testing utilities
- **MSW (Mock Service Worker)** - API mocking
- **Playwright** - End-to-end testing
- **Jest DOM** - DOM testing utilities

## 🔧 Setup & Installation

### Prerequisites
```bash
# Install all dependencies
cd backend && npm install
cd ../frontend && npm install

# Install Playwright browsers
cd frontend && npm run test:e2e:install
```

### Environment Setup
Ensure `.env` files are configured in both backend and frontend directories.

## 🧪 Running Tests

### Backend Tests
```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm run test -- --coverage

# Run integration tests only
npm run test:integration

# Run specific test file
npm test -- auth.integration.test.ts

# Run in watch mode
npm run test:watch
```

### Frontend Tests
```bash
cd frontend

# Run unit tests
npm test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- LoginForm.test.tsx

# Run in watch mode (default)
npm test
```

### End-to-End Tests
```bash
cd frontend

# Run E2E tests (headless)
npm run test:e2e

# Run with UI
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run specific browser
npm run test:e2e -- --project=chromium

# Run specific test file
npm run test:e2e -- auth.spec.ts
```

### Complete Testing Suite
```bash
# From project root
./scripts/integration-test.sh
```

## 📁 Test File Structure

```
backend/
├── src/
│   ├── tests/
│   │   ├── setup.ts                    # Test configuration
│   │   ├── auth.integration.test.ts    # API integration tests
│   │   └── database.test.ts            # Database tests
│   └── scripts/                        # Database testing scripts

frontend/
├── src/
│   ├── test/
│   │   └── setup.ts                    # Vitest configuration
│   ├── services/__tests__/
│   │   └── auth.api.test.ts           # API service tests
│   ├── stores/__tests__/
│   │   └── authStore.test.ts          # State management tests
│   └── components/auth/__tests__/
│       ├── LoginForm.test.tsx         # Component tests
│       └── ProtectedRoute.test.tsx    # Route protection tests
├── tests/
│   ├── e2e/
│   │   └── auth.spec.ts               # End-to-end tests
│   ├── global-setup.ts                # E2E setup
│   └── global-teardown.ts             # E2E cleanup
├── playwright.config.ts               # Playwright configuration
└── vitest.config.ts                   # Vitest configuration
```

## 🎯 Test Coverage

### Backend API Tests
- [x] User registration (Customer & Provider)
- [x] Login/logout functionality
- [x] JWT token validation
- [x] Password management
- [x] Email verification
- [x] Protected endpoint access
- [x] Role-based authorization
- [x] Account lockout mechanisms
- [x] Database integrity checks

### Frontend Component Tests
- [x] LoginForm validation and submission
- [x] Registration form validation
- [x] Protected route behavior
- [x] Authentication store state management
- [x] API service error handling
- [x] Loading states and user feedback

### End-to-End Test Scenarios
- [x] Complete customer registration flow
- [x] Complete provider registration flow
- [x] Login with different user roles
- [x] Password reset workflow
- [x] Email verification process
- [x] Protected route access control
- [x] Logout functionality
- [x] Mobile responsiveness
- [x] Keyboard navigation
- [x] Error handling

## 📊 Coverage Targets

### Current Coverage Goals
- **Backend**: 85%+ line coverage
- **Frontend**: 80%+ line coverage
- **E2E**: 100% critical user flows

### Coverage Reports
```bash
# Backend coverage
cd backend && npm run test -- --coverage
# Open: coverage/lcov-report/index.html

# Frontend coverage  
cd frontend && npm run test:coverage
# Open: coverage/index.html

# E2E test results
cd frontend && npm run test:e2e
# Open: playwright-report/index.html
```

## 🔍 Test Categories

### 1. Unit Tests
**Purpose**: Test individual components/functions in isolation

**Examples**:
- Form validation logic
- Utility functions
- Component rendering
- State management actions

### 2. Integration Tests  
**Purpose**: Test multiple components working together

**Examples**:
- API endpoint flows
- Database operations
- Component interaction
- Service integration

### 3. End-to-End Tests
**Purpose**: Test complete user workflows

**Examples**:
- Full registration process
- Login to dashboard navigation
- Multi-step form completion
- Cross-browser compatibility

## 🚀 Test Development Guidelines

### Writing Good Tests

#### 1. Test Structure (AAA Pattern)
```javascript
describe('LoginForm', () => {
  it('should validate email format', async () => {
    // Arrange - Setup test data
    const invalidEmail = 'invalid-email';
    
    // Act - Perform action
    render(<LoginForm />);
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: invalidEmail }
    });
    fireEvent.click(screen.getByRole('button'));
    
    // Assert - Check results
    await waitFor(() => {
      expect(screen.getByText('Invalid email address')).toBeInTheDocument();
    });
  });
});
```

#### 2. Test Naming Convention
- Use descriptive test names
- Start with "should" followed by expected behavior
- Include context when necessary

```javascript
// Good
it('should redirect to dashboard after successful login')
it('should show validation error for weak password')
it('should disable submit button while loading')

// Avoid
it('login test')
it('validates form')  
it('works correctly')
```

#### 3. Mock External Dependencies
```javascript
// Mock API calls
jest.mock('../../services/auth.api');

// Mock store
jest.mock('../../stores/authStore');

// Mock router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));
```

### Best Practices

#### ✅ Do
- Test user behavior, not implementation details
- Use data-testid for complex queries
- Test error states and edge cases
- Keep tests focused and simple
- Use meaningful test data
- Clean up after tests

#### ❌ Don't  
- Test third-party libraries
- Test implementation details
- Write overly complex tests
- Use real external services
- Leave failing tests
- Skip error scenarios

## 🔧 Debugging Tests

### Backend Debugging
```bash
# Run specific test with debug info
npm test -- --detectOpenHandles --forceExit auth.integration.test.ts

# Run with verbose output
npm test -- --verbose

# Run with inspect (Chrome DevTools)
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Frontend Debugging
```bash
# Run with debug output
npm test -- --reporter=verbose

# Run single test file
npm test -- LoginForm.test.tsx

# Use Vitest UI for debugging
npm run test:ui
```

### E2E Debugging
```bash
# Run with browser visible
npm run test:e2e:debug

# Run with trace viewer
npm run test:e2e -- --trace on

# Generate test report
npm run test:e2e -- --reporter=html
```

## 🚨 Troubleshooting

### Common Issues

#### Backend Tests
**Issue**: Database connection timeout
```bash
# Solution: Increase timeout in jest.config.js
module.exports = {
  testTimeout: 30000
};
```

**Issue**: Memory leaks in tests
```bash
# Solution: Use proper cleanup
afterEach(async () => {
  await mongoose.connection.db.dropDatabase();
});
```

#### Frontend Tests
**Issue**: Component not rendering
```bash
# Solution: Check for missing providers
const Wrapper = ({ children }) => (
  <BrowserRouter>
    <QueryClient>
      {children}
    </QueryClient>
  </BrowserRouter>
);
```

**Issue**: Async operations not completing
```bash
# Solution: Use proper async utilities
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

#### E2E Tests  
**Issue**: Timeout waiting for element
```bash
# Solution: Increase timeout or improve selector
await page.waitForSelector('[data-testid="submit-button"]', { 
  timeout: 10000 
});
```

**Issue**: Flaky tests
```bash
# Solution: Add explicit waits
await page.waitForURL('/dashboard');
await page.waitForLoadState('networkidle');
```

## 📈 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd backend && npm ci
      - run: cd backend && npm test

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci
      - run: cd frontend && npm run test:run
      
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd frontend && npm ci
      - run: cd frontend && npx playwright install
      - run: cd frontend && npm run test:e2e
```

## 📚 Additional Resources

### Documentation
- [Jest Documentation](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/)
- [Vitest Guide](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)

### Testing Philosophy
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## ✅ Test Checklist

Before deploying:

### Backend ✅
- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Database tests pass
- [ ] Coverage > 85%
- [ ] No memory leaks
- [ ] All endpoints tested

### Frontend ✅  
- [ ] Component tests pass
- [ ] Store tests pass
- [ ] API service tests pass
- [ ] Coverage > 80%
- [ ] No console errors
- [ ] Accessibility tests pass

### E2E ✅
- [ ] Registration flows work
- [ ] Login flows work
- [ ] Protected routes work  
- [ ] Error handling works
- [ ] Mobile responsive
- [ ] Cross-browser compatible

---

The authentication system now has comprehensive test coverage across all layers! 🚀