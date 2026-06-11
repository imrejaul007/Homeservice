import { Router } from 'express';
import { getTrendingFeed, trackTrendingFeedClick } from '../controllers/home.controller';

const router = Router();

router.get('/trending-feed', getTrendingFeed);
router.post('/trending-feed/:itemId/click', trackTrendingFeedClick);

export default router;
