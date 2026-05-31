import { Router } from 'express';
import autoTopupController from '../controllers/autoTopup.controller';
import authMiddleware from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware.authenticate);

// Get auto-topup configuration
router.get('/config', autoTopupController.getConfig);

// Update auto-topup configuration
router.put('/config', autoTopupController.updateConfig);

// Toggle auto-topup on/off
router.post('/toggle', autoTopupController.toggle);

// Get auto-topup transaction history
router.get('/history', autoTopupController.history);

// Preview next auto-topup
router.get('/preview', autoTopupController.preview);

export default router;
