# 🔐 Authentication System - Master Implementation Guide for Claude Code

**CONTEXT**: Home Service Platform with 3 user types (Customer, Provider, Admin)  
**GOAL**: Build complete authentication system that supports full platform features  
**APPROACH**: Step-by-step implementation with specific prompts for Claude Code

---

## 📁 REQUIRED CONTEXT FILES

### Always provide these files to Claude Code:
1. `docs/features/auth/AUTH-SYSTEM-OVERVIEW.md` - System architecture
2. `docs/features/auth/BACKEND-IMPLEMENTATION.md` - Backend technical guide
3. `docs/features/auth/FRONTEND-IMPLEMENTATION.md` - Frontend technical guide
4. `docs/features/auth/DATABASE-SETUP.md` - Database models and structure
5. `docs/requirements/Home-Service-Platform-Requirements.md` - Full platform requirements

### Current project structure to share:
```
backend/src/models/user.model.ts (existing)
backend/src/services/api.ts (existing)  
frontend/src/services/api.ts (existing)
backend/package.json
frontend/package.json
.env files
```

---

## 🚀 IMPLEMENTATION SEQUENCE

## PHASE 1: DATABASE FOUNDATION

### STEP 1.1: Enhanced User Model
**PROMPT FOR CLAUDE:**
```
I need to enhance the existing User model to support the full Home Service Platform features. 

CONTEXT FILES:
- docs/features/auth/DATABASE-SETUP.md (section: Enhanced User Model)
- docs/requirements/Home-Service-Platform-Requirements.md 
- Current: backend/src/models/user.model.ts

TASK: Update the User model to include:
1. Social profile fields (followers, following, social media links)
2. Loyalty system fields (coins, tier, referral code, streak)
3. Communication preferences (all notification types)
4. B2B corporate fields for business users
5. AI personalization fields for smart matching

REQUIREMENTS:
- Maintain existing authentication functionality
- Add proper validation for new fields
- Include indexes for performance
- Support all three user roles (customer, provider, admin)
- Future-proof for booking, payments, social features

Please implement the enhanced User model with complete TypeScript interfaces.
```

### STEP 1.2: Customer Profile Model
**PROMPT FOR CLAUDE:**
```
Create the CustomerProfile model that extends customer functionality.

CONTEXT FILES:
- docs/features/auth/DATABASE-SETUP.md (section: CustomerProfile Model)
- Enhanced User model from Step 1.1

TASK: Create backend/src/models/customerProfile.model.ts with:
1. User preferences (categories, distance, price range)
2. Saved addresses with coordinates
3. Payment methods (cards, PayPal, wallet)
4. Favorite providers list
5. Loyalty points with transaction history
6. Notification preferences
7. Booking statistics

REQUIREMENTS:
- References User model via userId
- Supports geospatial queries for location
- Handles loyalty point transactions
- Ready for booking and payment systems
- Includes proper validation and indexes

Implement the complete CustomerProfile model.
```

### STEP 1.3: Provider Profile Model
**PROMPT FOR CLAUDE:**
```
Create the ProviderProfile model for service providers with Instagram-style features.

CONTEXT FILES:
- docs/features/auth/DATABASE-SETUP.md (section: ProviderProfile Model)
- docs/requirements/Home-Service-Platform-Requirements.md (Provider Business Tools section)

TASK: Create backend/src/models/providerProfile.model.ts with:
1. Business information and verification status
2. Services offered and specializations
3. Location and service areas
4. Instagram-style portfolio with images
5. Ratings and reviews aggregation
6. Earnings and payout tracking
7. Availability schedule
8. Social features (followers, engagement metrics)
9. Analytics data structure

REQUIREMENTS:
- References User model via userId
- Supports document/image uploads
- Handles business verification workflow
- Ready for booking calendar integration
- Includes social media features
- Analytics-ready structure

Implement the complete ProviderProfile model.
```

