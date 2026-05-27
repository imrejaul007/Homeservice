import { Router } from 'express';
import streakController from '../controllers/streak.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware.authenticate);

// Get current streak
router.get('/', streakController.getStreakData);

// Check in (record daily streak)
router.post('/checkin', streakController.doCheckIn);

// Get streak history
router.get('/history', streakController.getHistory);

// Get leaderboard
router.get('/leaderboard', streakController.getLeaderboard);

export default router;
