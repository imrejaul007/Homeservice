import { Router } from 'express';
import loyaltyController from '../controllers/loyalty.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// ============================================
// Routes (All Protected)
// ============================================

// Get current loyalty status
router.get('/status',
  authMiddleware.authenticate,
  loyaltyController.getLoyaltyStatus
);

// Get points history
router.get('/history',
  authMiddleware.authenticate,
  loyaltyController.getPointsHistory
);

// Get tier benefits (public - no auth required)
router.get('/benefits',
  loyaltyController.getTierBenefits
);

// Redeem points
router.post('/redeem',
  authMiddleware.authenticate,
  loyaltyController.redeemPoints
);

// Expire old points (internal/system endpoint for scheduler)
router.post('/expire-old-points',
  loyaltyController.expireOldPoints
);

export default router;
