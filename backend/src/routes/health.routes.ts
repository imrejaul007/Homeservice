import { Router } from 'express';
import { getHealth, getReadiness, getLiveness } from '../controllers/health.controller';

const router = Router();

router.get('/health', getHealth);
router.get('/health/ready', getReadiness);
router.get('/health/live', getLiveness);

export default router;
