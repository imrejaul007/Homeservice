import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Apply authentication and admin role validation
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  // Get provider ID from authenticated user
  const providerId = (req as any).user?.id;

  // TODO: Fetch real stats from database based on providerId
  // For now, return mock data
  res.json({
    totalEarnings: 0,
    pendingPayout: 0,
    completedBookings: 0,
    avgRating: 0,
    responseRate: 95,
    acceptanceRate: 90,
    qualityScore: 85,
    pendingVerifications: 0,
  });
}));

export default router;