### STEP 1.4: Service Categories & Database Setup
**PROMPT FOR CLAUDE:**
```
Complete the database foundation with service categories and seeding.

CONTEXT FILES:
- docs/features/auth/DATABASE-SETUP.md (sections: ServiceCategory Model, Database Seeding)

TASK: Create the following files:
1. backend/src/models/serviceCategory.model.ts - Enhanced category model
2. backend/src/config/database.ts - Database connection with health checks
3. backend/src/seeders/categories.seeder.ts - Seed 5 main categories with subcategories
4. backend/src/seeders/admin.seeder.ts - Create super admin user
5. backend/src/seeders/index.ts - Master seeder

REQUIREMENTS:
- ServiceCategory supports subcategories with metadata
- Categories: Beauty, Wellness, Fitness, Home Services, Education
- Each category has 5+ subcategories with pricing/duration data
- Admin seeder creates super admin with all permissions
- Database connection has health monitoring
- All seeders are production-ready

Implement the complete database foundation with seeding.
```

## PHASE 2: BACKEND API IMPLEMENTATION

### STEP 2.1: Authentication Middleware & Security
**PROMPT FOR CLAUDE:**
```
Implement authentication middleware and security layer.

CONTEXT FILES:
- docs/features/auth/BACKEND-IMPLEMENTATION.md (section: Authentication Middleware)
- All database models from Phase 1

TASK: Create backend/src/middleware/auth.middleware.ts with:
1. JWT token validation
2. Role-based access control (customer/provider/admin)
3. Email verification requirements
4. Provider verification status checks
5. Rate limiting for auth endpoints
6. Account status validation
7. Multi-device token management

ADDITIONAL FILES NEEDED:
- backend/src/utils/security.ts - Security utilities
- Token validation helpers
- Password strength validation

REQUIREMENTS:
- Supports refresh token rotation
- Handles account lockout scenarios
- Rate limiting by IP and user
- Proper error responses
- Security headers configuration

Implement complete authentication middleware system.
```

### STEP 2.2: Registration Endpoints
**PROMPT FOR CLAUDE:**
```
Create customer and provider registration endpoints.

CONTEXT FILES:
- docs/features/auth/BACKEND-IMPLEMENTATION.md (section: Auth Controllers)
- All database models and middleware from previous steps

TASK: Create backend/src/controllers/auth.controller.ts with registration methods:

1. CUSTOMER REGISTRATION (/api/auth/register/customer):
   - Simple form processing
   - Create User + CustomerProfile records
   - Generate referral code and initialize loyalty points
   - Send email verification
   - Return JWT token

2. PROVIDER REGISTRATION (/api/auth/register/provider):
   - Multi-step form processing with file uploads
   - Create User + ProviderProfile records  
   - Handle document uploads (identity, business license, portfolio)
   - Set verification status to 'pending'
   - Send verification email
   - Return JWT token

REQUIREMENTS:
- Handles file uploads via multer/cloudinary
- Creates proper database relationships
- Sends appropriate emails
- Proper error handling and validation
- Transaction support for atomicity

Implement both registration endpoints with complete functionality.
```

### STEP 2.3: Login & Authentication Flow
**PROMPT FOR CLAUDE:**
```
Implement login system and token management.

CONTEXT FILES:
- docs/features/auth/BACKEND-IMPLEMENTATION.md (section: Auth Controllers - Login section)
- Existing auth.controller.ts from Step 2.2

TASK: Add to auth.controller.ts:

1. LOGIN ENDPOINT (/api/auth/login):
   - Email/password validation
   - Account lockout after 5 failed attempts
   - JWT + refresh token generation
   - Role-based redirect paths
   - Last login tracking
   - Multi-device support

2. TOKEN MANAGEMENT:
   - /api/auth/me - Get current user with profile
   - /api/auth/refresh-token - Refresh JWT tokens
   - /api/auth/logout - Clear tokens
   - /api/auth/logout-all - Clear all device tokens

3. PASSWORD MANAGEMENT:
   - /api/auth/change-password - Change password
   - /api/auth/forgot-password - Request reset
   - /api/auth/reset-password/:token - Reset with token

REQUIREMENTS:
- Proper security measures (rate limiting, lockout)
- Refresh token rotation
- Device management
- Secure password reset flow
- Role-based response data

Implement complete authentication flow.
```

