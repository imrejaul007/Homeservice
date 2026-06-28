import { Router } from 'express';
import {
  getTrendingFeed,
  trackTrendingFeedClick,
  getPlatformStats,
  getHeroSlides,
} from '../controllers/home.controller';

const router = Router();

router.get('/stats', getPlatformStats);
router.get('/hero-slides', getHeroSlides);
router.get('/trending-feed', getTrendingFeed);
router.post('/trending-feed/:itemId/click', trackTrendingFeedClick);

export default router;
