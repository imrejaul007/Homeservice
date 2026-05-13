# Home Service Marketplace Platform

A comprehensive platform connecting service providers with customers for home services including beauty, wellness, fitness, and more.

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd home-service-marketplace
```

2. Run the automated setup
```bash
npm run setup
```

3. Configure environment variables
- Update `backend/.env` with your MongoDB URI and API keys
- Update `frontend/.env` with API endpoints

4. Start development servers
```bash
npm run dev
```

### Access Points
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **API Documentation**: http://localhost:5000/api-docs
- **Health Check**: http://localhost:5000/health

## 📁 Project Structure

```
├── backend/          # Express.js + TypeScript API
├── frontend/         # React + Vite + TypeScript
├── docs/             # Documentation
├── scripts/          # Automation scripts
└── package.json      # Root package configuration
```

## 🛠 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Tailwind CSS + Shadcn/ui
- Zustand (State Management)
- TanStack Query
- React Router v6

### Backend  
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- JWT Authentication
- Stripe Payments
- Cloudinary (File Upload)

## 📊 Status Dashboard

The application includes a comprehensive status dashboard that shows:
- Frontend build status
- Backend API connectivity
- Database connection status
- External services health
- Real-time monitoring

Access the dashboard at http://localhost:5173 after starting the development server.

## 🧪 Verification Endpoints

Test the system health with these endpoints:

- `GET /health` - Overall system health
- `GET /api/test` - API connectivity test
- `GET /api/verify/database` - MongoDB connection status
- `GET /api/verify/services` - External services status

## 📝 Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run install:all` - Install all dependencies
- `npm run setup` - Run initial setup script
- `npm run build` - Build both frontend and backend
- `npm run test:integration` - Run integration tests
- `npm run verify` - Verify setup completeness

### Backend
- `npm run dev` - Start backend development server
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run test` - Run backend tests

### Frontend
- `npm run dev` - Start frontend development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run frontend tests

## 🔧 Configuration

### Environment Variables

Create `.env` files based on `.env.example`:

**Backend (.env)**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/marketplace
JWT_SECRET=your-secret-key
# Add other API keys as needed
```

**Frontend (.env)**
```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Home Service Marketplace
```

## 📚 Documentation

- [Requirements](./docs/requirements/Home-Service-Platform-Requirements.md)
- [Tech Stack](./docs/setup/tech-stack-final.md)
- [Setup Guide](./docs/setup/project-setup-guide.md)
- [Development Guide](./docs/development/getting-started.md)

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct and development process.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🆘 Support

For issues and questions:
- Check the [documentation](./docs)
- Run `npm run verify` to check setup
- Open an issue on GitHub

## ✅ Development Checklist

- [ ] Environment setup complete
- [ ] MongoDB connected
- [ ] Backend running on port 5000
- [ ] Frontend running on port 5173
- [ ] Status dashboard shows all green
- [ ] Test endpoints responding

---

## 🔧 TypeScript Build Fixes (May 13, 2026)

### Overview

This document details all TypeScript compilation errors that were resolved to achieve successful builds for both backend and frontend applications.

---

### Backend Fixes

#### 1. `src/controllers/auth.controller.ts` - UserResponse ID Property
**Error:** `Property '_id' does not exist on type 'UserResponse'`  
**Fix:** Changed `result.user._id` to `result.user.id`

#### 2. `src/controllers/review.controller.ts` - Booking Review Reference
**Error:** Property 'review' does not exist on booking document  
**Fix:** Rewrote controller to use `customerReview` field with `(booking as any)` casts

#### 3. `src/controllers/reviews.controller.ts` - New Reviews Controller
**Error:** Missing reviews controller  
**Fix:** Created new controller with proper casts for review property access

#### 4. `src/controllers/customer.controller.ts` - AsyncHandler Return Types
**Error:** Function declared type is neither 'void', 'undefined', 'any'  
**Fix:** Added `Promise<Response>` return types and `return res.json()` statements

```typescript
// Before
const getCustomerProfile = async (req, res) => { ... };

// After
const getCustomerProfile = async (req, res): Promise<Response> => {
  return res.json(...);
};
```

#### 5. `src/controllers/wallet.controller.ts` - Named Import Fix
**Error:** Module has no exported member 'walletService'  
**Fix:** Changed to named imports:
```typescript
import { getOrCreateWallet, debitWallet } from '../services/wallet.service';
```

#### 6. `src/routes/notification.routes.ts` - Promise<Response> Return Types
**Error:** AsyncHandler functions missing return types  
**Fix:** Added return types to all async handler functions

#### 7. `src/routes/review.routes.ts` - Multiple Controllers
**Error:** Review routes using undefined controller  
**Fix:** Updated routes to reference both `reviewController` and `reviewsController`

