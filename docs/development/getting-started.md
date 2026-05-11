# Getting Started - Development Guide

## 🚀 Development Environment Setup

### Prerequisites Checklist
- [ ] Node.js 20+ installed
- [ ] MongoDB (local or Atlas account)
- [ ] VS Code with TypeScript extensions
- [ ] Git configured

### Initial Setup
1. Follow the [Project Setup Guide](../setup/project-setup-guide.md) to initialize your project
2. Review the [Technology Stack](../setup/tech-stack-final.md) documentation
3. Understand the [Requirements](../requirements/Home-Service-Platform-Requirements.md)

## 📁 Project Architecture Overview

### Backend Structure
```
backend/src/
├── config/          # Database, Cloudinary, constants
├── models/          # Mongoose schemas
├── routes/          # Express route handlers
├── controllers/     # Business logic
├── services/        # External service integrations
├── middleware/      # Authentication, validation, error handling
├── utils/           # Helper functions
└── types/           # TypeScript type definitions
```

### Frontend Structure
```
frontend/src/
├── components/      # Reusable UI components
├── pages/           # Route-based page components
├── hooks/           # Custom React hooks
├── services/        # API service calls
├── store/           # Zustand state management
├── lib/             # Utilities and helpers
└── types/           # TypeScript interfaces
```

## 🛠 Development Workflow

### Starting the Development Servers
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:backend   # Starts on http://localhost:5000
npm run dev:frontend  # Starts on http://localhost:5173
```

### Database Setup
1. **Local MongoDB**: Install and start MongoDB locally
2. **MongoDB Atlas**: Create cluster and get connection string
3. Update `backend/.env` with your `MONGODB_URI`

### Environment Configuration
Update the following files with your credentials:

**Backend (.env)**:
```env
MONGODB_URI=mongodb://localhost:27017/marketplace_dev
JWT_SECRET=your-jwt-secret-key
CLOUDINARY_CLOUD_NAME=your_cloud_name
STRIPE_SECRET_KEY=sk_test_your_stripe_key
RESEND_API_KEY=re_your_resend_key
```

**Frontend (.env)**:
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Home Service Marketplace
```

## 🏗 Building Features

### 1. Authentication System
Start by implementing user authentication:

```bash
# Example commands for Claude Code:
# "Implement JWT authentication with login, register, and middleware"
# "Create protected routes and user session management"
```

Key files to create:
- `backend/src/controllers/auth.controller.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/middleware/auth.middleware.ts`
- `frontend/src/store/authStore.ts`
- `frontend/src/pages/LoginPage.tsx`

### 2. Service Provider Profiles
Instagram-style profiles for service providers:

```bash
# Example commands:
# "Create provider profile model with portfolio gallery"
# "Build Instagram-style provider profile components"
```

Key features:
- Portfolio image/video uploads
- Social interactions (follow, like, comment)
- Booking integration
- Analytics dashboard

### 3. Booking System
Core booking and scheduling functionality:

```bash
# Example commands:
# "Implement booking system with calendar integration"
# "Create booking models with payment integration"
```

Key components:
- Calendar availability
- Real-time booking
- Payment processing
- Booking confirmations

### 4. Payment Integration
Multi-payment support with loyalty system:

```bash
# Example commands:
# "Integrate Stripe payments with loyalty coins"
# "Implement gift cards and voucher system"
```

Features:
- Stripe payment processing
- Loyalty coin system
- Gift cards and vouchers
- Split payments

## 🧪 Testing and Quality

### API Testing
Use the built-in test endpoints:
- Health check: `GET /health`
- API test: `GET /api/test`
- Connection test via frontend status page

### Code Quality Tools
```bash
# Backend
cd backend && npm run build    # TypeScript compilation
cd backend && npm test         # Jest tests

# Frontend  
cd frontend && npm run build   # Production build
cd frontend && npm run preview # Preview build
```

### Development Best Practices
1. **Follow TypeScript strict mode** - All files must be properly typed
2. **Use existing patterns** - Follow established code structure
3. **Component organization** - Keep components small and focused
4. **API structure** - RESTful endpoints with proper error handling
5. **State management** - Use Zustand for global state, local state for component-specific data

## 🎯 Development Milestones

### Phase 1: Foundation
- [x] Project setup and architecture
- [ ] User authentication system
- [ ] Basic user and provider models
- [ ] API routing structure

### Phase 2: Core Features
- [ ] Service provider profiles
- [ ] Service listings and categories
- [ ] Basic booking system
- [ ] Payment integration

### Phase 3: Advanced Features
- [ ] AI-powered matching
- [ ] Social features (follow, like, comment)
- [ ] Loyalty and rewards system
- [ ] Advanced booking (recurring, group sessions)

### Phase 4: Business Features
- [ ] Admin dashboard
- [ ] Analytics and reporting
- [ ] B2B corporate features
- [ ] Mobile responsiveness

## 🔧 Common Development Tasks

### Adding a New Model
1. Create model in `backend/src/models/`
2. Add TypeScript interfaces
3. Create routes and controllers
4. Update frontend types
5. Create API service functions

### Creating UI Components
1. Use Shadcn/ui as base components
2. Follow Tailwind CSS conventions
3. Add to component library
4. Document component props

### API Integration
1. Define API endpoints in backend
2. Create service functions in frontend
3. Add error handling
4. Update TypeScript types

## 📚 Additional Resources

### Documentation
- [MongoDB Documentation](https://docs.mongodb.com/)
- [React + TypeScript Guide](https://react-typescript-cheatsheet.netlify.app/)
- [Shadcn/ui Components](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/docs)

### External APIs
- [Stripe API Docs](https://stripe.com/docs/api)
- [Cloudinary API](https://cloudinary.com/documentation)
- [Resend Email API](https://resend.com/docs)

## 🚨 Troubleshooting

### Common Issues

**Backend not connecting:**
- Check MongoDB is running
- Verify environment variables
- Check port 5000 availability

**Frontend build errors:**
- Run `npm install` in frontend directory
- Check TypeScript errors
- Verify API URL in .env

**Database connection issues:**
- Check MongoDB Atlas IP whitelist
- Verify connection string format
- Test connection with MongoDB Compass

### Getting Help
1. Check console logs for error details
2. Verify environment configuration
3. Test API endpoints individually
4. Review network requests in browser dev tools

---

## 🎉 Ready to Build!

Your development environment is now configured and ready. Start with implementing the authentication system, then move to core features like service provider profiles and booking system.

Use the comprehensive setup from the project guide to build your Home Service Marketplace efficiently!