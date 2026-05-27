import { Router } from 'express';
import habitController from '../controllers/habit.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

router.use(authMiddleware.authenticate);

// Get all habits and achievements
router.get('/', habitController.getHabits);

// Get weekly challenge
router.get('/weekly', habitController.getWeekly);

// Claim weekly challenge reward
router.post('/claim', habitController.claimWeekly);

// Update progress
router.post('/progress', habitController.updateProgress);

// Unlock achievement
router.post('/unlock', habitController.unlock);

export default router;