### STEP 2.4: Email Service & Verification
**PROMPT FOR CLAUDE:**
```
Create email service and verification system.

CONTEXT FILES:
- docs/features/auth/BACKEND-IMPLEMENTATION.md (section: Email Service Implementation)

TASK: Create email system:

1. backend/src/services/email.service.ts:
   - Nodemailer configuration
   - Template rendering with Handlebars
   - Email queue management
   - Error handling and retries

2. EMAIL TEMPLATES (backend/src/templates/email/):
   - email-verification.hbs
   - password-reset.hbs
   - provider-approved.hbs
   - provider-rejected.hbs

3. VERIFICATION ENDPOINTS:
   - /api/auth/verify-email/:token - Verify email
   - /api/auth/resend-verification - Resend verification

REQUIREMENTS:
- Production email service configuration (SendGrid/SMTP)
- Beautiful HTML email templates
- Email template variables
- Verification token security
- Email delivery tracking

Implement complete email verification system.
```

### STEP 2.5: API Routes & Validation
**PROMPT FOR CLAUDE:**
```
Set up API routing and comprehensive validation.

CONTEXT FILES:
- docs/features/auth/BACKEND-IMPLEMENTATION.md (section: Validation Middleware)
- docs/features/auth/ROUTES-AND-ACCESS-CONTROL.md

TASK: Create validation and routing:

1. backend/src/middleware/validation.middleware.ts:
   - Joi validation schemas for all endpoints
   - File upload validation
   - Custom validation rules
   - Error formatting

2. backend/src/routes/auth.routes.ts:
   - All authentication routes
   - Middleware chains (validation, auth, rate limiting)
   - File upload handling
   - Error handling

3. UPDATE backend/src/app.ts:
   - Add auth routes
   - Global error handler
   - CORS configuration
   - Security headers

VALIDATION SCHEMAS NEEDED:
- Customer registration schema
- Provider registration schema  
- Login schema
- Password reset schemas
- File upload validation

REQUIREMENTS:
- Comprehensive input validation
- Proper error responses
- Security middleware chains
- File type/size validation
- API documentation ready

Implement complete API routing with validation.
```

## PHASE 3: FRONTEND IMPLEMENTATION

### STEP 3.1: Authentication Store & API Integration
**PROMPT FOR CLAUDE:**
```
Create frontend state management and API services.

CONTEXT FILES:
- docs/features/auth/FRONTEND-IMPLEMENTATION.md (section: State Management with Zustand)
- Backend API from Phase 2

TASK: Create frontend authentication foundation:

1. frontend/src/stores/authStore.ts:
   - Zustand store with TypeScript
   - Authentication state (user, profile, token, loading, errors)
   - Actions: login, logout, register, getCurrentUser
   - Token persistence and refresh
   - Error handling

2. frontend/src/services/auth.api.ts:
   - All authentication API calls
   - File upload handling
   - Error handling
   - TypeScript interfaces for requests/responses

3. UPDATE frontend/src/services/api.ts:
   - JWT interceptors
   - Automatic token refresh
   - Request/response interceptors
   - Error handling

REQUIREMENTS:
- TypeScript throughout
- Proper error states
- Loading states for UX
- Token persistence
- Automatic token refresh
- API error handling

Implement complete frontend authentication foundation.
```

### STEP 3.2: Protected Routes & Navigation
**PROMPT FOR CLAUDE:**
```
Create route protection and navigation system.

CONTEXT FILES:
- docs/features/auth/FRONTEND-IMPLEMENTATION.md (section: Protected Routes)
- Auth store from Step 3.1

TASK: Create route protection system:

1. frontend/src/components/auth/ProtectedRoute.tsx:
   - Base protected route component
   - Role-based access control
   - Email verification requirements
   - Account status checks
   - Loading states

2. SPECIALIZED ROUTE COMPONENTS:
   - CustomerRoute (customer role only)
   - ProviderRoute (provider + verification required)
   - AdminRoute (admin role only)
   - PublicRoute (redirects authenticated users)

3. UPDATE frontend/src/App.tsx:
   - Route configuration
   - Protected route usage
   - Authentication flow
   - Role-based redirects

REQUIREMENTS:
- TypeScript route props
- Loading states during auth check
- Proper redirects
- URL preservation
- Error boundaries

Implement complete route protection system.
```

