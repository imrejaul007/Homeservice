import { Router } from 'express';
import customerDashboardController from '../controllers/customerDashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

/**
 * Customer dashboard extras — mounted at /api/dashboard
 * GET /api/dashboard/activity
 * GET /api/dashboard/recommended-pros
 */
const router = Router();

router.get(
  '/activity',
  authenticate,
  customerDashboardController.getActivityFeed
);

router.get(
  '/recommended-pros',
  authenticate,
  customerDashboardController.getRecommendedPros
);

export default router;
