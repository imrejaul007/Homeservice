# Project Context - NILIN Home Service Marketplace

**Quick Reference for AI Prompts**

---

## What This Project Is

A full-stack home service marketplace connecting customers with service providers (like Thumbtack/Uber for services).

**Core Flow:**
1. Users browse/search services by category
2. Select a provider and book a time slot
3. Provider approves/declines booking
4. Customer pays via Stripe
5. Service is completed, review is left

---

## Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + Zustand |
| Backend | Express.js + TypeScript + MongoDB/Mongoose |
| Auth | JWT (access + refresh tokens) |
| Payments | Stripe |
| Files | Cloudinary |
| Email | Resend + Nodemailer |

---

## User Roles

- **customer** - Browse services, book appointments, leave reviews
- **provider** - List services, manage availability, accept bookings
- **admin** - Approve providers, platform analytics

---

## Key Features

| Feature | Status |
|---------|--------|
| User registration/login (JWT) | ✅ Done |
| Email verification | ✅ Done |
| Category browsing | ✅ Done |
| Service search | ✅ Done |
| Provider profiles | ✅ Done |
| Booking creation/management | ✅ Done |
| Booking status workflow | ✅ Done |
| Stripe payment (test mode) | ⚠️ Partial |
| Email notifications | ⚠️ Templates done |
| Provider approval flow | ✅ Done |
| Loyalty points system | ⚠️ Partial |
| Admin dashboard | ✅ Done |

---

## API Structure

**Base URL:** `/api`

| Prefix | Description |
|--------|-------------|
| `/auth` | Login, register, password reset |
| `/categories` | Service categories |
| `/providers` | Provider profiles (public) |
| `/search` | Service search |
| `/bookings` | Booking CRUD |
| `/provider` | Provider dashboard (protected) |
| `/admin` | Admin operations |

---

## Database Models

- **User** - Core user data, auth, role
- **ProviderProfile** - Provider-specific data, services offered
- **CustomerProfile** - Customer preferences, addresses
- **Service** - Service listings with pricing
- **ServiceCategory** - Categories and subcategories
- **Booking** - Appointments with status tracking
- **Availability** - Provider time slots
- **BookingNotification** - In-app notifications

---

## Frontend Structure

```
src/
├── pages/           # Route pages
├── components/      # UI components
│   ├── auth/        # Login, register forms
│   ├── booking/     # Booking flow components
│   ├── dashboard/   # Role-specific dashboards
│   └── ...
├── services/        # API calls
├── stores/          # Zustand state
└── hooks/           # Custom React hooks
```

---

## Key Files for Reference

| File | Purpose |
|------|---------|
| `backend/src/app.ts` | Express app setup, middleware |
| `backend/src/routes/index.ts` | All API routes |
| `backend/src/models/*.ts` | Database schemas |
| `backend/src/services/auth.service.ts` | Auth business logic |
| `backend/src/services/booking.service.ts` | Booking logic |
| `frontend/src/App.tsx` | React router setup |
| `frontend/src/services/AuthService.ts` | Auth API calls |
| `frontend/src/stores/authStore.ts` | User state |
| `frontend/src/stores/bookingStore.ts` | Booking state |

---

## Environment Variables

**Backend (.env):**
- `MONGODB_URI` - MongoDB Atlas connection
- `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` - JWT keys
- `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` - Stripe
- `CLOUDINARY_*` - Cloudinary config
- `RESEND_API_KEY` - Email sending
- `CLIENT_URL` - Frontend URL for CORS

**Frontend (.env):**
- `VITE_API_URL` - Backend API URL

---

## Current Issues (for debugging)

1. Some `*.backup*` files exist - need cleanup
2. Refactored controllers duplicated - need consolidation
3. `RESEND_API_KEY` not configured - emails won't send in prod
4. Stripe in test mode - need live keys for production

---

## Deployment

- **Backend:** Render Web Service
- **Frontend:** Render Static Site
- **Database:** MongoDB Atlas (M0 free tier)

---

## Need Help With?

Use this context to ask me to:
- Add new features
- Fix bugs
- Implement missing functionality
- Refactor code
- Write tests
- Deploy to production
- Optimize performance
- Add documentation

---

*Version: May 2026*
