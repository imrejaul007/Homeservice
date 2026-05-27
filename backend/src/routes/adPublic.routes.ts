import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getTargetingCategories } from '../controllers/providerAd.controller';
import {
  getPublicAdFeed,
  recordPublicImpression,
  recordPublicClick,
} from '../controllers/adPublic.controller';
import mongoose from 'mongoose';

const router = Router();

const publicAdRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests' },
});

const validateAdId = (req: any, res: any, next: any) => {
  const { id } = req.params;
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ad ID' });
  }
  next();
};

router.use(publicAdRateLimit);

/**
 * GET /api/ads/public/categories
 */
router.get('/categories', getTargetingCategories);

/**
 * GET /api/ads/public/feed?limit=5&category=
 */
router.get('/feed', getPublicAdFeed);

/**
 * POST /api/ads/public/:id/impression
 */
router.post('/:id/impression', validateAdId, recordPublicImpression);

/**
 * POST /api/ads/public/:id/click
 */
router.post('/:id/click', validateAdId, recordPublicClick);

export default router;