### STEP 3.3: Registration Forms
**PROMPT FOR CLAUDE:**
```
Build customer and provider registration forms.

CONTEXT FILES:
- docs/features/auth/FRONTEND-IMPLEMENTATION.md (sections: Customer Registration, Provider Registration)
- Auth store and APIs from previous steps

TASK: Create registration components:

1. frontend/src/components/auth/CustomerRegistration.tsx:
   - Simple registration form
   - React Hook Form + Zod validation
   - Real-time validation
   - Success/error states
   - Email verification flow

2. frontend/src/components/auth/ProviderRegistration.tsx:
   - Multi-step wizard (6 steps)
   - File upload for documents/portfolio
   - Form state persistence
   - Progress indicator
   - Business information collection
   - Service category selection
   - Location selection
   - Document upload
   - Terms acceptance

REQUIREMENTS:
- React Hook Form with TypeScript
- Zod validation schemas
- File upload with preview
- Mobile responsive
- Proper error handling
- Loading states
- Form state persistence

Implement both registration forms with complete functionality.
```

### STEP 3.4: Login & Authentication UI
**PROMPT FOR CLAUDE:**
```
Create login system and authentication UI components.

CONTEXT FILES:
- docs/features/auth/FRONTEND-IMPLEMENTATION.md (sections: Login Component, Password Reset)

TASK: Create authentication UI:

1. frontend/src/components/auth/LoginForm.tsx:
   - Email/password form
   - Remember me functionality
   - Role-based redirect after login
   - Error handling
   - Loading states

2. PASSWORD MANAGEMENT COMPONENTS:
   - frontend/src/components/auth/ForgotPassword.tsx
   - frontend/src/components/auth/ResetPassword.tsx
   - frontend/src/components/auth/ChangePassword.tsx

3. EMAIL VERIFICATION COMPONENTS:
   - frontend/src/components/auth/EmailVerification.tsx
   - frontend/src/components/auth/EmailVerificationRequired.tsx

REQUIREMENTS:
- React Hook Form + Zod
- Proper TypeScript typing
- Mobile responsive design
- Loading and error states
- Success messaging
- Redirect handling

Implement complete authentication UI system.
```

### STEP 3.5: Dashboard Components
**PROMPT FOR CLAUDE:**
```
Create role-specific dashboard layouts.

CONTEXT FILES:
- docs/features/auth/FRONTEND-IMPLEMENTATION.md (section: Dashboard Components)
- docs/features/auth/AUTH-SYSTEM-OVERVIEW.md (dashboard specifications)

TASK: Create dashboard components:

1. frontend/src/components/dashboard/CustomerDashboard.tsx:
   - Welcome section with user info
   - Loyalty points display
   - Recent bookings (placeholder)
   - Favorite providers
   - Quick actions
   - Statistics cards

2. frontend/src/components/dashboard/ProviderDashboard.tsx:
   - Business overview
   - Verification status banner
   - Earnings summary
   - Booking requests (placeholder)
   - Profile analytics
   - Quick actions

3. frontend/src/components/dashboard/AdminDashboard.tsx:
   - Platform statistics
   - User management overview
   - Pending approvals
   - System health
   - Quick admin actions

REQUIREMENTS:
- Responsive grid layouts
- Real data from auth store
- Loading states
- Error boundaries  
- Mobile-first design
- Chart placeholders for future

Implement all three dashboard components.
```

## PHASE 4: INTEGRATION & TESTING

### STEP 4.1: Complete Integration & Setup
**PROMPT FOR CLAUDE:**
```
Connect all components and create setup automation.

CONTEXT FILES:
- docs/features/auth/INTEGRATION-TESTING-GUIDE.md (sections: Environment Setup, Database Integration)
- All components from previous phases

TASK: Complete system integration:

1. ENVIRONMENT SETUP:
   - scripts/setup-dev.sh - Complete development setup
   - Environment validation script
   - Database initialization
   - Dependency installation

2. INTEGRATION FIXES:
   - Fix any CORS issues
   - Ensure all API calls work
   - Test file uploads end-to-end
   - Verify token refresh flows
   - Fix any TypeScript errors

3. DATA FLOW TESTING:
   - Registration → Profile Creation → Email → Login
   - All three user types working
   - File uploads working
   - Email delivery working

REQUIREMENTS:
- One-command development setup
- All features working end-to-end
- No TypeScript/ESLint errors
- Database seeded properly
- Email service configured

Create complete working authentication system.
```

