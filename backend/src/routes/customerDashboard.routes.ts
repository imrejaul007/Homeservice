import { Router } from 'express';
import customerDashboardController from '../controllers/customerDashboard.controller';
import { authenticate, generalRateLimit } from '../middleware/auth.middleware';

const router = Router();

/**
 * Customer Dashboard Routes
 *
 * These routes provide data for the customer dashboard including:
 * - Dashboard overview (recent bookings, stats, loyalty, streak)
 * - Service packages listing
 * - Activity feed
 * - Recommended professionals
 */

// ============================================
// Unified Dashboard Routes (All Protected)
// ============================================

// GET /api/customer/dashboard
// Unified dashboard data endpoint - returns recentBookings, upcomingBookings, stats, loyalty, streak
router.get(
  '/dashboard',
  generalRateLimit,
  authenticate,
  customerDashboardController.getDashboard
);

// GET /api/customer/dashboard/stats
// Dashboard statistics only
router.get(
  '/dashboard/stats',
  generalRateLimit,
  authenticate,
  customerDashboardController.getDashboardStats
);

// GET /api/customer/dashboard/loyalty
// Loyalty points data only
router.get(
  '/dashboard/loyalty',
  generalRateLimit,
  authenticate,
  customerDashboardController.getDashboardLoyalty
);

// GET /api/customer/dashboard/streak
// Streak data only
router.get(
  '/dashboard/streak',
  generalRateLimit,
  authenticate,
  customerDashboardController.getDashboardStreak
);

// Packages & /dashboard/recommended-pros live in packages.public.routes.ts
// and dashboard.customer.routes.ts (mounted at /api/dashboard).

export default router;
