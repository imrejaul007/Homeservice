import { Router } from 'express';
import customerDashboardController from '../controllers/customerDashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

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
  authenticate,
  customerDashboardController.getDashboard
);

// GET /api/customer/dashboard/stats
// Dashboard statistics only
router.get(
  '/dashboard/stats',
  authenticate,
  customerDashboardController.getDashboardStats
);

// GET /api/customer/dashboard/loyalty
// Loyalty points data only
router.get(
  '/dashboard/loyalty',
  authenticate,
  customerDashboardController.getDashboardLoyalty
);

// GET /api/customer/dashboard/streak
// Streak data only
router.get(
  '/dashboard/streak',
  authenticate,
  customerDashboardController.getDashboardStreak
);

// ============================================
// Service Packages Routes
// ============================================

// GET /api/packages
// Service packages available for the customer
// Public route - no authentication required for browsing
router.get(
  '/packages',
  customerDashboardController.getPackages
);

// GET /api/packages/:id
// Get a single service package by ID
// Public route - no authentication required
router.get(
  '/packages/:id',
  customerDashboardController.getPackageById
);

// ============================================
// Activity & Recommendations Routes
// ============================================

// GET /api/dashboard/activity
// Recent activity feed (bookings, payments, reviews)
router.get(
  '/dashboard/activity',
  authenticate,
  customerDashboardController.getActivityFeed
);

// GET /api/dashboard/recommended-pros
// Recommended professionals based on user's booking history
router.get(
  '/dashboard/recommended-pros',
  authenticate,
  customerDashboardController.getRecommendedPros
);

export default router;
