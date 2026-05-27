# NILIN Engineering Onboarding Guide

Welcome to NILIN! This guide will help you get up and running with our codebase.

## Prerequisites

### Required Software
- Node.js 20+
- npm 10+
- Git
- Docker Desktop
- MongoDB Compass (optional)
- VS Code (recommended)

### Accounts
- GitHub access
- Firebase Console access
- Stripe Dashboard access
- Cloudinary account

## Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/nilin.git
cd nilin
```

### 2. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 3. Environment Setup

Copy the example env files:
```bash
# Backend
cd backend
cp .env.example .env

# Frontend
cd ../frontend
cp .env.example .env
```

### Required Environment Variables

**Backend (.env):**
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/nilin
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
STRIPE_SECRET_KEY=sk_test_xxx
RESEND_API_KEY=re_xxx
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001
VITE_STRIPE_PUBLIC_KEY=pk_test_xxx
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_PROJECT_ID=xxx
```

### 4. Start Development Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

### 5. Start Infrastructure

```bash
# Start MongoDB and Redis
docker-compose up -d
```

## Project Structure

```
nilin/
├── backend/              # Node.js Express API
│   ├── src/
│   │   ├── controllers/   # Route handlers
│   │   ├── services/      # Business logic
│   │   ├── models/        # MongoDB schemas
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/        # API routes
│   │   └── utils/         # Utilities
│   └── tests/             # Backend tests
├── frontend/            # React + Vite
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API clients
│   │   ├── stores/        # Zustand stores
│   │   ├── hooks/         # Custom hooks
│   │   └── utils/         # Utilities
│   └── android/          # Capacitor Android
├── docs/                 # Documentation
└── tests/               # E2E tests
```

## Key Technologies

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Zustand, TanStack Query |
| Backend | Node.js, Express, TypeScript |
| Database | MongoDB, Redis |
| Mobile | Capacitor, Android |
| Payments | Stripe |
| Storage | Cloudinary |
| Auth | JWT, 2FA |
| Monitoring | Sentry |

## Development Workflow

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes
```bash
# Make your changes
git add .
git commit -m "feat: your feature description"
```

### 3. Run Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd ../frontend && npm test

# E2E tests
cd ../tests && npm test
```

### 4. Push and Create PR
```bash
git push origin feature/your-feature-name
# Create PR on GitHub
```

## Code Style

We use ESLint and Prettier. Run before committing:
```bash
npm run lint
npm run format
```

## Common Tasks

### Creating a New API Route
1. Add route to `routes/*.ts`
2. Add controller in `controllers/*.ts`
3. Add service logic in `services/*.ts`
4. Add validation in `middleware/validation.middleware.ts`
5. Add tests in `tests/api/*.spec.ts`

### Adding a New Component
1. Create component in `components/`
2. Add TypeScript types
3. Add tests
4. Update Storybook if applicable

### Database Migrations
```bash
npm run migrate
npm run migrate:rollback
```

## Resources

- [API Documentation](./API.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [Coding Standards](./STANDARDS.md)
- [Debugging Guide](./DEBUGGING.md)

## Getting Help

- Slack: #engineering
- GitHub Issues: label with "question"
- Tech Lead: @your-lead
