/**
 * AI Monitoring Routes
 *
 * Provides AI-specific health and monitoring endpoints.
 */

import { Router } from 'express';
import {
  getAIHealth,
  getAIDetailedHealth,
  getAlerts,
  evaluateAlerts,
  getAIReadiness,
} from '../controllers/aiMonitoring.controller';

const router = Router();

// Health endpoints
router.get('/health/ai', getAIHealth);
router.get('/health/ai/detailed', getAIDetailedHealth);
router.get('/health/ai/ready', getAIReadiness);

// Alert endpoints
router.get('/alerts', getAlerts);
router.post('/alerts/evaluate', evaluateAlerts);

export default router;