### STEP 4.2: Testing Implementation
**PROMPT FOR CLAUDE:**
```
Implement comprehensive testing suite.

CONTEXT FILES:
- docs/features/auth/INTEGRATION-TESTING-GUIDE.md (all testing sections)
- Complete authentication system from Step 4.1

TASK: Create testing infrastructure:

1. BACKEND TESTING:
   - backend/src/__tests__/models/ - Model tests
   - backend/src/__tests__/controllers/ - API endpoint tests
   - backend/src/__tests__/middleware/ - Middleware tests
   - Integration tests for complete flows

2. FRONTEND TESTING:
   - frontend/src/__tests__/stores/ - Store tests
   - frontend/src/__tests__/components/ - Component tests
   - Mock API responses
   - Form validation tests

3. API TESTING:
   - Postman collection with all endpoints
   - Environment variables setup
   - Test data generation
   - Automated test scripts

4. E2E TESTING (Basic):
   - Registration flow test
   - Login flow test
   - Dashboard access test

REQUIREMENTS:
- Jest + Testing Library setup
- High test coverage (>80%)
- Mock external services
- Test data factories
- CI/CD ready tests

Implement complete testing suite.
```

### STEP 4.3: Documentation & API Specs
**PROMPT FOR CLAUDE:**
```
Create comprehensive documentation and API specifications.

CONTEXT FILES:
- Complete authentication system
- All implemented features

TASK: Generate documentation:

1. API DOCUMENTATION:
   - OpenAPI/Swagger specification
   - All endpoints with examples
   - Request/response schemas
   - Authentication flow diagrams
   - Error code documentation

2. DEVELOPER DOCUMENTATION:
   - Setup and installation guide
   - Environment configuration
   - Database schema documentation
   - Code architecture explanation
   - Troubleshooting guide

3. USER DOCUMENTATION:
   - Registration process guide
   - Admin user management
   - FAQ section
   - Feature overview

4. DEPLOYMENT GUIDE:
   - Production environment setup
   - Environment variables list
   - Database migration guide
   - Monitoring setup

REQUIREMENTS:
- Clear, actionable documentation
- Code examples throughout
- Diagrams for complex flows
- Production deployment ready
- Maintenance procedures

Create complete documentation package.
```

---

## 🎯 IMPLEMENTATION COMMANDS

### For each phase, use this prompt structure:

**INITIALIZATION PROMPT:**
```
I'm implementing the Home Service Platform authentication system following the master implementation plan. 

CURRENT PHASE: [Phase Number and Name]
CURRENT STEP: [Step Number and Name]

CONTEXT FILES PROVIDED:
- [List the specific files you're sharing]

CURRENT PROJECT STATE:
- [Describe what's already implemented]
- [Share relevant existing code]

SPECIFIC TASK:
[Copy the exact task from the step above]

Please implement this step completely, ensuring all requirements are met. Ask questions if anything is unclear.
```

### Progress Tracking Commands:
```
AFTER EACH STEP: "Show me what was implemented and test it briefly"
BEFORE NEXT STEP: "Confirm this step is complete and ready for next step"
IF ISSUES: "Debug this issue and provide solution"
```

---

## 🏆 SUCCESS CRITERIA

**PHASE 1 COMPLETE**: All database models working, seeders populate data
**PHASE 2 COMPLETE**: All API endpoints functional, tested with Postman  
**PHASE 3 COMPLETE**: All UI components working, can register/login in browser
**PHASE 4 COMPLETE**: Full system working end-to-end with tests passing

**FINAL SUCCESS**: 
✅ Customer can register → verify email → login → see dashboard  
✅ Provider can register → upload docs → verify email → login → see dashboard  
✅ Admin can login → see admin dashboard  
✅ All user types protected by proper access control  
✅ System ready for booking, payment, and social features  

**ARCHITECTURE READINESS**:
✅ User model supports loyalty points, social features, B2B fields  
✅ Provider profiles ready for Instagram-style features  
✅ Database structure supports full platform requirements  
✅ APIs designed for mobile app integration  
✅ Testing framework in place for future development  

---

**This is your complete implementation roadmap. Follow each step sequentially with Claude Code, providing the specified context files and prompts for systematic development of the authentication system.**