#### 8. `src/queue/workers.ts` - Null Check Pattern
**Error:** Potential null reference on `loyaltySystem.referralCode`  
**Fix:** Added optional chaining: `loyaltySystem?.referralCode`

#### 9. `src/models/settings.model.ts` - Static Method Type Definition
**Error:** `Property 'getSettings' does not exist on type 'Model<...>'`  
**Fix:** Added `IPlatformSettingsModel` interface:
```typescript
export interface IPlatformSettingsModel extends Model<IPlatformSettings> {
  getSettings(): Promise<IPlatformSettings>;
}
const PlatformSettings = mongoose.model<IPlatformSettings, IPlatformSettingsModel>(...);
```

#### 10. Backend Seeder - Nested Properties
**Error:** `businessName` and `rating` not directly on provider  
**Fix:** Used nested paths: `businessInfo.businessName`, `reviewsData.averageRating`

---

### Frontend Fixes

#### 1. `src/components/common/Input.tsx` - Prefix Property Conflict
**Error:** Property 'prefix' conflicts with React's InputHTMLAttributes  
**Fix:** Added to Omit type:
```typescript
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>
```

#### 2. `src/components/common/Modal.tsx` - Children Required
**Error:** Children prop required but may not be provided  
**Fix:** Made children optional:
```typescript
children?: React.ReactNode;
```

#### 3. `src/components/service/ServiceFAQ.tsx` - Unsupported Props
**Error:** Unknown props `allowMultipleOpen` and `arrowPosition`  
**Fix:** Removed unsupported type definitions

#### 4. `src/pages/HomePage.tsx` - SortBy Option
**Error:** Invalid sort option 'popular'  
**Fix:** Changed to `'popularity'`

#### 5. `src/services/offerService.ts` - API Service Import
**Error:** Module 'apiService' has no exported member  
**Fix:** Changed `apiService` to `api`

#### 6. `src/pages/customer/PaymentMethodsPage.tsx` - Missing Icon
**Error:** `Google` is not a valid Lucide React icon  
**Fix:** Replaced with `CircleDollarSign`

#### 7. `src/pages/customer/FavoritesPage.tsx` - Missing Property
**Error:** Property 'profile' does not exist  
**Fix:** Removed `.profile?.profilePhoto`, using only `.profilePhoto`

#### 8. `src/pages/provider/BookingDetailPage.tsx` - Timeline Event Types
**Error:** Type issues with timeline events  
**Fix:** Added explicit `TimelineEvent` interface with status union type

#### 9. `src/pages/SubcategoryServicePage.tsx` - Missing Prop
**Error:** `providerId` prop missing from ServiceReviews  
**Fix:** Added `providerId={transformedProviders[0]?.id || ''}`

#### 10. `src/components/customer/ProfileSettings.tsx` - Communication Preferences Type
**Error:** Type errors accessing nested properties  
**Fix:** Added `(customerProfile as any)` casts

#### 11. `src/components/customer/ProfileNotifications.tsx` - Toggle Key Parameter
**Error:** Type mismatch with key parameter  
**Fix:** Changed key type to `string` with `as any` cast for dynamic access

---

### Build Verification

| Project | Status | Command |
|---------|--------|---------|
| Backend | **PASSED** | `cd backend && npm run build` |
| Frontend | **PASSED** | `cd frontend && npm run build` |

---

### Files Modified Summary

**Backend (9 files):**
- `src/controllers/auth.controller.ts`
- `src/controllers/review.controller.ts`
- `src/controllers/reviews.controller.ts` (new)
- `src/controllers/customer.controller.ts`
- `src/controllers/wallet.controller.ts`
- `src/routes/notification.routes.ts`
- `src/routes/review.routes.ts`
- `src/queue/workers.ts`
- `src/models/settings.model.ts`

**Frontend (11 files):**
- `src/components/common/Input.tsx`
- `src/components/common/Modal.tsx`
- `src/components/service/ServiceFAQ.tsx`
- `src/pages/HomePage.tsx`
- `src/services/offerService.ts`
- `src/pages/customer/PaymentMethodsPage.tsx`
- `src/pages/customer/FavoritesPage.tsx`
- `src/pages/provider/BookingDetailPage.tsx`
- `src/pages/SubcategoryServicePage.tsx`
- `src/components/customer/ProfileSettings.tsx`
- `src/components/customer/ProfileNotifications.tsx`

---

### Common Patterns

1. **Mongoose Static Methods:** Define in separate interface extending `Model<T>`
2. **AsyncHandler Return Types:** Use `Promise<Response>` and `return` statements
3. **React Input Props:** Use `Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>`
4. **Dynamic Property Access:** Use `as any` casts with string keys
5. **Service Imports:** Use named imports for specific functions

---

Built with ❤️ using modern web technologies